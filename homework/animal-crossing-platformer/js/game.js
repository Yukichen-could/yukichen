/* =========================================================
   game.js  —  森友大冒险 主逻辑
   ========================================================= */
(function () {
  const AC = window.AC;
  const art = AC.art;
  const music = AC.music;
  const T = 40, W = 960, H = 560;

  /* ---------------- 画布 ---------------- */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* ---------------- 舞台缩放变量 ---------------- */
  const stage = document.getElementById('stage');
  function fitStage() {
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--s', (r.width / W).toFixed(4));
  }
  window.addEventListener('resize', fitStage);

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), hudName: $('hud-name'), hudAvatar: $('hud-avatar'), hudHearts: $('hud-hearts'),
    hudLevel: $('hud-level'), hudTheme: $('hud-theme'), hudBar: $('hud-bar'), hudBarIcon: $('hud-bar-icon'),
    hudPct: $('hud-pct'), hudBells: $('hud-bells'), hudLeaves: $('hud-leaves'),
    banner: $('banner'), bannerTag: $('banner-tag'), bannerName: $('banner-name'), bannerSub: $('banner-sub'),
    screenStart: $('screen-start'), screenCrop: $('screen-crop'), screenPause: $('screen-pause'),
    screenClear: $('screen-clear'), screenCongrats: $('screen-congrats'), touch: $('touch'),
    name: $('player-name'), avatarList: $('avatar-list'), levelList: $('level-list'),
    cropCanvas: $('crop-canvas'), cropZoom: $('crop-zoom'), confetti: $('confetti'),
    clearTitle: $('clear-title'), clearStats: $('clear-stats'),
    congratsName: $('congrats-name'), congratsStats: $('congrats-stats'), congratsAvatar: $('congrats-avatar'),
    congratsQuote: $('congrats-quote'),
    fileInput: $('file-input'), bgmInput: $('bgm-input'),
    toast: $('toast'), shop: $('btn-shop'), buyGun: $('btn-buy-gun'),
  };

  /* ---------------- 状态 ---------------- */
  const CONF = { GRAV: 2200, MAXFALL: 980, ACC: 2800, AIRACC: 1900, MAXRUN: 268, FRIC: 3000, JUMP: -782 };
  const SAVE_KEY = 'ac-adventure-save-v1';
  const GUN_COST = 20;          // 一把手枪的价格（铃钱）
  const GUN_COOLDOWN = 0.22;    // 射速

  const state = {
    mode: 'title',        // title | play | pause | clear | congrats
    idx: 0,
    unlocked: 1,
    avatar: { mode: 'villager', variant: 0, photo: null },
    totalBells: 0,
    wallet: 0,            // 可用铃钱（可消费）
    gun: false,           // 本关是否已装备手枪（每关重置）
    totalTime: 0,
    lives: 3,
    maxLives: 3,
    levelBells: 0,
    levelTotalBells: 0,
    levelStart: 0,
    freeze: 0,
    result: 'clear',
  };

  let level = null;
  let cam = { x: 0 };
  let particles = [];
  let ambient = [];
  let bullets = [];
  let shootCd = 0;
  let toastTimer = 0;
  let keys = {};
  let tNow = 0;
  let blinkTimer = 0, blinkOn = false;
  let hudCache = {};

  const player = {
    x: 0, y: 0, w: 30, h: 42, vx: 0, vy: 0,
    onGround: false, facing: 1, invuln: 0, runPhase: 0, squash: 0,
    prevBottom: 0, rideRef: null, coyote: 0, jumpBuf: 0, jumpHeld: false, blink: false, happy: false,
  };

  /* ---------------- 存档 ---------------- */
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.name) el.name.value = d.name;
      if (typeof d.unlocked === 'number') state.unlocked = Math.max(1, Math.min(6, d.unlocked));
      if (typeof d.wallet === 'number') state.wallet = Math.max(0, d.wallet);
      if (typeof d.variant === 'number') state.avatar.variant = d.variant;
      if (d.avatarMode === 'photo' && d.photo) {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = c.height = 256;
          c.getContext('2d').drawImage(img, 0, 0, 256, 256);
          state.avatar.photo = c;
          renderAvatarList();
        };
        img.src = d.photo;
      }
    } catch (e) { /* ignore */ }
    if (!el.name.value) el.name.value = '小旅人';
  }
  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        name: el.name.value || '小旅人',
        unlocked: state.unlocked,
        wallet: state.wallet,
        variant: state.avatar.variant,
        avatarMode: state.avatar.mode,
        photo: state.avatar.photo ? state.avatar.photo.toDataURL('image/jpeg', 0.8) : null,
      }));
    } catch (e) { /* ignore */ }
  }

  /* =========================================================
     关卡加载
     ========================================================= */
  /* 把紧挨着的同高地面合并成一块，消除接缝处的圆角缝隙（纯视觉，物理不变） */
  function mergeGrounds(solids) {
    const grounds = solids.filter((s) => !s.oneWay && !s.mover)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const merged = [];
    for (const s of grounds) {
      const last = merged[merged.length - 1];
      if (last && last.y === s.y && s.x <= last.x + last.w + 2) {
        last.w = Math.max(last.w, s.x + s.w - last.x);
        last.h = Math.max(last.h, s.h);
      } else {
        merged.push({ x: s.x, y: s.y, w: s.w, h: s.h });
      }
    }
    return merged;
  }

  function loadLevel(i) {
    const src = AC.LEVELS[i];
    state.idx = i;
    level = {
      id: src.id, name: src.name, short: src.short, hint: src.hint,
      cols: src.cols, width: src.width, seed: src.seed,
      themeIdx: src.theme, theme: art.THEMES[src.theme],
      solids: src.solids.map((s) => Object.assign({}, s, { dx: 0, dy: 0, phase: 0 })),
      enemies: src.enemies.map((e) => Object.assign({}, e)),
      items: src.items.map((it) => Object.assign({}, it, { got: false })),
      goal: Object.assign({}, src.goal),
      spawn: Object.assign({}, src.spawn),
      checkpoint: Object.assign({}, src.checkpoint, { on: false }),
      decor: art.buildDecor(src),
      pits: src.pits,
    };
    level.groundRects = mergeGrounds(level.solids);

    // 移动平台的初始相位错开
    let k = 0;
    level.solids.forEach((s) => { if (s.mover) s.phase = (k++ * 0.9) % (Math.PI * 2); });

    state.levelBells = 0;
    state.levelTotalBells = level.items.filter((it) => it.type === 'bell').length;
    // 生命值跨关保留，不再每关重置
    state.levelStart = performance.now();
    // 手枪只能用一局：每关开始清空
    state.gun = false;
    bullets = [];
    shootCd = 0;
    particles = [];
    cam.x = 0;
    initAmbient();
    respawn(true);

    // 音乐移调
    music.setLevel(i);

    // HUD
    el.hudLevel.textContent = '关卡 ' + (i + 1) + '/6';
    el.hudTheme.textContent = level.name;
    renderLeaves();
    paintHudAvatar();

    // 横幅
    el.bannerTag.textContent = 'LEVEL ' + (i + 1);
    el.bannerName.textContent = level.name;
    el.bannerSub.textContent = level.hint;
    el.banner.classList.remove('hidden');
    state.freeze = 1.5;
    // 重新触发动画
    const inner = el.banner.querySelector('.banner-inner');
    inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
  }

  function respawn(full) {
    const s = (!full && level.checkpoint.on) ? level.checkpoint : level.spawn;
    player.x = s.x;
    player.y = s.y - player.h - 2;
    player.vx = 0; player.vy = 0;
    // 关卡开场不闪烁；坠落后重生给短暂无敌
    player.invuln = full ? 0 : 1.2;
    player.onGround = false;
    player.facing = 1;
    player.happy = false;
    cam.x = Math.max(0, Math.min(level.width - W, player.x - W * 0.42));
  }

  /* =========================================================
     输入
     ========================================================= */
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', Spacebar: 'jump',
    ArrowDown: 'down', s: 'down', S: 'down',
    j: 'shoot', J: 'shoot', k: 'shoot', K: 'shoot', f: 'shoot', F: 'shoot',
  };
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      if (state.mode === 'play') pauseGame();
      else if (state.mode === 'pause') resumeGame();
    }
    if (e.key === 'm' || e.key === 'M') toggleSound();
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) { keys[k] = false; e.preventDefault(); }
  });
  window.addEventListener('blur', () => { keys = {}; });

  // 触屏
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) el.touch.classList.remove('hidden');
  el.touch.querySelectorAll('.tbtn').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); keys[k] = true; };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  /* =========================================================
     碰撞
     ========================================================= */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updateMovers(dt) {
    for (const s of level.solids) {
      if (!s.mover) continue;
      s.phase += dt * s.speed / Math.max(1, s.range);
      const off = Math.sin(s.phase) * (s.range / 2);
      const nx = s.axis === 'x' ? s.baseX + off : s.baseX;
      const ny = s.axis === 'y' ? s.baseY + off : s.baseY;
      s.dx = nx - s.x; s.dy = ny - s.y;
      s.x = nx; s.y = ny;
    }
  }

  function collideX(e) {
    for (const s of level.solids) {
      if (s.oneWay) continue;
      if (aabb(e, s)) {
        if (e.vx > 0) e.x = s.x - e.w;
        else if (e.vx < 0) e.x = s.x + s.w;
        e.vx = 0;
      }
    }
  }

  function collideY(e) {
    e.onGround = false; e.rideRef = null;
    for (const s of level.solids) {
      if (!aabb(e, s)) continue;
      if (s.oneWay) {
        if (e.vy >= 0 && e.prevBottom <= s.y + 14) {
          e.y = s.y - e.h; e.vy = 0; e.onGround = true; e.rideRef = s;
        }
      } else {
        if (e.vy > 0) { e.y = s.y - e.h; e.vy = 0; e.onGround = true; e.rideRef = s; }
        else if (e.vy < 0) { e.y = s.y + s.h; e.vy = 0; }
      }
    }
  }

  /* =========================================================
     粒子
     ========================================================= */
  function spawnParticles(x, y, n, kind, colors, spread, size, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * (spread || 120);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: life || 0.7, max: life || 0.7, kind,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: (size || 5) * (0.6 + Math.random() * 0.8),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
      });
    }
  }
  function floatText(x, y, text, color) {
    particles.push({
      x, y, vx: 0, vy: -52, life: 0.85, max: 0.85, kind: 'plus',
      color: color || '#ffe27a', size: 0, text,
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 520 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985;
      if (p.rot != null) p.rot += p.vr * dt;
    }
  }

  /* =========================================================
     手枪 / 子弹
     ========================================================= */
  function fireGun() {
    if (!state.gun || shootCd > 0) return;
    shootCd = GUN_COOLDOWN;
    const dir = player.facing || 1;
    const bx = player.x + player.w / 2 + dir * (player.w * 0.62);
    const by = player.y + player.h * 0.44;
    bullets.push({ x: bx, y: by, vx: dir * 780, life: 1.1, dir });
    player.squash = -0.14;
    player.vx -= dir * 22;
    music.sfx('shoot');
    spawnParticles(bx, by, 4, 'spark', ['#fff3b0', '#ffd75e', '#ffffff'], 100, 3.2, 0.26);
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -60 || b.x > level.width + 60;

      // 打中敌人
      if (!dead) {
        for (const e of level.enemies) {
          if (e.dead) continue;
          if (b.x > e.x - 6 && b.x < e.x + e.w + 6 && b.y > e.y - 4 && b.y < e.y + e.h + 4) {
            e.dead = 0.001;
            music.sfx('stomp');
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 12, 'spark',
              ['#fff3b0', '#ffb3cd', '#ffffff', '#ffd75e'], 210, 5.4, 0.55);
            floatText(e.x + e.w / 2, e.y - 6, 'BANG!', '#ffd75e');
            dead = true;
            break;
          }
        }
      }

      // 打中地形就消失（单向木板可以穿）
      if (!dead) {
        for (const s of level.solids) {
          if (s.oneWay) continue;
          if (b.x > s.x && b.x < s.x + s.w && b.y > s.y && b.y < s.y + s.h) {
            spawnParticles(b.x, b.y, 4, 'spark', ['#fff3b0', '#ffffff'], 110, 3, 0.3);
            dead = true;
            break;
          }
        }
      }

      if (dead) {
        if (b.life <= 0) spawnParticles(b.x, b.y, 2, 'puff', ['rgba(255,255,255,.6)'], 40, 3, 0.2);
        bullets.splice(i, 1);
      }
    }
  }

  /* =========================================================
     提示条 / 枪铺
     ========================================================= */
  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.className = 'toast' + (kind ? ' ' + kind : '');
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2000);
  }

  function buyGun() {
    if (state.mode === 'title' || state.mode === 'clear' || state.mode === 'congrats') return;
    if (state.gun) { toast('本关已经有手枪啦，按 J / K 开枪', 'good'); return; }
    if (state.wallet < GUN_COST) {
      toast('还差 ' + (GUN_COST - state.wallet) + ' 个铃钱才能换枪～', 'bad');
      music.sfx('ui');
      return;
    }
    state.wallet -= GUN_COST;
    state.gun = true;
    shootCd = 0;
    writeSave();
    music.sfx('buy');
    toast('🔫 手枪到手！本关有效，按 J / K 开枪', 'good');
    spawnParticles(player.x + player.w / 2, player.y + player.h * 0.3, 22, 'spark',
      ['#ffe27a', '#ffffff', '#ffb3cd', '#8fd06a'], 240, 6, 0.85);
    updateHUD();
  }

  const WEATHER = {    petal: { n: 22, kind: 'petal', color: ['#ffb3cd', '#ffd0de', '#fff0f5'], vy: 42, vx: -26, size: 5.5 },
    leaf: { n: 20, kind: 'leaf', color: ['#e8823c', '#f2a75c', '#c85a2c'], vy: 50, vx: -34, size: 5 },
    snow: { n: 42, kind: 'snow', color: ['#ffffff', '#e8f4ff', '#d0e8f8'], vy: 44, vx: -14, size: 2.8 },
    sparkle: { n: 14, kind: 'star', color: ['#fff7c0', '#ffffff', '#ffe8a0'], vy: 14, vx: -8, size: 3.4 },
    star: { n: 18, kind: 'star', color: ['#fff7c0', '#cfe0ff', '#ffffff'], vy: 18, vx: -10, size: 3 },
  };

  function initAmbient() {
    const cfg = WEATHER[level.theme.weather] || WEATHER.petal;
    ambient = [];
    for (let i = 0; i < cfg.n; i++) {
      ambient.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: cfg.vx * (0.6 + Math.random() * 0.8),
        vy: cfg.vy * (0.6 + Math.random() * 0.9),
        r: cfg.size * (0.6 + Math.random() * 0.9),
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3,
        ph: Math.random() * 6,
      });
    }
  }
  function updateAmbient(dt, t) {
    const cfg = WEATHER[level.theme.weather] || WEATHER.petal;
    for (const a of ambient) {
      a.x += (a.vx + Math.sin(t * 1.3 + a.ph) * 16) * dt;
      a.y += a.vy * dt;
      a.rot += a.vr * dt;
      if (a.y > H + 20) { a.y = -20; a.x = Math.random() * W; }
      if (a.x < -20) a.x = W + 20;
      if (a.x > W + 20) a.x = -20;
    }
  }

  /* =========================================================
     更新
     ========================================================= */
  function update(dt) {
    tNow += dt;

    // 眨眼
    blinkTimer -= dt;
    if (blinkTimer < 0) { blinkOn = !blinkOn; blinkTimer = blinkOn ? 0.12 : 2.2 + Math.random() * 2.4; }
    player.blink = blinkOn;

    if (state.freeze > 0) {
      state.freeze -= dt;
      if (state.freeze <= 0) el.banner.classList.add('hidden');
      updateAmbient(dt, tNow);
      return;
    }

    updateMovers(dt);

    // ---- 骑乘移动平台 ----
    if (player.rideRef && player.rideRef.mover) {
      player.x += player.rideRef.dx;
      player.y += player.rideRef.dy;
    }

    // ---- 水平输入 ----
    const left = keys.left || keys.a, right = keys.right || keys.d;
    const jump = keys.jump || keys.up;
    const acc = player.onGround ? CONF.ACC : CONF.AIRACC;
    if (left && !right) {
      player.vx -= acc * dt; player.facing = -1;
    } else if (right && !left) {
      player.vx += acc * dt; player.facing = 1;
    } else {
      const f = (player.onGround ? CONF.FRIC : CONF.FRIC * 0.35) * dt;
      if (Math.abs(player.vx) <= f) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * f;
    }
    player.vx = Math.max(-CONF.MAXRUN, Math.min(CONF.MAXRUN, player.vx));

    // ---- 跳跃 ----
    if (player.onGround) player.coyote = 0.1; else player.coyote -= dt;
    if (jump && !player.jumpHeld) player.jumpBuf = 0.14;
    player.jumpHeld = jump;
    player.jumpBuf -= dt;

    if (player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = CONF.JUMP;
      player.onGround = false; player.coyote = 0; player.jumpBuf = 0;
      player.squash = -0.35;
      music.sfx('jump');
      spawnParticles(player.x + player.w / 2, player.y + player.h, 5, 'puff', ['rgba(255,255,255,.85)'], 70, 4, 0.32);
    }
    // 短跳
    if (!jump && player.vy < -180) player.vy = -180;

    // ---- 手枪（本关有效） ----
    shootCd = Math.max(0, shootCd - dt);
    if (keys.shoot && state.gun) fireGun();

    // ---- 重力 ----
    player.vy += CONF.GRAV * dt;
    if (player.vy > CONF.MAXFALL) player.vy = CONF.MAXFALL;

    // ---- 移动并碰撞 ----
    player.prevBottom = player.y + player.h;
    player.x += player.vx * dt;
    collideX(player);
    const wasAir = !player.onGround;
    player.y += player.vy * dt;
    collideY(player);
    if (player.onGround && wasAir && Math.abs(player.vy) < 900) {
      if (!player.wasGround) {
        player.squash = 0.3;
        music.sfx('land');
        spawnParticles(player.x + player.w / 2, player.y + player.h, 4, 'puff', ['rgba(255,255,255,.7)'], 60, 3.4, 0.26);
      }
    }
    player.wasGround = player.onGround;

    // 边界
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > level.width) { player.x = level.width - player.w; player.vx = 0; }

    // 动画
    player.runPhase += dt * (player.onGround ? Math.abs(player.vx) * 0.055 + (Math.abs(player.vx) > 8 ? 4 : 0) : 0);
    player.squash *= Math.pow(0.001, dt);
    if (player.invuln > 0) player.invuln -= dt;

    // 掉坑
    if (player.y > H + 120) { die('fall'); return; }

    // ---- 敌人 ----
    for (let i = level.enemies.length - 1; i >= 0; i--) {
      const e = level.enemies[i];
      e.t += dt;
      if (e.dead) {
        e.dead += dt;
        if (e.dead > 0.5) level.enemies.splice(i, 1);
        continue;
      }
      if (e.type === 'walker') {
        e.x += e.vx * e.dir * dt;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
      } else {
        e.x += e.vx * e.dir * dt;
        if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
        e.y = e.baseY + Math.sin(e.t * 1.7) * e.amp;
      }

      if (player.invuln > 0 && player.invuln > 1.0) continue;
      if (aabb(player, e)) {
        const stomping = player.vy > 40 && player.prevBottom <= e.y + e.h * 0.6;
        if (stomping) {
          e.dead = 0.001;
          player.vy = -560;
          player.squash = -0.4;
          music.sfx('stomp');
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 8, 'spark', ['#fff3b0', '#a8e063', '#ffffff'], 170, 5, 0.5);
          floatText(e.x + e.w / 2, e.y - 4, '+5', '#fff3b0');
          state.levelBells += 0; // 不计入铃钱
        } else {
          hurt();
        }
      }
    }

    // ---- 子弹 ----
    updateBullets(dt);

    // ---- 道具 ----
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    for (const it of level.items) {
      if (it.got) continue;
      if (Math.hypot(it.x - pcx, it.y - pcy) > 32) continue;
      it.got = true;
      if (it.type === 'bell') {
        state.levelBells++; state.totalBells++; state.wallet++;
        music.sfx('bell');
        floatText(it.x, it.y - 8, '+10', '#ffe27a');
        spawnParticles(it.x, it.y, 6, 'spark', ['#ffe27a', '#fff3b0', '#ffffff'], 130, 4.5, 0.5);
      } else {
        state.lives = Math.min(state.maxLives + 1, state.lives + 1);
        state.maxLives = Math.max(state.maxLives, state.lives);
        music.sfx('fruit');
        floatText(it.x, it.y - 8, '+1 ♥', '#ff8fa8');
        spawnParticles(it.x, it.y, 12, 'spark', ['#ff8fa8', '#ffd0de', '#ffffff'], 180, 6, 0.7);
      }
    }

    // ---- 检查点 ----
    if (!level.checkpoint.on && Math.abs(player.x - level.checkpoint.x) < 40 && player.y + player.h > level.checkpoint.y - 90) {
      level.checkpoint.on = true;
      music.sfx('check');
      floatText(level.checkpoint.x, level.checkpoint.y - 80, '检查点!', '#8fd06a');
      spawnParticles(level.checkpoint.x, level.checkpoint.y - 60, 14, 'spark', ['#8fd06a', '#fff3b0', '#ffffff'], 200, 6, 0.8);
    }

    // ---- 终点 ----
    const gbox = { x: level.goal.x - 34, y: level.goal.y - 150, w: 100, h: 152 };
    if (aabb(player, gbox)) { completeLevel(); return; }

    // ---- 相机 ----
    const targetX = Math.max(0, Math.min(level.width - W, player.x + player.w / 2 - W * 0.42));
    cam.x += (targetX - cam.x) * Math.min(1, dt * 9);

    updateParticles(dt);
    updateAmbient(dt, tNow);
    updateHUD();
  }

  function hurt() {
    if (player.invuln > 0) return;
    state.lives--;
    music.sfx('hurt');
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 12, 'spark', ['#ff8fa8', '#ffffff', '#ffd0de'], 190, 6, 0.6);
    if (state.lives <= 0) { endLevel('fail'); return; }
    player.invuln = 1.7;
    player.vy = -430;
    player.vx = -player.facing * 200;
    el.hudHearts.textContent = '';
    renderHearts(true);
  }

  function die() {
    state.lives--;
    music.sfx('hurt');
    if (state.lives <= 0) { endLevel('fail'); return; }
    respawn(false);
    renderHearts(true);
  }

  /* =========================================================
     关卡结果
     ========================================================= */
  function completeLevel() {
    if (state.mode !== 'play') return;
    music.sfx('goal');
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    spawnParticles(cx, cy, 40, 'spark', ['#ffe27a', '#fff3b0', '#ff9ec4', '#8fd06a', '#ffffff'], 330, 8, 1.2);
    player.happy = true;
    endLevel('clear');
  }

  function endLevel(kind) {
    state.mode = 'clear';
    state.result = kind;
    const spent = (performance.now() - state.levelStart) / 1000;
    state.totalTime += spent;
    state.unlocked = Math.max(state.unlocked, Math.min(6, state.idx + 2));
    writeSave();

    if (kind === 'clear') {
      el.clearTitle.textContent = '关卡 ' + (state.idx + 1) + ' 完成！';
      document.querySelector('.clear-badge').textContent = '🎉';
      el.clearStats.innerHTML =
        stat(state.levelBells, '收集铃钱') +
        stat(state.lives + ' / ' + (state.maxLives), '剩余体力') +
        stat(fmtTime(spent), '用时');
      $('btn-next').textContent = state.idx >= 5 ? '查看通关庆祝 🏆' : '进入下一关 →';
      $('btn-next').style.display = '';
      $('btn-retry').textContent = '再挑战一次';
    } else {
      el.clearTitle.textContent = '体力耗尽了…';
      document.querySelector('.clear-badge').textContent = '😵';
      el.clearStats.innerHTML =
        stat(state.levelBells, '收集铃钱') +
        stat(state.lives, '剩余体力') +
        stat(fmtTime(spent), '坚持时间');
      $('btn-next').style.display = 'none';
      $('btn-retry').textContent = '重新挑战本关';
    }
    el.screenClear.classList.remove('hidden');
  }

  const stat = (v, k) => '<div class="stat"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return m + ':' + String(ss).padStart(2, '0');
  }

  /* =========================================================
     HUD
     ========================================================= */
  function renderHearts(force) {
    const n = Math.max(0, state.lives);
    const total = Math.max(state.maxLives, 3);
    if (!force && hudCache.lives === n && hudCache.maxLives === total) return;
    hudCache.lives = n; hudCache.maxLives = total;
    el.hudHearts.innerHTML = Array.from({ length: total }, (_, i) =>
      '<span class="' + (i < n ? '' : 'off') + '">❤️</span>').join('');
  }

  function renderLeaves() {
    el.hudLeaves.innerHTML = Array.from({ length: 6 }, (_, i) =>
      '<i class="' + (i < state.unlocked - 1 ? 'on' : '') + '">🍃</i>').join('');
  }

  function updateHUD() {
    const denom = Math.max(1, level.goal.x - 60);
    let p = player.x / denom;
    p = Math.max(0, Math.min(1, p));
    const pct = Math.round(p * 100);
    el.hudBar.style.width = (p * 100).toFixed(1) + '%';
    el.hudBarIcon.style.left = (p * 100).toFixed(1) + '%';
    if (hudCache.pct !== pct) { el.hudPct.textContent = pct + '%'; hudCache.pct = pct; }
    if (hudCache.wallet !== state.wallet) {
      el.hudBells.textContent = state.wallet;
      hudCache.wallet = state.wallet;
    }
    const canBuy = !state.gun && state.wallet >= GUN_COST;
    if (hudCache.gunReady !== canBuy || hudCache.gunOn !== state.gun) {
      el.shop.classList.toggle('ready', canBuy);
      el.shop.classList.toggle('on', state.gun);
      el.shop.title = state.gun ? '手枪已装备（本局限定）' : '用 ' + GUN_COST + ' 铃钱换手枪（本局限定）';
      hudCache.gunReady = canBuy; hudCache.gunOn = state.gun;
    }
    renderHearts(false);
  }

  function paintHudAvatar() {
    art.paintAvatar(el.hudAvatar, state.avatar, state.avatar.variant);
  }

  /* =========================================================
     渲染
     ========================================================= */
  function render() {
    const lv = level;
    const th = lv ? lv.theme : art.THEMES[0];
    const t = tNow;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    art.drawSky(ctx, th, cam, t);
    art.drawClouds(ctx, th, cam, t, 0);
    art.drawHills(ctx, th, cam, 0);
    art.drawFarTrees(ctx, th, cam, t);
    art.drawClouds(ctx, th, cam, t, 1);
    art.drawHills(ctx, th, cam, 1);

    if (!lv) return;

    // 天气
    const cfg = WEATHER[th.weather] || WEATHER.petal;
    ctx.save();
    for (const a of ambient) {
      ctx.globalAlpha = 0.75;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      if (cfg.kind === 'petal' || cfg.kind === 'leaf') {
        ctx.fillStyle = cfg.color[Math.floor(a.ph) % cfg.color.length];
        ctx.beginPath(); ctx.ellipse(0, 0, a.r, a.r * 0.55, 0, 0, 7); ctx.fill();
      } else if (cfg.kind === 'snow') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, a.r, 0, 7); ctx.fill();
      } else {
        art.drawStar(ctx, 0, 0, a.r * (0.7 + 0.3 * Math.sin(t * 3 + a.ph)), '#fff7c0');
      }
      ctx.restore();
    }
    ctx.restore();

    // 装饰
    for (const d of lv.decor) {
      const sx = d.x - cam.x;
      if (sx < -160 || sx > W + 160) continue;
      art.drawDecor(ctx, d, th, t, cam);
    }

    // 地形（合并后的地面 + 木板/移动平台）
    for (const s of (lv.groundRects || [])) art.drawSolid(ctx, s, th, t, cam);
    for (const s of lv.solids) {
      if (!s.oneWay && !s.mover) continue;
      art.drawSolid(ctx, s, th, t, cam);
    }

    // 检查点 / 终点
    art.drawCheckpoint(ctx, lv.checkpoint, th, t, cam);
    art.drawGoal(ctx, lv.goal, th, t, cam);

    // 道具
    for (const it of lv.items) {
      if (it.got) continue;
      const sx = it.x - cam.x;
      if (sx < -60 || sx > W + 60) continue;
      if (it.type === 'bell') art.drawBell(ctx, it, t, cam);
      else art.drawFruit(ctx, it, t, cam);
    }

    // 敌人
    for (const e of lv.enemies) art.drawEnemy(ctx, e, th, t, cam);

    // 子弹
    for (const b of bullets) art.drawBullet(ctx, b, t, cam);

    // 玩家
    if (state.mode === 'play' || state.mode === 'pause' || (state.mode === 'clear' && state.result === 'clear')) {
      art.drawPlayer(ctx, player, state.avatar, t, cam, state.gun);
    }

    // 粒子
    for (const p of particles) art.drawParticle(ctx, p, cam);

    // 画面暗角
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(40,25,10,.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 暂停 / 结算时的柔化
    if (state.mode === 'pause' || state.mode === 'clear' || state.mode === 'congrats') {
      ctx.fillStyle = 'rgba(20,30,22,.18)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* =========================================================
     循环
     ========================================================= */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state.mode === 'play') update(dt);
    else {
      tNow += dt;
      if (state.mode === 'title') {
        // 标题界面：远景动画
        cam.x = Math.sin(tNow * 0.08) * 90 + 90;
        updateAmbient(dt, tNow);
        updateParticles(dt);
      } else {
        updateParticles(dt);
        updateAmbient(dt, tNow);
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  /* =========================================================
     界面控制
     ========================================================= */
  function show(node) { node.classList.remove('hidden'); }
  function hide(node) { node.classList.add('hidden'); }

  function startLevel(i) {
    hide(el.screenStart); hide(el.screenClear); hide(el.screenPause); hide(el.screenCongrats);
    el.screenClear.classList.add('hidden');
    show(el.hud);
    state.mode = 'play';
    loadLevel(i);
    hudCache = {};
    music.start();
    writeSave();
  }

  function pauseGame() {
    if (state.mode !== 'play') return;
    state.mode = 'pause';
    show(el.screenPause);
    music.stop();
  }
  function resumeGame() {
    if (state.mode !== 'pause') return;
    state.mode = 'play';
    hide(el.screenPause);
    music.start();
    last = performance.now();
  }
  function toTitle() {
    state.mode = 'title';
    hide(el.screenPause); hide(el.screenClear); hide(el.screenCongrats); hide(el.hud);
    show(el.screenStart);
    music.stop();
    if (level) { level.enemies = []; level.items = []; particles = []; }
    renderLevelList();
    renderAvatarList();
    initAmbient();
  }

  /* ---------------- 通关庆祝 ---------------- */
  function showCongrats() {
    state.mode = 'congrats';
    hide(el.screenClear); hide(el.hud);
    show(el.screenCongrats);
    music.sfx('win');
    el.congratsName.textContent = el.name.value || '小旅人';
    el.congratsStats.innerHTML =
      stat('6 / 6', '通关关卡') +
      stat(state.totalBells, '铃钱总数') +
      stat(fmtTime(state.totalTime), '总用时') +
      stat(state.maxLives, '最大体力');
    const quotes = [
      '“小岛的风，今天也温柔地吹着。”',
      '“你把整座森林都走了一遍，真了不起！”',
      '“铃钱会有的，朋友也会有的。”',
      '“下一趟旅程，什么时候出发呀？”',
    ];
    el.congratsQuote.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    // 头像
    el.congratsAvatar.innerHTML = '';
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    art.paintAvatar(c, state.avatar, state.avatar.variant);
    el.congratsAvatar.appendChild(c);
    makeConfetti();
    writeSave();
  }

  function makeConfetti() {
    el.confetti.innerHTML = '';
    const cols = ['#ff9ec4', '#ffd75e', '#8fd06a', '#7fc7ea', '#ff8f6b', '#c9a0ff', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('i');
      const w = 6 + Math.random() * 8;
      s.style.left = Math.random() * 100 + '%';
      s.style.width = w + 'px';
      s.style.height = (w * (0.5 + Math.random())) + 'px';
      s.style.background = cols[Math.floor(Math.random() * cols.length)];
      s.style.animationDuration = (3.4 + Math.random() * 3.4) + 's';
      s.style.animationDelay = (-Math.random() * 6) + 's';
      s.style.opacity = 0.65 + Math.random() * 0.35;
      el.confetti.appendChild(s);
    }
  }

  /* ---------------- 形象选择 ---------------- */
  function renderAvatarList() {
    el.avatarList.innerHTML = '';
    art.VARIANTS.forEach((v, i) => {
      const b = document.createElement('button');
      b.className = 'avatar-btn' + (state.avatar.mode === 'villager' && state.avatar.variant === i ? ' on' : '');
      const c = document.createElement('canvas');
      c.width = c.height = 88;
      const g = c.getContext('2d');
      g.scale(88 / 100, 88 / 100);
      art.drawHead(g, 50, 52, 26, i, { t: 0.6 });
      b.appendChild(c);
      const s = document.createElement('span');
      s.textContent = v.name;
      b.appendChild(s);
      b.onclick = () => {
        state.avatar.mode = 'villager';
        state.avatar.variant = i;
        music.sfx('ui');
        renderAvatarList(); paintHudAvatar(); writeSave();
      };
      el.avatarList.appendChild(b);
    });

    // 照片按钮
    const pb = document.createElement('button');
    if (state.avatar.photo) {
      pb.className = 'avatar-btn canvas-holder' + (state.avatar.mode === 'photo' ? ' on' : '');
      const c = document.createElement('canvas');
      c.width = c.height = 88;
      const g = c.getContext('2d');
      g.save();
      g.beginPath(); g.arc(44, 44, 42, 0, 7); g.clip();
      g.drawImage(state.avatar.photo, 2, 2, 84, 84);
      g.restore();
      pb.appendChild(c);
      const s = document.createElement('span');
      s.textContent = '我的照片';
      pb.appendChild(s);
      // 角标：重新上传并重新裁剪
      const badge = document.createElement('i');
      badge.className = 'edit-badge';
      badge.textContent = '✎';
      badge.title = '更换 / 重新裁剪照片';
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        music.sfx('ui');
        el.fileInput.click();
      });
      pb.appendChild(badge);
      pb.onclick = () => {
        state.avatar.mode = 'photo';
        music.sfx('ui');
        renderAvatarList(); paintHudAvatar(); writeSave();
      };
    } else {
      pb.className = 'avatar-btn upload';
      pb.innerHTML = '<div class="plus">＋</div><span>上传照片</span>';
      pb.onclick = () => el.fileInput.click();
    }
    el.avatarList.appendChild(pb);

    // 已经有照片时，再给一个明确的「换一张」入口
    if (state.avatar.photo) {
      const rb = document.createElement('button');
      rb.className = 'avatar-btn upload';
      rb.innerHTML = '<div class="plus">⟳</div><span>换一张</span>';
      rb.onclick = () => { music.sfx('ui'); el.fileInput.click(); };
      el.avatarList.appendChild(rb);
    }
  }

  /* ---------------- 关卡列表 ---------------- */
  function renderLevelList() {
    el.levelList.innerHTML = '';
    AC.LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      const locked = i + 1 > state.unlocked;
      const done = i + 1 < state.unlocked;
      b.className = 'lv' + (locked ? ' locked' : '') + (done ? ' done' : '') + (i === state.idx ? ' on' : '');
      b.innerHTML = (locked ? '🔒' : (i + 1)) + '<small>' + lv.short + '</small>';
      if (!locked) {
        b.onclick = () => {
          music.sfx('ui');
          state.idx = i;
          renderLevelList();
        };
      }
      el.levelList.appendChild(b);
    });
  }

  /* =========================================================
     头像裁剪
     ========================================================= */
  const crop = { img: null, zoom: 1, ox: 0, oy: 0, drag: false, lx: 0, ly: 0, R: 320 * 0.42 };
  const cropCtx = el.cropCanvas.getContext('2d');
  el.cropCanvas.width = 320 * DPR;
  el.cropCanvas.height = 320 * DPR;
  cropCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

  function cropGeom() {
    const { img, R } = crop;
    const cover = Math.max((R * 2) / img.width, (R * 2) / img.height);
    const s = cover * crop.zoom;
    const w = img.width * s, h = img.height * s;
    // 约束：图片必须始终盖住圆形区域
    crop.ox = Math.max(-(w / 2 - R), Math.min(w / 2 - R, crop.ox));
    crop.oy = Math.max(-(h / 2 - R), Math.min(h / 2 - R, crop.oy));
    return { x: 160 + crop.ox - w / 2, y: 160 + crop.oy - h / 2, w, h, s };
  }

  function drawCrop() {
    if (!crop.img) return;
    const g = cropCtx;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, 320, 320);
    g.fillStyle = '#241c14'; g.fillRect(0, 0, 320, 320);
    const gm = cropGeom();
    g.save();
    g.beginPath(); g.arc(160, 160, crop.R, 0, 7); g.clip();
    g.drawImage(crop.img, gm.x, gm.y, gm.w, gm.h);
    g.restore();
  }

  function openCrop(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      crop.img = img; crop.zoom = 1; crop.ox = 0; crop.oy = 0;
      el.cropZoom.value = 100;
      show(el.screenCrop);
      drawCrop();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert('图片读取失败，请换一张试试～'); };
    img.src = url;
  }

  el.fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) openCrop(f);
    e.target.value = '';
  });
  el.bgmInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      music.setCustomFile(f);
      music.resume();
      music.playing = false;
      $('btn-bgm-file').textContent = '🎵 ' + f.name.slice(0, 22);
      setTimeout(() => { $('btn-bgm-file').textContent = '🎵 已载入自定义 BGM'; }, 2200);
    }
    e.target.value = '';
  });

  el.cropZoom.addEventListener('input', () => {
    crop.zoom = Number(el.cropZoom.value) / 100;
    drawCrop();
  });

  (function bindDrag() {
    const c = el.cropCanvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * 320, y: (e.clientY - r.top) / r.height * 320 };
    };
    c.addEventListener('pointerdown', (e) => {
      crop.drag = true; c.setPointerCapture(e.pointerId);
      const p = pos(e); crop.lx = p.x; crop.ly = p.y;
    });
    c.addEventListener('pointermove', (e) => {
      if (!crop.drag) return;
      const p = pos(e);
      crop.ox += p.x - crop.lx;
      crop.oy += p.y - crop.ly;
      crop.lx = p.x; crop.ly = p.y;
      drawCrop();
    });
    const up = () => { crop.drag = false; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      crop.zoom = Math.max(1, Math.min(3.2, crop.zoom - e.deltaY * 0.0016));
      el.cropZoom.value = String(Math.round(crop.zoom * 100));
      drawCrop();
    }, { passive: false });
  })();

  $('crop-cancel').onclick = () => { hide(el.screenCrop); crop.img = null; };
  $('crop-ok').onclick = () => {
    if (!crop.img) return;
    const gm = cropGeom();
    const S = 320;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const k = S / (crop.R * 2);
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
    g.fillStyle = '#f2e7d3'; g.fillRect(0, 0, S, S);
    g.drawImage(crop.img, (gm.x - (160 - crop.R)) * k, (gm.y - (160 - crop.R)) * k, gm.w * k, gm.h * k);
    g.restore();
    state.avatar.photo = cv;
    state.avatar.mode = 'photo';
    hide(el.screenCrop);
    music.sfx('ui');
    renderAvatarList();
    paintHudAvatar();
    writeSave();
  };

  /* =========================================================
     按钮绑定
     ========================================================= */
  $('btn-start').onclick = () => {
    music.init(); music.resume();
    if (music.customMode) music.playCustom();
    state.lives = state.maxLives;   // 新的一局从满体力开始
    startLevel(Math.max(0, Math.min(5, state.idx)));
  };

  $('btn-pause').onclick = () => { pauseGame(); };
  $('btn-resume').onclick = () => { resumeGame(); };
  $('btn-restart').onclick = () => { hide(el.screenPause); startLevel(state.idx); };
  $('btn-quit').onclick = () => { toTitle(); };
  $('btn-retry').onclick = () => {
    if (state.result === 'fail') state.lives = state.maxLives;  // 失败重试回满体力
    startLevel(state.idx);
  };
  $('btn-next').onclick = () => {
    if (state.idx >= 5) { hide(el.screenClear); showCongrats(); }
    else startLevel(state.idx + 1);
  };
  $('btn-again').onclick = () => {
    state.totalBells = 0; state.totalTime = 0; state.maxLives = 3; state.lives = 3; state.unlocked = 1;
    state.idx = 0; writeSave();
    hide(el.screenCongrats);
    startLevel(0);
  };
  $('btn-home').onclick = () => { hide(el.screenCongrats); toTitle(); };
  $('btn-bgm-file').onclick = () => el.bgmInput.click();
  el.shop.onclick = buyGun;
  el.buyGun.onclick = buyGun;

  function toggleSound() {
    const m = music.toggleMute();
    $('btn-sound').textContent = m ? '🔇' : '🔊';
  }
  $('btn-sound').onclick = toggleSound;

  el.name.addEventListener('input', () => {
    el.hudName.textContent = el.name.value || '小旅人';
    writeSave();
  });

  /* =========================================================
     初始化
     ========================================================= */
  function init() {
    fitStage();
    loadSave();
    el.hudName.textContent = el.name.value || '小旅人';
    renderAvatarList();
    renderLevelList();
    renderLeaves();
    paintHudAvatar();

    // 标题界面背景：用第一关的场景
    const src = AC.LEVELS[0];
    level = {
      id: 1, name: src.name, theme: art.THEMES[src.theme], width: src.width,
      solids: src.solids.map((s) => Object.assign({}, s, { dx: 0, dy: 0, phase: 0 })),
      enemies: [], items: [], decor: art.buildDecor(src),
      goal: Object.assign({}, src.goal),
      checkpoint: Object.assign({}, src.checkpoint, { on: false }),
      spawn: Object.assign({}, src.spawn), pits: src.pits, themeIdx: src.theme,
    };
    level.groundRects = mergeGrounds(level.solids);
    initAmbient();
    requestAnimationFrame((t) => { last = t; loop(t); });

    // 监听容器尺寸
    if (window.ResizeObserver) new ResizeObserver(fitStage).observe(stage);
  }

  /* 调试钩子（自动化测试用，不影响游戏） */
  AC.debug = {
    get state() { return state; },
    get level() { return level; },
    get player() { return player; },
    get bullets() { return bullets; },
  };

  init();
})();
