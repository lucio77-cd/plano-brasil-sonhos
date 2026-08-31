// api/perguntar.js
// Vercel Function (Node.js runtime). Recebe uma pergunta, busca os trechos
// mais relevantes do plano de governo (TF-IDF simples, sem dependências
// externas) e pede ao modelo da Anthropic para responder com base neles.

const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'a','o','e','de','do','da','em','um','uma','os','as','dos','das','no','na',
  'nos','nas','para','com','por','que','se','é','sua','seu','suas','seus',
  'ao','aos','à','às','como','mais','mas','ou','já','também','muito','pode',
  'foi','são','ser','está','estão','isso','este','esta','esse','essa','pelo',
  'pela','entre','sobre','quando','onde','qual','quais','não',
  // termos que aparecem tanto no documento que não ajudam a diferenciar trechos
  'brasil','brasileira','brasileiro','sonhos','plano','projeto','projetos',
  'governo','nacional','nossa','nosso'
]);

function pareceSumario(chunk) {
  // Trechos de sumário/índice têm muitas sequências de pontos (".......")
  // ou números de página soltos — não ajudam a responder perguntas.
  const pontosSeguidos = (chunk.match(/\.{4,}/g) || []).length;
  return pontosSeguidos >= 2;
}

let baseCache = null;

function carregarBase() {
  if (baseCache) return baseCache;
  const caminho = path.join(process.cwd(), 'data', 'base_conhecimento.json');
  const conteudo = fs.readFileSync(caminho, 'utf-8');
  const dados = JSON.parse(conteudo);
  baseCache = dados.chunks; // só usamos o texto; embeddings do Python ficam sem uso aqui
  return baseCache;
}

function tokenizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos p/ comparar
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2 && !STOPWORDS.has(palavra));
}

function buscarTrechosRelevantes(pergunta, chunks, topK = 4) {
  const termosPergunta = tokenizar(pergunta);
  const chunksValidos = chunks.filter((chunk) => !pareceSumario(chunk));

  if (termosPergunta.length === 0) return chunksValidos.slice(0, topK);

  const pontuacoes = chunksValidos.map((chunk, indice) => {
    const termosChunk = tokenizar(chunk);
    const frequencias = {};
    termosChunk.forEach((t) => { frequencias[t] = (frequencias[t] || 0) + 1; });

    let pontuacao = 0;
    termosPergunta.forEach((termo) => {
      if (frequencias[termo]) {
        pontuacao += frequencias[termo] / termosChunk.length;
      }
    });

    return { indice, pontuacao };
  });

  pontuacoes.sort((a, b) => b.pontuacao - a.pontuacao);

  return pontuacoes
    .slice(0, topK)
    .filter((p) => p.pontuacao > 0)
    .map((p) => chunksValidos[p.indice]);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Use POST.' });
    return;
  }

  const { pergunta } = req.body || {};

  if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    res.status(400).json({ erro: 'Envie uma pergunta.' });
    return;
  }

  try {
    const chunks = carregarBase();
    const trechos = buscarTrechosRelevantes(pergunta, chunks, 4);

    const contexto = trechos.length > 0
      ? trechos.map((t, i) => `Trecho ${i + 1}:\n${t}`).join('\n\n')
      : 'Nenhum trecho suficientemente relevante foi encontrado no documento.';

    const promptSistema = `Você é um assistente que explica o conteúdo do plano de governo "Brasil dos Nossos Sonhos" com base apenas nos trechos fornecidos abaixo.

Regras:
- Responda APENAS com base nos trechos fornecidos. Se a resposta não estiver neles, diga que o trecho consultado não cobre esse ponto e sugira reformular a pergunta.
- Deixe claro que você é uma IA lendo o documento, nunca fale como se fosse o autor em primeira pessoa.
- Seja direto e objetivo, em português, em no máximo 3 parágrafos curtos.

Trechos do documento:
${contexto}`;

    const modeloGemini = 'gemini-3.6-flash';
    const respostaAPI = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modeloGemini}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: promptSistema }]
          },
          contents: [
            { role: 'user', parts: [{ text: pergunta }] }
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: 'low' }
          }
        })
      }
    );

    if (!respostaAPI.ok) {
      const detalhe = await respostaAPI.text();
      console.error('Erro da API Gemini:', detalhe);
      res.status(502).json({ erro: 'Erro ao consultar o modelo.' });
      return;
    }

    const dadosAPI = await respostaAPI.json();
    const textoResposta = (dadosAPI.candidates?.[0]?.content?.parts || [])
      .map((parte) => parte.text || '')
      .join('\n')
      .trim() || 'Não foi possível gerar uma resposta a partir deste trecho.';

    res.status(200).json({
      resposta: textoResposta,
      trechos: trechos.map((t) => t.slice(0, 400) + (t.length > 400 ? '…' : ''))
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno ao processar a pergunta.' });
  }
};
