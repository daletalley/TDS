(() => {
  const canvas = document.getElementById('snake-field');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || reduced) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const CELL = 24;
  const ACTIVE_MS = 8000;
  const TICK_AMBIENT = 210;
  const TICK_ACTIVE = 135;
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

  const placeFood = () => {
    const taken = occupied();
    for (let i = 0; i < 80; i += 1) {
      const candidate = {
        x: 2 + Math.floor(random() * Math.max(1, cols - 4)),
        y: 2 + Math.floor(random() * Math.max(1, rows - 4))
      };
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
    const candidate = { x: head.x + next.x, y: head.y + next.y };
    const inside = candidate.x >= 1 && candidate.x < cols - 1 && candidate.y >= 1 && candidate.y < rows - 1;
    return inside && !taken.has(cellKey(candidate));
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
      const currentScore = Math.abs((snake[0].x + option.x) - food.x) + Math.abs((snake[0].y + option.y) - food.y);
      const bestScore = Math.abs((snake[0].x + best.x) - food.x) + Math.abs((snake[0].y + best.y) - food.y);
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

    const nextHead = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };
    snake.unshift(nextHead);

    if (sameCell(nextHead, food)) {
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
    ctx.arc(foodX, foodY, isActive() ? 4.5 : 3.5, 0, Math.PI * 2);
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
      const tickRate = isActive() ? TICK_ACTIVE : TICK_AMBIENT;
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
