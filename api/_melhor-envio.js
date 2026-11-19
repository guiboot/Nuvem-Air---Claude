/* Cotação de frete por transportadora no Melhor Envio.

   O arquivo começa com "_" para a Vercel não publicar como rota: quem expõe
   a cotação é api/frete.js, e o api/checkout.js usa o mesmo módulo para
   recalcular o frete escolhido. O valor do frete nunca vem do navegador —
   o cliente manda só o id do serviço, e o preço sai de uma cotação nova.

   Configuração (variáveis de ambiente na Vercel):
     MELHOR_ENVIO_TOKEN       token gerado no painel do Melhor Envio
                              (Integrações → Permissões de acesso), com a
                              permissão shipping-calculate
     MELHOR_ENVIO_USER_AGENT  "Nome da aplicação (email de contato técnico)",
                              exigido pela API do Melhor Envio
     MELHOR_ENVIO_SANDBOX     "1" para usar o ambiente de testes

   O CEP de origem e as caixas de cada produto ficam no catalogo.json
   (frete.cepOrigem e produtos.<SKU>.embalagem). */
const core = require('../loja/assets/js/loja-core.js');

const URL_PRODUCAO = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate';
const URL_SANDBOX = 'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate';

function configurado(env) {
  return !!(env.MELHOR_ENVIO_TOKEN && env.MELHOR_ENVIO_USER_AGENT);
}

/* Converte os itens do carrinho nos volumes que o Melhor Envio cota.
   Cada produto precisa da caixa cadastrada; se faltar uma, a cotação toda
   fica "a combinar" — cotar sem um dos volumes daria um frete barato demais. */
function montarVolumes(catalogo, itens) {
  const faltando = [];
  const produtos = itens.map((item) => {
    const p = core.produto(catalogo, item.sku);
    const e = p && p.embalagem;
    if (!e || !(e.larguraCm > 0 && e.alturaCm > 0 && e.comprimentoCm > 0 && e.pesoKg > 0)) {
      faltando.push(item.sku);
      return null;
    }
    return {
      id: item.sku,
      width: e.larguraCm,
      height: e.alturaCm,
      length: e.comprimentoCm,
      weight: e.pesoKg,
      /* Valor declarado = preço do equipamento, para o seguro cobrir a perda. */
      insurance_value: (p.precoCentavos || 0) / 100,
      quantity: item.qtd
    };
  });
  return faltando.length ? { ok: false, faltando: faltando } : { ok: true, produtos: produtos };
}

function centavos(valor) {
  const n = parseFloat(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/* Deixa só o que o cliente pode escolher: serviços sem erro e com preço.
   custom_price/custom_delivery_time trazem os ajustes configurados no painel
   do Melhor Envio (margem, prazo extra de manuseio), quando existem. */
function normalizarOpcoes(resposta) {
  if (!Array.isArray(resposta)) return [];
  return resposta
    .filter((s) => s && !s.error)
    .map((s) => ({
      id: String(s.id),
      servico: s.name,
      transportadora: (s.company && s.company.name) || '',
      logo: (s.company && s.company.picture) || '',
      precoCentavos: centavos(s.custom_price != null ? s.custom_price : s.price),
      prazoDias: s.custom_delivery_time != null ? s.custom_delivery_time : s.delivery_time
    }))
    .filter((o) => typeof o.precoCentavos === 'number' && o.precoCentavos > 0)
    .sort((a, b) => a.precoCentavos - b.precoCentavos);
}

/* Devolve { tipo: 'cotado', opcoes } ou { tipo: 'a-combinar', motivo }.
   Qualquer falha cai em "a combinar": o cliente ainda consegue comprar e a
   Nuvem Air cota o frete por fora, que era o comportamento de antes. */
async function cotar({ catalogo, itens, cep, env = process.env, fetchFn = fetch }) {
  const destino = core.normalizarCep(cep);
  if (!destino) return { tipo: 'cep-invalido' };
  if (!configurado(env)) return { tipo: 'a-combinar', motivo: 'nao-configurado' };

  const origem = core.normalizarCep(catalogo.frete && catalogo.frete.cepOrigem);
  if (!origem) return { tipo: 'a-combinar', motivo: 'sem-cep-origem' };

  const volumes = montarVolumes(catalogo, itens);
  if (!volumes.ok) return { tipo: 'a-combinar', motivo: 'sem-embalagem', faltando: volumes.faltando };

  let resposta;
  try {
    resposta = await fetchFn(env.MELHOR_ENVIO_SANDBOX === '1' ? URL_SANDBOX : URL_PRODUCAO, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.MELHOR_ENVIO_TOKEN,
        'User-Agent': env.MELHOR_ENVIO_USER_AGENT
      },
      body: JSON.stringify({
        from: { postal_code: origem },
        to: { postal_code: destino },
        products: volumes.produtos,
        options: { receipt: false, own_hand: false }
      }),
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) {
    console.error('Melhor Envio fora do ar:', e.message);
    return { tipo: 'a-combinar', motivo: 'falha' };
  }
  if (!resposta.ok) {
    /* Nunca logar o corpo nem o token. */
    console.error('Melhor Envio recusou a cotação:', resposta.status);
    return { tipo: 'a-combinar', motivo: 'falha' };
  }

  const opcoes = normalizarOpcoes(await resposta.json().catch(() => null));
  if (!opcoes.length) return { tipo: 'a-combinar', motivo: 'sem-servico' };
  return { tipo: 'cotado', opcoes: aplicarSubsidio(opcoes, subsidioCentavos(catalogo, itens)) };
}

/* Frete grátis até um limite: cada produto pode ter freteGratisAteCentavos
   no catálogo, e a Nuvem Air paga o frete até esse valor por unidade. Se a
   transportadora cobrar mais, o cliente paga só a diferença. Num carrinho
   com vários produtos, os limites somam. */
function subsidioCentavos(catalogo, itens) {
  return itens.reduce((soma, item) => {
    const p = core.produto(catalogo, item.sku);
    const ate = p && p.freteGratisAteCentavos;
    return soma + (typeof ate === 'number' && ate > 0 ? ate * item.qtd : 0);
  }, 0);
}

/* precoCentavos passa a ser o que o cliente paga; precoCheioCentavos guarda
   o valor da transportadora, para a loja mostrar o desconto. A ordem não
   muda: quem era mais barato continua mais barato. */
function aplicarSubsidio(opcoes, subsidio) {
  if (!(subsidio > 0)) return opcoes;
  return opcoes.map((o) => Object.assign({}, o, {
    precoCheioCentavos: o.precoCentavos,
    precoCentavos: Math.max(0, o.precoCentavos - subsidio)
  }));
}

module.exports = { cotar, montarVolumes, normalizarOpcoes, configurado, subsidioCentavos, aplicarSubsidio };
