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
  const START_LENGTH = 8;
  const ACTIVE_MS = 12000;
  const IDLE_RESET_MS = 22000;
  const COMBO_WINDOW_MS = 3800;
  const POWERUP_MS = 6500;
  const TICK_AMBIENT = 185;
  const TICK_PLAY = 104;
  const TICK_FOCUS = 132;
  const MAX_AMBIENT_LENGTH = 28;
  const MAX_PLAY_LENGTH = 84;
  const OPEN_SPACE_LIMIT = 220;
  const STORAGE_KEY = 'tds-snake-best-v2';
  const DIRECTIONS = [
    { x: 0, y: -1, name: 'up' },
    { x: 1, y: 0, name: 'right' },
    { x: 0, y: 1, name: 'down' },
    { x: -1, y: 0, name: 'left' }
  ];
  const INPUT_KEYS = new Map([
    ['ArrowUp', DIRECTIONS[0]],
    ['w', DIRECTIONS[0]],
    ['ArrowRight', DIRECTIONS[1]],
    ['d', DIRECTIONS[1]],
    ['ArrowDown', DIRECTIONS[2]],
    ['s', DIRECTIONS[2]],
    ['ArrowLeft', DIRECTIONS[3]],
    ['a', DIRECTIONS[3]]
  ]);

  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  let seed = 1337;
  let cols = 0;
  let rows = 0;
  let viewport = { width: 0, height: 0, dpr: 1 };
  let snake = [];
  let direction = DIRECTIONS[1];
  let queuedDirection = DIRECTIONS[1];
  let food = { x: 0, y: 0, kind: 'snack' };
  let powerup = null;
  let sparks = [];
  let floaters = [];
  let avoidRects = [];
  let mode = 'ambient';
  let score = 0;
  let best = Number(window.localStorage?.getItem(STORAGE_KEY) || 0);
  let streak = 0;
  let eaten = 0;
  let level = 1;
  let focusUntil = 0;
  let shield = 0;
  let activeUntil = 0;
  let lastInputAt = 0;
  let lastEatAt = 0;
  let tickCarry = 0;
  let lastFrame = 0;
  let hidden = document.hidden;
  let darkMode = darkScheme.matches;
  let touchStart = null;
  let testingNow = null;

  const now = () => testingNow ?? performance.now();
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sameCell = (a, b) => a.x === b.x && a.y === b.y;
  const opposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0;
  const cellKey = cell => `${cell.x}:${cell.y}`;
  const wrapCell = cell => ({
    x: (cell.x + cols) % cols,
    y: (cell.y + rows) % rows
  });
  const cellCenter = cell => ({ x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 });
  const isTyping = target => target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const isPlaying = () => mode === 'playing' || mode === 'paused' || mode === 'over';
  const isActive = () => mode === 'playing' && now() < activeUntil;
  const hasFocus = () => mode === 'playing' && now() < focusUntil;

  const palette = () => darkMode
    ? {
        grid: 'rgba(244,241,234,.055)',
        gridStrong: 'rgba(244,241,234,.09)',
        head: '#ff3b42',
        headSoft: 'rgba(255,59,66,.46)',
        body: 'rgba(244,241,234,.68)',
        bodySoft: 'rgba(244,241,234,.28)',
        food: '#ff3b42',
        power: '#58aaff',
        shield: '#4cc476',
        ink: '#f4f1ea',
        muted: 'rgba(244,241,234,.68)',
        panel: 'rgba(17,16,13,.78)',
        line: 'rgba(244,241,234,.22)'
      }
    : {
        grid: 'rgba(17,17,17,.05)',
        gridStrong: 'rgba(17,17,17,.085)',
        head: '#d71920',
        headSoft: 'rgba(215,25,32,.32)',
        body: 'rgba(17,17,17,.55)',
        bodySoft: 'rgba(17,17,17,.18)',
        food: '#d71920',
        power: '#0077d9',
        shield: '#138a42',
        ink: '#111',
        muted: 'rgba(17,17,17,.62)',
        panel: 'rgba(244,241,234,.78)',
        line: 'rgba(17,17,17,.22)'
      };

  const occupied = (includeTail = true) => new Set((includeTail ? snake : snake.slice(0, -1)).map(cellKey));
  const gridDistance = (a, b) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.min(dx, cols - dx) + Math.min(dy, rows - dy);
  };
  const cellVisible = cell => {
    const center = cellCenter(cell);
    return center.x >= CELL / 2 && center.x <= viewport.width - CELL / 2 && center.y >= CELL / 2 && center.y <= viewport.height - CELL / 2;
  };
  const inAvoidRect = cell => {
    const center = cellCenter(cell);
    return avoidRects.some(rect => center.x > rect.left && center.x < rect.right && center.y > rect.top && center.y < rect.bottom);
  };
  const openSpaceFrom = (start, blocked = occupied(false), limit = OPEN_SPACE_LIMIT) => {
    const seen = new Set([cellKey(start)]);
    const queue = [start];
    const maxCells = Math.min(cols * rows, limit);

    while (queue.length && seen.size < maxCells) {
      const cell = queue.shift();
      DIRECTIONS.forEach(move => {
        const next = wrapCell({ x: cell.x + move.x, y: cell.y + move.y });
        const key = cellKey(next);
        if (seen.has(key) || blocked.has(key) || !cellVisible(next)) return;
        seen.add(key);
        queue.push(next);
      });
    }

    return seen.size;
  };
  const exitsFrom = (cell, blocked = occupied(false)) => DIRECTIONS.reduce((total, move) => {
    const next = wrapCell({ x: cell.x + move.x, y: cell.y + move.y });
    return total + (!blocked.has(cellKey(next)) && cellVisible(next) && !inAvoidRect(next) ? 1 : 0);
  }, 0);
  const tailReachableFrom = (start, blocked = occupied(false)) => {
    const tail = snake[snake.length - 1];
    if (!tail) return true;

    const tailKey = cellKey(tail);
    const seen = new Set([cellKey(start)]);
    const queue = [start];

    while (queue.length && seen.size < OPEN_SPACE_LIMIT) {
      const cell = queue.shift();
      if (cellKey(cell) === tailKey) return true;
      DIRECTIONS.forEach(move => {
        const next = wrapCell({ x: cell.x + move.x, y: cell.y + move.y });
        const key = cellKey(next);
        if (seen.has(key) || (blocked.has(key) && key !== tailKey) || !cellVisible(next)) return;
        seen.add(key);
        queue.push(next);
      });
    }

    return false;
  };

  const readAvoidRects = () => {
    const margin = isPlaying() ? CELL * .5 : CELL;
    avoidRects = [...document.querySelectorAll('.topbar,.intro-footer,.work-list,.offer-grid,.contact-links')]
      .map(node => node.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0)
      .map(rect => ({
        left: rect.left - margin,
        right: rect.right + margin,
        top: rect.top - margin,
        bottom: rect.bottom + margin
      }));
  };

  const emitSparks = (cell, count, color) => {
    const center = cellCenter(cell);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 22 + random() * 80;
      sparks.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 360 + random() * 420,
        age: 0,
        size: 2 + random() * 4,
        color
      });
    }
    sparks = sparks.slice(-96);
  };

  const addFloater = (cell, text, color) => {
    const center = cellCenter(cell);
    floaters.push({ x: center.x, y: center.y, text, color, age: 0, life: 860 });
    floaters = floaters.slice(-8);
  };

  const pulse = (cell, strong = false) => {
    const center = cellCenter(cell);
    document.documentElement.style.setProperty('--pulse-x', `${center.x}px`);
    document.documentElement.style.setProperty('--pulse-y', `${center.y}px`);
    document.body.classList.add(strong ? 'snake-burst' : 'snake-pulse');
    window.setTimeout(() => {
      document.body.classList.remove('snake-pulse');
      document.body.classList.remove('snake-burst');
    }, strong ? 420 : 260);
  };

  const randomFreeCell = ({ nearHead = false, radius = 12, avoidContent = true, minDistance = 5 } = {}) => {
    const taken = occupied();
    if (powerup) taken.add(cellKey(powerup));
    if (food) taken.add(cellKey(food));
    const head = snake[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };

    for (let i = 0; i < 160; i += 1) {
      const candidate = nearHead && i < 84
        ? wrapCell({
            x: head.x + Math.floor((random() * 2 - 1) * radius),
            y: head.y + Math.floor((random() * 2 - 1) * Math.max(4, radius * .72))
          })
        : {
            x: Math.floor(random() * cols),
            y: Math.floor(random() * rows)
          };
      const farEnough = gridDistance(candidate, head) >= minDistance;
      const openEnough = openSpaceFrom(candidate, taken, 72) > Math.min(46, snake.length + 12);
      if (cellVisible(candidate) && !taken.has(cellKey(candidate)) && farEnough && openEnough && (!avoidContent || !inAvoidRect(candidate))) {
        return candidate;
      }
    }

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const candidate = { x, y };
        if (cellVisible(candidate) && !taken.has(cellKey(candidate)) && (!avoidContent || !inAvoidRect(candidate))) {
          return candidate;
        }
      }
    }

    return { x: Math.max(1, Math.floor(cols / 2)), y: Math.max(1, Math.floor(rows / 2)) };
  };

  const placeFood = () => {
    const bonus = mode === 'playing' && streak > 0 && streak % 5 === 0;
    food = {
      ...randomFreeCell({
        nearHead: true,
        radius: bonus ? 16 : 10,
        avoidContent: true,
        minDistance: Math.min(10, Math.max(4, snake.length * .24))
      }),
      kind: bonus ? 'bonus' : 'snack'
    };
  };

  const maybePlacePowerup = (force = false) => {
    if (!force && (mode !== 'playing' || powerup || eaten < 2 || random() > .28)) return;
    const roll = random();
    powerup = {
      ...randomFreeCell({ nearHead: true, radius: 18, avoidContent: true, minDistance: 7 }),
      kind: roll > .54 ? 'focus' : 'shield',
      expiresAt: now() + POWERUP_MS
    };
  };

  const saveBest = () => {
    if (score <= best) return;
    best = score;
    try {
      window.localStorage?.setItem(STORAGE_KEY, String(best));
    } catch {
      // Local storage can be unavailable in strict browser modes.
    }
  };

  const resetSnake = ({ play = false, keepScore = false } = {}) => {
    readAvoidRects();
    const start = {
      x: Math.max(5, Math.floor(cols * (play ? .34 : .18))),
      y: Math.max(5, Math.floor(rows * (play ? .42 : .24)))
    };
    direction = DIRECTIONS[1];
    queuedDirection = DIRECTIONS[1];
    snake = Array.from({ length: START_LENGTH }, (_, index) => ({
      x: wrapCell({ x: start.x - index, y: start.y }).x,
      y: start.y
    }));
    powerup = null;
    sparks = [];
    floaters = [];
    focusUntil = 0;
    shield = 0;
    tickCarry = 0;
    if (!keepScore) {
      score = 0;
      streak = 0;
      eaten = 0;
      level = 1;
    }
    placeFood();
  };

  const startPlaying = () => {
    if (mode === 'playing') return;
    if (mode === 'over' || mode === 'ambient') resetSnake({ play: true });
    mode = 'playing';
    activeUntil = now() + ACTIVE_MS;
    lastInputAt = now();
    document.body.classList.add('snake-active');
    readAvoidRects();
  };

  const gameOver = () => {
    if (shield > 0) {
      shield -= 1;
      const head = snake[0];
      resetSnake({ play: true, keepScore: true });
      snake[0] = head;
      emitSparks(head, 22, palette().shield);
      addFloater(head, 'shield', palette().shield);
      pulse(head, true);
      return;
    }
    mode = 'over';
    saveBest();
    activeUntil = now() + 2500;
    emitSparks(snake[0], 34, palette().head);
    pulse(snake[0], true);
  };

  const trimSnake = () => {
    const maxLength = Math.min(mode === 'playing' ? MAX_PLAY_LENGTH : MAX_AMBIENT_LENGTH, Math.max(START_LENGTH, cols * rows - 1));
    if (snake.length > maxLength) snake.length = maxLength;
  };

  const safeDirection = (next, { avoidContent = false } = {}) => {
    const head = snake[0];
    if (!head) return false;
    const taken = occupied(false);
    const candidate = wrapCell({ x: head.x + next.x, y: head.y + next.y });
    if (taken.has(cellKey(candidate))) return false;
    if (!cellVisible(candidate)) return false;
    if (avoidContent && inAvoidRect(candidate)) return false;
    return true;
  };

  const ambientDirection = () => {
    const options = [direction, ...DIRECTIONS].filter((option, index, list) => (
      list.findIndex(item => item.x === option.x && item.y === option.y) === index
      && !opposite(option, direction)
      && safeDirection(option)
    ));
    if (!options.length) return null;

    return options.reduce((bestOption, option) => {
      const scoreMove = move => {
        const candidate = wrapCell({ x: snake[0].x + move.x, y: snake[0].y + move.y });
        const blocked = occupied(false);
        const distance = gridDistance(candidate, food);
        const turnCost = move.x === direction.x && move.y === direction.y ? 0 : 2;
        const contentCost = inAvoidRect(candidate) ? 9 : 0;
        const openSpace = openSpaceFrom(candidate, blocked);
        const exits = exitsFrom(candidate, blocked);
        const spaceTarget = Math.min(OPEN_SPACE_LIMIT, snake.length * 3 + 18);
        const trapCost = openSpace < spaceTarget ? (spaceTarget - openSpace) * 1.25 : 0;
        const exitCost = exits < 2 ? 22 : exits === 2 ? 4 : 0;
        const tailCost = tailReachableFrom(candidate, blocked) ? 0 : 18;
        const spaceBonus = Math.min(openSpace, 112) / 10;
        return distance * 5 + turnCost + contentCost + trapCost + exitCost + tailCost - spaceBonus;
      };
      const current = scoreMove(option);
      const bestScore = scoreMove(bestOption);
      return current < bestScore || (current === bestScore && random() > .66) ? option : bestOption;
    }, options[0]);
  };

  const applySnack = nextHead => {
    const colors = palette();
    const comboAlive = now() - lastEatAt < COMBO_WINDOW_MS;
    streak = comboAlive ? streak + 1 : 1;
    lastEatAt = now();
    eaten += 1;
    level = 1 + Math.floor(eaten / 6);
    const bonus = food.kind === 'bonus';
    const gained = (bonus ? 45 : 10) + Math.min(40, (streak - 1) * 4);
    score += gained;
    activeUntil = now() + ACTIVE_MS;
    emitSparks(nextHead, bonus ? 26 : 15, bonus ? colors.power : colors.food);
    addFloater(nextHead, `+${gained}`, bonus ? colors.power : colors.food);
    pulse(nextHead, bonus);
    placeFood();
    maybePlacePowerup();
  };

  const applyPowerup = nextHead => {
    if (!powerup || !sameCell(nextHead, powerup)) return false;
    const colors = palette();
    if (powerup.kind === 'focus') {
      focusUntil = now() + 7000;
      addFloater(nextHead, 'focus', colors.power);
      emitSparks(nextHead, 24, colors.power);
    } else {
      shield = Math.min(2, shield + 1);
      addFloater(nextHead, 'shield', colors.shield);
      emitSparks(nextHead, 24, colors.shield);
    }
    score += 25;
    powerup = null;
    pulse(nextHead, true);
    return true;
  };

  const step = () => {
    if (!snake.length || mode === 'paused' || mode === 'over') return;

    const nextDirection = mode === 'playing' && safeDirection(queuedDirection)
      ? queuedDirection
      : ambientDirection();

    if (!nextDirection || !safeDirection(nextDirection)) {
      if (mode === 'playing') gameOver();
      else resetSnake();
      return;
    }

    direction = nextDirection;
    queuedDirection = direction;

    const nextHead = wrapCell({
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    });

    const body = occupied(false);
    if (body.has(cellKey(nextHead))) {
      if (mode === 'playing') gameOver();
      else resetSnake();
      return;
    }

    snake.unshift(nextHead);
    let grew = false;

    if (sameCell(nextHead, food)) {
      grew = true;
      applySnack(nextHead);
    }

    if (applyPowerup(nextHead)) grew = true;

    if (!grew) snake.pop();
    trimSnake();

    if (powerup && now() > powerup.expiresAt) powerup = null;
    if (mode === 'playing' && now() - lastInputAt > IDLE_RESET_MS) {
      mode = 'ambient';
      document.body.classList.remove('snake-active');
      resetSnake({ keepScore: false });
    }
  };

  const tickRate = () => {
    if (mode !== 'playing') return TICK_AMBIENT;
    const base = hasFocus() ? TICK_FOCUS : TICK_PLAY;
    return Math.max(58, base - Math.max(0, level - 1) * 6 - Math.max(0, snake.length - START_LENGTH) * .4);
  };

  const updateEffects = delta => {
    sparks.forEach(spark => {
      spark.age += delta;
      spark.x += spark.vx * delta / 1000;
      spark.y += spark.vy * delta / 1000;
      spark.vx *= .982;
      spark.vy *= .982;
    });
    sparks = sparks.filter(spark => spark.age < spark.life);

    floaters.forEach(item => {
      item.age += delta;
      item.y -= delta * .026;
    });
    floaters = floaters.filter(item => item.age < item.life);
  };

  const update = deltaMs => {
    if (hidden) return;
    tickCarry += deltaMs;
    const rate = tickRate();
    while (tickCarry >= rate) {
      step();
      tickCarry -= rate;
    }
    updateEffects(deltaMs);
  };

  const roundRect = (x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const drawGrid = colors => {
    ctx.save();
    ctx.lineWidth = 1;
    for (let x = (now() * .004) % CELL; x < viewport.width; x += CELL) {
      ctx.strokeStyle = x % (CELL * 5) < 1 ? colors.gridStrong : colors.grid;
      ctx.beginPath();
      ctx.moveTo(x + .5, 0);
      ctx.lineTo(x + .5, viewport.height);
      ctx.stroke();
    }
    for (let y = (now() * .002) % CELL; y < viewport.height; y += CELL) {
      ctx.strokeStyle = y % (CELL * 5) < 1 ? colors.gridStrong : colors.grid;
      ctx.beginPath();
      ctx.moveTo(0, y + .5);
      ctx.lineTo(viewport.width, y + .5);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawCollectible = (item, colors) => {
    if (!item) return;
    const center = cellCenter(item);
    const pulseSize = Math.sin(now() / 170) * 2;
    const isPower = item.kind === 'focus' || item.kind === 'shield';
    const color = item.kind === 'shield' ? colors.shield : item.kind === 'focus' ? colors.power : item.kind === 'bonus' ? colors.power : colors.food;
    ctx.save();
    ctx.globalAlpha = isPower ? .82 : .75;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (isPower) {
      ctx.translate(center.x, center.y);
      ctx.rotate(now() / 520);
      roundRect(-8 - pulseSize * .2, -8 - pulseSize * .2, 16 + pulseSize * .4, 16 + pulseSize * .4, 4);
      ctx.stroke();
      ctx.globalAlpha = .24;
      ctx.fill();
    } else if (item.kind === 'bonus') {
      ctx.translate(center.x, center.y);
      ctx.rotate(Math.PI / 4);
      roundRect(-8 - pulseSize, -8 - pulseSize, 16 + pulseSize * 2, 16 + pulseSize * 2, 3);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(center.x, center.y, 7 + pulseSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = .18;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 17 + pulseSize * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawSnake = colors => {
    ctx.save();
    for (let i = snake.length - 1; i >= 0; i -= 1) {
      const cell = snake[i];
      const center = cellCenter(cell);
      const head = i === 0;
      const age = i / Math.max(1, snake.length - 1);
      const size = head ? CELL - 7 : CELL - 9 - age * 3;
      const x = center.x - size / 2;
      const y = center.y - size / 2;
      ctx.globalAlpha = head ? .92 : Math.max(.12, (mode === 'playing' ? .62 : .35) - age * .38);
      ctx.fillStyle = head ? colors.head : colors.body;
      ctx.strokeStyle = head ? colors.head : colors.bodySoft;
      ctx.lineWidth = head ? 2 : 1;
      roundRect(x, y, size, size, head ? 6 : 4);
      ctx.fill();
      ctx.stroke();

      if (head) {
        const eyeOffset = 4;
        const side = direction.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 };
        ctx.fillStyle = darkMode ? '#11100d' : '#f4f1ea';
        ctx.globalAlpha = .88;
        ctx.beginPath();
        ctx.arc(center.x + direction.x * 4 + side.x * eyeOffset, center.y + direction.y * 4 + side.y * eyeOffset, 2.1, 0, Math.PI * 2);
        ctx.arc(center.x + direction.x * 4 - side.x * eyeOffset, center.y + direction.y * 4 - side.y * eyeOffset, 2.1, 0, Math.PI * 2);
        ctx.fill();
        if (shield > 0) {
          ctx.globalAlpha = .34;
          ctx.strokeStyle = colors.shield;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(center.x, center.y, 17 + Math.sin(now() / 200) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  const drawEffects = () => {
    ctx.save();
    sparks.forEach(spark => {
      const alpha = Math.max(0, 1 - spark.age / spark.life);
      ctx.globalAlpha = alpha * .78;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = '900 13px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    floaters.forEach(item => {
      const alpha = Math.max(0, 1 - item.age / item.life);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    });
    ctx.restore();
  };

  const drawHud = colors => {
    if (mode === 'ambient' && !isMobile()) {
      ctx.save();
      ctx.globalAlpha = .55;
      ctx.fillStyle = colors.panel;
      ctx.strokeStyle = colors.line;
      roundRect(18, viewport.height - 56, 214, 34, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.muted;
      ctx.font = '900 11px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ARROWS / WASD TO PLAY', 32, viewport.height - 39);
      ctx.restore();
      return;
    }

    if (mode === 'ambient') return;

    ctx.save();
    const compact = viewport.width < 620;
    const panelX = compact ? 18 : 18;
    const panelY = compact ? 176 : 88;
    const panelW = compact ? 188 : Math.min(380, viewport.width - 36);
    const panelH = compact ? 38 : 46;

    ctx.globalAlpha = compact ? .72 : .92;
    ctx.fillStyle = colors.panel;
    ctx.strokeStyle = colors.line;
    roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colors.ink;
    ctx.font = `900 ${compact ? 11 : 13}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const status = mode === 'paused' ? 'PAUSED' : mode === 'over' ? 'GAME OVER' : hasFocus() ? 'FOCUS' : `LEVEL ${level}`;
    const textY = panelY + panelH / 2;
    ctx.fillText(`SCORE ${score}`, panelX + 16, textY);
    ctx.fillStyle = colors.muted;
    if (compact) {
      ctx.fillText(status.replace('LEVEL ', 'L'), panelX + 112, textY);
    } else {
      ctx.fillText(`BEST ${best}`, 130, textY);
      ctx.fillText(status, 220, textY);
    }
    if (!compact && shield > 0) {
      ctx.fillStyle = colors.shield;
      ctx.fillText(`SHIELD ${shield}`, 302, textY);
    }

    if (mode === 'over') {
      const w = Math.min(300, viewport.width - 36);
      const x = (viewport.width - w) / 2;
      const y = Math.max(148, viewport.height * .34);
      ctx.fillStyle = colors.panel;
      ctx.strokeStyle = colors.line;
      roundRect(x, y, w, 88, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.ink;
      ctx.font = '900 20px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nice run.', viewport.width / 2, y + 31);
      ctx.fillStyle = colors.muted;
      ctx.font = '900 11px Arial, Helvetica, sans-serif';
      ctx.fillText('PRESS SPACE OR ENTER', viewport.width / 2, y + 62);
    }
    ctx.restore();
  };

  const draw = () => {
    const colors = palette();
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    document.body.classList.toggle('snake-active', mode === 'playing' || mode === 'over');
    document.body.classList.toggle('snake-focus', hasFocus());
    drawGrid(colors);
    drawCollectible(food, colors);
    drawCollectible(powerup, colors);
    drawSnake(colors);
    drawEffects();
    drawHud(colors);
    ctx.globalAlpha = 1;
  };

  const frame = timestamp => {
    if (!lastFrame) lastFrame = timestamp;
    const delta = Math.min(80, timestamp - lastFrame);
    lastFrame = timestamp;
    testingNow = null;
    update(delta);
    draw();
    window.requestAnimationFrame(frame);
  };

  const setDirection = next => {
    if (opposite(next, direction)) return false;
    startPlaying();
    queuedDirection = next;
    lastInputAt = now();
    activeUntil = now() + ACTIVE_MS;
    return true;
  };

  const togglePause = () => {
    if (mode === 'ambient') {
      startPlaying();
      return;
    }
    if (mode === 'over') {
      resetSnake({ play: true });
      mode = 'playing';
      return;
    }
    mode = mode === 'paused' ? 'playing' : 'paused';
    activeUntil = now() + ACTIVE_MS;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  window.addEventListener('keydown', event => {
    if (isTyping(event.target)) return;
    const normalized = INPUT_KEYS.has(event.key) ? event.key : event.key.toLowerCase();
    const next = INPUT_KEYS.get(normalized);

    if (next && !isMobile()) {
      if (setDirection(next)) event.preventDefault();
      return;
    }

    if (normalized === ' ' || normalized === 'enter') {
      event.preventDefault();
      togglePause();
      return;
    }

    if (normalized === 'r') {
      event.preventDefault();
      resetSnake({ play: true });
      mode = 'playing';
      activeUntil = now() + ACTIVE_MS;
      return;
    }

    if (normalized === 'f') {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if (event.key === 'Escape') {
      if (document.fullscreenElement) document.exitFullscreen?.();
      if (mode === 'playing') mode = 'paused';
    }
  });

  window.addEventListener('pointerdown', event => {
    if (!isMobile()) return;
    touchStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  window.addEventListener('pointerup', event => {
    if (!isMobile() || !touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.hypot(dx, dy) < 22) {
      togglePause();
      return;
    }
    const next = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? DIRECTIONS[1] : DIRECTIONS[3])
      : (dy > 0 ? DIRECTIONS[2] : DIRECTIONS[0]);
    setDirection(next);
  }, { passive: true });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = window.innerWidth;
    const height = window.innerHeight;
    viewport = { width, height, dpr };
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(12, Math.floor(width / CELL));
    rows = Math.max(12, Math.floor(height / CELL));
    resetSnake({ play: mode === 'playing', keepScore: mode === 'playing' });
  };

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    lastFrame = 0;
  });

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', readAvoidRects, { passive: true });
  darkScheme.addEventListener('change', event => {
    darkMode = event.matches;
  });

  window.render_game_to_text = () => JSON.stringify({
    note: 'Snake grid origin is top-left. x increases right, y increases down. Wraparound edges are active.',
    mode,
    score,
    best,
    level,
    streak,
    shield,
    focusActive: hasFocus(),
    snake: {
      head: snake[0],
      length: snake.length,
      direction: direction.name,
      body: snake.slice(0, 14)
    },
    food,
    powerup,
    controls: ['Arrow keys/WASD move', 'Space/Enter pause or restart', 'R restart', 'F fullscreen']
  });

  window.advanceTime = ms => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      testingNow = (testingNow ?? performance.now()) + (1000 / 60);
      update(1000 / 60);
    }
    draw();
  };

  resize();
  window.requestAnimationFrame(frame);
})();
