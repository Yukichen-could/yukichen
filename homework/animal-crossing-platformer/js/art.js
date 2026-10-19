/* =========================================================
   art.js  —  动物森友会风格渲染层
   ========================================================= */
(function () {
  const AC = (window.AC = window.AC || {});
  const T = 40;
  const W = 960, H = 560;

  /* ---------------- roundRect 兜底 ---------------- */
  function rr(g, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------- 主题配色 ---------------- */
  const THEMES = [
    { // 0 春
      sky: ['#a6e2f7', '#d7f2fb', '#f6fbe6'],
      hillFar: '#a9dca2', hillNear: '#86c87e',
      grass: '#93d46c', grassDark: '#6fbb51', grassLight: '#bdec95',
      dirt: '#d7ae78', dirtDark: '#bb8f5a', dirtDot: '#c69a63',
      trunk: '#ab7742', leaf: '#6cc45f', leaf2: '#93dc7c',
      cloud: '#ffffff', cloudShade: '#dceef7',
      plank: '#d8a86b', plankDark: '#b88a4f', plankLight: '#eccb95',
      accent: '#ff9ec4', weather: 'petal', night: false,
      farLeaf: '#b6dca8', sky2: '#eaf8ff',
    },
    { // 1 夏
      sky: ['#6fd0f2', '#a9e8fb', '#fdf3cf'],
      hillFar: '#f2e0b0', hillNear: '#e9c98a',
      grass: '#f3da8e', grassDark: '#dcbe6c', grassLight: '#fcecb8',
      dirt: '#e9d2a2', dirtDark: '#c9ab74', dirtDot: '#d8bd8a',
      trunk: '#bb8c53', leaf: '#7fd6a8', leaf2: '#a4e8c2',
      cloud: '#ffffff', cloudShade: '#e6f5fb',
      plank: '#e0b478', plankDark: '#bd8f52', plankLight: '#f2d3a2',
      accent: '#ffb45e', weather: 'sparkle', night: false,
      farLeaf: '#a8e0c0', sky2: '#f0fbff',
    },
    { // 2 秋
      sky: ['#ffbe7e', '#ffdcaa', '#fff6e2'],
      hillFar: '#dfae6c', hillNear: '#c8864a',
      grass: '#c9d06c', grassDark: '#a3ac4e', grassLight: '#e4e89c',
      dirt: '#c28c58', dirtDark: '#a27044', dirtDot: '#b07a48',
      trunk: '#9e6c3e', leaf: '#e8823c', leaf2: '#f4a860',
      cloud: '#fff4e2', cloudShade: '#f2dcc0',
      plank: '#c89456', plankDark: '#a2743c', plankLight: '#e0b478',
      accent: '#e2603c', weather: 'leaf', night: false,
      farLeaf: '#dba05c', sky2: '#fff0d8',
    },
    { // 3 冬
      sky: ['#b7ddf5', '#dceffb', '#f8fcff'],
      hillFar: '#dcebf7', hillNear: '#c3dcee',
      grass: '#f7fcff', grassDark: '#d8e9f3', grassLight: '#ffffff',
      dirt: '#bcccd9', dirtDark: '#9badbd', dirtDot: '#adbfcd',
      trunk: '#9e7c60', leaf: '#d2e9e4', leaf2: '#ecf8f4',
      cloud: '#ffffff', cloudShade: '#e2eff8',
      plank: '#c8a878', plankDark: '#a48657', plankLight: '#e0c79c',
      accent: '#7fc7ea', weather: 'snow', night: false,
      farLeaf: '#dceaf2', sky2: '#f4fbff',
    },
    { // 4 黄昏樱花
      sky: ['#ffab98', '#ffd0ac', '#ffeecd'],
      hillFar: '#e79aa8', hillNear: '#cf7f95',
      grass: '#a8d47a', grassDark: '#83b157', grassLight: '#caea9c',
      dirt: '#bb8c6c', dirtDark: '#9d7254', dirtDot: '#ad7f5e',
      trunk: '#8c6044', leaf: '#ffb3cd', leaf2: '#ffd3e0',
      cloud: '#fff0e2', cloudShade: '#f5d4c0',
      plank: '#c09060', plankDark: '#9c7048', plankLight: '#dcb082',
      accent: '#ff8fb0', weather: 'petal', night: false,
      farLeaf: '#eaa8bc', sky2: '#fff2e0',
    },
    { // 5 星夜云端镇
      sky: ['#1e1e46', '#3a3468', '#6a5f9c'],
      hillFar: '#413e76', hillNear: '#565096',
      grass: '#8fd8c0', grassDark: '#69b8a0', grassLight: '#bbeeda',
      dirt: '#5f5f92', dirtDark: '#484874', dirtDot: '#6c6ca0',
      trunk: '#7c6c96', leaf: '#9fd0ee', leaf2: '#c6e6fa',
      cloud: '#8e8ec8', cloudShade: '#7a7ab4',
      plank: '#b09ad0', plankDark: '#8b78ac', plankLight: '#cdbce6',
      accent: '#ffd75e', weather: 'star', night: true,
      farLeaf: '#8fb8e0', sky2: '#565096',
    },
  ];

  /* ---------------- 随机 ---------------- */
  function rng(seed) {
    let s = (seed >>> 0) || 7;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* =========================================================
     角色形象
     ========================================================= */
  const VARIANTS = [
    { name: '小熊', fur: '#d09a62', fur2: '#b57e46', ear: 'round', shirt: '#8fd06a', shirt2: '#6fba4c', blush: '#f19aa8', kigar: '#5e4a34' },
    { name: '兔兔', fur: '#f7e9da', fur2: '#e3cfba', ear: 'long', shirt: '#ffc0d4', shirt2: '#f2a0bb', blush: '#f6a8bb', kigar: '#7a6552' },
    { name: '猫咪', fur: '#bcc6d0', fur2: '#9aa6b2', ear: 'tri', shirt: '#ffe08a', shirt2: '#f0c85e', blush: '#f0a1ad', kigar: '#5b6672' },
    { name: '豆柴', fur: '#f2c684', fur2: '#dda85e', ear: 'flop', shirt: '#9fd8f5', shirt2: '#78bce0', blush: '#ef9f9f', kigar: '#8a6a3e' },
  ];

  function drawEars(g, cx, cy, r, v, flip) {
    g.fillStyle = v.fur;
    g.strokeStyle = v.fur2;
    g.lineWidth = 2.4;
    const sx = flip ? -1 : 1;
    if (v.ear === 'round') {
      [[-r * 0.78, -r * 0.72], [r * 0.78, -r * 0.72]].forEach(([dx, dy]) => {
        g.beginPath(); g.arc(cx + dx * sx, cy + dy, r * 0.42, 0, 7); g.fill(); g.stroke();
      });
    } else if (v.ear === 'long') {
      [[-0.42, -1.62], [0.42, -1.62]].forEach(([dx, dy]) => {
        g.save(); g.translate(cx + dx * r * sx, cy + dy * r); g.rotate(dx * 0.22 * sx);
        rr(g, -r * 0.24, -r * 0.62, r * 0.48, r * 1.24, r * 0.24); g.fill(); g.stroke();
        g.fillStyle = '#f7c3d4'; rr(g, -r * 0.11, -r * 0.44, r * 0.22, r * 0.9, r * 0.11); g.fill();
        g.fillStyle = v.fur; g.restore();
      });
    } else if (v.ear === 'tri') {
      [[-0.7, -0.72], [0.7, -0.72]].forEach(([dx, dy]) => {
        g.beginPath();
        g.moveTo(cx + dx * r * sx, cy + dy * r - r * 0.62);
        g.lineTo(cx + (dx - 0.36) * r * sx, cy + dy * r + r * 0.24);
        g.lineTo(cx + (dx + 0.4) * r * sx, cy + dy * r + r * 0.16);
        g.closePath(); g.fill(); g.stroke();
      });
    } else { // flop
      [[-0.94, -0.1], [0.94, -0.1]].forEach(([dx, dy]) => {
        g.save(); g.translate(cx + dx * r * sx, cy + dy * r); g.rotate(dx * 0.5 * sx);
        rr(g, -r * 0.28, -r * 0.5, r * 0.56, r * 1.0, r * 0.28); g.fill(); g.stroke();
        g.restore();
      });
    }
  }

  function drawFace(g, cx, cy, r, v, blink, happy) {
    // 口鼻
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.ellipse(cx, cy + r * 0.34, r * 0.5, r * 0.34, 0, 0, 7); g.fill();
    // 眼睛
    const ex = r * 0.38, ey = cy - r * 0.1;
    if (blink) {
      g.strokeStyle = v.kigar; g.lineWidth = Math.max(1.6, r * 0.11); g.lineCap = 'round';
      [-1, 1].forEach((s) => {
        g.beginPath(); g.arc(cx + s * ex, ey, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      });
    } else {
      [-1, 1].forEach((s) => {
        g.fillStyle = v.kigar;
        g.beginPath(); g.ellipse(cx + s * ex, ey, r * 0.135, r * (happy ? 0.1 : 0.19), 0, 0, 7); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(cx + s * ex - r * 0.05, ey - r * 0.07, r * 0.055, 0, 7); g.fill();
      });
    }
    // 腮红
    g.fillStyle = v.blush; g.globalAlpha = 0.5;
    [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(cx + s * r * 0.68, cy + r * 0.28, r * 0.17, r * 0.11, 0, 0, 7); g.fill(); });
    g.globalAlpha = 1;
    // 嘴
    g.strokeStyle = v.kigar; g.lineWidth = Math.max(1.5, r * 0.1); g.lineCap = 'round';
    g.beginPath();
    if (happy) g.arc(cx, cy + r * 0.28, r * 0.2, 0.12 * Math.PI, 0.88 * Math.PI);
    else { g.moveTo(cx - r * 0.16, cy + r * 0.4); g.lineTo(cx, cy + r * 0.5); g.lineTo(cx + r * 0.16, cy + r * 0.4); }
    g.stroke();
  }

  function drawHead(g, cx, cy, r, variant, opts) {
    opts = opts || {};
    const v = VARIANTS[variant % VARIANTS.length];
    const flip = opts.facing === -1;
    drawEars(g, cx, cy, r, v, flip);

    if (opts.photo) {
      // 照片头像
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
      g.drawImage(opts.photo, cx - r, cy - r, r * 2, r * 2);
      g.restore();
      g.lineWidth = r * 0.16; g.strokeStyle = '#ffffff';
      g.beginPath(); g.arc(cx, cy, r * 0.95, 0, 7); g.stroke();
      g.lineWidth = r * 0.13; g.strokeStyle = v.fur2;
      g.beginPath(); g.arc(cx, cy, r * 1.06, 0, 7); g.stroke();
      // 头顶小叶芽
      drawLeaf(g, cx + r * (flip ? -0.5 : 0.5), cy - r * 1.05, r * 0.42, opts.t || 0, v);
      return;
    }

    g.fillStyle = v.fur; g.strokeStyle = v.fur2; g.lineWidth = Math.max(2, r * 0.14);
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.beginPath(); g.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.32, r * 0.22, -0.5, 0, 7); g.fill();
    drawFace(g, cx, cy, r, v, opts.blink, opts.happy);
    drawLeaf(g, cx + r * (flip ? -0.58 : 0.58), cy - r * 0.98, r * 0.4, opts.t || 0, v);
  }

  function drawLeaf(g, x, y, s, t, v) {
    g.save();
    g.translate(x, y); g.rotate(Math.sin(t * 1.4) * 0.22 - 0.5);
    g.fillStyle = v.shirt; g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = s * 0.12;
    g.beginPath();
    g.moveTo(-s, 0); g.quadraticCurveTo(0, -s * 0.9, s, 0); g.quadraticCurveTo(0, s * 0.9, -s, 0);
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = s * 0.1;
    g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(s * 0.7, 0); g.stroke();
    g.restore();
  }

  /* 完整角色（游戏中） */
  function drawCreature(g, x, y, w, h, variant, opts) {
    opts = opts || {};
    const v = VARIANTS[variant % VARIANTS.length];
    const cx = x + w / 2;
    const feet = y + h;
    const run = opts.run || 0;
    const air = !!opts.air;
    const sq = opts.squash || 0;

    g.save();
    // 影子
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.beginPath(); g.ellipse(cx, feet + 2, w * 0.44, w * 0.13, 0, 0, 7); g.fill();

    g.translate(cx, feet);
    if (sq) g.scale(1 + sq * 0.28, 1 - sq * 0.24);

    const headR = w * 0.44;
    const headCY = -h + headR + 1;
    const bodyTop = headCY + headR * 0.55;
    const bodyH = -bodyTop - h * 0.1;   // 局部坐标：从 bodyTop 到脚踝上方

    // 腿
    g.fillStyle = v.fur2;
    const legSw = air ? w * 0.1 : Math.sin(run) * w * 0.16;
    rr(g, -w * 0.24 + legSw * 0.5, -h * 0.1, w * 0.22, h * 0.12, w * 0.1); g.fill();
    rr(g, w * 0.02 - legSw * 0.5, -h * 0.1, w * 0.22, h * 0.12, w * 0.1); g.fill();

    // 身体
    g.fillStyle = v.shirt; g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 2;
    rr(g, -w * 0.33, bodyTop, w * 0.66, bodyH + 2, w * 0.26); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)';
    rr(g, -w * 0.2, bodyTop + bodyH * 0.35, w * 0.4, bodyH * 0.5, w * 0.15); g.fill();

    // 手
    g.fillStyle = v.fur;
    const armSw = air ? -w * 0.1 : Math.sin(run + Math.PI) * w * 0.14;
    rr(g, -w * 0.5, bodyTop + bodyH * 0.18 + armSw, w * 0.2, h * 0.2, w * 0.1); g.fill();
    rr(g, w * 0.3, bodyTop + bodyH * 0.18 - armSw, w * 0.2, h * 0.2, w * 0.1); g.fill();

    // 手枪（装备时握在朝向前侧的手里）
    if (opts.gun) {
      const dir = (opts.facing === -1) ? -1 : 1;
      g.save();
      g.translate(dir * w * 0.34, bodyTop + bodyH * 0.26);
      g.scale(dir, 1);
      g.fillStyle = '#59636e';
      rr(g, -2, -2.6, w * 0.46, 6.6, 3); g.fill();               // 套筒 / 枪管
      g.fillStyle = '#8b96a2';
      rr(g, 1.5, -1.6, w * 0.3, 2.4, 1.2); g.fill();             // 高光
      g.fillStyle = '#454e58';
      rr(g, -1.5, 2.6, 6, 8.5, 2.4); g.fill();                   // 握把
      g.fillStyle = '#333b44';
      g.beginPath(); g.arc(w * 0.44, 0.6, 1.9, 0, 7); g.fill();  // 枪口
      g.restore();
    }

    // 头
    drawHead(g, 0, headCY, headR, variant, {
      facing: opts.facing || 1,
      photo: opts.photo,
      blink: opts.blink,
      happy: opts.happy,
      t: opts.t || 0,
    });
    g.restore();
  }

  /* 生成形象缩略图 */
  function makeAvatarCanvas(variant, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(size / 100, size / 100);
    drawHead(g, 50, 52, 26, variant, { t: 0.6 });
    return c;
  }

  /* 把当前形象画进某个 canvas（HUD / 通关页用） */
  function paintAvatar(canvas, avatar, variant) {
    const size = canvas.width;
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.save();
    g.scale(size / 100, size / 100);
    if (avatar && avatar.mode === 'photo' && avatar.canvas) {
      // 圆形底
      g.fillStyle = '#f4ecdd';
      g.beginPath(); g.arc(50, 56, 40, 0, 7); g.fill();
      drawHead(g, 50, 56, 38, variant, { photo: avatar.canvas, t: 0.6 });
    } else {
      drawHead(g, 50, 58, 31, variant, { t: 0.6 });
    }
    g.restore();
  }

  /* =========================================================
     装饰生成
     ========================================================= */
  function buildDecor(level) {
    const R = rng((level.seed || 1) ^ 0x9e3779b9);
    const out = [];
    level.solids.forEach((s) => {
      if (s.oneWay || s.mover) return;
      const a = Math.floor(s.x / T);
      const b = Math.floor((s.x + s.w) / T) - 1;
      const r = Math.round(s.y / T);
      for (let c = a + 1; c < b; c++) {
        const roll = R();
        if (roll < 0.085 && c > a + 1 && c < b - 1) {
          out.push({ type: 'tree', x: c * T + T / 2 + (R() - 0.5) * 14, y: r * T, s: 0.85 + R() * 0.45, seed: R() * 10 });
        } else if (roll < 0.19) {
          out.push({ type: 'bush', x: c * T + T / 2 + (R() - 0.5) * 16, y: r * T, s: 0.7 + R() * 0.5, seed: R() * 10 });
        } else if (roll < 0.42) {
          out.push({ type: 'flower', x: c * T + R() * T, y: r * T, hue: Math.floor(R() * 5), s: 0.8 + R() * 0.5 });
        } else if (roll < 0.58) {
          out.push({ type: 'tuft', x: c * T + R() * T, y: r * T, s: 0.75 + R() * 0.6 });
        } else if (roll < 0.63) {
          out.push({ type: 'stone', x: c * T + R() * T, y: r * T, s: 0.7 + R() * 0.5 });
        }
      }
    });
    return out;
  }

  /* =========================================================
     背景
     ========================================================= */
  function drawSky(g, th, cam, t) {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, th.sky[0]);
    grad.addColorStop(0.55, th.sky[1]);
    grad.addColorStop(1, th.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // 星星（夜）
    if (th.night) {
      const R = rng(99);
      for (let i = 0; i < 90; i++) {
        const sx = (R() * 3000 - cam.x * 0.05) % (W + 60);
        const x = (sx + W + 60) % (W + 60) - 30;
        const y = R() * H * 0.62;
        const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.6 + R() * 1.6) + i));
        g.fillStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')';
        g.beginPath(); g.arc(x, y, 0.8 + R() * 1.5, 0, 7); g.fill();
      }
    }

    // 太阳 / 月亮
    const cx = W * 0.76 - cam.x * 0.015;
    const cy = H * 0.17;
    const glow = g.createRadialGradient(cx, cy, 6, cx, cy, 130);
    const core = th.night ? '#fffbe0' : '#fff6c8';
    glow.addColorStop(0, th.night ? 'rgba(255,251,224,.85)' : 'rgba(255,246,200,.95)');
    glow.addColorStop(0.35, th.night ? 'rgba(255,245,210,.22)' : 'rgba(255,232,150,.4)');
    glow.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(cx, cy, 130, 0, 7); g.fill();
    g.fillStyle = core;
    g.beginPath(); g.arc(cx, cy, th.night ? 30 : 36, 0, 7); g.fill();
    if (th.night) { // 月亮阴影
      g.fillStyle = 'rgba(200,205,235,.55)';
      g.beginPath(); g.arc(cx + 11, cy - 8, 26, 0, 7); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(cx + 20, cy - 14, 24, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
  }

  function drawClouds(g, th, cam, t, layer) {
    const R = rng(layer === 0 ? 1234 : 5678);
    const p = layer === 0 ? 0.07 : 0.16;
    const n = layer === 0 ? 16 : 12;
    const scale = layer === 0 ? 1.35 : 0.95;
    g.globalAlpha = layer === 0 ? 0.7 : 0.92;
    for (let i = 0; i < n; i++) {
      const bx = R() * 4200;
      const by = 26 + R() * 190;
      const s = (0.55 + R() * 0.7) * scale;
      const x = ((bx - cam.x * p) % 4200 + 4200) % 4200 - 300;
      if (x < -260 || x > W + 260) continue;
      drawCloud(g, x, by + Math.sin(t * 0.25 + i) * 5, 62 * s, th);
    }
    g.globalAlpha = 1;
  }

  function drawCloud(g, x, y, r, th) {
    g.fillStyle = th.cloud;
    g.beginPath();
    g.arc(x, y, r * 0.62, 0, 7);
    g.arc(x + r * 0.62, y + r * 0.1, r * 0.46, 0, 7);
    g.arc(x - r * 0.62, y + r * 0.14, r * 0.42, 0, 7);
    g.arc(x + r * 0.16, y - r * 0.34, r * 0.44, 0, 7);
    g.fill();
    g.fillStyle = th.cloudShade;
    g.beginPath();
    g.ellipse(x, y + r * 0.42, r * 0.92, r * 0.2, 0, 0, 7);
    g.fill();
  }

  function drawHills(g, th, cam, which) {
    const p = which === 0 ? 0.1 : 0.2;
    const baseY = which === 0 ? H * 0.62 : H * 0.72;
    const amp = which === 0 ? 46 : 34;
    const col = which === 0 ? th.hillFar : th.hillNear;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 10) {
      const wx = x + cam.x * p;
      const y = baseY + Math.sin(wx * 0.0022 + which * 2.1) * amp + Math.sin(wx * 0.0061 + which) * amp * 0.34;
      g.lineTo(x, y);
    }
    g.lineTo(W + 10, H); g.closePath(); g.fill();

    // 山顶柔光
    const gr = g.createLinearGradient(0, baseY - amp, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,.16)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-10, H);
    for (let x = -10; x <= W + 10; x += 10) {
      const wx = x + cam.x * p;
      const y = baseY + Math.sin(wx * 0.0022 + which * 2.1) * amp + Math.sin(wx * 0.0061 + which) * amp * 0.34;
      g.lineTo(x, y);
    }
    g.lineTo(W + 10, H); g.closePath(); g.fill();
  }

  /* 远景树林 */
  function drawFarTrees(g, th, cam, t) {
    const p = 0.42;
    const R = rng(4321);
    for (let i = 0; i < 90; i++) {
      const bx = R() * 7000;
      const s = 0.5 + R() * 0.55;
      const x = ((bx - cam.x * p) % 7000 + 7000) % 7000 - 500;
      if (x < -140 || x > W + 140) continue;
      const gy = H * 0.78 + R() * 16;
      g.globalAlpha = 0.85;
      g.fillStyle = th.trunk;
      g.fillRect(x - 4 * s, gy - 54 * s, 8 * s, 56 * s);
      g.fillStyle = th.farLeaf || th.leaf;
      g.beginPath();
      g.arc(x, gy - 66 * s, 30 * s, 0, 7);
      g.arc(x - 22 * s, gy - 52 * s, 22 * s, 0, 7);
      g.arc(x + 22 * s, gy - 52 * s, 22 * s, 0, 7);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  /* =========================================================
     前景装饰
     ========================================================= */
  const FLOWER_COLORS = ['#ff9ec4', '#fff07a', '#ffffff', '#a8b6ff', '#ffa76e'];

  function drawDecor(g, item, th, t, cam) {
    const x = item.x - (cam ? cam.x : 0), y = item.y, s = item.s || 1;
    g.save();
    g.translate(x, y);

    if (item.type === 'tree') {
      const sway = Math.sin(t * 0.9 + (item.seed || 0)) * 0.035;
      g.fillStyle = th.trunk;
      rr(g, -6 * s, -52 * s, 12 * s, 54 * s, 5 * s); g.fill();
      g.fillStyle = 'rgba(0,0,0,.08)';
      rr(g, 1 * s, -52 * s, 5 * s, 54 * s, 3 * s); g.fill();
      g.save();
      g.rotate(sway);
      g.fillStyle = th.leaf2;
      g.beginPath(); g.arc(0, -74 * s, 34 * s, 0, 7); g.fill();
      g.fillStyle = th.leaf;
      g.beginPath();
      g.arc(-24 * s, -62 * s, 24 * s, 0, 7);
      g.arc(24 * s, -62 * s, 24 * s, 0, 7);
      g.arc(0, -90 * s, 27 * s, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(-11 * s, -86 * s, 14 * s, 9 * s, -0.5, 0, 7); g.fill();
      // 果实
      g.fillStyle = th.accent;
      g.beginPath(); g.arc(-16 * s, -66 * s, 6 * s, 0, 7); g.arc(18 * s, -78 * s, 6 * s, 0, 7); g.fill();
      g.restore();
    } else if (item.type === 'bush') {
      g.fillStyle = th.leaf;
      g.beginPath();
      g.arc(0, -10 * s, 16 * s, 0, 7);
      g.arc(-15 * s, -6 * s, 12 * s, 0, 7);
      g.arc(15 * s, -6 * s, 12 * s, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)';
      g.beginPath(); g.ellipse(-6 * s, -18 * s, 9 * s, 5 * s, -0.4, 0, 7); g.fill();
    } else if (item.type === 'flower') {
      const c = FLOWER_COLORS[item.hue % FLOWER_COLORS.length];
      const sw = Math.sin(t * 1.6 + item.x * 0.05) * 1.6;
      g.strokeStyle = '#6fbb51'; g.lineWidth = 2 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(sw, -8 * s, sw * 1.4, -14 * s); g.stroke();
      g.fillStyle = c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.beginPath(); g.arc(sw * 1.4 + Math.cos(a) * 4 * s, -14 * s + Math.sin(a) * 4 * s, 3.4 * s, 0, 7); g.fill();
      }
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(sw * 1.4, -14 * s, 2.6 * s, 0, 7); g.fill();
    } else if (item.type === 'tuft') {
      g.strokeStyle = th.grassDark; g.lineWidth = 2.2 * s; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const sw = Math.sin(t * 1.4 + item.x * 0.03) * 2;
        g.beginPath(); g.moveTo(i * 3 * s, 0);
        g.quadraticCurveTo(i * 4 * s + sw, -7 * s, i * 6 * s + sw * 1.6, -12 * s);
        g.stroke();
      }
    } else if (item.type === 'stone') {
      g.fillStyle = '#c3ccd4';
      g.beginPath(); g.ellipse(0, -4 * s, 9 * s, 7 * s, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.ellipse(-2 * s, -6 * s, 4 * s, 2.5 * s, -0.3, 0, 7); g.fill();
    }
    g.restore();
  }

  /* =========================================================
     地形
     ========================================================= */
  function drawSolid(g, s, th, t, cam) {
    const x = s.x - cam.x, y = s.y, w = s.w, h = s.h;
    if (x + w < -60 || x > W + 60) return;

    if (s.oneWay) {
      // ---- 木板平台 ----
      const bh = Math.max(12, h);
      g.save();
      g.shadowColor = 'rgba(90,60,20,.22)';
      g.shadowBlur = 8; g.shadowOffsetY = 4;
      g.fillStyle = th.plank;
      rr(g, x, y, w, bh, bh / 2); g.fill();
      g.restore();
      g.fillStyle = th.plankLight;
      rr(g, x + 3, y + 2, w - 6, bh * 0.34, bh * 0.17); g.fill();
      g.strokeStyle = th.plankDark; g.lineWidth = 2;
      rr(g, x + 1, y + 1, w - 2, bh - 2, (bh - 2) / 2); g.stroke();
      // 木纹
      g.strokeStyle = 'rgba(150,110,60,.28)'; g.lineWidth = 1.5;
      for (let i = 1; i < Math.floor(w / 26); i++) {
        g.beginPath(); g.moveTo(x + i * 26, y + 3); g.lineTo(x + i * 26, y + bh - 3); g.stroke();
      }
      // 两端小叶
      g.fillStyle = s.mover ? th.accent : th.leaf;
      g.beginPath(); g.ellipse(x + 6, y + bh * 0.5, 7, 4.5, -0.35, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + w - 6, y + bh * 0.5, 7, 4.5, 0.35, 0, 7); g.fill();
      if (s.mover) {
        g.strokeStyle = th.accent; g.lineWidth = 2.4;
        rr(g, x - 1, y - 1, w + 2, bh + 2, bh / 2 + 1); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)';
        const px = x + ((t * 40) % Math.max(20, w - 10)) + 5;
        g.beginPath(); g.arc(px, y + bh * 0.5, 2.6, 0, 7); g.fill();
      }
      return;
    }

    // ---- 地面方块 ----
    const R = 12;
    g.save();
    g.beginPath(); rr(g, x, y, w, h, R); g.clip();

    const dg = g.createLinearGradient(0, y, 0, y + Math.min(h, 240));
    dg.addColorStop(0, th.dirt);
    dg.addColorStop(1, th.dirtDark);
    g.fillStyle = dg;
    g.fillRect(x, y, w, h);

    // 土壤颗粒
    const rr2 = rng(Math.round(s.x * 31 + s.y * 7) || 3);
    g.fillStyle = th.dirtDot;
    g.globalAlpha = 0.5;
    for (let i = 0; i < Math.floor(w / 26); i++) {
      const px = x + R + rr2() * Math.max(1, w - R * 2);
      const py = y + 28 + rr2() * Math.max(1, Math.min(h - 30, 120));
      g.beginPath(); g.arc(px, py, 1.6 + rr2() * 2.6, 0, 7); g.fill();
    }
    g.globalAlpha = 1;

    // 草地
    const band = 17;
    g.fillStyle = th.grass;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.lineTo(x + w, y + band);
    for (let cx2 = x + w; cx2 > x; cx2 -= 20) {
      g.arc(cx2 - 10, y + band, 10, 0, Math.PI, false);
    }
    g.lineTo(x, y);
    g.closePath();
    g.fill();

    g.fillStyle = th.grassLight;
    g.fillRect(x, y, w, 5.5);
    g.fillStyle = th.grassDark;
    g.fillRect(x, y + band - 2, w, 2.5);

    // 草叶
    g.strokeStyle = th.grassDark; g.lineWidth = 2; g.lineCap = 'round';
    const gr = rng(Math.round(s.x * 17 + 5) || 5);
    for (let i = 0; i < Math.floor(w / 34); i++) {
      const px = x + 10 + gr() * Math.max(1, w - 20);
      const hh = 5 + gr() * 6;
      g.beginPath(); g.moveTo(px, y + 2); g.quadraticCurveTo(px + 2, y - hh * 0.6, px + 4, y - hh); g.stroke();
      g.beginPath(); g.moveTo(px + 6, y + 2); g.quadraticCurveTo(px + 5, y - hh * 0.5, px + 2, y - hh * 0.8); g.stroke();
    }
    g.restore();

    // 轮廓
    g.strokeStyle = 'rgba(120,90,50,.28)'; g.lineWidth = 2;
    rr(g, x + 1, y + 1, w - 2, h - 2, R); g.stroke();
  }

  /* =========================================================
     道具
     ========================================================= */
  function drawBell(g, it, t, cam) {
    const bob = Math.sin(t * 2.6 + it.t) * 4;
    const x = it.x - (cam ? cam.x : 0), y = it.y + bob;
    g.save();
    // 光晕
    const gl = g.createRadialGradient(x, y, 2, x, y, 22);
    gl.addColorStop(0, 'rgba(255,235,140,.55)');
    gl.addColorStop(1, 'rgba(255,235,140,0)');
    g.fillStyle = gl;
    g.beginPath(); g.arc(x, y, 22, 0, 7); g.fill();

    g.fillStyle = '#ffd24d';
    g.strokeStyle = '#d9a017'; g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(x - 10, y + 7);
    g.quadraticCurveTo(x - 10, y - 8, x, y - 8);
    g.quadraticCurveTo(x + 10, y - 8, x + 10, y + 7);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffeaa0';
    g.beginPath(); g.ellipse(x - 4, y - 2, 3.4, 4.4, -0.35, 0, 7); g.fill();
    g.strokeStyle = '#d9a017'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - 10, y + 7); g.lineTo(x + 10, y + 7); g.stroke();
    g.fillStyle = '#ffd24d';
    g.beginPath(); g.arc(x, y + 9.5, 2.6, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#c98a12';
    g.beginPath(); g.arc(x, y - 9.5, 2.4, 0, 7); g.fill();
    g.restore();
  }

  function drawFruit(g, it, t, cam) {
    const bob = Math.sin(t * 2.2 + it.t) * 5;
    const x = it.x - (cam ? cam.x : 0), y = it.y + bob;
    g.save();
    const gl = g.createRadialGradient(x, y, 2, x, y, 26);
    gl.addColorStop(0, 'rgba(255,160,180,.5)');
    gl.addColorStop(1, 'rgba(255,160,180,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill();

    g.strokeStyle = '#7a5230'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - 4); g.quadraticCurveTo(x + 3, y - 14, x + 1, y - 18); g.stroke();
    g.fillStyle = '#6fc24e';
    g.beginPath(); g.ellipse(x + 8, y - 17, 8, 4.6, -0.4, 0, 7); g.fill();
    g.fillStyle = '#e8524d';
    g.strokeStyle = '#bd3b38'; g.lineWidth = 1.8;
    g.beginPath(); g.arc(x - 5, y + 2, 9.5, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.arc(x + 6, y + 1, 8.5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.beginPath(); g.ellipse(x - 8, y - 2, 3, 4, -0.4, 0, 7); g.fill();
    g.restore();
  }

  /* =========================================================
     敌人
     ========================================================= */
  function drawEnemy(g, e, th, t, cam) {
    const x = e.x - cam.x, y = e.y;
    if (x < -80 || x > W + 80) return;
    g.save();
    if (e.dead) {
      g.globalAlpha = Math.max(0, 1 - e.dead / 0.45);
      g.translate(x + e.w / 2, y + e.h);
      g.scale(1 + e.dead * 1.6, Math.max(0.05, 1 - e.dead * 2.2));
      g.translate(-(x + e.w / 2), -(y + e.h));
    }

    if (e.type === 'walker') {
      const sq = Math.sin(t * 5 + e.t) * 0.045;
      const cx = x + e.w / 2, cy = y + e.h;
      g.fillStyle = 'rgba(0,0,0,.15)';
      g.beginPath(); g.ellipse(cx, cy + 2, e.w * 0.42, 4.5, 0, 0, 7); g.fill();
      g.save();
      g.translate(cx, cy); g.scale(1 + sq, 1 - sq);
      // 脚
      g.fillStyle = '#8a6a3f';
      const st = Math.sin(t * 6 + e.t) * 3;
      rr(g, -e.w * 0.3 + st, -6, 11, 7, 3.5); g.fill();
      rr(g, e.w * 0.3 - 11 - st, -6, 11, 7, 3.5); g.fill();
      // 身体（苔藓球）
      const bg = g.createLinearGradient(0, -e.h, 0, 0);
      bg.addColorStop(0, '#8fd46a');
      bg.addColorStop(1, '#5da844');
      g.fillStyle = bg;
      g.strokeStyle = '#4c9138'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -e.h * 0.52, e.w * 0.46, e.h * 0.46, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.3)';
      g.beginPath(); g.ellipse(-e.w * 0.14, -e.h * 0.72, e.w * 0.15, e.h * 0.11, -0.4, 0, 7); g.fill();
      // 眼睛
      g.fillStyle = '#3c3020';
      const dir = e.dir || 1;
      g.beginPath(); g.arc(dir * 4 - 5, -e.h * 0.58, 2.6, 0, 7); g.arc(dir * 4 + 5, -e.h * 0.58, 2.6, 0, 7); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(dir * 4 - 5.8, -e.h * 0.63, 0.9, 0, 7); g.arc(dir * 4 + 4.2, -e.h * 0.63, 0.9, 0, 7); g.fill();
      // 嘴
      g.strokeStyle = '#3c3020'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(dir * 4, -e.h * 0.44, 3.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      // 头顶小叶
      drawLeaf(g, 0, -e.h * 1.0, 6.5, t + e.t, { shirt: '#9ee07a' });
      g.restore();
    } else {
      // 蝴蝶
      const flap = Math.abs(Math.sin(t * 7 + e.t));
      const cx = x + e.w / 2, cy = y + e.h / 2;
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.beginPath(); g.ellipse(cx, e.baseY + e.h + 16, 10, 3.5, 0, 0, 7); g.fill();
      g.fillStyle = th.accent;
      [-1, 1].forEach((s) => {
        g.save();
        g.translate(cx, cy);
        g.scale(s * (0.45 + flap * 0.6), 1);
        g.beginPath();
        g.ellipse(10, -5, 11, 8.5, -0.35, 0, 7);
        g.ellipse(9, 6, 8.5, 6.5, 0.35, 0, 7);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.beginPath(); g.ellipse(9, -6, 4.5, 3, -0.35, 0, 7); g.fill();
        g.fillStyle = th.accent;
        g.restore();
      });
      g.fillStyle = '#6b5a8a';
      rr(g, cx - 3, cy - 9, 6, 19, 3); g.fill();
      g.fillStyle = '#3c3020';
      g.beginPath(); g.arc(cx - 1.6 * (e.dir || 1), cy - 8, 2, 0, 7); g.arc(cx + 2.6 * (e.dir || 1), cy - 8, 2, 0, 7); g.fill();
      g.strokeStyle = '#6b5a8a'; g.lineWidth = 1.4; g.lineCap = 'round';
      [-1, 1].forEach((s) => {
        g.beginPath(); g.moveTo(cx + s * 1.6, cy - 10); g.quadraticCurveTo(cx + s * 6, cy - 16, cx + s * 9, cy - 14); g.stroke();
        g.beginPath(); g.arc(cx + s * 9.6, cy - 14, 1.6, 0, 7); g.fillStyle = '#6b5a8a'; g.fill();
      });
    }
    g.restore();
  }

  /* =========================================================
     终点 & 检查点
     ========================================================= */
  function drawGoal(g, goal, th, t, cam) {
    const x = goal.x - cam.x, y = goal.y;
    if (x < -160 || x > W + 220) return;
    g.save();
    // 光环
    const gl = g.createRadialGradient(x, y - 70, 10, x, y - 70, 120);
    gl.addColorStop(0, 'rgba(255,240,160,.45)');
    gl.addColorStop(1, 'rgba(255,240,160,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y - 70, 120, 0, 7); g.fill();

    // 基座
    g.fillStyle = '#c9b79c';
    g.beginPath(); g.ellipse(x, y + 3, 38, 10, 0, 0, 7); g.fill();
    g.fillStyle = '#e0d0b8';
    g.beginPath(); g.ellipse(x, y, 34, 8.5, 0, 0, 7); g.fill();

    // 柱子
    g.fillStyle = '#b98a52';
    rr(g, x - 7, y - 130, 14, 132, 6); g.fill();
    g.fillStyle = '#d8a86b';
    rr(g, x - 7, y - 130, 7, 132, 6); g.fill();

    // 风向标伞
    g.save();
    g.translate(x, y - 130);
    g.rotate(Math.sin(t * 1.1) * 0.12);
    const cols = ['#ff8fa8', '#ffd75e', '#8fd06a', '#7fc7ea'];
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate((i / 8) * Math.PI * 2 + t * 0.5);
      g.fillStyle = cols[i % 4];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 30, -0.22, 0.22); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = '#fff8e0';
    g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    g.fillStyle = '#ffd75e';
    g.beginPath(); g.arc(0, 0, 4.5, 0, 7); g.fill();
    g.restore();

    // 飘带
    g.save();
    g.translate(x + 7, y - 104);
    for (let i = 0; i < 3; i++) {
      const w2 = 34 - i * 5;
      const yy = i * 20;
      g.fillStyle = ['#ff9ec4', '#ffd75e', '#8fd06a'][i];
      g.beginPath();
      g.moveTo(0, yy);
      for (let k = 0; k <= 6; k++) {
        g.lineTo((k / 6) * w2, yy + Math.sin(t * 3 + k * 0.8 + i) * 4);
      }
      for (let k = 6; k >= 0; k--) {
        g.lineTo((k / 6) * w2, yy + 9 + Math.sin(t * 3 + k * 0.8 + i) * 4);
      }
      g.closePath(); g.fill();
    }
    g.restore();

    // 星星
    for (let i = 0; i < 5; i++) {
      const a = t * 1.3 + (i / 5) * Math.PI * 2;
      const px = x + Math.cos(a) * 62;
      const py = y - 70 + Math.sin(a) * 34;
      drawStar(g, px, py, 4 + Math.sin(t * 4 + i) * 1.4, '#fff3b0');
    }
    g.restore();
  }

  function drawStar(g, x, y, r, col) {
    g.save(); g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? r * 0.45 : r;
      const fn = i ? 'lineTo' : 'moveTo';
      g[fn](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath(); g.fill(); g.restore();
  }

  function drawCheckpoint(g, cp, th, t, cam) {
    const x = cp.x - cam.x, y = cp.y;
    if (x < -120 || x > W + 120) return;
    g.save();
    g.fillStyle = '#b98a52';
    rr(g, x - 5, y - 60, 10, 62, 5); g.fill();
    g.fillStyle = cp.on ? '#ffd75e' : '#d8a86b';
    rr(g, x - 5, y - 60, 5, 62, 5); g.fill();
    g.save();
    g.translate(x, y - 60);
    g.rotate(cp.on ? Math.sin(t * 2.6) * 0.1 : 0);
    if (cp.on) {
      g.fillStyle = '#ffd75e'; g.strokeStyle = '#d9a017'; g.lineWidth = 2;
    } else {
      g.fillStyle = '#e8e0d0'; g.strokeStyle = '#c0b49c'; g.lineWidth = 2;
    }
    rr(g, -24, -30, 48, 30, 7); g.fill(); g.stroke();
    g.fillStyle = cp.on ? '#7a5a10' : '#a89a84';
    g.beginPath(); g.arc(-8, -15, 3.4, 0, 7); g.arc(8, -15, 3.4, 0, 7); g.fill();
    g.strokeStyle = cp.on ? '#7a5a10' : '#a89a84'; g.lineWidth = 2;
    g.beginPath();
    if (cp.on) g.arc(0, -12, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    else { g.moveTo(-6, -8); g.lineTo(0, -5); g.lineTo(6, -8); }
    g.stroke();
    g.restore();
    g.restore();
  }

  /* =========================================================
     玩家
     ========================================================= */
  function drawPlayer(g, p, avatarState, t, cam, withGun) {
    // 只有刚受伤的前半段才闪烁，避免长时间隐身
    if (p.invuln > 0.9 && Math.floor(t * 18) % 2 === 0) return;
    const cx0 = cam ? p.x - cam.x : p.x;
    drawCreature(g, cx0, p.y, p.w, p.h, avatarState.variant, {
      facing: p.facing,
      photo: avatarState.photo,
      blink: p.blink,
      happy: p.happy,
      run: p.runPhase,
      air: !p.onGround,
      squash: p.squash,
      gun: !!withGun,
      t,
    });
  }

  /* 子弹 */
  function drawBullet(g, b, t, cam) {
    const x = b.x - (cam ? cam.x : 0), y = b.y;
    const dir = b.dir || 1;
    g.save();
    // 拖尾
    const tl = 17;
    const grad = g.createLinearGradient(x - dir * tl, y, x, y);
    grad.addColorStop(0, 'rgba(255,231,122,0)');
    grad.addColorStop(1, 'rgba(255,231,122,.9)');
    g.strokeStyle = grad; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - dir * tl, y); g.lineTo(x, y); g.stroke();
    // 光晕
    const gl = g.createRadialGradient(x, y, 1, x, y, 10);
    gl.addColorStop(0, 'rgba(255,255,224,.95)');
    gl.addColorStop(0.45, 'rgba(255,214,90,.7)');
    gl.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(x, y, 2.7, 0, 7); g.fill();
    g.restore();
  }

  /* =========================================================
     粒子
     ========================================================= */
  function drawParticle(g, pt, cam) {
    const a = Math.max(0, pt.life / pt.max);
    g.save();
    g.globalAlpha = a;
    const x = pt.x - cam.x, y = pt.y;
    if (pt.kind === 'spark') {
      drawStar(g, x, y, pt.size * (0.4 + a * 0.8), pt.color);
    } else if (pt.kind === 'puff') {
      g.fillStyle = pt.color;
      g.beginPath(); g.arc(x, y, pt.size * (1.6 - a * 0.7), 0, 7); g.fill();
    } else if (pt.kind === 'petal' || pt.kind === 'leaf') {
      g.translate(x, y); g.rotate(pt.rot);
      g.fillStyle = pt.color;
      g.beginPath(); g.ellipse(0, 0, pt.size, pt.size * 0.55, 0, 0, 7); g.fill();
    } else if (pt.kind === 'snow') {
      g.fillStyle = pt.color;
      g.beginPath(); g.arc(x, y, pt.size, 0, 7); g.fill();
    } else if (pt.kind === 'star') {
      drawStar(g, x, y, pt.size * (0.5 + a), pt.color);
    } else if (pt.kind === 'plus') {
      g.fillStyle = pt.color;
      g.font = 'bold ' + (13 + pt.size) + 'px system-ui';
      g.textAlign = 'center';
      g.fillText(pt.text, x, y);
    }
    g.restore();
  }

  AC.art = {
    THEMES, VARIANTS, T, W, H, rr,
    buildDecor, drawSky, drawClouds, drawHills, drawFarTrees, drawDecor,
    drawSolid, drawBell, drawFruit, drawEnemy, drawGoal, drawCheckpoint,
    drawPlayer, drawParticle, drawStar, drawHead, drawCreature, drawBullet,
    makeAvatarCanvas, paintAvatar, rng,
  };
})();
