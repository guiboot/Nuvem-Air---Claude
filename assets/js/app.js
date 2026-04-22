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

  items.forEach((item) => {
    const key = item.dataset.menu;
    item.addEventListener('mouseenter', () => openPanel(key));
    item.addEventListener('mouseleave', scheduleClose);
    const btn = item.querySelector('.nav__link');
    if (btn) {
      btn.addEventListener('focus', () => openPanel(key));
      btn.addEventListener('click', (e) => {
        e.preventDefault();
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
})();
