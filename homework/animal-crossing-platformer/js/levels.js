/* =========================================================
   levels.js  —  6 个关卡的生成与数据
   tile = 40px, 逻辑画布 960 x 560 (14 行)
   规则：必须通行的只有地面与 <=3 格的坑；浮空平台都是"拿铃钱"的可选路线
   ========================================================= */
(function () {
  const AC = (window.AC = window.AC || {});
  const T = 40;

  /* ---------------- 随机数 ---------------- */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------------- 构造原语 ---------------- */
  const solid = (c, r, w, h, oneWay) => ({ x: c * T, y: r * T, w: w * T, h: h * T, oneWay: !!oneWay });
  const ground = (a, b, r) => solid(a, r, b - a + 1, 14 - r, false);
  const plat = (c, r, w) => solid(c, r, w, 0.46, true);
  const ledge = (c, r) => solid(c, r, 1, 1, false);
  const mover = (c, r, w, axis, range, speed) => ({
    x: c * T, y: r * T, w: w * T, h: 0.46 * T, oneWay: true, mover: true,
    axis: axis, range: range * T, speed: speed, baseX: c * T, baseY: r * T,
    phase: 0, dx: 0, dy: 0,
  });
  const bell = (c, r) => ({ type: 'bell', x: c * T + T / 2, y: r * T + T / 2, got: false, t: Math.random() * 6 });
  const fruit = (c, r) => ({ type: 'fruit', x: c * T + T / 2, y: r * T + T / 2, got: false, t: Math.random() * 6 });
  const walker = (c, r, a, b) => ({
    type: 'walker', x: c * T, y: r * T - 30, w: 32, h: 30,
    minX: a * T, maxX: b * T, vx: 62, dir: 1, dead: 0, t: Math.random() * 6, squash: 0,
  });
  const flyer = (c, r, a, b, amp, speed) => ({
    type: 'flyer', x: c * T, y: r * T, baseY: r * T, w: 30, h: 26,
    minX: a * T, maxX: b * T, vx: 92 * speed, dir: 1, amp: amp * T, ph: Math.random() * 6,
    dead: 0, t: Math.random() * 6,
  });

  /* ---------------- 关卡元信息 ---------------- */
  const META = [
    { id: 1, name: '春 · 青青草原', short: '草原', theme: 0, cols: 112, diff: 1, seed: 20260301,
      hint: '向右前进，收集铃钱，抵达终点风车！' },
    { id: 2, name: '夏 · 海滨沙丘', short: '海滩', theme: 1, cols: 124, diff: 2, seed: 771103,
      hint: '小心的蝴蝶，跳过沙滩上的裂缝。' },
    { id: 3, name: '秋 · 枫叶林', short: '枫林', theme: 2, cols: 132, diff: 3, seed: 390217,
      hint: '会漂浮的木板出现了，踩稳再跳。' },
    { id: 4, name: '冬 · 雪之谷', short: '雪谷', theme: 3, cols: 140, diff: 4, seed: 55120,
      hint: '上下浮动的平台，注意起跳节奏。' },
    { id: 5, name: '黄昏 · 樱花丘', short: '樱丘', theme: 4, cols: 148, diff: 5, seed: 880143,
      hint: '长距离跳跃，记得先助跑。' },
    { id: 6, name: '星夜 · 云端镇', short: '云镇', theme: 5, cols: 156, diff: 6, seed: 204617,
      hint: '最终关卡，稳住心态，终点就在前方！' },
  ];

  /* ---------------- 关卡生成 ---------------- */
  function build(meta) {
    const R = rng(meta.seed);
    const d = meta.diff;
    const cols = meta.cols;
    const lv = Object.assign({}, meta, {
      width: cols * T, solids: [], enemies: [], items: [], pits: [],
    });

    /* --- 1. 地面分段 + 坑 --- */
    const segs = [];
    let x = 0, row = 11;
    let guard = 0;
    while (guard++ < 80) {
      const remain = cols - x;
      if (remain < 15) { segs.push({ a: x, b: cols - 1, r: row }); break; }

      const lenMin = Math.max(7, 14 - d);
      const lenMax = Math.min(remain - 6, 18 - Math.floor(d / 2));
      const len = ri(R, lenMin, Math.max(lenMin + 1, lenMax));
      segs.push({ a: x, b: x + len - 1, r: row });
      x += len;

      if (cols - x < 18) { segs.push({ a: x, b: cols - 1, r: row }); break; }

      // 坑的宽度
      let pw = d <= 2 ? ri(R, 2, 3) : (d >= 5 ? ri(R, 3, 4) : ri(R, 2, 3));
      // 4 格坑中间放一根石柱，保证一定能过
      if (pw === 4) lv.solids.push(solid(x + 2, row - 1, 1, 15 - row, false));
      lv.pits.push({ c0: x, c1: x + pw - 1, w: pw, r: row });
      x += pw;

      row = clamp(row + [(-1), 0, 0, 1, 1][ri(R, 0, 4)], 10, 12);
      if (row !== 11 && R() < 0.35) row = 11;
    }
    if (segs.length && segs[segs.length - 1].b < cols - 1) {
      segs.push({ a: segs[segs.length - 1].b + 1, b: cols - 1, r: 11 });
    }

    segs.forEach((s) => lv.solids.push(ground(s.a, s.b, s.r)));

    /* --- 2. 浮空平台（铃钱路线） --- */
    segs.forEach((s) => {
      const span = s.b - s.a + 1;
      if (span < 8) return;
      let px = s.a + 2 + ri(R, 0, 1);
      const end = s.b - 2;
      let g2 = 0;
      while (px + 3 <= end && g2++ < 9) {
        const w = Math.min(ri(R, 3, 4), end - px + 1);
        const rr = s.r - ri(R, 2, 3);
        if (rr < 3) break;
        lv.solids.push(plat(px, rr, w));
        for (let i = 0; i < w; i++) lv.items.push(bell(px + i, rr - 1));
        if (R() < 0.16 && w >= 3) lv.enemies.push(walker(px + 1, rr, px, px + w - 1));
        // 偶尔再来一层更高的平台
        if (d >= 2 && R() < 0.42 && rr - 2 >= 3 && px + w + 4 <= end) {
          const w2 = ri(R, 3, 4);
          const rr2 = rr - 2;
          lv.solids.push(plat(px + w + 1, rr2, Math.min(w2, end - (px + w + 1) + 1)));
          const ww = Math.min(w2, end - (px + w + 1) + 1);
          for (let i = 0; i < ww; i++) lv.items.push(bell(px + w + 1 + i, rr2 - 1));
          px += w + ww + ri(R, 3, 5);
        } else {
          px += w + ri(R, 2, 5);
        }
      }
    });

    /* --- 3. 空中的铃钱弧线 --- */
    segs.forEach((s) => {
      const span = s.b - s.a + 1;
      if (span < 12 || R() < 0.4) return;
      const c = s.a + ri(R, 3, Math.max(4, span - 7));
      const base = s.r - 3;
      const n = ri(R, 3, 5);
      for (let i = 0; i < n; i++) {
        const dy = Math.round(Math.sin((i / (n - 1)) * Math.PI) * 2) + ri(R, 0, 1);
        lv.items.push(bell(c + i, clamp(base - dy, 2, 9)));
      }
    });

    /* --- 4. 敌人 --- */
    segs.forEach((s, si) => {
      const span = s.b - s.a + 1;
      if (span < 8) return;
      let n = Math.floor(span / 11) + (d >= 3 ? 1 : 0);
      if (si === 0) n = Math.min(n, 1);
      for (let i = 0; i < n; i++) {
        const a = s.a + 3 + Math.floor(R() * Math.max(1, span - 6));
        if (si === 0 && a < 14) continue;
        const b = Math.min(s.b - 1, a + ri(R, 4, 7));
        if (b - a < 2) continue;
        lv.enemies.push(walker(a, s.r, a, b));
      }
    });

    // 飞行敌人：盘旋在坑的上方
    if (d >= 2) {
      lv.pits.forEach((p, i) => {
        if (p.w < 3 || i % 2 === 1) return;
        lv.enemies.push(flyer(p.c0 + 1, 8, p.c0 - 1, p.c0 + p.w + 1, 1.4, 0.75 + d * 0.09));
      });
    }

    /* --- 5. 移动平台（拿铃钱的捷径） --- */
    if (d >= 3) {
      lv.pits.forEach((p, i) => {
        if (p.w >= 3 && R() < 0.5 + d * 0.06) {
          lv.solids.push(mover(p.c0, 9, 2, 'x', p.w + 1, 34 + d * 5));
        }
        if (d >= 4 && R() < 0.3) {
          lv.solids.push(mover(p.c0 + 1, 6, 2, 'y', 3, 26 + d * 3));
        }
      });
    }

    /* --- 6. 水果（额外生命） --- */
    const bigSegs = segs.filter((s) => s.b - s.a >= 10);
    if (bigSegs.length) {
      const s1 = bigSegs[0];
      lv.items.push(fruit(s1.a + Math.floor((s1.b - s1.a) / 2), s1.r - 4));
      if (bigSegs.length > 1) {
        const s2 = bigSegs[bigSegs.length - 1];
        lv.items.push(fruit(s2.a + 4, s2.r - 3));
      }
    }

    /* --- 7. 出生点 / 检查点 / 终点 --- */
    lv.spawn = { x: 2 * T, y: (segs[0].r - 4) * T };

    const midCol = Math.floor(cols * 0.52);
    const cpSeg = segs.find((s) => midCol >= s.a && midCol <= s.b) || segs[Math.floor(segs.length / 2)];
    lv.checkpoint = { x: (cpSeg.a + 3) * T, y: cpSeg.r * T, on: false };

    const last = segs[segs.length - 1];
    lv.goal = { x: (last.b - 4) * T, y: last.r * T };

    // 终点 & 出生点附近清空敌人
    lv.enemies = lv.enemies.filter((e) => {
      const c = e.x / T;
      return c > 16 && c < cols - 12;
    });

    return lv;
  }

  const LEVELS = META.map(build);
  AC.LEVELS = LEVELS;
  AC.TILE = T;

  /* 渲染前的资源准备在 art.js / game.js 中完成 */
})();
