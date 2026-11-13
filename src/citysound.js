// La ciudad que se oye a lo lejos la noche del brote (prólogo del modo historia): disparos sueltos y ráfagas,
// sirenas que van y vienen, alarmas de coche, un helicóptero que pasa, algún golpe sordo lejano y gritos. Todo
// sintetizado y sin posición (de lejos, de un lado o del otro). Suena mientras se conduce y sigue después del
// choque. G.CitySound.start(k) / stop() / update(dt). k: cuánto se oye (1 normal)
(function (G) {
  'use strict';
  const R = (a, b) => a + Math.random() * (b - a);
  let on = false, k = 1, nextT = 0, T = 0, nb = null, nbCtx = null;
  const live = [];        // sonidos largos en curso (sirena, alarma, helicóptero): { stop, t1 }

  const ok = () => !!(G.Audio && G.Audio.ctx && G.Audio.busOf && G.Audio.busOf('amb'));
  function noise(ctx) {
    if (nb && nbCtx === ctx) return nb;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nb = b; nbCtx = ctx;
    return b;
  }
  // salida: a un lado (pan) y apagado por la distancia (filtro)
  function outNode(ctx, pan, cut) {
    const out = G.Audio.busOf('amb');
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
    let tail = f;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; f.connect(p); tail = p; }
    tail.connect(out);
    return f;
  }

  // un disparo lejano (o una ráfaga)
  function shots() {
    const ctx = G.Audio.ctx, t0 = ctx.currentTime, n = Math.random() < 0.35 ? Math.floor(R(3, 9)) : (Math.random() < 0.5 ? 2 : 1);
    const pan = R(-0.9, 0.9), cut = R(700, 1600), vol = R(0.12, 0.3) * k, gap = Math.random() < 0.5 ? R(0.08, 0.13) : R(0.3, 0.9);
    const o = outNode(ctx, pan, cut);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * gap * R(0.8, 1.2);
      const s = ctx.createBufferSource(); s.buffer = noise(ctx);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(vol * 0.12, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + R(0.5, 1.1));
      s.connect(g); g.connect(o); s.start(t, Math.random()); s.stop(t + 1.2);
    }
  }
  // una sirena (aullido o «yelp») que se acerca, se queda un rato y se va
  function siren() {
    const ctx = G.Audio.ctx, t = ctx.currentTime, dur = R(7, 14), yelp = Math.random() < 0.35;
    const pan = R(-0.8, 0.8), o = outNode(ctx, pan, R(1200, 2200));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(R(0.05, 0.11) * k, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const osc = ctx.createOscillator(); osc.type = 'triangle';
    const lfo = ctx.createOscillator(); lfo.type = yelp ? 'triangle' : 'sine'; lfo.frequency.value = yelp ? 3.2 : 0.22;
    const lg = ctx.createGain(); lg.gain.value = yelp ? 260 : 330;
    osc.frequency.value = yelp ? 1050 : 980;
    lfo.connect(lg); lg.connect(osc.frequency);
    // (se va alejando: un poco más grave al final)
    osc.detune.setValueAtTime(40, t); osc.detune.linearRampToValueAtTime(-60, t + dur);
    osc.connect(g); g.connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  // alarma de coche: dos tonos que se alternan
  function alarm() {
    const ctx = G.Audio.ctx, t = ctx.currentTime, dur = R(5, 9);
    const o = outNode(ctx, R(-0.7, 0.7), 1800);
    const g = ctx.createGain(); g.gain.value = 0;
    const osc = ctx.createOscillator(); osc.type = 'square';
    for (let q = 0, i = 0; q < dur; q += 0.16, i++) {
      osc.frequency.setValueAtTime(i % 2 ? 1250 : 900, t + q);
      g.gain.setValueAtTime(i % 8 < 6 ? 0.025 * k : 0, t + q);
    }
    g.gain.setValueAtTime(0, t + dur);
    osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + dur + 0.1);
  }
  // un helicóptero que pasa por encima (lejos): el batir de las palas
  function heli() {
    const ctx = G.Audio.ctx, t = ctx.currentTime, dur = R(12, 18);
    const o = outNode(ctx, 0, 380);
    const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = true;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = R(16, 20);
    const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * k, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.8, t); p.pan.linearRampToValueAtTime(0.8, t + dur); g.connect(p); tail = p; }
    s.connect(am); am.connect(g); tail.connect(o);
    s.start(t); lfo.start(t); s.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  }
  // un golpe sordo muy lejos (algo que explota, un choque)
  function boom() {
    const ctx = G.Audio.ctx, t = ctx.currentTime, o = outNode(ctx, R(-0.6, 0.6), 220);
    const s = ctx.createBufferSource(); s.buffer = noise(ctx);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    s.connect(g); g.connect(o); s.start(t, Math.random()); s.stop(t + 2.8);
  }

  // un grito lejano (alguien que pide ayuda o al que alcanzan): una voz sintetizada que sube y se quiebra
  function scream() {
    const ctx = G.Audio.ctx, t = ctx.currentTime, fem = Math.random() < 0.55, dur = R(0.7, 1.6);
    const o = outNode(ctx, R(-0.85, 0.85), R(1400, 2600));
    const f0 = fem ? R(520, 700) : R(300, 420);
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.8, t); src.frequency.linearRampToValueAtTime(f0 * 1.25, t + dur * 0.3); src.frequency.linearRampToValueAtTime(f0 * 0.9, t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = R(5, 8); const vg = ctx.createGain(); vg.gain.value = f0 * 0.03; vib.connect(vg); vg.connect(src.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(R(0.04, 0.09) * k, t + 0.08); g.gain.setValueAtTime(R(0.04, 0.08) * k, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // las formantes de una «a» abierta
    for (const [fq, q, gv] of [[fem ? 950 : 750, 6, 1], [fem ? 1600 : 1200, 8, 0.6], [2800, 10, 0.25]]) {
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = gv;
      src.connect(b); b.connect(bg); bg.connect(g);
    }
    g.connect(o);
    src.start(t); vib.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  const CitySound = {
    get on() { return on; },
    // chaos (0 a 1): la segunda parte de la noche: más a menudo, más cerca y con gritos
    chaos: 0,
    scream() { if (ok()) try { scream(); } catch (e) { /* nada */ } },
    start(kk) { on = true; k = kk == null ? 1 : kk; nextT = R(1.5, 3); T = 0; },
    set level(v) { k = v; },
    stop() { on = false; this.chaos = 0; },
    update(dt) {
      if (!on || !ok()) return;
      T += dt; nextT -= dt;
      if (nextT > 0) return;
      // qué suena: sobre todo disparos y sirenas; de vez en cuando lo demás
      const r = Math.random();
      const ch = this.chaos || 0;
      try {
        if (ch > 0 && Math.random() < 0.3 * ch) scream();
        else if (r < 0.38) shots();
        else if (r < 0.62) siren();
        else if (r < 0.72) alarm();
        else if (r < 0.8) heli();
        else if (r < 0.88) boom();
        else if (G.Audio.play) G.Audio.play('farMoan', { vol: 0.3 * k, pan: R(-0.8, 0.8) });
      } catch (e) { /* nada */ }
      nextT = R(2.5, 7.5) * (1 - ch * 0.45);
    }
  };
  G.CitySound = CitySound;
})(window.Game = window.Game || {});
