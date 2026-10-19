/* =========================================================
   audio.js  —  森友大冒险 音乐 / 音效引擎
   - 程序化生成的 Relaxing BGM（雨声感铺底 + 柔和钢琴感旋律）
   - 支持载入用户自己的音频文件作为 BGM
   ========================================================= */
(function () {
  const AC = (window.AC = window.AC || {});

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------- 混响 IR ---------------- */
  function makeIR(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* ---------------- 音乐引擎 ---------------- */
  // 相对 F 大调的旋律音级：0=F 2=G 4=A 5=Bb 7=C 9=D 12=F 14=G 16=A
  const MELODY = [
    // [小节, 拍位, 音级, 时值]
    [0, 0, 12, 1.0], [0, 1, 9, 0.5], [0, 1.5, 7, 0.5], [0, 2.5, 9, 1.5],
    [1, 0, 5, 1.0], [1, 1, 7, 0.5], [1, 1.5, 9, 0.5], [1, 2.5, 7, 1.5],
    [2, 0, 4, 1.0], [2, 1, 7, 0.5], [2, 1.5, 5, 0.5], [2, 2.5, 4, 1.5],
    [3, 0, 2, 1.0], [3, 1.5, 4, 0.5], [3, 2.5, 0, 1.5],
    [4, 0, 12, 1.5], [4, 2, 14, 0.5], [4, 2.5, 12, 1.5],
    [5, 0, 9, 1.0], [5, 1.5, 12, 1.0], [5, 3, 9, 1.0],
    [6, 0, 7, 1.0], [6, 1, 5, 0.5], [6, 1.5, 4, 0.5], [6, 2.5, 2, 1.5],
    [7, 0, 0, 1.5], [7, 2, 4, 2.0],
  ];
  // 每个小节的和弦（根音 midi + 和弦音相对根音的半音数）
  const CHORDS = [
    { root: 53, iv: [0, 4, 7, 11] },  // Fmaj7
    { root: 50, iv: [0, 3, 7, 10] },  // Dm7
    { root: 46, iv: [0, 4, 7, 11] },  // Bbmaj7
    { root: 48, iv: [0, 5, 7, 12] },  // Csus
  ];
  const BARS = 8;
  const BPM = 74;
  const SPB = 60 / BPM;          // 每拍秒数
  const STEP = SPB / 2;          // 八分音符

  class Music {
    constructor() {
      this.ready = false;
      this.playing = false;
      this.muted = false;
      this.keyOffset = 0;        // 每关移调
      this.step = 0;
      this.nextTime = 0;
      this.timer = null;
      this.customEl = null;      // 用户自己的 BGM
      this.customMode = false;
      this.volume = 0.62;
    }

    init() {
      if (this.ready) return;
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx) return;
      const ctx = (this.ctx = new ACtx());

      // 母总线
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;

      // 柔和限幅
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 24;
      comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.28;

      this.master.connect(comp);
      comp.connect(ctx.destination);

      // 混响
      this.rev = ctx.createConvolver();
      this.rev.buffer = makeIR(ctx, 2.4, 2.6);
      this.revGain = ctx.createGain();
      this.revGain.gain.value = 0.42;
      this.rev.connect(this.revGain);
      this.revGain.connect(this.master);

      // 音乐总线
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.9;
      this.musicBus.connect(this.master);

      this.dryGain = ctx.createGain();
      this.dryGain.gain.value = 1;
      this.dryGain.connect(this.musicBus);

      // 延迟（让旋律更有空间感）
      this.delay = ctx.createDelay(1.2);
      this.delay.delayTime.value = SPB * 0.75;
      this.delayGain = ctx.createGain();
      this.delayGain.gain.value = 0.26;
      const dFb = ctx.createGain(); dFb.gain.value = 0.32;
      const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 1800;
      this.delay.connect(dLP); dLP.connect(dFb); dFb.connect(this.delay);
      this.delay.connect(this.musicBus);
      this.delayIn = ctx.createGain();
      this.delayIn.connect(this.delay);

      // 音效总线
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      this.ready = true;
    }

    resume() {
      if (!this.ready) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    /* ---- 单音 ---- */
    tone(opts) {
      const ctx = this.ctx; if (!ctx) return;
      const t = opts.t || ctx.currentTime;
      const dur = opts.dur || 0.5;
      const o = ctx.createOscillator();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(opts.freq, t);
      if (opts.freqTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqTo), t + dur);

      const g = ctx.createGain();
      const peak = opts.gain == null ? 0.2 : opts.gain;
      const atk = opts.atk == null ? 0.012 : opts.atk;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      let node = o;
      if (opts.filter) {
        const f = ctx.createBiquadFilter();
        f.type = opts.filter; f.frequency.value = opts.cutoff || 1200; f.Q.value = opts.q || 0.7;
        node.connect(f); node = f;
      }
      node.connect(g);

      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = opts.pan || 0; g.connect(p); p.connect(opts.out || this.dryGain); }
      else g.connect(opts.out || this.dryGain);

      if (opts.rev) {
        const rg = ctx.createGain(); rg.gain.value = opts.rev;
        g.connect(rg); rg.connect(this.rev);
      }
      if (opts.delay) {
        const dg = ctx.createGain(); dg.gain.value = opts.delay;
        g.connect(dg); dg.connect(this.delayIn);
      }

      o.start(t);
      o.stop(t + dur + 0.06);
      return o;
    }

    /* ---- 噪声（沙锤 / 踩地） ---- */
    noise(opts) {
      const ctx = this.ctx; if (!ctx) return;
      const t = opts.t || ctx.currentTime;
      const dur = opts.dur || 0.06;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, opts.decay || 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = opts.filter || 'highpass'; f.frequency.value = opts.cutoff || 5000;
      const g = ctx.createGain(); g.gain.value = opts.gain == null ? 0.05 : opts.gain;
      src.connect(f); f.connect(g);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = opts.pan || 0; g.connect(p); p.connect(opts.out || this.musicBus); }
      else g.connect(opts.out || this.musicBus);
      src.start(t); src.stop(t + dur + 0.02);
    }

    /* ---- 和弦 Pad ---- */
    chord(barIdx, t) {
      const c = CHORDS[barIdx % CHORDS.length];
      const root = c.root + this.keyOffset;
      for (let i = 0; i < c.iv.length; i++) {
        const f = mtof(root + c.iv[i] + 12);
        this.tone({
          t, freq: f, dur: SPB * 4.2, type: 'triangle',
          gain: 0.052, atk: 1.1, filter: 'lowpass', cutoff: 1450,
          pan: (i - 1.5) * 0.28, rev: 0.55, out: this.dryGain,
        });
      }
      // 低音
      this.tone({ t, freq: mtof(root - 12), dur: SPB * 2.0, type: 'sine', gain: 0.19, atk: 0.03, rev: 0.12 });
      this.tone({ t: t + SPB * 2, freq: mtof(root - 12), dur: SPB * 2.0, type: 'sine', gain: 0.15, atk: 0.03, rev: 0.12 });
    }

    /* ---- 铃声点缀 ---- */
    bellNote(f, t, gain) {
      this.tone({ t, freq: f, dur: 1.6, type: 'sine', gain: gain || 0.075, atk: 0.005, rev: 0.5, delay: 0.18 });
      this.tone({ t, freq: f * 2.01, dur: 0.9, type: 'sine', gain: (gain || 0.075) * 0.3, atk: 0.005, rev: 0.4 });
    }

    /* ---- 单步调度 ---- */
    scheduleStep(step, t) {
      const bar = Math.floor(step / 8) % BARS;
      const beat = (step % 8) / 2;

      if (step % 8 === 0) this.chord(bar, t);

      // 沙锤
      const sh = step % 2 === 0 ? 0.026 : 0.015;
      this.noise({ t, dur: 0.055, cutoff: 7200, gain: sh, pan: step % 4 < 2 ? -0.3 : 0.3, decay: 4 });

      // 轻踏
      if (beat === 0 || beat === 2) {
        this.tone({ t, freq: 92, freqTo: 52, dur: 0.22, type: 'sine', gain: 0.14, atk: 0.004 });
      }

      // 旋律
      for (let i = 0; i < MELODY.length; i++) {
        const m = MELODY[i];
        if (m[0] !== bar || Math.abs(m[1] - beat) > 0.001) continue;
        const root = 53 + this.keyOffset;
        this.tone({
          t, freq: mtof(root + m[2]), dur: Math.max(0.34, m[3] * SPB * 1.7),
          type: 'triangle', gain: 0.115, atk: 0.02,
          filter: 'lowpass', cutoff: 2600,
          pan: 0.1, rev: 0.42, delay: 0.34,
        });
      }

      // 铃铛点缀（每两小节一次）
      if (step === 14 || step === 46) {
        const root = 53 + this.keyOffset;
        this.bellNote(mtof(root + 24), t, 0.055);
      }
    }

    loop() {
      if (!this.playing || !this.ctx) return;
      const horizon = this.ctx.currentTime + 0.25;
      let guard = 0;
      while (this.nextTime < horizon && guard++ < 64) {
        this.scheduleStep(this.step, this.nextTime);
        this.step = (this.step + 1) % (BARS * 8);
        this.nextTime += STEP;
      }
    }

    start() {
      this.resume();
      if (!this.ready) return;
      if (this.customMode) { this.playCustom(); return; }
      if (this.playing) return;
      this.playing = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.12;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.loop(), 25);
    }

    stop() {
      this.playing = false;
      clearInterval(this.timer);
      this.timer = null;
      if (this.customMode) this.pauseCustom();
      const t = this.ctx ? this.ctx.currentTime : 0;
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.cancelScheduledValues(t);
        this.musicBus.gain.setTargetAtTime(0.0001, t, 0.12);
        setTimeout(() => {
          if (this.musicBus) this.musicBus.gain.setValueAtTime(0.9, this.ctx.currentTime);
        }, 700);
      }
    }

    /* ---- 用户自定义 BGM ---- */
    setCustomFile(file) {
      if (this.customEl) { this.customEl.pause(); this.customEl = null; }
      const url = URL.createObjectURL(file);
      const el = new Audio(url);
      el.loop = true;
      el.volume = 0.55;
      this.customEl = el;
      this.customMode = true;
      this.customName = file.name;
      if (this.playing) this.stop();
      el.play().catch(() => {});
      return el;
    }
    clearCustom() {
      if (this.customEl) { this.customEl.pause(); this.customEl = null; }
      this.customMode = false;
      this.customName = null;
    }
    playCustom() {
      if (this.customEl && this.customEl.paused) this.customEl.play().catch(() => {});
    }
    pauseCustom() { if (this.customEl) this.customEl.pause(); }

    /* ---- 静音 ---- */
    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
      if (this.customEl) this.customEl.volume = m ? 0 : 0.55;
    }
    toggleMute() { this.setMuted(!this.muted); return this.muted; }

    setLevel(i) { this.keyOffset = [0, 2, -2, 3, -4, 5][i % 6]; }

    /* ---------------- 音效 ---------------- */
    sfx(name) {
      if (!this.ready) return;
      this.resume();
      const t = this.ctx.currentTime + 0.001;
      const o = (extra) => Object.assign({ t, out: this.sfxBus, rev: 0.16 }, extra);
      switch (name) {
        case 'jump':
          this.tone(o({ freq: 430, freqTo: 780, dur: 0.16, type: 'triangle', gain: 0.16 }));
          break;
        case 'land':
          this.noise({ t, dur: 0.09, cutoff: 1400, filter: 'lowpass', gain: 0.09, out: this.sfxBus, decay: 5 });
          break;
        case 'bell':
          this.tone(o({ freq: mtof(88), dur: 0.5, type: 'sine', gain: 0.17 }));
          this.tone(o({ t: t + 0.055, freq: mtof(95), dur: 0.5, type: 'sine', gain: 0.14 }));
          break;
        case 'fruit':
          [76, 81, 88].forEach((n, i) => this.tone(o({ t: t + i * 0.055, freq: mtof(n), dur: 0.45, type: 'triangle', gain: 0.15 })));
          break;
        case 'hurt':
          this.tone(o({ freq: 420, freqTo: 110, dur: 0.42, type: 'sawtooth', gain: 0.13, filter: 'lowpass', cutoff: 900 }));
          break;
        case 'stomp':
          this.tone(o({ freq: 300, freqTo: 660, dur: 0.14, type: 'square', gain: 0.1, filter: 'lowpass', cutoff: 1400 }));
          break;
        case 'check':
          [72, 76, 79].forEach((n, i) => this.tone(o({ t: t + i * 0.07, freq: mtof(n), dur: 0.5, type: 'sine', gain: 0.14 })));
          break;
        case 'goal':
          [72, 76, 79, 84, 88].forEach((n, i) => this.tone(o({ t: t + i * 0.1, freq: mtof(n), dur: 0.9, type: 'triangle', gain: 0.17, rev: 0.4 })));
          break;
        case 'ui':
          this.tone(o({ freq: 720, dur: 0.1, type: 'sine', gain: 0.1 }));
          break;
        case 'shoot':
          this.noise({ t, dur: 0.07, cutoff: 2600, filter: 'highpass', gain: 0.075, out: this.sfxBus, decay: 7 });
          this.tone(o({ freq: 640, freqTo: 180, dur: 0.1, type: 'square', gain: 0.07, filter: 'lowpass', cutoff: 1800 }));
          break;
        case 'buy':
          [79, 84, 88].forEach((n, i) => this.tone(o({ t: t + i * 0.06, freq: mtof(n), dur: 0.35, type: 'triangle', gain: 0.14 })));
          break;
        case 'win':
          [65, 69, 72, 77, 81, 84, 89, 93].forEach((n, i) =>
            this.tone(o({ t: t + i * 0.13, freq: mtof(n), dur: 1.6, type: 'triangle', gain: 0.17, rev: 0.55 })));
          break;
      }
    }
  }

  AC.music = new Music();
})();
