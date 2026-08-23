/* Cria a preferência de pagamento no Mercado Pago.

   Regra que não pode ser quebrada: nenhum valor monetário vindo do
   navegador é usado. O corpo da requisição contribui apenas com sku,
   quantidade, CEP e dados de contato — todo o resto é recalculado aqui
   a partir de loja/catalogo.json. Sem isso, qualquer pessoa edita o
   localStorage e compra um NI23 por R$ 0,01. */
const fs = require('node:fs');
const path = require('node:path');
const core = require('../loja/assets/js/loja-core.js');

const MP_API = 'https://api.mercadopago.com/checkout/preferences';

function carregarCatalogo() {
  const arquivo = path.join(process.cwd(), 'loja', 'catalogo.json');
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

function emailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarCliente(cliente) {
  const c = cliente || {};
  if (!c.nome || String(c.nome).trim().length < 2) return 'Informe o nome completo.';
  if (!emailValido(c.email)) return 'Informe um e-mail válido.';
  if (!c.telefone || String(c.telefone).replace(/\D/g, '').length < 10) return 'Informe um telefone válido com DDD.';
  return null;
}

function referencia(itens) {
  const assinatura = itens.map((i) => i.sku + 'x' + i.qtd).join('_');
  return 'NA-' + Date.now().toString(36).toUpperCase() + '-' + assinatura;
}

const PAGAMENTOS = ['pix', 'cartao'];

function montarPreferencia(catalogo, corpo, origem) {
  const body = corpo || {};

  /* O método de pagamento é obrigatório porque o preço depende dele: no Pix
     o cliente viu um valor com desconto na vitrine, e é esse que tem de ser
     cobrado. Sem saber o método não dá para montar a preferência. */
  const pagamento = body.pagamento;
  if (PAGAMENTOS.indexOf(pagamento) === -1) {
    return { ok: false, status: 400, erro: 'Escolha como quer pagar: Pix ou cartão.' };
  }

  const erroCliente = validarCliente(body.cliente);
  if (erroCliente) return { ok: false, status: 400, erro: erroCliente };

  const validacao = core.validarItens(catalogo, body.itens);
  if (!validacao.ok) return { ok: false, status: 400, erro: validacao.erro };
  const itens = validacao.itens;

  const frete = core.resolverFrete(catalogo, body.cep);
  if (frete.tipo === 'cep-invalido') return { ok: false, status: 400, erro: 'Informe um CEP válido com 8 dígitos.' };

  const items = itens.map((item) => {
    const p = core.produto(catalogo, item.sku);
    const pix = core.precoPixCentavos(catalogo, item.sku);
    const centavos = pagamento === 'pix' && pix !== null ? pix : p.precoCentavos;
    return {
      id: item.sku,
      title: p.nome,
      quantity: item.qtd,
      currency_id: 'BRL',
      unit_price: centavos / 100
    };
  });

  if (frete.tipo === 'fixo' && frete.valorCentavos > 0) {
    items.push({ id: 'FRETE', title: 'Frete', quantity: 1, currency_id: 'BRL', unit_price: frete.valorCentavos / 100 });
  }

  const cliente = body.cliente;
  const documento = String(cliente.documento || '').replace(/\D/g, '');
  const telefone = String(cliente.telefone).replace(/\D/g, '');

  const preferencia = {
    items: items,
    payer: {
      name: String(cliente.nome).trim(),
      email: cliente.email,
      phone: { area_code: telefone.slice(0, 2), number: telefone.slice(2) }
    },
    back_urls: {
      success: origem + '/loja/sucesso',
      pending: origem + '/loja/pendente',
      failure: origem + '/loja/erro'
    },
    auto_return: 'approved',
    statement_descriptor: 'NUVEMAIR',
    external_reference: referencia(itens),
    /* Restringir o método no próprio checkout é o que impede o cliente de
       pegar o preço com desconto do Pix e finalizar no cartão. */
    payment_methods: pagamento === 'pix'
      ? { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }] }
      : { excluded_payment_types: [{ id: 'bank_transfer' }],
          installments: (typeof catalogo.parcelamentoMax === 'number' && catalogo.parcelamentoMax >= 2)
            ? catalogo.parcelamentoMax : 1 },
    /* O painel do Mercado Pago é a lista de pedidos: sem banco de dados,
       é aqui que a Nuvem Air lê CEP, itens e situação do frete. */
    metadata: {
      cep: core.normalizarCep(body.cep),
      itens: itens.map((i) => i.sku + ' x' + i.qtd).join(', '),
      frete: frete.tipo === 'fixo' ? core.formatarBRL(frete.valorCentavos) : 'a-combinar',
      pagamento: pagamento,
      documento: documento || 'nao-informado'
    }
  };

  if (documento.length === 11 || documento.length === 14) {
    preferencia.payer.identification = { type: documento.length === 11 ? 'CPF' : 'CNPJ', number: documento };
  }

  return { ok: true, preferencia: preferencia };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    res.status(500).json({ erro: 'Pagamento indisponível no momento. Fale com a gente pelo WhatsApp.' });
    return;
  }

  let catalogo;
  try {
    catalogo = carregarCatalogo();
  } catch (e) {
    res.status(500).json({ erro: 'Não foi possível carregar o catálogo.' });
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origem = proto + '://' + req.headers.host;

  const montada = montarPreferencia(catalogo, req.body, origem);
  if (!montada.ok) {
    res.status(montada.status).json({ erro: montada.erro });
    return;
  }

  try {
    const resposta = await fetch(MP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(montada.preferencia)
    });
    if (!resposta.ok) {
      /* Nunca ecoar o corpo da resposta nem o token no log. */
      console.error('Mercado Pago recusou a preferência:', resposta.status);
      res.status(502).json({ erro: 'Não foi possível iniciar o pagamento. Tente novamente.' });
      return;
    }
    const dados = await resposta.json();
    res.status(200).json({ url: dados.init_point });
  } catch (e) {
    console.error('Falha ao falar com o Mercado Pago:', e.message);
    res.status(502).json({ erro: 'Não foi possível iniciar o pagamento. Tente novamente.' });
  }
};

module.exports.montarPreferencia = montarPreferencia;
