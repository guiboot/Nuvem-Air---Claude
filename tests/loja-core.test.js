const test = require('node:test');
const assert = require('node:assert');
const core = require('../loja/assets/js/loja-core.js');

const catalogo = {
  moeda: 'BRL',
  produtos: {
    NI9PRO: { nome: 'Climatizador Portátil NI9PRO', slug: 'ni9pro', precoCentavos: 249900 },
    NI18:   { nome: 'Climatizador Móvel Big Tank NI18', slug: 'ni18', precoCentavos: 599900 },
    NI23:   { nome: 'Climatizador Móvel Big Tank NI23', slug: 'ni23', precoCentavos: null }
  },
  frete: {
    faixas: [
      { de: '80000000', ate: '87999999', valorCentavos: 15000 },
      { de: '01000000', ate: '19999999', valorCentavos: 28000 }
    ]
  }
};

test('formatarBRL formata centavos em real', () => {
  assert.strictEqual(core.formatarBRL(249900), 'R$ 2.499,00');
  assert.strictEqual(core.formatarBRL(0), 'R$ 0,00');
  assert.strictEqual(core.formatarBRL(50), 'R$ 0,50');
});

test('formatarBRL devolve "Sob consulta" quando não há preço', () => {
  assert.strictEqual(core.formatarBRL(null), 'Sob consulta');
});

test('subtotalCentavos soma preço do catálogo vezes quantidade', () => {
  const itens = [{ sku: 'NI9PRO', qtd: 2 }, { sku: 'NI18', qtd: 1 }];
  assert.strictEqual(core.subtotalCentavos(catalogo, itens), 249900 * 2 + 599900);
});

test('subtotalCentavos ignora preço enviado pelo cliente', () => {
  const itens = [{ sku: 'NI9PRO', qtd: 1, precoCentavos: 100 }];
  assert.strictEqual(core.subtotalCentavos(catalogo, itens), 249900);
});

test('temPrecoDefinido é falso para produto sem preço', () => {
  assert.strictEqual(core.temPrecoDefinido(catalogo, 'NI9PRO'), true);
  assert.strictEqual(core.temPrecoDefinido(catalogo, 'NI23'), false);
});

test('normalizarCep aceita com e sem máscara', () => {
  assert.strictEqual(core.normalizarCep('87050-000'), '87050000');
  assert.strictEqual(core.normalizarCep('87050000'), '87050000');
  assert.strictEqual(core.normalizarCep(' 87050 000 '), '87050000');
});

test('normalizarCep rejeita CEP inválido', () => {
  assert.strictEqual(core.normalizarCep('123'), null);
  assert.strictEqual(core.normalizarCep('abcdefgh'), null);
  assert.strictEqual(core.normalizarCep(''), null);
});

test('resolverFrete acha a faixa do CEP', () => {
  assert.deepStrictEqual(core.resolverFrete(catalogo, '87050-000'), { tipo: 'fixo', valorCentavos: 15000 });
  assert.deepStrictEqual(core.resolverFrete(catalogo, '01310100'), { tipo: 'fixo', valorCentavos: 28000 });
});

test('resolverFrete devolve a-combinar fora das faixas', () => {
  assert.deepStrictEqual(core.resolverFrete(catalogo, '69900-000'), { tipo: 'a-combinar' });
});

test('resolverFrete devolve cep-invalido para CEP malformado', () => {
  assert.deepStrictEqual(core.resolverFrete(catalogo, '123'), { tipo: 'cep-invalido' });
});

test('validarItens rejeita SKU desconhecido', () => {
  const r = core.validarItens(catalogo, [{ sku: 'NAO_EXISTE', qtd: 1 }]);
  assert.strictEqual(r.ok, false);
  assert.match(r.erro, /NAO_EXISTE/);
});

test('validarItens rejeita produto sem preço definido', () => {
  const r = core.validarItens(catalogo, [{ sku: 'NI23', qtd: 1 }]);
  assert.strictEqual(r.ok, false);
  assert.match(r.erro, /sem preço/i);
});

test('validarItens rejeita quantidade inválida', () => {
  assert.strictEqual(core.validarItens(catalogo, [{ sku: 'NI18', qtd: 0 }]).ok, false);
  assert.strictEqual(core.validarItens(catalogo, [{ sku: 'NI18', qtd: -1 }]).ok, false);
  assert.strictEqual(core.validarItens(catalogo, [{ sku: 'NI18', qtd: 1.5 }]).ok, false);
  assert.strictEqual(core.validarItens(catalogo, [{ sku: 'NI18', qtd: 100 }]).ok, false);
});

test('validarItens rejeita carrinho vazio', () => {
  assert.strictEqual(core.validarItens(catalogo, []).ok, false);
});

test('validarItens devolve itens limpos, só sku e qtd', () => {
  const r = core.validarItens(catalogo, [{ sku: 'NI18', qtd: 2, precoCentavos: 1 }]);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.itens, [{ sku: 'NI18', qtd: 2 }]);
});

/* ---------- Preço "de / por" ---------- */

const catalogoPromo = {
  moeda: 'BRL',
  produtos: {
    NI18:   { nome: 'NI18', slug: 'ni18', precoCentavos: 449000, precoDeCentavos: 550000 },
    SEMDE:  { nome: 'Sem de', slug: 'semde', precoCentavos: 100000 },
    IGUAL:  { nome: 'Igual', slug: 'igual', precoCentavos: 100000, precoDeCentavos: 100000 },
    MENOR:  { nome: 'Menor', slug: 'menor', precoCentavos: 100000, precoDeCentavos: 90000 }
  },
  frete: { faixas: [] }
};

test('descontoPercentual calcula o abatimento', () => {
  assert.strictEqual(core.descontoPercentual(catalogoPromo, 'NI18'), 18);
});

test('descontoPercentual é nulo sem preço "de"', () => {
  assert.strictEqual(core.descontoPercentual(catalogoPromo, 'SEMDE'), null);
});

test('descontoPercentual é nulo quando o "de" não é maior que o "por"', () => {
  assert.strictEqual(core.descontoPercentual(catalogoPromo, 'IGUAL'), null);
  assert.strictEqual(core.descontoPercentual(catalogoPromo, 'MENOR'), null);
});

test('o preço "de" nunca entra na conta — cobra-se o "por"', () => {
  assert.strictEqual(core.subtotalCentavos(catalogoPromo, [{ sku: 'NI18', qtd: 2 }]), 898000);
});

/* ---------- Pix e parcelamento ---------- */

const catalogoPag = {
  moeda: 'BRL',
  descontoPixPercentual: 5,
  parcelamentoMax: 4,
  produtos: {
    A: { nome: 'A', slug: 'a', precoCentavos: 420000 },
    B: { nome: 'B', slug: 'b', precoCentavos: 449000 },
    SEM: { nome: 'Sem', slug: 'sem', precoCentavos: null }
  },
  frete: { faixas: [] }
};
const semPix = { moeda: 'BRL', produtos: { A: { nome: 'A', precoCentavos: 420000 } }, frete: { faixas: [] } };

test('precoPixCentavos aplica o desconto', () => {
  assert.strictEqual(core.precoPixCentavos(catalogoPag, 'A'), 399000);
  assert.strictEqual(core.precoPixCentavos(catalogoPag, 'B'), 426550);
});

test('precoPixCentavos é nulo sem desconto configurado ou sem preço', () => {
  assert.strictEqual(core.precoPixCentavos(semPix, 'A'), null);
  assert.strictEqual(core.precoPixCentavos(catalogoPag, 'SEM'), null);
});

test('parcelaCentavos divide pelo número de parcelas, arredondando pra cima', () => {
  assert.strictEqual(core.parcelaCentavos(catalogoPag, 'A'), 105000);
  assert.strictEqual(core.parcelaCentavos(catalogoPag, 'B'), 112250);
});

test('parcelaCentavos é nulo sem parcelamento configurado', () => {
  assert.strictEqual(core.parcelaCentavos(semPix, 'A'), null);
});

test('descontoPixCentavos incide sobre o valor informado', () => {
  assert.strictEqual(core.descontoPixCentavos(catalogoPag, 869000), 43450);
  assert.strictEqual(core.descontoPixCentavos(semPix, 869000), 0);
});

test('o desconto do Pix não altera o subtotal cheio', () => {
  assert.strictEqual(core.subtotalCentavos(catalogoPag, [{ sku: 'A', qtd: 1 }, { sku: 'B', qtd: 1 }]), 869000);
});

test('totalCentavos soma frete e só desconta o Pix quando o pagamento é Pix', () => {
  const itens = [{ sku: 'A', qtd: 1 }];
  assert.deepStrictEqual(core.totalCentavos(catalogoPag, itens, 15000, 'pix'),
    { subtotal: 420000, frete: 15000, desconto: 21000, total: 414000 });
  assert.deepStrictEqual(core.totalCentavos(catalogoPag, itens, 15000, 'cartao'),
    { subtotal: 420000, frete: 15000, desconto: 0, total: 435000 });
});

test('o desconto do Pix não incide sobre o frete', () => {
  const r = core.totalCentavos(catalogoPag, [{ sku: 'A', qtd: 1 }], 100000, 'pix');
  assert.strictEqual(r.desconto, 21000);
  assert.strictEqual(r.total, 420000 - 21000 + 100000);
});
