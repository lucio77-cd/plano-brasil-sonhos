const campoPergunta = document.getElementById('campo-pergunta');
const botaoPerguntar = document.getElementById('botao-perguntar');
const areaResposta = document.getElementById('area-resposta');
const carregando = document.getElementById('carregando');
const respostaTexto = document.getElementById('resposta-texto');
const trechosCitados = document.getElementById('trechos-citados');
const historico = document.getElementById('historico');
const chips = document.querySelectorAll('.chip');

async function perguntar(pergunta) {
  if (!pergunta || !pergunta.trim()) return;

  areaResposta.hidden = false;
  carregando.hidden = false;
  respostaTexto.textContent = '';
  trechosCitados.innerHTML = '';
  botaoPerguntar.disabled = true;

  areaResposta.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const resposta = await fetch('/api/perguntar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta })
    });

    if (!resposta.ok) {
      throw new Error(`Erro do servidor: ${resposta.status}`);
    }

    const dados = await resposta.json();

    carregando.hidden = true;
    respostaTexto.textContent = dados.resposta;

    if (dados.trechos && dados.trechos.length > 0) {
      const titulo = document.createElement('h3');
      titulo.textContent = 'Trechos do documento usados nesta resposta';
      trechosCitados.appendChild(titulo);

      dados.trechos.forEach((trecho) => {
        const div = document.createElement('div');
        div.className = 'trecho';
        div.textContent = trecho;
        trechosCitados.appendChild(div);
      });
    }

    adicionarAoHistorico(pergunta, dados.resposta);

  } catch (erro) {
    carregando.hidden = true;
    respostaTexto.textContent = 'Não foi possível obter uma resposta agora. Tente novamente em instantes.';
    console.error(erro);
  } finally {
    botaoPerguntar.disabled = false;
  }
}

function adicionarAoHistorico(pergunta, resposta) {
  const item = document.createElement('div');
  item.className = 'item-historico';

  const tituloPergunta = document.createElement('p');
  tituloPergunta.className = 'pergunta-feita';
  tituloPergunta.textContent = pergunta;

  const corpoResposta = document.createElement('p');
  corpoResposta.textContent = resposta;

  item.appendChild(tituloPergunta);
  item.appendChild(corpoResposta);
  historico.prepend(item);
}

botaoPerguntar.addEventListener('click', () => {
  perguntar(campoPergunta.value);
  campoPergunta.value = '';
});

campoPergunta.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') {
    perguntar(campoPergunta.value);
    campoPergunta.value = '';
  }
});

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const pergunta = chip.dataset.pergunta;
    campoPergunta.value = pergunta;
    perguntar(pergunta);
    campoPergunta.value = '';
  });
});
