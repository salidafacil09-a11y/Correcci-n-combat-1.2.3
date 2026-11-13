// Música: banda sonora hecha en el momento (sin archivos de audio), con melodías propias.
//  · menú: una guitarra de cuerdas dobles muy leve, notas sueltas que suenan y se apagan, mucho aire y eco;
//  · exploración: casi siempre silencio (manda el ambiente); cada tanto aparece una frase corta y se retira sola;
//  · tensión: cuando algo te busca, un zumbido grave apenas audible y algún vidrio lejano;
//  · presencia (el miedo): lo que duerme cerca (el hongomorfo, chasqueadores quietos) manda silencio total; lo que
//    te acecha sin dejarse ver (acechadores, emboscadas, el hongomorfo cazando) solo un drone hondo que respira y
//    un latido lejano, más rápido cuanto más cerca; y antes de que salte encima, un segundo de nada;
//  · combate: drones distorsionados, percusión pesada, chelos raspados y bajo frotado; sube con el peligro (solo
//    cuando de verdad te persiguen).
(function (G) {
  'use strict';
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, ready = false, N = null, NB = null, timer = 0, gen = 0;
  const KS = {};          // cuerdas ya calculadas (una por nota)
  const CURVES = {};
  const Q = [];           // notas de guitarra que esperan su momento

  function fresh() {
    return {
      mode: 'off', paused: false, out: -1, layout: null,
      cmb: null, hold: 0, lvWant: 1, downT: 0, step: 0, nextT: 0,
      tens: 0, tenApplied: -1, tenNodes: null, pingT: 0,
      pres: 0, presApplied: -1, presNodes: null, beatT: 0, hush: 0, cmbWait: 0, ext: 0, extT: 0,
      cue: null, cueT: 30, menuPad: null, menuNext: 0, lastPh: -1, dark: false
    };
  }
  let S = fresh();

  // ---------- piezas básicas ----------
  function g(v) { const x = ctx.createGain(); x.gain.value = v == null ? 1 : v; return x; }
  function filt(type, f, q, gn) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gn != null) b.gain.value = gn; return b; }
  function chain() { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }
  function shaper(drive) {
    const k = Math.round(drive * 10);
    if (!CURVES[k]) {
      const n = 1024, c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
      CURVES[k] = c;
    }
    // (en el celular sin sobremuestreo: la saturación cuesta la mitad y en su altavoz no se distingue)
    const s = ctx.createWaveShaper(); s.curve = CURVES[k]; s.oversample = G.Audio && G.Audio.lite ? 'none' : '2x';
    return s;
  }
  function osc(type, f, t, dur) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    o.start(t); if (dur) o.stop(t + dur);
    return o;
  }
  function noise(kind, t, dur) {
    const s = ctx.createBufferSource(); s.buffer = NB[kind]; s.loop = true;
    s.start(t, R(0, 1.5)); if (dur) s.stop(t + dur);
    return s;
  }
  // envolvente: sube en «a» segundos hasta «pk» y se apaga en «d»
  function eg(t, a, pk, d) {
    const x = ctx.createGain();
    x.gain.setValueAtTime(0, t); x.gain.linearRampToValueAtTime(pk, t + a);
    x.gain.exponentialRampToValueAtTime(Math.max(1e-4, pk * 1e-3), t + a + d);
    x.gain.setValueAtTime(0, t + a + d + 0.01);
    return x;
  }
  function pan(v) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v)); return p; }
    return g(1);
  }
  // fundido sin chasquidos (solo con setTargetAtTime en las capas)
  function fade(param, v, t, tc) { param.cancelScheduledValues(t); param.setTargetAtTime(v, t, tc); }

  function noises(c) {
    const sr = c.sampleRate, n = sr * 2, o = {};
    const w = c.createBuffer(1, n, sr), p = c.createBuffer(1, n, sr), b = c.createBuffer(1, n, sr);
    const wd = w.getChannelData(0), pd = p.getChannelData(0), bd = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const r = Math.random() * 2 - 1;
      wd[i] = r;
      b0 = 0.99886 * b0 + r * 0.0555179; b1 = 0.99332 * b1 + r * 0.0750759; b2 = 0.969 * b2 + r * 0.153852;
      b3 = 0.8665 * b3 + r * 0.3104856; b4 = 0.55 * b4 + r * 0.5329522; b5 = -0.7616 * b5 - r * 0.016898;
      pd[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + r * 0.5362) * 0.11; b6 = r * 0.115926;
      last = (last + 0.02 * r) / 1.02; bd[i] = last * 3.5;
    }
    o.white = w; o.pink = p; o.brown = b;
    return o;
  }
  // sala grande: cola larga y oscura (cada vez más apagada)
  function hall(sec, nch) {
    const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(nch || 2, n, sr);
    for (let ch = 0; ch < (nch || 2); ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        if (t < 0.022 + ch * 0.007) { d[i] = 0; continue; }
        const k = 0.55 - 0.45 * Math.min(1, t / sec);
        lp += (Math.random() * 2 - 1 - lp) * k;
        d[i] = lp * Math.exp(-t * 6.2 / sec);
      }
    }
    return b;
  }

  // ---------- mezcla ----------
  function build(c, dest) {
    ctx = c;
    NB = noises(c);
    const n = {};
    n.out = g(0); n.out.connect(dest);
    n.pf = filt('lowpass', 20000, 0.5); n.pf.connect(n.out);
    // en el celular, la sala liviana (retardos realimentados) en vez de la convolución: era lo más caro de todo
    const lite = !!(G.Audio && G.Audio.lite && G.Audio.liteRev);
    n.revIn = g(1); n.revOut = g(1);
    if (lite) {
      const r = G.Audio.liteRev(c, 2.4, 2200, false, 1.46);
      n.revIn.connect(r.input); r.output.connect(n.revOut);
    } else {
      n.rev = c.createConvolver();
      n.rev.buffer = hall(3.6, 2);
      chain(n.revIn, n.rev, n.revOut);
    }
    n.revOut.connect(n.pf);
    // guitarra (y su colchón): cuerpo de madera, sin brillo metálico
    n.gtr = g(0); n.gtr.connect(n.pf);
    n.gtrIn = g(1);
    chain(n.gtrIn, filt('peaking', 210, 1, 3), filt('peaking', 2600, 1.2, 2.5), filt('highshelf', 6500, null, -6), n.gtr);
    n.gtrRev = g(0.62); n.gtr.connect(n.gtrRev); n.gtrRev.connect(n.revIn);
    // tensión
    n.ten = g(0); n.ten.connect(n.pf);
    n.tenRev = g(0.8); n.ten.connect(n.tenRev); n.tenRev.connect(n.revIn);
    // presencia: grave y seco (poca sala, para que se sienta cerca)
    n.pres = g(0); n.pres.connect(n.pf);
    n.presRev = g(0.35); n.pres.connect(n.presRev); n.presRev.connect(n.revIn);
    // combate: todo pasa por una saturación suave y un compresor que lo aprieta
    n.cmb = g(0.75); n.cmb.connect(n.pf);
    n.cmbComp = c.createDynamicsCompressor();
    n.cmbComp.threshold.value = -14; n.cmbComp.knee.value = 6; n.cmbComp.ratio.value = 4; n.cmbComp.attack.value = 0.004; n.cmbComp.release.value = 0.12;
    n.cmbComp.connect(n.cmb);
    n.cmbIn = g(1);
    chain(n.cmbIn, filt('highpass', 45, 0.7), shaper(1.8), filt('peaking', 900, 0.8, 3), filt('lowpass', 8000, 0.5), n.cmbComp);
    n.perc = g(1);
    chain(n.perc, filt('highpass', 38, 0.7), shaper(2.6), filt('peaking', 2500, 0.9, 3), filt('lowpass', 10000, 0.5), n.cmbComp);
    n.cmbRev = g(0.2); n.cmb.connect(n.cmbRev); n.cmbRev.connect(n.revIn);
    // muestra (al mover el control de volumen)
    n.pre = g(0.6); chain(n.pre, filt('peaking', 210, 1, 3), filt('highshelf', 6500, null, -6), n.pf);
    const pr = g(0.6); n.pre.connect(pr); pr.connect(n.revIn);
    N = n;
  }

  function init() {
    const A = G.Audio;
    if (!A || !A.ready || !A.ctx || !A.musicBus) return;
    const bus = A.musicBus();
    if (!bus) return;
    build(A.ctx, bus);
    gen = A.gen || 0;
    ready = true;
    if (!timer) timer = setInterval(tick, 40);
    warmStrings();
  }
  // las cuerdas de todas las notas de las frases, calculadas de antemano (una por pausa, en el menú) para que
  // ninguna se calcule en medio del juego la primera vez que suena (cada una son ~100.000 muestras)
  let warmOn = false;
  function warmStrings() {
    if (warmOn) return;
    warmOn = true;
    const notes = new Set([50, 57, 65]);
    for (const P of PH) for (const nt of P) { notes.add(nt[1]); }
    const list = [...notes].filter((m) => !KS[m]);
    const next = () => {
      const m = list.shift();
      if (m == null) return;
      if (ctx && !KS[m]) { try { ks(m); } catch (e) { /* nada */ } }
      setTimeout(next, 60);
    };
    setTimeout(next, 900);
  }

  // ---------- guitarra: cuerda pulsada (Karplus-Strong), dos cuerdas por orden apenas desafinadas ----------
  const KSR = 24000;
  function ks(m) {
    if (KS[m]) return KS[m];
    const f = mtof(m), sr = KSR;
    const dur = m < 50 ? 4.6 : m < 62 ? 3.8 : 3.0;
    const T60 = m < 50 ? 4.0 : m < 62 ? 3.1 : 2.3;
    const n = Math.floor(sr * dur);
    const b = ctx.createBuffer(1, n, sr), out = b.getChannelData(0);
    const y = new Float32Array(n);
    for (let s = 0; s < 2; s++) {
      const fs = f * (s ? 1.0026 : 0.9994);
      const P = sr / fs, sm = s ? 0.4 : 0.46;     // filtro del lazo: menos = más brillo
      const D = P - sm;
      const gl = Math.pow(0.001, 1 / (fs * T60));
      const L0 = Math.ceil(P);
      const ex = new Float32Array(L0); let lp = 0;
      const soft = s ? 0.5 : 0.62;
      for (let i = 0; i < L0; i++) { lp += (Math.random() * 2 - 1 - lp) * soft; ex[i] = lp; }
      const pp = Math.max(1, Math.round(L0 * (s ? 0.13 : 0.19)));   // dónde se pulsa la cuerda
      y.fill(0);
      for (let i = 0; i < n; i++) {
        const x = i < L0 ? ex[i] - (i >= pp ? ex[i - pp] : 0) : 0;
        const p = i - D;
        let fb = 0;
        if (p >= 1) {
          const k = p | 0, fr = p - k;
          const a = y[k] + (y[k + 1] - y[k]) * fr, c = y[k - 1] + (y[k] - y[k - 1]) * fr;
          fb = gl * ((1 - sm) * a + sm * c);
        }
        y[i] = x + fb;
      }
      const off = s ? Math.round(sr * 0.007) : 0;    // la 2.ª cuerda suena un pelo después
      for (let i = 0; i + off < n; i++) out[i + off] += y[i] * (s ? 0.42 : 0.58);
    }
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]));
    const k = pk > 0 ? 0.85 / pk : 1, fo = Math.floor(sr * 0.3);
    for (let i = 0; i < n; i++) out[i] *= k * (i > n - fo ? (n - i) / fo : 1);
    KS[m] = b;
    return b;
  }
  // roce del dedo en la cuerda (antes de un deslizamiento)
  function squeak(t, v, dest) {
    const s = noise('white', t, 0.2), f = filt('bandpass', 1300, 7);
    f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.12);
    chain(s, f, eg(t, 0.03, v * 0.05, 0.1), dest);
  }
  function harm(t, m, v, dest) {
    const a = eg(t, 0.004, v * 0.2, 3.4);
    const o = osc('sine', mtof(m), t, 3.6), o2 = osc('sine', mtof(m) * 2.003, t, 3.6), g2 = g(0.12);
    o.connect(a); chain(o2, g2, a); a.connect(dest || N.gtrIn);
  }
  // fl: { sl: semitonos desde abajo (deslizamiento), vib: vibrato, h: armónico encima, p: paneo }
  function pluck(t, m, v, fl, dest) {
    fl = fl || {}; dest = dest || N.gtrIn;
    const b = ks(m), s = ctx.createBufferSource(); s.buffer = b;
    if (fl.sl) {
      s.playbackRate.setValueAtTime(Math.pow(2, -fl.sl / 12), t);
      s.playbackRate.setTargetAtTime(1, t + 0.03, 0.04);
      squeak(t - 0.02, v, dest);
    } else if (fl.vib) {
      const lo = ctx.createOscillator(); lo.frequency.value = R(4.2, 5.2);
      const lg = g(0); lg.gain.setValueAtTime(0, t + 0.5); lg.gain.linearRampToValueAtTime(0.0045, t + 1.3);
      chain(lo, lg, s.playbackRate); lo.start(t); lo.stop(t + b.duration);
    }
    const lp = filt('lowpass', 1500 + v * 4200, 0.5);
    const a = g(v);
    const p = pan(fl.p != null ? fl.p : Math.max(-0.45, Math.min(0.45, (m - 58) / 30)) + R(-0.08, 0.08));
    chain(s, lp, a, p, dest);
    s.start(t); s.stop(t + b.duration);
    if (fl.h) harm(t, m + 12, v * 0.7, dest);
  }
  // colchón grave (como un fuelle lejano): fundamental y quinta, con el filtro que respira
  function pad(t, notes, lvl, att, dest) {
    const out = g(0), lp = filt('lowpass', 420, 0.7), sc = g(0.5 / notes.length);
    const os = [];
    for (const m of notes) for (const c of [-5, 6]) { const o = osc('triangle', mtof(m) * Math.pow(2, c / 1200), t); o.connect(lp); os.push(o); }
    const lfo = osc('sine', R(0.05, 0.09), t), lg = g(150); chain(lfo, lg, lp.frequency); os.push(lfo);
    chain(lp, sc, out, dest || N.gtr);
    out.gain.setValueAtTime(0, t); out.gain.setTargetAtTime(lvl, t, att / 3);
    return { stop(t1, rel) { fade(out.gain, 0, t1, rel / 4); for (const o of os) o.stop(t1 + rel * 1.6); } };
  }

  // frases propias (tiempo en pulsos, nota MIDI, fuerza, adornos). Re menor con segundas suspendidas.
  const PH = [
    [[0, 50, 0.8], [0.5, 57, 0.5], [1, 64, 0.6], [1.5, 65, 0.7, { sl: 2, vib: 1 }], [3, 64, 0.5], [3.5, 62, 0.45], [5, 57, 0.4, { vib: 1 }]],
    [[0, 53, 0.7], [0.5, 60, 0.5], [1, 67, 0.55], [2, 69, 0.65, { sl: 2 }], [2.75, 67, 0.4], [3.5, 65, 0.5], [4.5, 64, 0.45], [6, 62, 0.35, { vib: 1 }]],
    [[0, 50, 0.7], [0, 57, 0.45], [1, 62, 0.55], [1.5, 64, 0.5], [2.5, 60, 0.5], [3, 57, 0.45], [4, 55, 0.5, { sl: 2 }], [5.5, 57, 0.4, { vib: 1 }]],
    [[0, 69, 0.5], [0.5, 72, 0.45], [1, 74, 0.5, { sl: 2 }], [2, 72, 0.4], [2.5, 69, 0.45], [3.5, 67, 0.4], [4, 65, 0.45], [5, 64, 0.35], [6.5, 62, 0.3, { h: 1 }]],
    [[0, 45, 0.7], [1, 52, 0.5], [1.5, 57, 0.45], [2, 60, 0.5], [3, 58, 0.5, { vib: 1 }], [4, 57, 0.45], [6, 50, 0.4]],
    [[0, 62, 0.6], [0.5, 57, 0.4], [1.5, 62, 0.55], [2, 58, 0.45, { sl: 1 }], [3, 57, 0.4], [4.5, 50, 0.5], [4.5, 57, 0.35, { vib: 1 }]],
    [[0, 57, 0.55], [0.75, 64, 0.5], [1.5, 65, 0.5], [2.25, 64, 0.45], [3, 60, 0.5, { sl: 2, vib: 1 }], [4.5, 62, 0.45], [5, 57, 0.35], [6.5, 50, 0.4, { h: 1 }]]
  ];
  const DARK = [2, 4, 5];           // las más graves, para sitios oscuros como la estación
  function phrase(t0, P, beat, k) {
    let end = t0;
    for (const nt of P) {
      const at = t0 + nt[0] * beat + R(-0.02, 0.035);
      const m = nt[1], v = nt[2] * k * R(0.88, 1.05), fl = nt[3];
      Q.push({ t: at, f: (tt) => pluck(tt, m, v, fl) });
      end = Math.max(end, at);
    }
    return end;
  }
  function runQ(now) {
    for (let i = Q.length - 1; i >= 0; i--) if (Q[i].t < now + 0.3) { const e = Q.splice(i, 1)[0]; e.f(Math.max(e.t, now + 0.01)); }
  }
  function nextPh(set) {
    let i, n = 0;
    do { i = set ? pick(set) : Math.floor(Math.random() * PH.length); n++; } while (i === S.lastPh && n < 8);
    S.lastPh = i;
    return PH[i];
  }

  // ---------- menú ----------
  function menuTick(now) {
    if (now < S.menuNext) return;
    const end = phrase(now + 0.1, nextPh(), R(0.82, 0.96), 0.78);
    if (Math.random() < 0.35) { const m = pick([74, 76, 81, 86]), at = end + R(0.9, 1.7); Q.push({ t: at, f: (tt) => harm(tt, m, 0.5) }); }
    S.menuNext = end + R(3.5, 7.5);
  }

  // ---------- exploración: una frase que aparece y se va ----------
  function cueStart(now) {
    const c = S.cue = { end: 0 };
    fade(N.gtr.gain, 0.72, now, 0.5);
    const root = S.dark ? 45 : 50;
    c.pad = pad(now, [root - 12, root - 5], 0.06, 6);
    let t = now + R(2.5, 4.5);
    const n = Math.random() < 0.55 ? 2 : 3;
    for (let k = 0; k < n; k++) t = phrase(t, nextPh(S.dark ? DARK : null), R(0.84, 0.97), 0.72 - k * 0.07) + R(2.8, 5.5);
    c.end = t;
    c.pad.stop(t - 3, 7);
  }
  function cueAbort(now) {
    Q.length = 0;
    fade(N.gtr.gain, 0, now, 0.3);
    if (S.cue && S.cue.pad) S.cue.pad.stop(now, 1.4);
    S.cue = null;
  }

  // ---------- tensión ----------
  function tenOn(t) {
    if (S.tenNodes) return;
    const os = [], lp = filt('lowpass', 900, 0.6), mix = g(1);
    for (const [m, c, v] of [[38, 0, 0.45], [38, 21, 0.45], [63, 0, 0.05]]) {
      const o = osc('triangle', mtof(m) * Math.pow(2, c / 1200), t), og = g(v); chain(o, og, mix); os.push(o);
    }
    const nz = noise('pink', t), nb = filt('bandpass', 340, 3), ng = g(0.32);
    const lfo = osc('sine', 0.11, t), lg = g(0.22); chain(lfo, lg, ng.gain);
    chain(nz, nb, ng, mix); os.push(nz, lfo);
    chain(mix, lp, N.ten);
    S.tenNodes = os;
  }
  function tenOff(t) {
    if (!S.tenNodes) return;
    for (const o of S.tenNodes) o.stop(t + 3);
    S.tenNodes = null;
  }
  // vidrio frotado lejano (dos tonos que baten)
  function glass(t, v) {
    const m = pick([85, 87, 86]), a = g(0), p = pan(R(-0.7, 0.7));
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.22 * v, t + 1.4); a.gain.linearRampToValueAtTime(0, t + 5);
    const o = osc('sine', mtof(m), t, 5.2), o2 = osc('sine', mtof(m) + 1.7, t, 5.2);
    o.connect(a); o2.connect(a); chain(a, p, N.ten);
  }

  // ---------- presencia ----------
  // un drone hondo que respira (dos senos graves que baten, ruido marrón que sube y baja como un aliento)
  function presOn(t) {
    if (S.presNodes) return;
    const os = [], mix = g(1), lp = filt('lowpass', 300, 0.8);
    for (const [f, v] of [[32.7, 0.45], [33.9, 0.4], [49.0, 0.16], [65.4, 0.06]]) { const o = osc('sine', f, t), og = g(v); chain(o, og, mix); os.push(o); }
    // (lo que sí se oye en el altavoz del móvil: el mismo acorde una y dos octavas arriba, muy bajito)
    for (const [f, v] of [[98.0, 0.07], [101.6, 0.06], [130.8, 0.025]]) { const o = osc('triangle', f, t), og = g(v); chain(o, og, mix); os.push(o); }
    const nz = noise('brown', t), nl = filt('lowpass', 260, 0.9), ng = g(0);
    const lfo = osc('sine', 0.075, t), lg = g(0.32); chain(lfo, lg, ng.gain); os.push(nz, lfo);
    chain(nz, nl, ng, mix);
    // un roce alto y casi inaudible (como algo que se arrastra lejos)
    const hz = noise('pink', t), hb = filt('bandpass', 2400, 6), hg = g(0);
    const l2 = osc('sine', 0.031, t), l2g = g(0.035); chain(l2, l2g, hg.gain); os.push(hz, l2);
    chain(hz, hb, hg, mix);
    chain(mix, lp, N.pres);
    S.presNodes = os;
  }
  function presOff(t) {
    if (!S.presNodes) return;
    for (const o of S.presNodes) o.stop(t + 3);
    S.presNodes = null;
  }
  // latido lejano (lub-dub), muy grave
  function beat(t, v) {
    for (const [dt, k] of [[0, 1], [0.2, 0.62]]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(58, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.16);
      chain(o, eg(t + dt, 0.012, v * k * 0.5, 0.22), N.pres); o.start(t + dt); o.stop(t + dt + 0.3);
      const b = ctx.createOscillator(); b.type = 'triangle';          // el cuerpo del golpe (para el móvil)
      b.frequency.setValueAtTime(130, t + dt); b.frequency.exponentialRampToValueAtTime(85, t + dt + 0.1);
      chain(b, filt('lowpass', 400, 0.7), eg(t + dt, 0.008, v * k * 0.12, 0.12), N.pres); b.start(t + dt); b.stop(t + dt + 0.2);
    }
  }
  // un golpe hondo que sacude (con los golpes del hongomorfo tras la pared)
  function thumpHit(t, v) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    chain(o, eg(t, 0.004, v * 0.6, 1.1), N.pres); o.start(t); o.stop(t + 1.3);
    chain(noise('brown', t, 1.2), filt('lowpass', 140, 0.8), eg(t, 0.01, v * 0.5, 0.9), N.pres);
  }

  // ---------- combate ----------
  function boom(t, v, f0) {
    f0 = f0 || 62;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0 * 1.9, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.06); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.7);
    chain(o, eg(t, 0.002, v * 0.55, 0.7), N.perc); o.start(t); o.stop(t + 0.8);
    // el parche: golpe medio que se oye también en el altavoz del móvil
    const k = ctx.createOscillator(); k.type = 'triangle';
    k.frequency.setValueAtTime(260, t); k.frequency.exponentialRampToValueAtTime(130, t + 0.1);
    chain(k, eg(t, 0.001, v * 0.45, 0.14), N.perc); k.start(t); k.stop(t + 0.2);
    chain(noise('brown', t, 0.5), filt('lowpass', 300, 0.7), eg(t, 0.002, v * 0.45, 0.3), N.perc);
    chain(noise('white', t, 0.08), filt('bandpass', 1700, 0.8), eg(t, 0.0008, v * 0.55, 0.05), N.perc);
  }
  function tom(t, v, k) {
    k = k || 1;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(155 * k, t); o.frequency.exponentialRampToValueAtTime(82 * k, t + 0.3);
    chain(o, eg(t, 0.002, v * 0.8, 0.42), pan(R(-0.3, 0.3)), N.perc); o.start(t); o.stop(t + 0.5);
    chain(noise('white', t, 0.2), filt('bandpass', 420 * k, 1.2), eg(t, 0.001, v * 0.5, 0.14), N.perc);
  }
  // golpe metálico (chapa, caño): parciales que no son armónicos
  function metal(t, v) {
    const f0 = R(370, 430), bp = filt('bandpass', 2200, 0.8), a = eg(t, 0.001, v * 0.24, R(0.5, 0.9));
    for (const k of [1, 1.483, 1.932, 2.546, 2.98]) osc('square', f0 * k, t, 1).connect(bp);
    chain(bp, a, pan(R(-0.5, 0.5)), N.perc);
    chain(noise('white', t, 0.2), filt('highpass', 2500), eg(t, 0.0008, v * 0.4, 0.12), N.perc);
  }
  function hat(t, v) {
    chain(noise('white', t, 0.08), filt('highpass', 4500, 0.7), eg(t, 0.0005, v * 0.7, R(0.025, 0.05)), pan(R(-0.4, 0.4)), N.perc);
  }
  function snap(t, v) {
    for (const dt of [0, 0.012]) chain(noise('white', t + dt, 0.12), filt('bandpass', 1100, 1.4), eg(t + dt, 0.0008, v * 0.5, 0.09), N.perc);
  }
  // bajo frotado: cuerda grave con el arco apretado (largo) o golpeada (corto)
  function bassNote(t, m, v, d) {
    const f = mtof(m), lp = filt('lowpass', 900, 4), a = g(0);
    lp.frequency.setValueAtTime(d > 1 ? 700 : 1700, t); lp.frequency.exponentialRampToValueAtTime(d > 1 ? 380 : 260, t + Math.max(0.12, d * 0.8));
    const at = d > 1 ? 0.35 : 0.008;
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(v * 0.5, t + at); a.gain.exponentialRampToValueAtTime(1e-4, t + at + d); a.gain.setValueAtTime(0, t + at + d + 0.01);
    const o = osc('sawtooth', f, t, at + d + 0.05), o2 = osc('square', f * 0.5, t, at + d + 0.05), g2 = g(0.15);
    o.connect(lp); chain(o2, g2, lp); chain(lp, a, N.cmbIn);
    if (d > 1) {   // el roce del arco
      const nb = filt('bandpass', f * 5, 4), ng = g(0), lo = osc('sine', R(6, 8), t, d + 0.5), lg = g(v * 0.12);
      ng.gain.setValueAtTime(v * 0.14, t); chain(lo, lg, ng.gain);
      chain(noise('pink', t, d + 0.4), nb, ng, a);
    }
  }
  // chelo raspado (sul ponticello): sierra desafinada + resina, con la presión del arco temblando
  function scrape(t, m, d, v) {
    const f = mtof(m), mix = g(0.5);
    const o1 = osc('sawtooth', f, t, d + 0.1), o2 = osc('sawtooth', f * 1.006, t, d + 0.1);
    for (const o of [o1, o2]) { o.frequency.setValueAtTime(o.frequency.value, t + d * 0.6); o.frequency.linearRampToValueAtTime(o.frequency.value * 0.985, t + d); o.connect(mix); }
    const nb = filt('bandpass', f * 2.5, 1.6), ng = g(0.9); chain(noise('white', t, d + 0.1), nb, ng, mix);
    const jit = g(1), cv = new Float32Array(24); for (let i = 0; i < cv.length; i++) cv[i] = R(0.35, 1);
    jit.gain.setValueCurveAtTime(cv, t, d);
    const a = g(0);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(v * 0.42, t + d * 0.35); a.gain.linearRampToValueAtTime(v * 0.3, t + d * 0.75); a.gain.linearRampToValueAtTime(0, t + d);
    chain(mix, filt('highpass', 220), filt('peaking', 1900, 1, 7), shaper(3.5), jit, a, pan(R(-0.5, 0.5)), N.cmbIn);
  }
  // drone distorsionado de fondo (sierras graves + un silbido eléctrico que se mueve)
  function cDrone(t) {
    const mix = g(0.22), lp = filt('lowpass', 320, 5), out = g(0), os = [];
    for (const [m, ty, c, v] of [[26, 'sawtooth', 0, 0.35], [38, 'sawtooth', 7, 1], [45, 'square', -6, 0.7], [51, 'sawtooth', 3, 0.3]]) {
      const o = osc(ty, mtof(m) * Math.pow(2, c / 1200), t), og = g(v); chain(o, og, mix); os.push(o);
    }
    const lfo = osc('sine', 0.13, t), lg = g(170); chain(lfo, lg, lp.frequency); os.push(lfo);
    chain(mix, lp, shaper(5), filt('highpass', 60), out, N.cmbComp);
    const nz = noise('pink', t), nb = filt('bandpass', 900, 9), ng = g(1.1);
    const l2 = osc('sine', 0.06, t), l2g = g(450); chain(l2, l2g, nb.frequency);
    chain(nz, nb, ng, out); os.push(nz, l2);
    out.gain.setValueAtTime(0, t); out.gain.setTargetAtTime(0.12, t, 0.4);
    return {
      level(t1, lv) { fade(lp.frequency, 300 + lv * 320, t1, 1); fade(out.gain, 0.04 + lv * 0.06, t1, 0.8); },
      stop(t1, rel) { fade(out.gain, 0, t1, rel / 4); for (const o of os) o.stop(t1 + rel * 1.6); }
    };
  }
  // guitarra eléctrica sostenida con acople (en el peor momento)
  function gDrone(t) {
    const mix = g(0.3), out = g(0), os = [];
    for (const [m, c] of [[38, -4], [45, 5], [50, 9]]) { const o = osc('sawtooth', mtof(m) * Math.pow(2, c / 1200), t); o.connect(mix); os.push(o); }
    chain(mix, shaper(14), filt('lowpass', 1700, 0.8), filt('highpass', 100), out, N.cmbComp);
    const fb = osc('sine', mtof(74), t), vb = osc('sine', 5, t), vg = g(4), fg = g(0);
    chain(vb, vg, fb.frequency); chain(fb, fg, out); os.push(fb, vb);
    fg.gain.setValueAtTime(0, t); fg.gain.setTargetAtTime(0.18, t + 2.5, 1.5);
    out.gain.setValueAtTime(0, t); out.gain.setTargetAtTime(0.16, t, 1.1);
    return { stop(t1, rel) { fade(out.gain, 0, t1, rel / 4); for (const o of os) o.stop(t1 + rel * 1.6); } };
  }

  const BPM = 100, STEP = 60 / BPM / 4;
  const BOOM = [[0, 10], [0, 6, 10], [0, 3, 6, 10, 12, 14]];
  const TOM = [[], [3, 13, 14], [2, 8, 9, 15]];
  const BASS = [[], [0, 3, 6, 10, 13], [0, 3, 6, 9, 12, 14]];
  const ACC = { 0: 1, 3: 1, 6: 1, 9: 1, 12: 1 };
  function cmbStart(now) {
    const t = now + 0.04;
    if (CB.done && CB.sr === ctx.sampleRate) { S.cmb = cbStart(t); return S.cmb; }
    const c = S.cmb = { lv: 1, drone: cDrone(t), gd: null };
    S.step = 0; S.nextT = t;
    cmbIntro(t);
    return c;
  }
  // entrada: golpe, chapa y dos chelos que rechinan juntos
  function cmbIntro(t) {
    boom(t, 1.25, 50); metal(t, 0.7);
    scrape(t, 50, 2.4, 0.75); scrape(t + 0.02, 51, 2.4, 0.6);
    const s = noise('white', t, 0.6), f = filt('bandpass', 2600, 2);
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    chain(s, f, eg(t, 0.005, 0.3, 0.5), N.perc);
  }
  function cmbEnd(now, quiet) {
    const c = S.cmb; if (!c) return;
    S.cmb = null;
    if (c.baked) { cbEnd(c, now, quiet); return; }
    c.drone.stop(now, quiet ? 1.2 : 3.6);
    if (c.gd) c.gd.stop(now, quiet ? 1 : 2.4);
    if (!quiet) cmbOutro(now);
  }
  // cierre: un golpe hondo y el bajo que se hunde
  function cmbOutro(now) {
    boom(now + 0.05, 0.8, 44);
    const o = osc('sawtooth', mtof(38), now, 4.2), lp = filt('lowpass', 320, 2), a = g(0);
    o.frequency.setValueAtTime(mtof(38), now + 0.3); o.frequency.exponentialRampToValueAtTime(mtof(29), now + 3.8);
    a.gain.setValueAtTime(0, now); a.gain.linearRampToValueAtTime(0.32, now + 0.2); a.gain.linearRampToValueAtTime(0, now + 4);
    chain(o, lp, a, N.cmbIn);
  }
  function cmbStep(i, t) {
    const c = S.cmb, s = i % 16, bar = Math.floor(i / 16);
    if (s === 0) {
      c.lv = S.lvWant;
      c.drone.level(t, c.lv);
      if (c.lv >= 3 && !c.gd) c.gd = gDrone(t);
      else if (c.lv < 3 && c.gd) { c.gd.stop(t, 1.6); c.gd = null; }
    }
    const lv = c.lv, j = () => t + R(-0.004, 0.006), rnd = Math.random;
    if (BOOM[lv - 1].indexOf(s) >= 0 && !(lv === 1 && s === 10 && bar % 2 === 1)) boom(j(), (s === 0 ? 1 : 0.7) * R(0.85, 1));
    if (TOM[lv - 1].indexOf(s) >= 0) tom(j(), 0.6 * R(0.8, 1.1), s >= 13 ? 1.15 : 1);
    if (lv >= 2 && bar % 4 === 3 && s >= 12) tom(j(), 0.45 + 0.1 * (s - 12), 1 + 0.08 * (s - 12));   // redoble al final de cada frase
    if (lv === 1 ? (s === 4 || s === 12) : lv === 2 ? s % 2 === 0 : true) hat(j(), lv === 1 ? 0.14 : ACC[s] ? 0.36 : R(0.1, 0.2));
    if (lv === 1) { if (s === 0 && bar % 2 === 0) bassNote(t, 38, 0.5, 4.4); }
    else if (BASS[lv - 1].indexOf(s) >= 0) bassNote(j(), bar % 4 === 3 && s >= 8 ? 39 : (lv === 3 && s === 12 && rnd() < 0.5 ? 41 : 38), ACC[s] ? 0.85 : 0.65, 0.28);
    if (s === 0) {
      if (lv === 1 && bar % 2 === 0) scrape(t, pick([50, 51, 45, 46]), 3.6, 0.5);
      else if (lv === 2) scrape(t, bar % 2 ? pick([51, 46]) : pick([50, 45]), 2.3, 0.55);
      else if (lv === 3) { const m = pick([50, 45, 57]); scrape(t, m, 2.3, 0.6); scrape(t + 0.03, m + 1, 2.3, 0.5); }
    }
    if (lv >= 2 && s === 8 && bar % 2 === 1) scrape(t, pick([62, 63]), 0.45, 0.5);
    if (lv === 3 && ((s === 4 && bar % 2 === 1) || (s === 12 && rnd() < 0.5))) metal(j(), 0.55);
    if ((lv === 3 && s === 8 && rnd() < 0.35) || (lv === 2 && s === 12 && rnd() < 0.2)) snap(j(), 0.5);
  }

  // ---------- combate grabado (celular) ----------
  // En el celular la música de combate no se arma nota por nota en plena pelea (eran decenas de osciladores,
  // ruidos y saturaciones por segundo compitiendo con el juego): se graba en el menú, en segundo plano, un bucle
  // de 8 compases por cada nivel de intensidad, más la entrada y el cierre. En la pelea suenan los tres bucles
  // a la vez, sincronizados, y subir o bajar de nivel es solo cambiar cuál se oye (al empezar el compás).
  const BAR = 16 * STEP, LOOP_BARS = 8, LOOP = LOOP_BARS * BAR, XF = 1.5;
  const CB = { lv: [null, null, null], intro: null, outro: null, done: false, sr: 0, ms: 0 };
  // azar con semilla: cada paso del bucle sale igual en cada vuelta (así el bucle empalma sin costura)
  function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // arma una escena en un contexto fuera de línea (con todo cambiado un momento) y la devuelve lista para dibujar;
  // lo de este módulo vuelve a su lugar ANTES de esperar el dibujo (la música en vivo sigue mientras tanto)
  // (los bucles, a 32 kHz: un tercio menos de trabajo y de memoria; por el altavoz del celular no cambia nada)
  const LOOP_SR = 32000;
  function offline(sec, fill, sr) {
    sr = sr || ctx.sampleRate;
    const oc = new OfflineAudioContext(1, Math.ceil(sr * sec), sr);
    const sv = { ctx, N, NB, S }, rnd = Math.random;
    try {
      build(oc, oc.destination); S = fresh();
      N.out.gain.value = 1;
      fill();
    } finally { Math.random = rnd; ctx = sv.ctx; N = sv.N; NB = sv.NB; S = sv.S; }
    return oc.startRendering();
  }
  function bakeLoop(lv) {
    // dos compases antes (para que las colas, el zumbido, el compresor y el eco ya estén andando) + el bucle + el cruce
    const t0 = 2 * BAR + 0.05, n = LOOP_BARS * 16;
    return offline(t0 + LOOP + XF + 0.05, () => {
      Math.random = seeded(lv * 977 + 5);
      S.lvWant = lv; S.cmb = { lv, drone: cDrone(0.02), gd: null };
      for (let i = -32; t0 + i * STEP < t0 + LOOP + XF; i++) {
        const k = ((i % n) + n) % n;
        Math.random = seeded(k * 7919 + lv * 104729 + 1);
        cmbStep(k, t0 + i * STEP);
      }
    }, LOOP_SR).then((r) => {
      const x = r.getChannelData(0), sr = r.sampleRate, a = Math.round(t0 * sr), L = Math.round(LOOP * sr), X = Math.round(XF * sr);
      const b = ctx.createBuffer(1, L, sr), y = b.getChannelData(0);
      y.set(x.subarray(a, a + L));
      // los golpes son idénticos en cada vuelta; lo único que no empalma es el zumbido de fondo: se cruza
      for (let i = 0; i < X; i++) { const w = i / X; y[i] = x[a + i] * w + x[a + L + i] * (1 - w); }
      return b;
    });
  }
  function bakeShot(sec, fill) {
    return offline(sec, fill).then((r) => {
      const x = r.getChannelData(0);
      let end = x.length - 1; while (end > 0 && Math.abs(x[end]) < 1e-4) end--;
      const b = ctx.createBuffer(1, end + 1, r.sampleRate); b.copyToChannel(x.subarray(0, end + 1), 0);
      return b;
    });
  }
  // las piezas, de a una (las graba la cola del audio, detrás de las pantallas de carga)
  function bakeJobs() {
    const piece = (k, mk) => () => {
      if (!ready || CB.done || (k === 'intro' ? CB.intro : k === 'outro' ? CB.outro : CB.lv[+k[4] - 1])) return null;
      const t0 = performance.now(), sr = ctx.sampleRate;
      return mk().then((b) => {
        if (!ready || ctx.sampleRate !== sr) return;          // (el audio se rehízo con otra frecuencia)
        if (k === 'intro') CB.intro = b; else if (k === 'outro') CB.outro = b; else CB.lv[+k[4] - 1] = b;
        CB.ms += Math.round(performance.now() - t0);
        if (CB.intro && CB.outro && CB.lv[0] && CB.lv[1] && CB.lv[2]) { CB.sr = sr; CB.done = true; }
      });
    };
    return {
      intro: piece('intro', () => bakeShot(3.5, () => cmbIntro(0.02))),
      outro: piece('outro', () => bakeShot(5, () => cmbOutro(0))),
      loop1: piece('loop1', () => bakeLoop(1)), loop2: piece('loop2', () => bakeLoop(2)), loop3: piece('loop3', () => bakeLoop(3))
    };
  }
  // (pruebas) todo de una vez
  async function bakeCombat() { const J = bakeJobs(); for (const k of ['intro', 'outro', 'loop1', 'loop2', 'loop3']) await J[k](); }
  function cbStart(t) {
    const c = { lv: 1, baked: true, t0: t, src: [], g: [] };
    for (let k = 0; k < 3; k++) {
      const s = ctx.createBufferSource(); s.buffer = CB.lv[k]; s.loop = true;
      const gg = g(0); chain(s, gg, N.pf);
      if (k === 0) gg.gain.setTargetAtTime(1, t, 0.05);
      s.start(t);
      c.src.push(s); c.g.push(gg);
    }
    const s = ctx.createBufferSource(); s.buffer = CB.intro; chain(s, N.pf); s.start(t);
    return c;
  }
  // cambio de nivel: al empezar el compás siguiente (los tres bucles van juntos, el ritmo no se corta)
  function cbLevel(c, now) {
    if (S.lvWant === c.lv) return;
    const tb = c.t0 + Math.ceil((now + 0.06 - c.t0) / BAR) * BAR;
    fade(c.g[c.lv - 1].gain, 0, tb, 0.12);
    fade(c.g[S.lvWant - 1].gain, 1, tb, 0.03);
    c.lv = S.lvWant;
  }
  function cbEnd(c, now, quiet) {
    const rel = quiet ? 1.2 : 3.6;
    for (let k = 0; k < 3; k++) { fade(c.g[k].gain, 0, now, rel / 4); try { c.src[k].stop(now + rel * 1.6); } catch (e) { /* nada */ } }
    if (!quiet) { const s = ctx.createBufferSource(); s.buffer = CB.outro; chain(s, N.pf); s.start(now); }
  }

  // ---------- estados ----------
  function setMode(m, now) {
    const was = S.mode;
    if (was === m) return;
    S.mode = m;
    if (was === 'menu') { if (S.menuPad) S.menuPad.stop(now, 1.6); S.menuPad = null; }
    Q.length = 0;
    if (S.cue) cueAbort(now);
    if (S.cmb) cmbEnd(now, true);
    fade(N.gtr.gain, 0, now, 0.4);
    if (m !== 'game') { tenOff(now); fade(N.ten.gain, 0, now, 0.3); S.tens = 0; S.tenApplied = -1; presOff(now); fade(N.pres.gain, 0, now, 0.3); S.pres = 0; S.presApplied = -1; S.cmbWait = 0; }
    if (m === 'menu') {
      fade(N.gtr.gain, 0.62, now, 0.6);
      S.menuPad = pad(now, [38, 45], 0.045, 7);
      S.menuNext = now + 1.8;
    } else if (m === 'game') {
      tenOn(now); presOn(now);
      S.hold = 0; S.lvWant = 1;
    }
  }
  function newMap() {
    const lay = G.World && G.World.layout;
    S.layout = lay;
    S.dark = lay === 'comisaria';
    S.cueT = lay === 'refugio' ? R(6, 14) : R(25, 60);
  }

  // persecución de verdad (combate) / búsqueda (tensión) / acecho sin dejarse ver (presencia)
  const ZC = { chase: 1, attack: 1, combo: 1, runatk: 1, grapple: 1, recover: 1, bang: 1, tcharge: 1, tdash: 1, troar: 1, tthrow: 1, bslam: 1 };
  const ZT = { sus: 1, alert: 1, investigate: 1 };
  const ZP = { stalk: 1, hide: 1, watch: 1, ambush: 1 };
  // el hongomorfo: dormido = silencio; cazando o comiendo = presencia; encima tuyo = combate
  const HGC = { chase: 1, hburst: 1, hgrab: 1, hrip: 1, hkill: 1, troar: 1, recover: 1, attack: 1, combo: 1, runatk: 1, bslam: 1 };
  const HC = { fight: 1, melee: 1, stab: 1 };
  const HT = { check: 1 };
  function scan(dt, p, now) {
    let c = 0, t = 0, pr = 0, hush = 0, boss = false, grab = false;
    const list = (G.Population && G.Population.list) || [];
    for (const z of list) {
      if (!z || !z.alive || !z.pos) continue;
      const d = Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z);
      if (d > 40) continue;
      const st = z.state, near = Math.max(0, 1 - d / 30);
      if (z.phantom) { if (d < 22) pr += 0.35 * near; continue; }
      if (z.human) { if (HC[st]) c += d < 15 ? 1.4 : 1; else if (HT[st] && d < 30) t += 1; continue; }
      if (z.hongo) {
        if (st === 'hdorm') { if (d < 26) hush = 1; }
        else if (HGC[st]) { c += 4; boss = true; }
        else pr += 1.6 * Math.max(0.35, near);
        continue;
      }
      if (ZC[st]) { c += (z.temb ? 2.5 : 1) * (d < 8 ? 1.5 : 1); if (st === 'grapple' && d < 3) grab = true; }
      else if (ZP[st] && d < 30) pr += near * (z.stalker ? 1.2 : 0.9);
      else if (ZT[st] && d < 24) t += 1;
      else if (z.blind && d < 14) { hush = Math.max(hush, 0.7); if (d < 9) t += 0.3; }
      else if (z.temb && d < 18) hush = Math.max(hush, 0.6);
    }
    // lo que pide desde fuera (la estación: lo que se oye tras las paredes)
    if (S.extT > 0) { S.extT -= dt; pr = Math.max(pr, S.ext); if (S.extT <= 0) S.ext = 0; }
    S.lastC = c;
    if (c > 0) S.hold = 7; else S.hold -= dt;
    let lv = c >= 6 || boss || grab ? 3 : c >= 2.5 ? 2 : 1;
    if (c > 0 && p.health < 35 && lv < 3) lv++;
    if (lv >= S.lvWant) { S.lvWant = lv; S.downT = 0; } else { S.downT += dt; if (S.downT > 4) { S.lvWant = lv; S.downT = 0; } }
    const want = c > 0 || S.hold > 0;
    if (want && !S.cmb) {
      if (S.cue) cueAbort(now);
      // si algo te acechaba y salta: un segundo de nada antes del golpe
      if (S.cmbWait <= 0) {
        if (S.pres > 0.3 || S.tens > 0.5) { S.cmbWait = now + 1.1; fade(N.pres.gain, 0, now, 0.05); fade(N.ten.gain, 0, now, 0.05); S.presApplied = S.tenApplied = 0; }
        else S.cmbWait = now;
      }
      if (now >= S.cmbWait) { S.cmbWait = 0; cmbStart(now); }
    } else if (!want) {
      S.cmbWait = 0;
      if (S.cmb) { cmbEnd(now); S.cueT = Math.max(S.cueT, R(50, 90)); }
    }
    const waiting = S.cmbWait > 0;
    // presencia (nunca encima del combate)
    const pw = S.cmb || waiting ? 0 : Math.min(1, pr * 0.6);
    S.pres += (pw - S.pres) * Math.min(1, dt * (pw > S.pres ? 0.35 : 0.25));
    const pv = waiting ? 0 : S.pres * 0.9;
    if (Math.abs(pv - S.presApplied) > 0.01) { fade(N.pres.gain, pv, now, 0.4); S.presApplied = pv; }
    if (!S.cmb && !waiting && S.pres > 0.12 && now > S.beatT) { beat(now + 0.03, Math.min(1, 0.35 + S.pres)); S.beatT = now + 60 / (48 + S.pres * 36); }
    // silencio: lo que duerme cerca apaga lo demás
    S.hush += (hush - S.hush) * Math.min(1, dt * (hush > S.hush ? 1.5 : 0.2));
    // tensión (nunca encima del combate ni del acecho)
    const tt = S.cmb || waiting ? 0 : Math.min(1, t * 0.35) * (1 - S.pres * 0.8) * (1 - S.hush * 0.85);
    S.tens += (tt - S.tens) * Math.min(1, dt * (tt > S.tens ? 0.6 : 0.3));
    const tv = waiting ? 0 : S.tens * 0.5;
    if (Math.abs(tv - S.tenApplied) > 0.01) { fade(N.ten.gain, tv, now, 0.25); S.tenApplied = tv; }
    // exploración (nunca con algo cerca: ni acechando ni dormido)
    const calm = !S.cmb && !waiting && S.tens < 0.15 && S.pres < 0.08 && S.hush < 0.2;
    if (S.cue) { if (!calm && (S.cmb || waiting || S.tens > 0.4 || S.pres > 0.15 || S.hush > 0.3)) cueAbort(now); else if (now > S.cue.end + 4) { S.cue = null; S.cueT = R(110, 230); } }
    else if (calm) { S.cueT -= dt; if (S.cueT <= 0) cueStart(now); }
  }

  function advance(now) {
    runQ(now);
    if (S.mode === 'menu') menuTick(now);
    if (S.cmb && S.cmb.baked) cbLevel(S.cmb, now);
    else if (S.cmb) {
      if (S.nextT < now - 0.1) S.nextT = now + 0.03;     // la pestaña se durmió: no recuperar golpes viejos
      while (S.nextT < now + 0.2) { cmbStep(S.step++, S.nextT); S.nextT += STEP; }
    }
    if (S.mode === 'game' && !S.cmb && S.tens > 0.35 && now > S.pingT) { glass(now + 0.05, S.tens); S.pingT = now + R(6, 11); }
  }
  function tick() {
    if (!ready || ctx.state !== 'running') return;
    advance(ctx.currentTime);
  }

  // cada fotograma, desde el bucle del juego
  function update(dt, state, player) {
    // el audio se rehízo (otro contexto): rearmar la mezcla y empezar de nuevo el estado
    if (ready && G.Audio && (G.Audio.gen || 0) !== gen) { ready = false; N = null; S = fresh(); Q.length = 0; }
    if (!ready) { init(); if (!ready) return; }
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    let want = state === 'menu' ? 'menu' : (state === 'playing' || state === 'frozen' || state === 'paused') ? 'game' : 'silent';
    if (want === 'game' && (!player || player.dead)) want = 'silent';
    if (want === 'game' && G.World && G.World.layout !== S.layout) { if (S.mode === 'game') setMode('silent', now); newMap(); }
    setMode(want, now);
    const paused = state === 'paused';
    const o = want === 'silent' ? 0 : paused ? 0.55 : 1;
    if (o !== S.out) { fade(N.out.gain, o, now, o ? 0.5 : 0.5); S.out = o; }
    if (paused !== S.paused) { fade(N.pf.frequency, paused ? 700 : 20000, now, 0.2); S.paused = paused; }
    const rdt = Math.max(0, Math.min(0.5, now - (S.lastNow || now))); S.lastNow = now;    // tiempo real (no depende de los fps)
    if (S.mode === 'game' && !paused) scan(rdt, player, now);
    advance(now);
  }

  function preview() {
    if (G.Audio) G.Audio.unlock();
    if (!ready) init();
    if (!ready) return;
    const t = ctx.currentTime + 0.05;
    pluck(t, 50, 0.7, null, N.pre); pluck(t + 0.45, 57, 0.5, null, N.pre); pluck(t + 0.9, 65, 0.6, { sl: 2 }, N.pre);
  }

  // el vigilante del audio pregunta cada medio segundo: ¿algún volumen de la música quedó donde no debía?
  // (un fundido que se cortó a medias deja la música muda toda la pelea)
  let chkBad = 0;
  function check() {
    if (!ready || !N || ctx.state !== 'running' || S.out < 0) return 0;
    const now = ctx.currentTime, p = N.out.gain, pf = N.pf.frequency;
    let bad = !isFinite(p.value) || Math.abs(p.value - S.out) > 0.12;
    if (!S.paused && (!isFinite(pf.value) || pf.value < 15000)) bad = true;
    if (!isFinite(N.cmb.gain.value) || Math.abs(N.cmb.gain.value - 0.75) > 0.05) bad = true;
    chkBad = bad ? chkBad + 1 : 0;
    if (chkBad < 5) return 0;      // (los fundidos normales duran menos de 2,5 s)
    chkBad = 0;
    fade(p, S.out, now, 0.3);
    if (!S.paused) fade(pf, 20000, now, 0.2);
    N.cmb.gain.cancelScheduledValues(now); N.cmb.gain.setValueAtTime(0.75, now);
    return 1;
  }

  // pruebas: dibuja una escena sin sonar (menu | cue | tension | combat) y la devuelve
  async function render(kind, sec) {
    const sr = 44100, oc = new OfflineAudioContext(2, Math.floor(sr * sec), sr);
    const sv = { ctx, N, NB, S, ready, q: Q.splice(0) };
    try {
      build(oc, oc.destination); S = fresh();
      fade(N.out.gain, 1, 0, 0.05); S.out = 1;
      setMode(kind === 'menu' ? 'menu' : 'game', 0);
      if (kind === 'cue') cueStart(0.2);
      for (let t = 0; t < sec; t += 0.04) {
        if (kind === 'tension') { S.tens = Math.min(1, t / 4); fade(N.ten.gain, S.tens * 0.5, t, 0.25); }
        if (kind === 'presence') {
          S.pres = Math.min(1, t / 5); fade(N.pres.gain, S.pres * 0.9, t, 0.4);
          if (t >= S.beatT) { beat(t + 0.03, Math.min(1, 0.35 + S.pres)); S.beatT = t + 60 / (48 + S.pres * 36); }
          if (Math.abs(t - sec * 0.6) < 0.02) thumpHit(t, 1);
        }
        if (kind === 'combat') {
          if (t > 0.3 && !S.cmb && t < 1) cmbStart(t);
          S.lvWant = t < 8 ? 1 : t < 16 ? 2 : 3;
          if (S.cmb && t > sec - 6) cmbEnd(t);
        }
        advance(t);
      }
      return await oc.startRendering();
    } finally {
      ctx = sv.ctx; N = sv.N; NB = sv.NB; S = sv.S; ready = sv.ready; Q.length = 0; Q.push(...sv.q);
    }
  }

  // desde fuera: una presencia mínima durante «sec» segundos (lo que se oye tras las paredes) y un golpe hondo
  function dread(v, sec) { S.ext = Math.max(v || 0, S.extT > 0 ? S.ext : 0); S.extT = Math.max(S.extT, sec || 1); }
  function thump(v) {
    if (!ready || ctx.state !== 'running' || S.mode !== 'game') return;
    thumpHit(ctx.currentTime + 0.02, v == null ? 1 : v);
  }
  // (una escena del modo historia: la música de combate sigue al menos sec segundos más, aunque no haya nadie)
  function hold(sec) { S.hold = Math.max(S.hold || 0, sec); }
  G.Music = { update, preview, render, dread, thump, check, hold, _bakeCombat: bakeCombat, _bakeJobs: bakeJobs, get _cb() { return CB; },
    get combatBaked() { return { done: CB.done, ms: CB.ms, parts: [CB.intro, CB.outro].concat(CB.lv).filter(Boolean).length, sec: CB.done ? +(CB.lv.reduce((a, b) => a + b.duration, 0) + CB.intro.duration + CB.outro.duration).toFixed(1) : 0 }; }, get strings() { return Object.keys(KS).length; }, get mode() { return S.mode; }, get combat() { return S.cmb ? S.cmb.lv : 0; }, get tension() { return S.tens; }, get presence() { return S.pres; }, get hush() { return S.hush; }, get dbg() { return { bk: !!(S.cmb && S.cmb.baked), bg: S.cmb && S.cmb.baked ? S.cmb.g.map((x) => +x.gain.value.toFixed(2)) : null, c: S.lastC, hold: S.hold, lv: S.lvWant, cue: S.cueT, pres: S.pres, hush: S.hush, wait: S.cmbWait }; } };
})(window.Game = window.Game || {});
