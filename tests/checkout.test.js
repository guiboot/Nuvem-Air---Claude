const test = require('node:test');
const assert = require('node:assert');
const { montarPreferencia } = require('../api/checkout.js');

const catalogo = {
  moeda: 'BRL',
  produtos: {
    NI9PRO: { nome: 'Climatizador Portátil NI9PRO', slug: 'ni9pro', precoCentavos: 249900 },
    NI18:   { nome: 'Climatizador Móvel Big Tank NI18', slug: 'ni18', precoCentavos: 599900 },
    NI23:   { nome: 'Climatizador Móvel Big Tank NI23', slug: 'ni23', precoCentavos: null }
  },
  frete: { faixas: [{ de: '80000000', ate: '87999999', valorCentavos: 15000 }] }
};

const clienteOk = { nome: 'Maria Souza', email: 'maria@empresa.com.br', telefone: '44988117615', documento: '12345678909' };

function corpo(extra) {
  return Object.assign({ itens: [{ sku: 'NI18', qtd: 1 }], cliente: clienteOk, cep: '87050-000', pagamento: 'cartao' }, extra);
}

test('monta a preferência com item e frete separados', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://vendas.nuvemair.com.br');
  assert.strictEqual(r.ok, true);
  const itens = r.preferencia.items;
  assert.strictEqual(itens.length, 2);
  assert.strictEqual(itens[0].title, 'Climatizador Móvel Big Tank NI18');
  assert.strictEqual(itens[0].unit_price, 5999);
  assert.strictEqual(itens[0].quantity, 1);
  assert.strictEqual(itens[1].title, 'Frete');
  assert.strictEqual(itens[1].unit_price, 150);
});

test('preço enviado pelo cliente é ignorado', () => {
  const r = montarPreferencia(catalogo, corpo({ itens: [{ sku: 'NI18', qtd: 1, precoCentavos: 100, unit_price: 1 }] }), 'https://x');
  assert.strictEqual(r.preferencia.items[0].unit_price, 5999);
});

test('CEP fora das faixas não cobra frete e marca a-combinar', () => {
  const r = montarPreferencia(catalogo, corpo({ cep: '69900-000' }), 'https://x');
  assert.strictEqual(r.preferencia.items.length, 1);
  assert.strictEqual(r.preferencia.metadata.frete, 'a-combinar');
});

test('CEP inválido é recusado', () => {
  const r = montarPreferencia(catalogo, corpo({ cep: '123' }), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.match(r.erro, /CEP/i);
});

test('produto sem preço é recusado', () => {
  const r = montarPreferencia(catalogo, corpo({ itens: [{ sku: 'NI23', qtd: 1 }] }), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});

test('SKU inexistente é recusado', () => {
  const r = montarPreferencia(catalogo, corpo({ itens: [{ sku: 'HACK', qtd: 1 }] }), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});

test('carrinho vazio é recusado', () => {
  const r = montarPreferencia(catalogo, corpo({ itens: [] }), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});

test('cliente sem nome, e-mail ou telefone é recusado', () => {
  for (const campo of ['nome', 'email', 'telefone']) {
    const c = Object.assign({}, clienteOk);
    delete c[campo];
    const r = montarPreferencia(catalogo, corpo({ cliente: c }), 'https://x');
    assert.strictEqual(r.ok, false, 'faltando ' + campo);
    assert.strictEqual(r.status, 400);
  }
});

test('e-mail malformado é recusado', () => {
  const r = montarPreferencia(catalogo, corpo({ cliente: Object.assign({}, clienteOk, { email: 'nao-e-email' }) }), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});

test('dados do cliente vão para payer', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://x');
  assert.strictEqual(r.preferencia.payer.email, 'maria@empresa.com.br');
  assert.strictEqual(r.preferencia.payer.name, 'Maria Souza');
});

test('metadata carrega CEP e itens para o painel do MP', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://x');
  assert.strictEqual(r.preferencia.metadata.cep, '87050000');
  assert.strictEqual(r.preferencia.metadata.itens, 'NI18 x1');
});

test('back_urls apontam para as páginas de retorno da loja', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://vendas.nuvemair.com.br');
  assert.strictEqual(r.preferencia.back_urls.success, 'https://vendas.nuvemair.com.br/loja/sucesso');
  assert.strictEqual(r.preferencia.back_urls.pending, 'https://vendas.nuvemair.com.br/loja/pendente');
  assert.strictEqual(r.preferencia.back_urls.failure, 'https://vendas.nuvemair.com.br/loja/erro');
});

test('external_reference é gerado', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://x');
  assert.match(r.preferencia.external_reference, /^NA-/);
});

test('CPF vira identification CPF', () => {
  const r = montarPreferencia(catalogo, corpo(), 'https://x');
  assert.deepStrictEqual(r.preferencia.payer.identification, { type: 'CPF', number: '12345678909' });
});

test('CNPJ vira identification CNPJ', () => {
  const r = montarPreferencia(catalogo, corpo({ cliente: Object.assign({}, clienteOk, { documento: '12.345.678/0001-95' }) }), 'https://x');
  assert.deepStrictEqual(r.preferencia.payer.identification, { type: 'CNPJ', number: '12345678000195' });
});

test('documento ausente não cria identification', () => {
  const c = Object.assign({}, clienteOk);
  delete c.documento;
  const r = montarPreferencia(catalogo, corpo({ cliente: c }), 'https://x');
  assert.strictEqual(r.preferencia.payer.identification, undefined);
  assert.strictEqual(r.preferencia.metadata.documento, 'nao-informado');
});

test('quantidade maior que um multiplica no MP pela quantity, não pelo preço', () => {
  const r = montarPreferencia(catalogo, corpo({ itens: [{ sku: 'NI9PRO', qtd: 3 }] }), 'https://x');
  assert.strictEqual(r.preferencia.items[0].unit_price, 2499);
  assert.strictEqual(r.preferencia.items[0].quantity, 3);
});

test('o preço "de" não vai para o Mercado Pago — cobra-se o "por"', () => {
  const comPromo = JSON.parse(JSON.stringify(catalogo));
  comPromo.produtos.NI18.precoCentavos = 449000;
  comPromo.produtos.NI18.precoDeCentavos = 550000;
  const r = montarPreferencia(comPromo, corpo(), 'https://x');
  assert.strictEqual(r.preferencia.items[0].unit_price, 4490);
  assert.strictEqual(JSON.stringify(r.preferencia).includes('5500'), false);
});

/* ---------- Pagamento: Pix com desconto vs. cartão ---------- */

const catPag = {
  moeda: 'BRL',
  descontoPixPercentual: 5,
  parcelamentoMax: 4,
  produtos: { NI18: { nome: 'NI18', slug: 'ni18', precoCentavos: 449000 } },
  frete: { faixas: [{ de: '80000000', ate: '87999999', valorCentavos: 15000 }] }
};
function corpoPag(pagamento, extra) {
  return Object.assign({ itens: [{ sku: 'NI18', qtd: 1 }], cliente: clienteOk, cep: '87050-000', pagamento }, extra);
}

test('Pix: cobra com desconto e restringe o checkout ao Pix', () => {
  const r = montarPreferencia(catPag, corpoPag('pix'), 'https://x');
  assert.strictEqual(r.ok, true);
  const produto = r.preferencia.items.find((i) => i.id === 'NI18');
  assert.strictEqual(produto.unit_price, 4265.5);
  const tipos = r.preferencia.payment_methods.excluded_payment_types.map((t) => t.id).sort();
  assert.deepStrictEqual(tipos, ['credit_card', 'debit_card', 'ticket']);
  assert.strictEqual(r.preferencia.metadata.pagamento, 'pix');
});

test('cartão: cobra o valor cheio e não oferece Pix', () => {
  const r = montarPreferencia(catPag, corpoPag('cartao'), 'https://x');
  const produto = r.preferencia.items.find((i) => i.id === 'NI18');
  assert.strictEqual(produto.unit_price, 4490);
  assert.deepStrictEqual(r.preferencia.payment_methods.excluded_payment_types.map((t) => t.id), ['bank_transfer']);
});

test('cartão: limita as parcelas ao configurado', () => {
  const r = montarPreferencia(catPag, corpoPag('cartao'), 'https://x');
  assert.strictEqual(r.preferencia.payment_methods.installments, 4);
});

test('o desconto do Pix não incide sobre o frete', () => {
  const r = montarPreferencia(catPag, corpoPag('pix'), 'https://x');
  const frete = r.preferencia.items.find((i) => i.id === 'FRETE');
  assert.strictEqual(frete.unit_price, 150);
});

test('método de pagamento desconhecido é recusado', () => {
  const r = montarPreferencia(catPag, corpoPag('bitcoin'), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});

test('sem método informado é recusado — não dá para escolher por ele', () => {
  const r = montarPreferencia(catPag, corpoPag(undefined), 'https://x');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
});
