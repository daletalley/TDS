(() => {
  const ready = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loader = document.getElementById('loader');
    const loadCount = document.getElementById('load-count');
    const menu = document.getElementById('menu');
    const nav = document.getElementById('nav');
    const preview = document.getElementById('preview');
    const scenes = [...document.querySelectorAll('.scene')];
    let activePreviewRow = null;

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

    const textFrom = (row, selector) => row.querySelector(selector)?.textContent?.trim() || '';
    const siteCapture = url => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`;

    const previewNode = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text) node.textContent = text;
      return node;
    };

    const previewMeta = row => {
      const href = row.href || '';
      return {
        title: textFrom(row, 'strong'),
        type: row.dataset.previewType || 'app',
        label: textFrom(row, 'span'),
        category: textFrom(row, 'em'),
        note: row.dataset.previewNote || textFrom(row, 'em'),
        detail: row.dataset.previewDetail || href || 'Current work',
        captureUrl: row.dataset.previewUrl || href
      };
    };

    const previewHost = url => {
      if (!url) return window.location.hostname || 'local app';
      return new URL(url, window.location.href).hostname;
    };

    const renderFramePreview = ({ title, category, media, badge, host }) => {
      const frame = previewNode('div', 'preview-frame');
      const rail = previewNode('div', 'preview-rail');
      const caption = previewNode('div', 'preview-caption');

      rail.append(previewNode('span', '', badge), previewNode('span', '', category));
      caption.append(previewNode('strong', '', title), previewNode('span', '', host));
      frame.append(media, rail, caption);
      preview.append(frame);
    };

    const dockPreview = row => {
      if (!preview || !row) return;

      const titleRect = row.querySelector('strong')?.getBoundingClientRect() || row.getBoundingClientRect();
      const previewWidth = Math.min(340, window.innerWidth * 0.28);
      const previewHeight = previewWidth / 1.36;
      const x = Math.min(
        Math.max(titleRect.right + 24, 18),
        window.innerWidth - previewWidth - 28
      );
      const y = Math.min(
        Math.max(titleRect.top + titleRect.height / 2, previewHeight / 2 + 18),
        window.innerHeight - previewHeight / 2 - 18
      );

      document.documentElement.style.setProperty('--preview-x', `${x.toFixed(2)}px`);
      document.documentElement.style.setProperty('--preview-y', `${y.toFixed(2)}px`);
    };

    const renderPreview = row => {
      if (!preview) return;

      activePreviewRow = row;
      dockPreview(row);

      const meta = previewMeta(row);

      preview.className = `preview on is-${meta.type}`;
      preview.replaceChildren();

      if (meta.type === 'app' && row.href) {
        const appFrame = previewNode('iframe', 'preview-iframe');
        appFrame.src = row.getAttribute('href');
        appFrame.title = `${meta.title} preview`;
        appFrame.tabIndex = -1;
        appFrame.setAttribute('aria-hidden', 'true');
        renderFramePreview({
          title: meta.title,
          category: meta.category,
          media: appFrame,
          badge: 'LIVE APP',
          host: previewHost('')
        });
        return;
      }

      if (meta.type === 'site' && meta.captureUrl) {
        const shot = previewNode('div', 'preview-shot');
        shot.style.backgroundImage = `url("${siteCapture(meta.captureUrl)}")`;
        renderFramePreview({
          title: meta.title,
          category: meta.category,
          media: shot,
          badge: 'LIVE',
          host: previewHost(meta.captureUrl)
        });
        return;
      }

      const panel = previewNode('div', 'preview-panel');
      const top = previewNode('div', 'preview-panel-top');
      top.append(previewNode('span', '', meta.label), previewNode('span', '', meta.category));

      const center = previewNode('div', 'preview-panel-center');
      center.append(previewNode('strong', '', meta.title), previewNode('span', '', meta.note));

      const grid = previewNode('div', 'preview-mini-grid');
      const lines = meta.type === 'queued' ? ['Plan', 'Shape', 'Build'] : ['Open', 'Save', 'Sync'];
      lines.forEach(item => {
        const cell = previewNode('i', '', item);
        grid.append(cell);
      });

      const footer = previewNode('div', 'preview-panel-foot');
      footer.append(previewNode('span', '', meta.detail));

      panel.append(top, center, grid, footer);
      preview.append(panel);
    };

    document.querySelectorAll('.work-row').forEach(row => {
      row.addEventListener('pointerenter', () => renderPreview(row));
      row.addEventListener('pointerleave', () => {
        activePreviewRow = null;
        preview?.classList.remove('on');
      });
    });

    window.addEventListener('resize', () => dockPreview(activePreviewRow));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
