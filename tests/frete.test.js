const test = require('node:test');
const assert = require('node:assert');
const { cotar, montarVolumes, normalizarOpcoes } = require('../api/_melhor-envio.js');
const { montarPreferencia } = require('../api/checkout.js');

const catalogo = {
  categorias: { portateis: {} },
  frete: { cepOrigem: '87050-000', faixas: [] },
  produtos: {
    NU18: { nome: 'NU18', categoria: 'portateis', precoCentavos: 449000,
      embalagem: { larguraCm: 70, alturaCm: 150, comprimentoCm: 60, pesoKg: 34 } },
    NU9PRO: { nome: 'NU9PRO', categoria: 'portateis', precoCentavos: 420000 }
  }
};
const env = { MELHOR_ENVIO_TOKEN: 'tok', MELHOR_ENVIO_USER_AGENT: 'Loja (contato@exemplo.com)' };

const RESPOSTA = [
  { id: 3, name: '.Package', price: '310.50', custom_price: '320.00', delivery_time: 6, custom_delivery_time: 8, company: { name: 'Jadlog', picture: 'https://x/jadlog.png' } },
  { id: 1, name: 'PAC', error: 'Dimensões excedidas', company: { name: 'Correios' } },
  { id: 17, name: 'Amanhã', price: '280.10', delivery_time: 4, company: { name: 'Azul Cargo Express' } }
];

function fetchFalso(resposta, registro) {
  return async (url, opts) => {
    if (registro) registro.push({ url, opts });
    return { ok: true, json: async () => resposta };
  };
}

test('monta os volumes com a caixa e o valor declarado de cada produto', () => {
  const r = montarVolumes(catalogo, [{ sku: 'NU18', qtd: 2 }]);
  assert.deepStrictEqual(r.produtos[0], { id: 'NU18', width: 70, height: 150, length: 60, weight: 34, insurance_value: 4490, quantity: 2 });
});

test('produto sem caixa cadastrada impede a cotação', () => {
  const r = montarVolumes(catalogo, [{ sku: 'NU18', qtd: 1 }, { sku: 'NU9PRO', qtd: 1 }]);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.faltando, ['NU9PRO']);
});

test('descarta serviços com erro, usa o preço ajustado e ordena do mais barato', () => {
  const o = normalizarOpcoes(RESPOSTA);
  assert.deepStrictEqual(o.map((x) => x.id), ['17', '3']);
  assert.strictEqual(o[1].precoCentavos, 32000);
  assert.strictEqual(o[1].prazoDias, 8);
  assert.strictEqual(o[0].transportadora, 'Azul Cargo Express');
});

test('cota no Melhor Envio com token, User-Agent e CEPs', async () => {
  const chamadas = [];
  const r = await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '01310-100', env, fetchFn: fetchFalso(RESPOSTA, chamadas) });
  assert.strictEqual(r.tipo, 'cotado');
  assert.strictEqual(r.opcoes.length, 2);
  const { url, opts } = chamadas[0];
  assert.match(url, /^https:\/\/melhorenvio\.com\.br\//);
  assert.strictEqual(opts.headers.Authorization, 'Bearer tok');
  assert.strictEqual(opts.headers['User-Agent'], env.MELHOR_ENVIO_USER_AGENT);
  const corpo = JSON.parse(opts.body);
  assert.strictEqual(corpo.from.postal_code, '87050000');
  assert.strictEqual(corpo.to.postal_code, '01310100');
});

test('sandbox usa o endereço de testes', async () => {
  const chamadas = [];
  await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '01310100', env: Object.assign({ MELHOR_ENVIO_SANDBOX: '1' }, env), fetchFn: fetchFalso(RESPOSTA, chamadas) });
  assert.match(chamadas[0].url, /sandbox\.melhorenvio/);
});

test('sem token o frete fica a combinar, sem chamar a API', async () => {
  const chamadas = [];
  const r = await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '01310100', env: {}, fetchFn: fetchFalso(RESPOSTA, chamadas) });
  assert.strictEqual(r.tipo, 'a-combinar');
  assert.strictEqual(chamadas.length, 0);
});

test('API fora do ar deixa o frete a combinar', async () => {
  const r = await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '01310100', env, fetchFn: async () => { throw new Error('timeout'); } });
  assert.strictEqual(r.tipo, 'a-combinar');
});

test('resposta de erro da API deixa o frete a combinar', async () => {
  const r = await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '01310100', env, fetchFn: async () => ({ ok: false, status: 401 }) });
  assert.strictEqual(r.tipo, 'a-combinar');
});

test('CEP inválido é recusado antes de cotar', async () => {
  const r = await cotar({ catalogo, itens: [{ sku: 'NU18', qtd: 1 }], cep: '123', env, fetchFn: fetchFalso(RESPOSTA) });
  assert.strictEqual(r.tipo, 'cep-invalido');
});

test('checkout cobra o frete cotado com a transportadora no nome do item', () => {
  const cliente = { nome: 'Maria Souza', email: 'maria@empresa.com.br', telefone: '44988117615' };
  const r = montarPreferencia(catalogo, { itens: [{ sku: 'NU18', qtd: 1 }], cliente, cep: '01310-100', pagamento: 'cartao' },
    'https://x', { valorCentavos: 28010, descricao: 'Azul Cargo Express Amanhã, 4 dias úteis' });
  const frete = r.preferencia.items[1];
  assert.strictEqual(frete.unit_price, 280.1);
  assert.match(frete.title, /Azul Cargo/);
  assert.match(r.preferencia.metadata.frete, /Azul Cargo/);
});

/* ---------- Frete grátis até um limite (freteGratisAteCentavos) ---------- */
const { subsidioCentavos, aplicarSubsidio } = require('../api/_melhor-envio.js');
const catSub = {
  categorias: { portateis: {} },
  frete: { cepOrigem: '87050-000', faixas: [] },
  produtos: {
    NU6PD: { nome: 'NU6PD', categoria: 'portateis', precoCentavos: 159000, freteGratisAteCentavos: 18000,
      embalagem: { larguraCm: 45, alturaCm: 110, comprimentoCm: 60, pesoKg: 16 } },
    NU18: catalogo.produtos.NU18
  }
};

test('frete até R$ 180 sai grátis', () => {
  const [o] = aplicarSubsidio([{ id: '1', precoCentavos: 15000 }], 18000);
  assert.strictEqual(o.precoCentavos, 0);
  assert.strictEqual(o.precoCheioCentavos, 15000);
});

test('frete acima de R$ 180: o cliente paga só a diferença', () => {
  const [o] = aplicarSubsidio([{ id: '1', precoCentavos: 25050 }], 18000);
  assert.strictEqual(o.precoCentavos, 7050);
});

test('sem limite cadastrado o frete não muda', () => {
  const opcoes = [{ id: '1', precoCentavos: 25050 }];
  assert.strictEqual(aplicarSubsidio(opcoes, 0), opcoes);
  assert.strictEqual(subsidioCentavos(catSub, [{ sku: 'NU18', qtd: 1 }]), 0);
});

test('o limite vale por unidade e só para os produtos que têm', () => {
  assert.strictEqual(subsidioCentavos(catSub, [{ sku: 'NU6PD', qtd: 2 }, { sku: 'NU18', qtd: 1 }]), 36000);
});

test('a cotação já devolve o frete com o desconto aplicado', async () => {
  const r = await cotar({ catalogo: catSub, itens: [{ sku: 'NU6PD', qtd: 1 }], cep: '01310100', env, fetchFn: fetchFalso(RESPOSTA) });
  assert.deepStrictEqual(r.opcoes.map((o) => [o.id, o.precoCentavos, o.precoCheioCentavos]), [['17', 10010, 28010], ['3', 14000, 32000]]);
});

test('checkout com frete grátis não cobra item de frete', () => {
  const cliente = { nome: 'Maria Souza', email: 'maria@empresa.com.br', telefone: '44988117615' };
  const r = montarPreferencia(catSub, { itens: [{ sku: 'NU6PD', qtd: 1 }], cliente, cep: '01310-100', pagamento: 'pix' },
    'https://x', { valorCentavos: 0, descricao: 'Jadlog .Package' });
  assert.strictEqual(r.preferencia.items.length, 1);
  assert.match(r.preferencia.metadata.frete, /^grátis/);
});
