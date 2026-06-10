(() => {
  const ready = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loader = document.getElementById('loader');
    const loadCount = document.getElementById('load-count');
    const menu = document.getElementById('menu');
    const nav = document.getElementById('nav');
    const preview = document.getElementById('preview');
    const chapterTag = document.getElementById('chapter-tag');
    const scenes = [...document.querySelectorAll('.scene')];
    const pointer = {
      currentX: window.innerWidth / 2,
      currentY: window.innerHeight / 2,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight / 2
    };

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
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
    }, { passive: true });

    const movePreview = () => {
      pointer.currentX += (pointer.targetX - pointer.currentX) * 0.14;
      pointer.currentY += (pointer.targetY - pointer.currentY) * 0.14;
      document.documentElement.style.setProperty('--sx', `${pointer.currentX.toFixed(2)}px`);
      document.documentElement.style.setProperty('--sy', `${pointer.currentY.toFixed(2)}px`);
      window.requestAnimationFrame(movePreview);
    };
    movePreview();

    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      document.documentElement.style.setProperty('--progress', progress.toFixed(4));

      let active = scenes[0];
      scenes.forEach(scene => {
        const rect = scene.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.42 && rect.bottom > window.innerHeight * 0.28) {
          active = scene;
        }
      });

      if (chapterTag && active) {
        chapterTag.textContent = active.dataset.chapter || '00';
        chapterTag.classList.remove('dark');
      }
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

    document.querySelectorAll('.work-row').forEach(row => {
      row.addEventListener('pointerenter', () => {
        if (!preview) return;
        preview.style.backgroundImage = `url("${row.dataset.img}")`;
        preview.classList.add('on');
      });
      row.addEventListener('pointerleave', () => {
        preview?.classList.remove('on');
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
