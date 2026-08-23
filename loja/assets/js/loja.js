/* Cola de navegador da loja: DOM, eventos e rede.
   Nenhuma conta de dinheiro mora aqui — todo cálculo é delegado ao
   LojaCore, que é o mesmo módulo que a Vercel Function usa. */
(function () {
  'use strict';

  var carrinho = LojaCarrinho.criarCarrinho(window.localStorage);
  var promessaCatalogo = null;

  function catalogo() {
    if (!promessaCatalogo) {
      promessaCatalogo = fetch('/loja/catalogo.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('catálogo indisponível');
          return r.json();
        });
    }
    return promessaCatalogo;
  }

  /* Eventos de conversão. Não injetamos nenhum ID de medição: apenas
     empurramos para o dataLayer e para gtag se a página já os tiver. Assim o
     rastreamento funciona quando você plugar GTM/GA4, e não quebra sem eles. */
  function rastrear(evento, dados) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: evento }, dados || {}));
      if (typeof window.gtag === 'function') window.gtag('event', evento, dados || {});
    } catch (e) { /* rastreamento nunca pode derrubar a loja */ }
  }

  function el(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  /* ---------- Vitrine: filtra o que o gerador já imprimiu ----------
     Os cards vêm prontos no HTML (tools/gerar-loja.js). Aqui a gente só
     mostra, esconde e reordena. Nada de remontar markup no navegador:
     era isso que deixava a vitrine invisível para o Googlebot. */

  var ORDENS = [
    { id: 'relevancia', rotulo: 'Relevância' },
    { id: 'menor', rotulo: 'Menor preço' },
    { id: 'maior', rotulo: 'Maior preço' },
    { id: 'nome', rotulo: 'Nome (A–Z)' }
  ];

  function renderVitrine(destino, lateral) {
    if (!destino) return;

    var cards = [].slice.call(destino.querySelectorAll('.loja-card'));
    if (!cards.length) return;

    var secoes = [].slice.call(destino.querySelectorAll('[data-secao]'));
    var contagem = destino.querySelector('[data-contagem]');
    var nada = destino.querySelector('[data-nada]');
    var ordemOriginal = cards.slice();

    var dados = {};
    cards.forEach(function (c) {
      var preco = c.getAttribute('data-preco');
      dados[c.getAttribute('data-sku')] = {
        categoria: c.getAttribute('data-categoria'),
        preco: preco === '' ? null : parseInt(preco, 10),
        texto: (c.getAttribute('data-nome') + ' ' + c.textContent + ' ' + c.getAttribute('data-sku')).toLowerCase()
      };
    });

    var categorias = {};
    secoes.forEach(function (sec) {
      var t = sec.querySelector('.loja-secao__titulo');
      categorias[sec.getAttribute('data-secao')] = t ? t.textContent : sec.getAttribute('data-secao');
    });

    var estado = { categoria: 'todos', ordem: 'relevancia', de: null, ate: null, busca: '' };

    function passa(c) {
      var d = dados[c.getAttribute('data-sku')];
      if (estado.categoria !== 'todos' && d.categoria !== estado.categoria) return false;
      if (estado.busca && d.texto.indexOf(estado.busca) === -1) return false;
      /* Produto sem preço nunca é descartado pela faixa: ele não tem valor
         para comparar, e sumir esconderia produto real do cliente. */
      if (d.preco !== null) {
        if (estado.de !== null && d.preco < estado.de) return false;
        if (estado.ate !== null && d.preco > estado.ate) return false;
      }
      return true;
    }

    function aplicar() {
      var visiveis = 0;
      cards.forEach(function (c) {
        var ok = passa(c);
        c.hidden = !ok;
        if (ok) visiveis++;
      });

      secoes.forEach(function (sec) {
        var algum = [].slice.call(sec.querySelectorAll('.loja-card'))
          .some(function (c) { return !c.hidden; });
        sec.hidden = !algum;
      });

      if (contagem) contagem.textContent = visiveis + (visiveis === 1 ? ' produto' : ' produtos');
      if (nada) nada.hidden = visiveis > 0;

      ordenar();
    }

    function ordenar() {
      if (estado.ordem === 'relevancia') {
        // devolve cada card à posição original, dentro da própria seção
        ordemOriginal.forEach(function (c) { c.parentNode.appendChild(c); });
        return;
      }
      secoes.forEach(function (sec) {
        var grid = sec.querySelector('.loja-grid');
        if (!grid) return;
        [].slice.call(grid.querySelectorAll('.loja-card')).sort(function (a, b) {
          var da = dados[a.getAttribute('data-sku')], db = dados[b.getAttribute('data-sku')];
          if (estado.ordem === 'nome') {
            return a.getAttribute('data-nome').localeCompare(b.getAttribute('data-nome'), 'pt-BR');
          }
          // sem preço vai sempre para o fim, nas duas ordenações
          if (da.preco === null && db.preco === null) return 0;
          if (da.preco === null) return 1;
          if (db.preco === null) return -1;
          return estado.ordem === 'menor' ? da.preco - db.preco : db.preco - da.preco;
        }).forEach(function (c) { grid.appendChild(c); });
      });
    }

    function desenharLateral() {
      if (!lateral) return;
      lateral.textContent = '';

      var bCat = el('div', 'loja-lateral__bloco');
      bCat.appendChild(el('h2', null, 'Categorias'));
      var lista = el('ul', 'loja-lateral__cats');
      [['todos', 'Todos os produtos']].concat(
        Object.keys(categorias).map(function (k) { return [k, categorias[k]]; })
      ).forEach(function (par) {
        var chave = par[0];
        var qtd = cards.filter(function (c) {
          return chave === 'todos' || dados[c.getAttribute('data-sku')].categoria === chave;
        }).length;
        if (!qtd) return;
        var li = el('li');
        var b = el('button', 'loja-lateral__cat' + (estado.categoria === chave ? ' is-active' : ''));
        b.type = 'button';
        b.setAttribute('aria-pressed', estado.categoria === chave ? 'true' : 'false');
        b.appendChild(el('span', null, par[1]));
        b.appendChild(el('em', null, String(qtd)));
        b.addEventListener('click', function () {
          estado.categoria = chave;
          try {
            history.replaceState(null, '', chave === 'todos' ? '/loja' : '/loja#' + chave);
          } catch (e) { /* alguns contextos não deixam trocar a URL */ }
          desenharLateral();
          aplicar();
        });
        li.appendChild(b);
        lista.appendChild(li);
      });
      bCat.appendChild(lista);
      lateral.appendChild(bCat);

      var bOrd = el('div', 'loja-lateral__bloco');
      var idOrd = 'ordenar-por';
      var lab = el('label', null, 'Ordenar por');
      lab.setAttribute('for', idOrd);
      lab.className = 'loja-lateral__rotulo';
      bOrd.appendChild(lab);
      var sel = el('select', 'loja-lateral__select');
      sel.id = idOrd;
      ORDENS.forEach(function (o) {
        var opt = el('option', null, o.rotulo);
        opt.value = o.id;
        if (o.id === estado.ordem) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', function () { estado.ordem = sel.value; ordenar(); });
      bOrd.appendChild(sel);
      lateral.appendChild(bOrd);

      var bPreco = el('div', 'loja-lateral__bloco');
      bPreco.appendChild(el('h2', null, 'Preço'));
      var faixa = el('div', 'loja-lateral__faixa');

      function campo(rotulo, valor, ph, id) {
        var w = el('label', 'loja-lateral__campo');
        var sp = el('span', null, rotulo);
        sp.setAttribute('for', id);
        w.appendChild(sp);
        var i = el('input');
        i.type = 'number';
        i.id = id;
        i.min = '0';
        i.step = '100';
        i.placeholder = ph;
        i.setAttribute('aria-label', rotulo + ' (R$)');
        if (valor !== null) i.value = String(Math.round(valor / 100));
        w.appendChild(i);
        return { wrap: w, input: i };
      }

      var precos = cards.map(function (c) { return dados[c.getAttribute('data-sku')].preco; })
        .filter(function (v) { return v !== null; });
      var minP = precos.length ? Math.floor(Math.min.apply(null, precos) / 100) : 0;
      var maxP = precos.length ? Math.ceil(Math.max.apply(null, precos) / 100) : 0;

      var cDe = campo('De', estado.de, String(minP), 'preco-de');
      var cAte = campo('Até', estado.ate, String(maxP), 'preco-ate');
      faixa.appendChild(cDe.wrap);
      faixa.appendChild(cAte.wrap);
      bPreco.appendChild(faixa);

      var aplicarBtn = el('button', 'loja-lateral__aplicar', 'Aplicar');
      aplicarBtn.type = 'button';
      aplicarBtn.addEventListener('click', function () {
        var de = parseInt(cDe.input.value, 10);
        var ate = parseInt(cAte.input.value, 10);
        estado.de = Number.isFinite(de) ? de * 100 : null;
        estado.ate = Number.isFinite(ate) ? ate * 100 : null;
        aplicar();
      });
      bPreco.appendChild(aplicarBtn);
      lateral.appendChild(bPreco);
    }

    var form = document.querySelector('[data-busca]');
    if (form) {
      var campoBusca = form.querySelector('input');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        estado.busca = campoBusca.value.trim().toLowerCase();
        estado.categoria = 'todos';
        rastrear('busca_interna', { termo: estado.busca });
        desenharLateral();
        aplicar();
      });
    }

    var inicial = (location.hash || '').replace('#', '');
    if (categorias[inicial]) estado.categoria = inicial;

    desenharLateral();
    aplicar();
  }

  /* ---------- Página de produto ---------- */

  function renderProduto(raiz) {
    if (!raiz) return;
    var sku = raiz.getAttribute('data-sku');
    var btn = raiz.querySelector('[data-comprar]');
    if (!btn || btn.hasAttribute('disabled')) return;

    rastrear('view_item', { sku: sku });

    btn.addEventListener('click', function () {
      var campo = raiz.querySelector('[data-qtd]');
      var qtd = campo ? parseInt(campo.value, 10) : 1;
      if (!Number.isInteger(qtd) || qtd < 1) qtd = 1;
      carrinho.adicionar(sku, qtd);
      rastrear('add_to_cart', { sku: sku, qtd: qtd });
      window.location.href = '/loja/carrinho';
    });
  }

  /* ---------- Carrinho ---------- */

  function mostrarErro(caixa, mensagem) {
    if (!caixa) return;
    if (!mensagem) { caixa.hidden = true; caixa.textContent = ''; return; }
    caixa.textContent = mensagem;
    caixa.hidden = false;
  }

  function pagamentoEscolhido() {
    var m = document.querySelector('input[name="pagamento"]:checked');
    return m ? m.value : 'cartao';
  }

  function renderCarrinho(raiz) {
    if (!raiz) return;
    var corpo = raiz.querySelector('[data-itens]');
    var vazio = raiz.querySelector('[data-vazio]');
    var conteudo = raiz.querySelector('[data-conteudo]');
    var caixaErro = raiz.querySelector('.loja-erro');

    catalogo().then(function (cat) {
      function desenhar() {
        var itens = carrinho.ler();

        var titulo = raiz.querySelector('[data-titulo-carrinho]');

        if (itens.length === 0) {
          if (vazio) vazio.hidden = false;
          if (conteudo) conteudo.hidden = true;
          if (titulo) titulo.textContent = 'Seu carrinho está vazio';
          atualizarContador();
          return;
        }
        if (vazio) vazio.hidden = true;
        if (conteudo) conteudo.hidden = false;
        if (titulo) titulo.textContent = 'Finalize sua compra';

        corpo.textContent = '';
        itens.forEach(function (item) {
          var p = LojaCore.produto(cat, item.sku);
          if (!p) return;
          var tr = el('tr');

          var tdProd = el('td', 'loja-carrinho__cel-produto');
          var caixa = el('div', 'loja-carrinho__produto');
          var img = el('img');
          img.src = p.imagem;
          img.alt = p.nome;
          caixa.appendChild(img);
          caixa.appendChild(el('strong', null, p.nome));
          tdProd.appendChild(caixa);
          tr.appendChild(tdProd);

          var tdPreco = el('td', null, LojaCore.formatarBRL(p.precoCentavos));
          tdPreco.setAttribute('data-rotulo', 'Preço');
          tr.appendChild(tdPreco);

          var tdQtd = el('td');
          tdQtd.setAttribute('data-rotulo', 'Qtd');
          var input = el('input');
          input.type = 'number';
          input.min = '1';
          input.max = String(LojaCore.QTD_MAX);
          input.value = String(item.qtd);
          input.setAttribute('aria-label', 'Quantidade de ' + p.nome);
          input.addEventListener('change', function () {
            carrinho.definirQtd(item.sku, parseInt(input.value, 10));
            desenhar();
          });
          tdQtd.appendChild(input);
          tr.appendChild(tdQtd);

          var tdSub = el('td', null, LojaCore.formatarBRL(
            LojaCore.subtotalCentavos(cat, [item])));
          tdSub.setAttribute('data-rotulo', 'Subtotal');
          tr.appendChild(tdSub);

          var tdRem = el('td', 'loja-carrinho__cel-remover');
          var rem = el('button', 'loja-carrinho__remover', 'Remover');
          rem.type = 'button';
          rem.addEventListener('click', function () { carrinho.remover(item.sku); desenhar(); });
          tdRem.appendChild(rem);
          tr.appendChild(tdRem);

          corpo.appendChild(tr);
        });

        atualizarTotais();
        atualizarContador();
      }

      function atualizarTotais() {
        var itens = carrinho.ler();
        var campoCep = document.getElementById('ck-cep');
        var frete = LojaCore.resolverFrete(cat, campoCep ? campoCep.value : '');
        var freteCentavos = frete.tipo === 'fixo' ? frete.valorCentavos : 0;
        var pagamento = pagamentoEscolhido();
        var t = LojaCore.totalCentavos(cat, itens, freteCentavos, pagamento);

        var q = function (sel) { return raiz.querySelector(sel); };
        if (q('[data-subtotal]')) q('[data-subtotal]').textContent = LojaCore.formatarBRL(t.subtotal);

        var linhaDesc = q('[data-linha-desconto]');
        if (linhaDesc) {
          linhaDesc.hidden = t.desconto === 0;
          if (t.desconto > 0) q('[data-desconto]').textContent = '− ' + LojaCore.formatarBRL(t.desconto);
        }

        var alvoFrete = q('[data-frete]');
        var nota = q('[data-frete-nota]');
        if (frete.tipo === 'fixo') {
          if (alvoFrete) alvoFrete.textContent = LojaCore.formatarBRL(frete.valorCentavos);
          if (nota) { nota.hidden = true; nota.textContent = ''; }
        } else {
          if (alvoFrete) alvoFrete.textContent = frete.tipo === 'cep-invalido' ? '—' : 'A combinar';
          if (nota) {
            nota.hidden = false;
            nota.textContent = frete.tipo === 'cep-invalido'
              ? 'Informe o CEP para calcularmos o frete.'
              : 'Ainda não temos frete fechado para esse CEP. Você paga só o equipamento agora e a gente cota o frete com você antes de despachar.';
          }
        }

        if (q('[data-total]')) q('[data-total]').textContent = LojaCore.formatarBRL(t.total);

        var notaParc = q('[data-parcela-nota]');
        if (notaParc) {
          var n = cat.parcelamentoMax;
          if (pagamento === 'cartao' && typeof n === 'number' && n >= 2 && t.total > 0) {
            notaParc.hidden = false;
            notaParc.textContent = 'Em até ' + n + 'x de ' +
              LojaCore.formatarBRL(Math.ceil(t.total / n)) + ' sem juros no cartão.';
          } else {
            notaParc.hidden = true;
          }
        }
      }

      var campoCep = document.getElementById('ck-cep');
      if (campoCep) campoCep.addEventListener('input', atualizarTotais);

      [].forEach.call(document.querySelectorAll('input[name="pagamento"]'), function (r) {
        r.addEventListener('change', atualizarTotais);
      });

      var form = raiz.querySelector('[data-checkout]');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          irParaPagamento(form, caixaErro);
        });
      }

      desenhar();
    }).catch(function () {
      mostrarErro(caixaErro, 'Não foi possível carregar o catálogo. Recarregue a página.');
    });
  }

  function irParaPagamento(form, caixaErro) {
    var btn = form.querySelector('button[type="submit"]');
    var rotulo = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Abrindo o pagamento…';
    mostrarErro(caixaErro, null);

    var val = function (id) {
      var campo = document.getElementById(id);
      return campo ? campo.value.trim() : '';
    };

    function liberar(mensagem) {
      mostrarErro(caixaErro, mensagem);
      btn.disabled = false;
      btn.textContent = rotulo;
    }

    /* Só sku, qtd e o método de pagamento vão para o servidor. Preço nenhum —
       quem calcula é o api/checkout.js, a partir do catalogo.json. */
    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itens: carrinho.ler().map(function (i) { return { sku: i.sku, qtd: i.qtd }; }),
        cliente: {
          nome: val('ck-nome'),
          email: val('ck-email'),
          telefone: val('ck-telefone'),
          documento: val('ck-documento')
        },
        cep: val('ck-cep'),
        pagamento: pagamentoEscolhido()
      })
    })
      .then(function (r) {
        return r.json()
          .catch(function () { return {}; })
          .then(function (d) { return { ok: r.ok, dados: d }; });
      })
      .then(function (res) {
        if (!res.ok || !res.dados.url) {
          /* Falhou: o carrinho FICA como está, o cliente não perde a compra. */
          liberar(res.dados.erro || 'Não foi possível iniciar o pagamento.');
          return;
        }
        window.location.href = res.dados.url;
      })
      .catch(function () {
        liberar('Sem conexão com o servidor. Tente de novo em instantes.');
      });
  }

  /* ---------- Contador no header ---------- */

  function atualizarContador() {
    var alvo = document.querySelector('[data-carrinho-contador]');
    if (!alvo) return;
    var n = carrinho.totalItens();
    alvo.textContent = String(n);
    alvo.hidden = n === 0;
  }

  /* ---------- Bootstrap ---------- */

  /* Cliques em WhatsApp e telefone são conversão: sem isso não dá para saber
     de onde vem o contato. Delegado no documento para pegar também os links
     que o gerador imprime. */
  function rastrearCliques() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('wa.me') !== -1) {
        rastrear('clique_whatsapp', { origem: a.getAttribute('data-evento') || 'geral', pagina: location.pathname });
      } else if (href.indexOf('tel:') === 0) {
        rastrear('clique_telefone', { pagina: location.pathname });
      }
    }, true);
  }

  function init() {
    rastrearCliques();
    renderVitrine(document.querySelector('[data-vitrine]'), document.querySelector('[data-lateral]'));
    renderProduto(document.querySelector('[data-produto]'));
    renderCarrinho(document.querySelector('[data-carrinho]'));

    if (document.querySelector('[data-limpar-carrinho]')) carrinho.limpar();

    atualizarContador();
  }

  window.Loja = {
    init: init,
    carrinho: carrinho,
    renderVitrine: renderVitrine,
    renderProduto: renderProduto,
    renderCarrinho: renderCarrinho
  };
})();
