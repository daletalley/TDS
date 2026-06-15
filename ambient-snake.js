(() => {
  const canvas = document.getElementById('snake-field');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || reduced) return;

  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1',
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none'
  });

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const CELL = 24;
  const ACTIVE_MS = 8000;
  const FOOD_RADIUS = 9;
  const TICK_AMBIENT = 185;
  const TICK_ACTIVE = 88;
  const MAX_AMBIENT_LENGTH = 28;
  const MAX_ACTIVE_LENGTH = 48;
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const INPUT_KEYS = new Map([
    ['ArrowUp', { x: 0, y: -1 }],
    ['ArrowRight', { x: 1, y: 0 }],
    ['ArrowDown', { x: 0, y: 1 }],
    ['ArrowLeft', { x: -1, y: 0 }],
    ['w', { x: 0, y: -1 }],
    ['d', { x: 1, y: 0 }],
    ['s', { x: 0, y: 1 }],
    ['a', { x: -1, y: 0 }]
  ]);

  let seed = 1337;
  let cols = 0;
  let rows = 0;
  let snake = [];
  let direction = { x: 1, y: 0 };
  let queuedDirection = direction;
  let food = { x: 0, y: 0 };
  let viewport = { width: 0, height: 0 };
  let activeUntil = 0;
  let lastFrame = 0;
  let tickCarry = 0;
  let eaten = 0;
  let avoidRects = [];
  let hidden = document.hidden;
  let darkMode = darkScheme.matches;

  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const sameCell = (a, b) => a.x === b.x && a.y === b.y;
  const opposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0;
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const isActive = () => performance.now() < activeUntil;

  const cellKey = cell => `${cell.x}:${cell.y}`;

  const occupied = (includeTail = true) => new Set((includeTail ? snake : snake.slice(0, -1)).map(cellKey));
  const wrapCell = cell => ({
    x: (cell.x + cols) % cols,
    y: (cell.y + rows) % rows
  });
  const gridDistance = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.min(dx, cols - dx) + Math.min(dy, rows - dy);
  };
  const cellVisible = cell => {
    const center = cellCenter(cell);
    return center.x >= CELL / 2 && center.x <= viewport.width - CELL / 2 && center.y >= CELL / 2 && center.y <= viewport.height - CELL / 2;
  };
  const openSpaceFrom = start => {
    const blocked = occupied(false);
    const seen = new Set([cellKey(start)]);
    const queue = [start];
    const limit = Math.min(cols * rows, 90);

    while (queue.length && seen.size < limit) {
      const cell = queue.shift();
      [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 }
      ].forEach(move => {
        const next = wrapCell({ x: cell.x + move.x, y: cell.y + move.y });
        const key = cellKey(next);
        if (seen.has(key) || blocked.has(key) || !cellVisible(next)) return;
        seen.add(key);
        queue.push(next);
      });
    }

    return seen.size;
  };

  const activeTickRate = () => Math.max(58, TICK_ACTIVE - Math.max(0, snake.length - 8) * 2);
  const maxSnakeLength = () => isActive() ? MAX_ACTIVE_LENGTH : MAX_AMBIENT_LENGTH;
  const trimSnake = () => {
    const maxLength = Math.min(maxSnakeLength(), Math.max(8, cols * rows - 1));
    if (snake.length > maxLength) {
      snake.length = maxLength;
    }
  };
  const palette = () => darkMode
    ? {
        head: 'rgba(255,59,66,.84)',
        headStroke: 'rgba(255,59,66,.96)',
        tail: 'rgba(244,241,234,.58)',
        tailStroke: 'rgba(244,241,234,.42)',
        food: 'rgba(255,59,66,.92)'
      }
    : {
        head: 'rgba(215,25,32,.76)',
        headStroke: 'rgba(215,25,32,.95)',
        tail: 'rgba(17,17,17,.52)',
        tailStroke: 'rgba(17,17,17,.42)',
        food: 'rgba(215,25,32,.9)'
      };
  const cellCenter = cell => ({ x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 });
  const inAvoidRect = cell => {
    const center = cellCenter(cell);
    return avoidRects.some(rect => center.x > rect.left && center.x < rect.right && center.y > rect.top && center.y < rect.bottom);
  };
  const pulse = cell => {
    const center = cellCenter(cell);
    document.documentElement.style.setProperty('--pulse-x', `${center.x}px`);
    document.documentElement.style.setProperty('--pulse-y', `${center.y}px`);
    document.body.classList.add('snake-pulse');
    window.setTimeout(() => document.body.classList.remove('snake-pulse'), 260);
  };
  const readAvoidRects = () => {
    avoidRects = [...document.querySelectorAll('.topbar,.intro-footer,.work-list,.offer-grid,.contact-links')]
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => ({
        left: rect.left - CELL,
        right: rect.right + CELL,
        top: rect.top - CELL,
        bottom: rect.bottom + CELL
      }));
  };

  const placeFood = () => {
    const taken = occupied();
    const head = snake[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    for (let i = 0; i < 120; i += 1) {
      const nearHead = i < 54;
      const candidate = nearHead
        ? wrapCell({
            x: head.x + Math.floor((random() * 2 - 1) * FOOD_RADIUS),
            y: head.y + Math.floor((random() * 2 - 1) * Math.max(4, FOOD_RADIUS * .72))
          })
        : {
            x: Math.floor(random() * cols),
            y: Math.floor(random() * rows)
          };
      if (cellVisible(candidate) && !taken.has(cellKey(candidate)) && !inAvoidRect(candidate)) {
        food = candidate;
        return;
      }
    }
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const candidate = { x, y };
        if (cellVisible(candidate) && !taken.has(cellKey(candidate))) {
          food = candidate;
          return;
        }
      }
    }
  };

  const resetSnake = () => {
    const start = {
      x: Math.max(4, Math.floor(cols * .18)),
      y: Math.max(4, Math.floor(rows * .24))
    };
    direction = { x: 1, y: 0 };
    queuedDirection = direction;
    snake = Array.from({ length: 8 }, (_, index) => ({
      x: start.x - index,
      y: start.y
    }));
    placeFood();
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = window.innerWidth;
    const height = window.innerHeight;
    viewport = { width, height };
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(12, Math.floor(width / CELL));
    rows = Math.max(12, Math.floor(height / CELL));
    readAvoidRects();
    resetSnake();
  };

  const safeDirection = (next, { avoidContent = false } = {}) => {
    const head = snake[0];
    const taken = occupied(false);
    const candidate = wrapCell({ x: head.x + next.x, y: head.y + next.y });
    if (taken.has(cellKey(candidate))) return false;
    if (!cellVisible(candidate)) return false;
    if (avoidContent && inAvoidRect(candidate)) return false;
    return true;
  };

  const ambientDirection = () => {
    const options = [
      direction,
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 }
    ].filter(option => !opposite(option, direction) && safeDirection(option));

    if (!options.length) return null;

    return options.reduce((best, option) => {
      const score = move => {
        const candidate = wrapCell({ x: snake[0].x + move.x, y: snake[0].y + move.y });
        const distance = gridDistance(candidate, food);
        const turnCost = move.x === direction.x && move.y === direction.y ? 0 : 2;
        const contentCost = inAvoidRect(candidate) ? 8 : 0;
        const spaceBonus = Math.min(openSpaceFrom(candidate), 64) / 12;
        return distance * 6 + turnCost + contentCost - spaceBonus;
      };
      const currentScore = score(option);
      const bestScore = score(best);
      return currentScore < bestScore || (currentScore === bestScore && random() > .66) ? option : best;
    }, options[0]);
  };

  const step = () => {
    const nextDirection = isActive() ? queuedDirection : ambientDirection();
    if (!nextDirection || !safeDirection(nextDirection)) {
      resetSnake();
      return;
    }

    direction = nextDirection;
    queuedDirection = direction;

    const nextHead = wrapCell({
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    });
    snake.unshift(nextHead);

    if (sameCell(nextHead, food)) {
      eaten += 1;
      pulse(nextHead);
      if (isActive()) activeUntil = performance.now() + ACTIVE_MS;
      trimSnake();
      placeFood();
    } else {
      snake.pop();
    }

    trimSnake();
  };

  const drawCell = (cell, index) => {
    const x = cell.x * CELL + 4;
    const y = cell.y * CELL + 4;
    const size = CELL - 8;
    const active = isActive();
    const colors = palette();

    ctx.globalAlpha = active ? Math.max(.22, .68 - index * .04) : Math.max(.13, .34 - index * .022);
    ctx.fillStyle = index === 0 ? colors.head : colors.tail;
    ctx.strokeStyle = index === 0 ? colors.headStroke : colors.tailStroke;
    ctx.lineWidth = index === 0 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x + .5, y + .5, size - 1, size - 1);
  };

  const draw = now => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    document.body.classList.toggle('snake-active', isActive());

    const pulse = .42 + Math.sin(now / 320) * .18;
    const foodX = food.x * CELL + CELL / 2;
    const foodY = food.y * CELL + CELL / 2;
    const colors = palette();

    ctx.globalAlpha = isActive() ? .72 : .32 + pulse * .16;
    ctx.fillStyle = colors.food;
    ctx.beginPath();
    ctx.arc(foodX, foodY, isActive() ? 9 : 7, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach(drawCell);
    ctx.globalAlpha = 1;
  };

  const frame = now => {
    if (!lastFrame) lastFrame = now;
    const delta = now - lastFrame;
    lastFrame = now;

    if (!hidden) {
      tickCarry += delta;
      const tickRate = isActive() ? activeTickRate() : TICK_AMBIENT;
      while (tickCarry >= tickRate) {
        step();
        tickCarry -= tickRate;
      }
      draw(now);
    }

    window.requestAnimationFrame(frame);
  };

  window.addEventListener('keydown', event => {
    const target = event.target;
    const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    const key = INPUT_KEYS.has(event.key) ? event.key : event.key.toLowerCase();
    const next = INPUT_KEYS.get(key);

    if (!next || typing || isMobile()) return;
    if (opposite(next, direction)) return;

    event.preventDefault();
    queuedDirection = next;
    activeUntil = performance.now() + ACTIVE_MS;
  });

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    lastFrame = 0;
  });

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', readAvoidRects, { passive: true });
  darkScheme.addEventListener('change', event => {
    darkMode = event.matches;
  });
  resize();
  window.requestAnimationFrame(frame);
})();
