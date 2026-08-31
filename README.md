# Brasil dos Nossos Sonhos — Explorador do Plano

Site simples que responde perguntas sobre o conteúdo do plano de governo
"Brasil dos Nossos Sonhos", com base no PDF original. As respostas são
geradas por IA a partir de trechos do documento — o site deixa claro que
não é o autor respondendo.

## Estrutura

```
index.html              → página principal
style.css                → estilo
script.js                → frontend (captura a pergunta, chama a API)
api/perguntar.js         → Vercel Function: busca trechos + chama a API da Anthropic
data/base_conhecimento.json → trechos do documento (substitua pelo seu, veja LEIA-ME.txt)
```

## Passo a passo para publicar

### 1. Preparar os dados
Troque `data/LEIA-ME.txt` pelo arquivo `base_conhecimento.json` que você
baixou do notebook Kaggle. O nome do arquivo deve ficar exatamente
`data/base_conhecimento.json`.

### 2. Subir para o GitHub
```bash
cd plano-brasil-sonhos
git init
git add .
git commit -m "primeira versão do site"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/plano-brasil-sonhos.git
git push -u origin main
```

### 3. Publicar na Vercel
1. Acesse vercel.com e clique em "Add New Project"
2. Importe o repositório que você acabou de subir no GitHub
3. Antes de publicar, adicione a variável de ambiente:
   - Nome: `GEMINI_API_KEY`
   - Valor: sua chave da API do Gemini (crie em aistudio.google.com/apikey)
   (Vercel → Settings → Environment Variables)
4. Clique em "Deploy"

Pronto — a Vercel te dá uma URL pública (algo como
`plano-brasil-sonhos.vercel.app`) e qualquer novo `git push` no GitHub
atualiza o site automaticamente.

## Como funciona a busca

O site não usa os embeddings gerados no Python (eles ficam no JSON, mas
sem uso). Em vez disso, a Vercel Function (`api/perguntar.js`) faz uma
busca por relevância de palavras-chave nos trechos do documento — mais
simples de rodar em ambiente serverless, sem precisar carregar nenhum
modelo de IA no servidor. Só a geração da resposta final usa IA (a API
do Gemini).

## Trocar o modelo usado

Em `api/perguntar.js`, a variável `modeloGemini` está definida como
`gemini-2.5-flash`. Você pode trocar por outro modelo Gemini disponível
na sua conta, se quiser.
