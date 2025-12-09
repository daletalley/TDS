(() => {
  const onReady = () => {
    document.documentElement.classList.add('reveal-ready');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveals = Array.from(document.querySelectorAll('.reveal'));
    if (prefersReducedMotion) {
      reveals.forEach(el => el.classList.add('visible'));
    } else if (reveals.length) {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '140px 0px 160px 0px' });

      reveals.forEach((el, index) => {
        const delayMs = Math.min(index * 30, 220);
        el.style.setProperty('--reveal-delay', `${delayMs}ms`);
        revealObserver.observe(el);
      });
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

    const availabilityCard = document.getElementById('availability-card');
    const availabilityStatus = document.getElementById('availability-status');
    const availabilityState = document.getElementById('availability-state');
    const navAvailability = document.getElementById('nav-availability');
    const navAvailabilityState = document.getElementById('nav-availability-state');
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');
    const mobileNavQuery = window.matchMedia('(max-width: 720px)');

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
          if (mobileNavQuery.matches) closeMenu();
        });
      });

      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
      });

      mobileNavQuery.addEventListener('change', event => {
        if (!event.matches) closeMenu();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
