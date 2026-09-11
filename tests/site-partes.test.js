const test = require('node:test');
const assert = require('node:assert');
const partes = require('../tools/site-partes.js');

test('extrai o conteúdo entre os marcadores', () => {
  const html = 'antes\n<!-- NAV:INICIO -->\n<header>oi</header>\n<!-- NAV:FIM -->\ndepois';
  assert.strictEqual(partes.extrair(html, 'NAV').trim(), '<header>oi</header>');
});

test('lança quando o marcador não existe', () => {
  assert.throws(() => partes.extrair('<p>nada</p>', 'NAV'), /NAV/);
});

test('absolutiza src e href de assets relativos', () => {
  const r = partes.absolutizar('<img src="assets/img/logo.webp" /><a href="assets/x.pdf">x</a>');
  assert.ok(r.includes('src="/assets/img/logo.webp"'));
  assert.ok(r.includes('href="/assets/x.pdf"'));
});

test('absolutiza âncoras, que na raiz apontam para seções da home', () => {
  assert.ok(partes.absolutizar('<a href="#faq">FAQ</a>').includes('href="/#faq"'));
});

test('não mexe em caminho já absoluto nem em link externo', () => {
  const entrada = '<a href="/comprar">c</a><a href="https://wa.me/55">w</a><a href="mailto:a@b.c">m</a>';
  assert.strictEqual(partes.absolutizar(entrada), entrada);
});

test('partes() devolve o nav e o rodapé reais do index.html, já absolutos', () => {
  const p = partes.partes();
  assert.ok(p.nav.includes('class="nav"'), 'nav não veio');
  assert.ok(p.rodape.includes('class="footer"'), 'rodapé não veio');
  assert.ok(!/src="assets\//.test(p.nav), 'sobrou caminho relativo no nav');
  assert.ok(!/href="#/.test(p.rodape), 'sobrou âncora relativa no rodapé');
});
