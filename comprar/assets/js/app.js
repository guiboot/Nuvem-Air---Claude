/* Nuvem Air — interações */
(function () {
  'use strict';

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav scroll state
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 8) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  const toggle = document.getElementById('navToggle');
  if (toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('is-open'));
    nav.querySelectorAll('.nav__menu a').forEach((a) => {
      a.addEventListener('click', () => nav.classList.remove('is-open'));
    });
  }

  // =========================================================
  // Mega-menu (hover + focus/click) — estilo Terminal Industries
  // =========================================================
  const items = nav.querySelectorAll('.nav__item[data-menu]');
  const panels = nav.querySelectorAll('.nav__panel[data-panel]');
  let closeTimer = null;

  const openPanel = (key) => {
    clearTimeout(closeTimer);
    items.forEach((it) => it.classList.toggle('is-open', it.dataset.menu === key));
    panels.forEach((p) => p.classList.toggle('is-open', p.dataset.panel === key));
  };
  const closePanels = () => {
    items.forEach((it) => it.classList.remove('is-open'));
    panels.forEach((p) => p.classList.remove('is-open'));
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closePanels, 160);
  };

  // No mobile os mega-menus ficam ocultos; tocar na categoria leva direto à seção.
  const mobileTargets = { industriais: '#industriais', portateis: '#portateis', empresa: '#diferenciais' };
  const isMobileNav = () => window.matchMedia('(max-width: 780px)').matches;

  items.forEach((item) => {
    const key = item.dataset.menu;
    item.addEventListener('mouseenter', () => openPanel(key));
    item.addEventListener('mouseleave', scheduleClose);
    const btn = item.querySelector('.nav__link');
    if (btn) {
      btn.addEventListener('focus', () => openPanel(key));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isMobileNav()) {
          const target = mobileTargets[key];
          if (target) {
            const dest = document.querySelector(target);
            if (dest) dest.scrollIntoView({ behavior: 'smooth' });
            else window.location.hash = target;
          }
          nav.classList.remove('is-open');
          closePanels();
          return;
        }
        const isOpen = item.classList.contains('is-open');
        if (isOpen) closePanels();
        else openPanel(key);
      });
    }
  });
  panels.forEach((panel) => {
    panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    panel.addEventListener('mouseleave', scheduleClose);
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closePanels();
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanels();
  });
  // Close when clicking a panel link
  nav.querySelectorAll('.nav__panel a').forEach((a) => {
    a.addEventListener('click', () => closePanels());
  });

  // =========================================================
  // Stats counters
  // =========================================================
  const counters = document.querySelectorAll('[data-count]');
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const animateCount = (el) => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const val = Math.round(easeOut(p) * target);
      el.textContent = val.toLocaleString('pt-BR');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Reveal on scroll
  const targets = document.querySelectorAll(
    '.section-head, .product, .pillar, .process__list li, .review, .reviews__carousel, .coverage__list li, .faq__item, .cta__form, .footer__col, .hbadge, .hero__duo-card'
  );
  targets.forEach((t) => t.classList.add('reveal'));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((t) => io.observe(t));

  // Counters when stats strip enters view
  const statsBlock = document.querySelector('.stats-strip');
  if (statsBlock && counters.length) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          counters.forEach((c) => animateCount(c));
          countObserver.disconnect();
        });
      },
      { threshold: 0.3 }
    );
    countObserver.observe(statsBlock);
  }

  // Hero rotating word
  const words = document.querySelectorAll('.hero__word-item');
  if (words.length) {
    let idx = 0;
    setInterval(() => {
      const current = words[idx];
      const next = words[(idx + 1) % words.length];
      current.classList.add('is-leaving');
      current.classList.remove('is-active');
      next.classList.remove('is-leaving');
      next.classList.add('is-active');
      idx = (idx + 1) % words.length;
    }, 2400);
  }

  // Reviews carousel navigation
  document.querySelectorAll('[data-reviews-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-reviews-track]');
    const prev = carousel.querySelector('[data-reviews-prev]');
    const next = carousel.querySelector('[data-reviews-next]');
    if (!track) return;
    const step = () => {
      const slide = track.querySelector('.reviews__slide');
      if (!slide) return track.clientWidth * 0.8;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
      return slide.getBoundingClientRect().width + gap;
    };
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  });

  // Keep only one FAQ open
  const faqItems = document.querySelectorAll('.faq__item');
  faqItems.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* ---------- Rastreio de conversão (Google Ads + GA4) ---------- */
  // TODO: troque 'AW-10845759978/XXXXXXXXXXX' pelo rótulo real da conversão criada no Google Ads.
  var ADS_CONVERSION = 'AW-10845759978/XXXXXXXXXXX';
  function trackLead(source) {
    try {
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', { send_to: ADS_CONVERSION });
        gtag('event', 'generate_lead', { method: source || 'site', currency: 'BRL' });
      }
    } catch (e) {}
  }
  // Dispara conversão em todo clique de WhatsApp
  document.querySelectorAll('a[href*="wa.me/"], a[href*="api.whatsapp.com"]').forEach(function (a) {
    a.addEventListener('click', function () { trackLead('whatsapp'); });
  });

  /* ---------- Formulário de lead -> WhatsApp + conversão ---------- */
  var WA_NUMBER = '5544988049444';
  var leadForm = document.getElementById('leadForm');
  if (leadForm) {
    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      var nome = v('lf-nome'), email = v('lf-email'), tel = v('lf-telefone');
      if (!nome || !email || !tel) {
        if (leadForm.reportValidity) leadForm.reportValidity();
        else alert('Preencha nome, e-mail e telefone.');
        return;
      }
      var linhas = [
        'Olá! Quero um orçamento com instalação.', '',
        'Nome: ' + nome,
        'Empresa: ' + (v('lf-empresa') || '—'),
        'E-mail: ' + email,
        'Telefone: ' + tel,
        'Interesse: ' + v('lf-interesse'),
        'Mensagem: ' + (v('lf-mensagem') || '—')
      ];
      var msg = encodeURIComponent(linhas.join('\n'));
      trackLead('formulario');
      var btn = leadForm.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) btn.textContent = 'Abrindo o WhatsApp…';
      window.open('https://wa.me/' + WA_NUMBER + '?text=' + msg, '_blank', 'noopener');
      setTimeout(function () { if (btn) btn.textContent = label; }, 4000);
    });
  }

  /* ---------- Lazy-load dos vídeos (evita baixar ~11MB no load) ---------- */
  var lazyVideos = document.querySelectorAll('video.lazy-video');
  if (lazyVideos.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var vid = entry.target;
        if (vid.dataset.src) {
          vid.src = vid.dataset.src;
          vid.removeAttribute('data-src');
          if (vid.play) vid.play().catch(function () {});
        }
        obs.unobserve(vid);
      });
    }, { rootMargin: '300px' });
    lazyVideos.forEach(function (v) { vio.observe(v); });
  } else {
    lazyVideos.forEach(function (v) { if (v.dataset.src) { v.src = v.dataset.src; if (v.play) v.play().catch(function () {}); } });
  }

  // Collapsible spec table
  var specToggle = document.getElementById('specToggle');
  if (specToggle) {
    var moreRows = document.querySelectorAll('.spec-table tr.spec-row--more');
    specToggle.addEventListener('click', function () {
      var expanded = specToggle.getAttribute('aria-expanded') === 'true';
      specToggle.setAttribute('aria-expanded', String(!expanded));
      moreRows.forEach(function (row) { row.classList.toggle('is-hidden', expanded); });
    });
  }
})();
