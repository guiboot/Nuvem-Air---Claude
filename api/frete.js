/* Cotação de frete para o carrinho e para a página de produto.

   Recebe { cep, itens: [{ sku, qtd }] } e devolve as opções das
   transportadoras do Melhor Envio, mais barata primeiro. Quando não dá para
   cotar (sem token, produto sem caixa cadastrada, API fora), responde
   { tipo: 'a-combinar' } e a loja segue vendendo com frete a combinar. */
const fs = require('node:fs');
const path = require('node:path');
const core = require('../loja/assets/js/loja-core.js');
const melhorEnvio = require('./_melhor-envio.js');

function carregarCatalogo() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'loja', 'catalogo.json'), 'utf8'));
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  let catalogo;
  try {
    catalogo = carregarCatalogo();
  } catch (e) {
    res.status(500).json({ erro: 'Não foi possível carregar o catálogo.' });
    return;
  }

  const body = req.body || {};
  const validacao = core.validarItens(catalogo, body.itens);
  if (!validacao.ok) {
    res.status(400).json({ erro: validacao.erro });
    return;
  }

  const r = await melhorEnvio.cotar({ catalogo, itens: validacao.itens, cep: body.cep });
  if (r.tipo === 'cep-invalido') {
    res.status(400).json({ erro: 'Informe um CEP válido com 8 dígitos.' });
    return;
  }
  /* O motivo interno (token, caixa faltando) não vai para o navegador. */
  res.status(200).json(r.tipo === 'cotado' ? r : { tipo: 'a-combinar' });
};
