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
  let activeUntil = 0;
  let lastFrame = 0;
  let tickCarry = 0;
  let hidden = document.hidden;

  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const sameCell = (a, b) => a.x === b.x && a.y === b.y;
  const opposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0;
  const isMobile = () => window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const isActive = () => performance.now() < activeUntil;

  const cellKey = cell => `${cell.x}:${cell.y}`;

  const occupied = () => new Set(snake.map(cellKey));
  const wrapCell = cell => ({
    x: (cell.x + cols) % cols,
    y: (cell.y + rows) % rows
  });
  const gridDistance = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.min(dx, cols - dx) + Math.min(dy, rows - dy);
  };

  const activeTickRate = () => Math.max(58, TICK_ACTIVE - Math.max(0, snake.length - 8) * 2);

  const placeFood = () => {
    const taken = occupied();
    const head = snake[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
    for (let i = 0; i < 80; i += 1) {
      const candidate = wrapCell({
        x: head.x + Math.floor((random() * 2 - 1) * FOOD_RADIUS),
        y: head.y + Math.floor((random() * 2 - 1) * Math.max(4, FOOD_RADIUS * .72))
      });
      if (!taken.has(cellKey(candidate))) {
        food = candidate;
        return;
      }
    }
    food = { x: Math.floor(cols * .72), y: Math.floor(rows * .34) };
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
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(12, Math.ceil(width / CELL));
    rows = Math.max(12, Math.ceil(height / CELL));
    resetSnake();
  };

  const safeDirection = next => {
    const head = snake[0];
    const taken = occupied();
    const candidate = wrapCell({ x: head.x + next.x, y: head.y + next.y });
    return !taken.has(cellKey(candidate));
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
      const currentScore = gridDistance(wrapCell({ x: snake[0].x + option.x, y: snake[0].y + option.y }), food);
      const bestScore = gridDistance(wrapCell({ x: snake[0].x + best.x, y: snake[0].y + best.y }), food);
      return currentScore < bestScore || (currentScore === bestScore && random() > .62) ? option : best;
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
      if (isActive()) activeUntil = performance.now() + ACTIVE_MS;
      placeFood();
    } else {
      snake.pop();
    }
  };

  const drawCell = (cell, index) => {
    const x = cell.x * CELL + 4;
    const y = cell.y * CELL + 4;
    const size = CELL - 8;
    const active = isActive();

    ctx.globalAlpha = active ? Math.max(.16, .58 - index * .035) : Math.max(.08, .26 - index * .018);
    ctx.fillStyle = index === 0 ? 'rgba(215,25,32,.76)' : 'rgba(17,17,17,.52)';
    ctx.strokeStyle = index === 0 ? 'rgba(215,25,32,.95)' : 'rgba(17,17,17,.42)';
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

    ctx.globalAlpha = isActive() ? .72 : .32 + pulse * .16;
    ctx.fillStyle = 'rgba(215,25,32,.9)';
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
  resize();
  window.requestAnimationFrame(frame);
})();
