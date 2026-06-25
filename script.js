(() => {
  document.documentElement.classList.add('js-reveal');

  const ready = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loader = document.getElementById('loader');
    const loadCount = document.getElementById('load-count');
    const menu = document.getElementById('menu');
    const nav = document.getElementById('nav');
    const scenes = [...document.querySelectorAll('.scene')];
    const workRows = [...document.querySelectorAll('.work-row')];
    const offerCards = [...document.querySelectorAll('.offer-grid article')];

    if (!reduced && loader && loadCount) {
      let value = 0;
      const tick = window.setInterval(() => {
        value = Math.min(100, value + 7 + Math.floor(value / 18));
        loadCount.textContent = String(value);
        if (value === 100) {
          window.clearInterval(tick);
          window.setTimeout(() => loader.classList.add('done'), 180);
        }
      }, 18);
    } else {
      loader?.classList.add('done');
    }

    const closeMenu = () => {
      document.body.classList.remove('menu-open');
      menu?.setAttribute('aria-expanded', 'false');
    };

    menu?.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      menu.setAttribute('aria-expanded', String(open));
    });

    nav?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });

    window.addEventListener('pointermove', event => {
      document.documentElement.style.setProperty('--x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--y', `${event.clientY}px`);
    }, { passive: true });

    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      document.documentElement.style.setProperty('--progress', progress.toFixed(4));
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -10% 0px' });

    scenes.forEach(scene => observer.observe(scene));
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    updateScroll();

    const setOfferFocus = key => {
      workRows.forEach(row => {
        row.classList.toggle('is-offer-match', Boolean(key) && (row.dataset.offer || '').split(/\s+/).includes(key));
        row.classList.toggle('is-offer-dim', Boolean(key) && !(row.dataset.offer || '').split(/\s+/).includes(key));
      });
    };

    offerCards.forEach(card => {
      card.addEventListener('pointerenter', () => setOfferFocus(card.dataset.offer));
      card.addEventListener('focus', () => setOfferFocus(card.dataset.offer));
      card.addEventListener('pointerleave', () => setOfferFocus(''));
      card.addEventListener('blur', () => setOfferFocus(''));
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
