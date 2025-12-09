(() => {
  const onReady = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveals = Array.from(document.querySelectorAll('.reveal'));
    let revealObserver;

    const revealNow = el => {
      if (!el || el.classList.contains('visible')) return;
      el.classList.add('visible');
      if (revealObserver) revealObserver.unobserve(el);
    };

    const primeReveals = () => {
      reveals.forEach(el => {
        if (el.classList.contains('visible')) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 240) revealNow(el);
      });
    };

    const stagedWarmup = () => {
      if (prefersReducedMotion) return;
      primeReveals();
      requestAnimationFrame(primeReveals);
      setTimeout(primeReveals, 140);
      setTimeout(primeReveals, 320);
    };

    if (!prefersReducedMotion) {
      reveals.forEach((el, index) => {
        const delayMs = Math.min(index * 70, 420);
        el.style.transitionDelay = `${delayMs}ms`;
      });
    }

    if (prefersReducedMotion) {
      reveals.forEach(revealNow);
    } else {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) revealNow(entry.target);
        });
      }, { threshold: 0.05, rootMargin: '240px 0px 160px 0px' });

      reveals.forEach(el => revealObserver.observe(el));
      stagedWarmup();
      window.addEventListener('resize', primeReveals);
      window.addEventListener('load', stagedWarmup, { once: true });
    }

    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
      link.addEventListener('click', e => {
        const targetId = link.getAttribute('href').slice(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }
      });
    });

    let lastScrollY = window.scrollY;
    let shadeTimeout;

    const setScrollPop = value => {
      document.documentElement.style.setProperty('--scroll-pop', value.toFixed(3));
    };

    const handleScrollShade = () => {
      const currentY = window.scrollY;
      const delta = Math.min(Math.abs(currentY - lastScrollY), 120);
      lastScrollY = currentY;

      const intensity = Math.min(delta / 90, 1);
      setScrollPop(intensity);

      clearTimeout(shadeTimeout);
      shadeTimeout = setTimeout(() => setScrollPop(0), 150);
    };

    window.addEventListener('scroll', handleScrollShade, { passive: true });
    setScrollPop(0);

    const availabilityCard = document.getElementById('availability-card');
    const availabilityStatus = document.getElementById('availability-status');
    const availabilityState = document.getElementById('availability-state');
    const navAvailability = document.getElementById('nav-availability');
    const navAvailabilityState = document.getElementById('nav-availability-state');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    const updateAvailability = () => {
      const now = new Date();
      const ksParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour12: false,
        hour: 'numeric',
        weekday: 'short'
      }).formatToParts(now);

      const ksHour = Number(ksParts.find(part => part.type === 'hour')?.value ?? 0);
      const ksWeekday = ksParts.find(part => part.type === 'weekday')?.value ?? '';

      const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(ksWeekday);
      const isWithinHours = ksHour >= 8 && ksHour < 18;
      const online = isWeekday && isWithinHours;

      if (availabilityCard) {
        availabilityCard.classList.toggle('online', online);
        availabilityCard.classList.toggle('offline', !online);
      }
      if (availabilityStatus) {
        availabilityStatus.classList.toggle('online', online);
        availabilityStatus.classList.toggle('offline', !online);
      }
      if (navAvailability) {
        navAvailability.classList.toggle('online', online);
        navAvailability.classList.toggle('offline', !online);
      }

      const stateText = online ? 'Online' : 'Offline';
      if (availabilityState) availabilityState.textContent = stateText;
      if (navAvailabilityState) navAvailabilityState.textContent = stateText;
    };

    updateAvailability();
    setInterval(updateAvailability, 60000);

    const closeMenu = () => {
      document.body.classList.remove('menu-open');
      if (navLinks) navLinks.classList.remove('open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      document.body.classList.add('menu-open');
      if (navLinks) navLinks.classList.add('open');
      if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    };

    if (menuToggle && navLinks) {
      menuToggle.addEventListener('click', () => {
        const isOpen = document.body.classList.contains('menu-open');
        if (isOpen) {
          closeMenu();
        } else {
          openMenu();
        }
      });

      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (window.matchMedia('(max-width: 720px)').matches) closeMenu();
        });
      });

      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
      });

      window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 720px)').matches) closeMenu();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
