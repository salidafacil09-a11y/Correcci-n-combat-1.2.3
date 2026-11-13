// Conducir el patrullero (prólogo del modo historia). Dos tramos:
//   · el garaje de la estación (la escena del juego, con sus paredes y los otros coches): sacarlo por el portón
//   · la calle (escena propia, G.Road: la avenida que se arma delante y se deshace detrás)
// Física sencilla con peso: el motor empuja menos cuanto más rápido vas, frena fuerte, la dirección gira menos a
// velocidad, la carrocería se inclina en las curvas y cabecea al frenar. Choques: se desliza por lo que roza y
// rebota de frente. Sonido propio (motor sintetizado con su régimen y sus marchas, rodadura, viento, derrape y
// golpes), HUD propio (volante, pedales, velocímetro) y los faros con la luz de la linterna (G.Flash.external).
// El choque del final: otro coche sale de la transversal y lo embiste por el costado del conductor.
// G.Drive.garage(...) / road(...) / update(dt) / render(renderer) / stop()
(function (G) {
  'use strict';
  const U = G.Util;

  // ---------- El coche ----------
  const LEN = 4.6, WID = 1.85, WB = 2.7;
  const VMAX = 30, ACC = 6.2, BRAKE = 10.5, VREV = 5.5;
  const CIRC = [-1.55, 0, 1.55], CR = 0.95;
  const GEARS = [0, 7.5, 13.5, 20, 26, 40];          // velocidades de cambio (m/s)

  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
  let glowTexC = null;
  function glowTex() {
    if (glowTexC) return glowTexC;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTexC = new THREE.CanvasTexture(cv);
    return glowTexC;
  }
  function sprite(col, s, op) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op == null ? 1 : op }));
    sp.material.toneMapped = false; sp.scale.set(s, s, 1); sp.userData.noFlashShadow = true;
    return sp;
  }
  const basic = (c) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.toneMapped = false; return m; };
  // el modelo: el mismo dibujo que los patrulleros de los mapas (G.Furniture) más las luces que se encienden
  function buildCar(type, col) {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const m = new G.Mesher();
    const T = G.Furniture.T[type], hw = T.w / 2, hd = T.d / 2;
    G.Furniture.draw(m, { type, lv: 0, x0: -hw, x1: hw, z0: -hd, z1: hd, y: -0.04, h: T.h, fx: 0, fz: 1, seed: 77, col, cont: null, solid: true });
    const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = false;
    body.add(mesh);
    const L = {};
    // faros, pilotos (rojos: más fuertes al frenar) y luces de marcha atrás
    const hb = new THREE.BoxGeometry(0.34, 0.12, 0.03);
    L.head = basic(0xfff2d8);
    for (const e of [-1, 1]) {
      const h = new THREE.Mesh(hb, L.head); h.position.set(e * (hw - 0.3), 0.72, hd + 0.02); body.add(h);
      const g = sprite(0xfff0d0, 0.9, 0.8); g.position.set(e * (hw - 0.3), 0.72, hd + 0.12); body.add(g);
    }
    L.tail = basic(0x5a0808); L.rev = basic(0x202020);
    for (const e of [-1, 1]) {
      const t = new THREE.Mesh(hb, L.tail); t.position.set(e * (hw - 0.28), 0.78, -hd - 0.02); body.add(t);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), L.rev); r.position.set(e * (hw - 0.55), 0.78, -hd - 0.02); body.add(r);
    }
    L.tailGlow = []; for (const e of [-1, 1]) { const g = sprite(0xff2010, 0.7, 0.35); g.position.set(e * (hw - 0.28), 0.78, -hd - 0.1); body.add(g); L.tailGlow.push(g); }
    // las luces del techo (rojo y azul, alternando) con su resplandor
    if (type === 'patrulla') {
      L.red = basic(0x400a0a); L.blue = basic(0x0a1240);
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.22), L.red); r.position.set(-0.3, 1.49, -0.1); body.add(r);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.22), L.blue); b.position.set(0.3, 1.49, -0.1); body.add(b);
      L.redG = sprite(0xff1a10, 3.2, 0); L.redG.position.set(-0.3, 1.55, -0.1); body.add(L.redG);
      L.blueG = sprite(0x2040ff, 3.2, 0); L.blueG.position.set(0.3, 1.55, -0.1); body.add(L.blueG);
    }
    // sombra (una mancha oscura debajo: de noche no hay sombras de verdad)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(T.w + 1.0, T.d + 1.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);
    root.userData.noFlashShadow = true;
    return { root, body, L, type, len: T.d, wid: T.w };
  }
  function disposeCar(c) {
    if (!c) return;
    if (c.root.parent) c.root.parent.remove(c.root);
    c.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
  }

  // ---------- Sonido ----------
  const Snd = {
    n: null, gen: -1,
    ok() { const A = G.Audio; return !!(A && A.ctx && A.busOf && A.busOf('fx')); },
    noise() {
      const ctx = G.Audio.ctx;
      if (this._nb && this._nbCtx === ctx) return this._nb;
      const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._nb = b; this._nbCtx = ctx;
      return b;
    },
    start() {
      if (!this.ok()) return;
      this.stop();
      const A = G.Audio, ctx = A.ctx, out = A.busOf('fx'), t = ctx.currentTime;
      const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); return o; };
      const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
      const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 0.7; return b; };
      const src = () => { const s = ctx.createBufferSource(); s.buffer = this.noise(); s.loop = true; s.start(t, Math.random()); return s; };
      const n = {};
      n.eng = gain(0);
      n.o1 = osc('sawtooth', 27); n.o2 = osc('square', 13.5); n.o3 = osc('triangle', 54); n.o4 = osc('sawtooth', 27.3);
      const g1 = gain(0.42), g2 = gain(0.3), g3 = gain(0.22), g4 = gain(0.28);
      n.lp = filt('lowpass', 400, 1.1);
      const sh = ctx.createWaveShaper(), c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 2.2); }
      sh.curve = c;
      n.am = gain(0.75);
      n.lfo = osc('sine', 13.5); const lg = gain(0.25); n.lfo.connect(lg); lg.connect(n.am.gain);
      n.o1.connect(g1); n.o2.connect(g2); n.o3.connect(g3); n.o4.connect(g4);
      for (const g of [g1, g2, g3, g4]) g.connect(sh);
      sh.connect(n.lp); n.lp.connect(n.am); n.am.connect(n.eng); n.eng.connect(out);
      // la admisión (un soplido que sube con el acelerador)
      n.in = src(); n.inF = filt('bandpass', 110, 1.4); n.inG = gain(0); n.in.connect(n.inF); n.inF.connect(n.inG); n.inG.connect(n.eng);
      // rodadura, viento y derrape
      n.road = src(); n.roadF = filt('lowpass', 420, 0.8); n.roadG = gain(0); n.road.connect(n.roadF); n.roadF.connect(n.roadG); n.roadG.connect(out);
      n.wind = src(); n.windF = filt('highpass', 900, 0.6); n.windG = gain(0); n.wind.connect(n.windF); n.windF.connect(n.windG); n.windG.connect(out);
      n.skid = src(); n.skidF = filt('bandpass', 1500, 4); n.skidG = gain(0); n.skid.connect(n.skidF); n.skidF.connect(n.skidG); n.skidG.connect(out);
      this.n = n; this.gen = A.gen;
      // el arranque: el motor de arranque (unos golpes rápidos) y el motor que prende
      this.crank();
      n.eng.gain.setValueAtTime(0, t); n.eng.gain.setTargetAtTime(0.55, t + 0.95, 0.12);
    },
    crank() {
      if (!this.ok()) return;
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime;
      for (let i = 0; i < 9; i++) {
        const s = ctx.createBufferSource(); s.buffer = this.noise();
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
        const g = ctx.createGain(); const t0 = t + i * 0.095;
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.01, t0 + 0.085);
        s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0 + 0.1);
      }
    },
    update(rpm, thr, speed, slip, idleOnly) {
      if (!this.n || !this.ok()) return;
      if (G.Audio.gen !== this.gen) { this.n = null; this.start(); return; }
      const ctx = G.Audio.ctx, t = ctx.currentTime, n = this.n, f = rpm / 60 * 2;
      n.o1.frequency.setTargetAtTime(f, t, 0.04); n.o4.frequency.setTargetAtTime(f * 1.012, t, 0.04);
      n.o2.frequency.setTargetAtTime(f / 2, t, 0.04); n.o3.frequency.setTargetAtTime(f * 2, t, 0.04);
      n.lfo.frequency.setTargetAtTime(f / 2, t, 0.04);
      n.lp.frequency.setTargetAtTime(260 + rpm * 0.16 + thr * 900, t, 0.05);
      n.inG.gain.setTargetAtTime(0.05 + thr * 0.22, t, 0.06); n.inF.frequency.setTargetAtTime(f * 3.5, t, 0.05);
      n.roadG.gain.setTargetAtTime(Math.min(0.32, speed * 0.012), t, 0.1);
      n.windG.gain.setTargetAtTime(Math.min(0.14, speed * speed * 0.00014), t, 0.1);
      n.skidG.gain.setTargetAtTime(Math.min(0.5, slip * 0.5), t, 0.05);
    },
    stop(hard) {
      const n = this.n;
      this.n = null;
      if (!n || !G.Audio || !G.Audio.ctx) return;
      const ctx = G.Audio.ctx, t = ctx.currentTime;
      for (const k of ['eng', 'roadG', 'windG', 'skidG']) if (n[k]) { n[k].gain.cancelScheduledValues(t); n[k].gain.setTargetAtTime(0, t, hard ? 0.01 : 0.25); }
      setTimeout(() => { for (const k of ['o1', 'o2', 'o3', 'o4', 'lfo', 'in', 'road', 'wind', 'skid']) try { n[k].stop(); } catch (e) { /* nada */ } }, hard ? 120 : 1500);
    },
    // en pausa (o detrás de la pantalla de carga): el motor calla
    mute(on) {
      if (!this.n || !this.ok()) return;
      const t = G.Audio.ctx.currentTime, n = this.n;
      n.eng.gain.setTargetAtTime(on ? 0 : 0.55, t, 0.05);
      if (on) for (const k of ['roadG', 'windG', 'skidG']) n[k].gain.setTargetAtTime(0, t, 0.05);
    },
    // un golpe: k 0..1 (1 = el choque)
    hit(k) {
      if (!this.ok()) return;
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = this.noise();
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300 + 2600 * k;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 + 0.9 * k, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + 0.7 * k);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 1.2);
      // chapa: unas notas metálicas que se apagan
      for (let i = 0; i < (k > 0.5 ? 5 : 2); i++) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 160 + Math.random() * 520;
        const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 900 + Math.random() * 1800; b.Q.value = 6;
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.06 + 0.12 * k, t + 0.01); og.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + 0.6 * k);
        o.connect(b); b.connect(og); og.connect(out); o.start(t); o.stop(t + 1.0);
      }
      // y un golpe sordo (el peso del coche)
      const th = ctx.createOscillator(); th.type = 'sine'; th.frequency.setValueAtTime(90, t); th.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      const tg = ctx.createGain(); tg.gain.setValueAtTime(0.0001, t); tg.gain.exponentialRampToValueAtTime(0.4 + 0.6 * k, t + 0.01); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.35 + 0.3 * k);
      th.connect(tg); tg.connect(out); th.start(t); th.stop(t + 0.8);
    },
    // chispas de los cables (el puente): chasquidos agudos y un zumbido corto
    spark(k) {
      if (!this.ok()) return;
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime, n = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const t0 = t + i * (0.02 + Math.random() * 0.05);
        const s = ctx.createBufferSource(); s.buffer = this.noise();
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2800 + Math.random() * 2000;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18 * (k || 1), t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
        s.connect(f); f.connect(g); g.connect(out); s.start(t0, Math.random()); s.stop(t0 + 0.08);
      }
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + 0.01); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.2);
    },
    // el motor que tose y se cala (un arranque que no llega a prender)
    cough() {
      if (!this.ok()) return;
      this.crank();
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime + 0.85;
      for (let i = 0; i < 3; i++) {
        const t0 = t + i * 0.16;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(34 - i * 4, t0);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32 - i * 0.08, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
        o.connect(f); f.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.16);
      }
    },
    // el bocinazo del que viene de lado
    horn() {
      if (!this.ok()) return;
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.03); g.gain.setValueAtTime(0.32, t + 0.75); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
      for (const fr of [392, 494]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 0.95); }
      f.connect(g); g.connect(out);
    },
    // el choque: el golpe, los cristales y la chapa arrastrándose
    crash() {
      this.hit(1);
      if (G.Audio) { G.Audio.play('glass', { vol: 1 }); G.Audio.play('glass', { vol: 0.8, delay: 0.12 }); }
      if (!this.ok()) return;
      const ctx = G.Audio.ctx, out = G.Audio.busOf('fx'), t = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = this.noise();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.15); g.gain.exponentialRampToValueAtTime(0.5, t + 0.22); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 1.0);
      setTimeout(() => this.hit(0.75), 260);
    }
  };

  // ---------- Controles ----------
  const keys = {};
  let keysOn = false;
  function onKey(e) {
    if (!D.active || D.frozen) return;
    const down = e.type === 'keydown';
    const k = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) { keys[k] = down; e.preventDefault(); }
  }
  const touch = { steer: 0, gas: false, brake: false, sid: null, sx: 0 };
  let hud = null;
  function buildHud() {
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'drive-hud';
    hud.className = 'hidden';
    hud.innerHTML =
      '<div class="dh-wheel"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke-width="8"/>' +
      '<circle cx="50" cy="50" r="9"/><path d="M14 54 L41 52 M59 52 L86 54 M50 59 L50 88" stroke-width="8" fill="none"/></svg><span>Volante</span></div>' +
      '<div class="dh-speed"><b>0</b><small>km/h</small><i class="dh-gear">D</i><div class="dh-rpm"><span></span></div></div>' +
      '<div class="dh-ped dh-brake"><span>Freno</span></div>' +
      '<div class="dh-ped dh-gas"><span>Acelerar</span></div>' +
      '<div class="dh-hint"></div>' +
      '<button class="dh-pause" aria-label="Pausa">II</button>' +
      '<div class="dh-flash"></div>';
    document.body.appendChild(hud);
    const wheel = hud.querySelector('.dh-wheel');
    wheel.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.sid = e.pointerId; touch.sx = e.clientX; try { wheel.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } });
    wheel.addEventListener('pointermove', (e) => { if (e.pointerId !== touch.sid) return; touch.steer = U.clamp((e.clientX - touch.sx) / 70, -1, 1); });
    const endW = (e) => { if (e.pointerId !== touch.sid) return; touch.sid = null; touch.steer = 0; };
    wheel.addEventListener('pointerup', endW); wheel.addEventListener('pointercancel', endW);
    for (const [cls, key] of [['.dh-gas', 'gas'], ['.dh-brake', 'brake']]) {
      const b = hud.querySelector(cls);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); touch[key] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) { /* nada */ } });
      const up = () => { touch[key] = false; b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
    hud.querySelector('.dh-pause').addEventListener('click', (e) => { e.preventDefault(); if (G.Input && G.Input.queue) G.Input.queue('pause'); });
    return hud;
  }
  function readInput() {
    let gas = 0, brk = 0, st = 0;
    if (keys.KeyW || keys.ArrowUp) gas = 1;
    if (keys.KeyS || keys.ArrowDown || keys.Space) brk = 1;
    if (keys.KeyA || keys.ArrowLeft) st -= 1;
    if (keys.KeyD || keys.ArrowRight) st += 1;
    if (touch.gas) gas = 1;
    if (touch.brake) brk = 1;
    if (touch.sid != null) st = touch.steer;
    // mando: palanca izquierda para girar, gatillos para acelerar y frenar
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p || !p.connected) continue;
        const ax = p.axes[0] || 0;
        if (Math.abs(ax) > 0.14) st = U.clamp(st + (ax - Math.sign(ax) * 0.14) / 0.86, -1, 1);
        const b = (i) => (p.buttons[i] ? (p.buttons[i].value || (p.buttons[i].pressed ? 1 : 0)) : 0);
        gas = Math.max(gas, b(7), b(0));
        brk = Math.max(brk, b(6), b(2));
      }
    } catch (e) { /* nada */ }
    return { gas, brk, st };
  }

  // ---------- Estado ----------
  const car = { x: 0, z: 0, y: 0, h: 0, v: 0, steer: 0, yaw: 0, roll: 0, pitch: 0, rollV: 0, pitchV: 0, thr: 0, brk: 0, rev: false, revT: 0, rpm: 800, gear: 1, slip: 0, bob: 0 };
  const cam = { x: 0, y: 0, z: 0, h: 0, shake: 0, roll: 0, ready: false };
  let model = null, roadScene = null, camera = null, onExit = null, hintT = 0, lastHit = 0, T = 0;
  let crash = null, other = null, lights = null, glows = [];
  const head = { pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 }, range: 46, outer: 0.62, vert: 0.38, power: 3.4, color: [1.0, 0.93, 0.8], bounce: 0.05, on: true };

  // ¿choca un círculo? (garaje: las paredes y los muebles del mapa; calle: G.Road). Devuelve el empuje
  function pushAt(x, z, r) {
    if (D.road) { const h = G.Road.collide(x, z, r); return h ? { x: h.x, z: h.z, what: h.what } : null; }
    const W = G.World;
    // (la gente del garaje: el mecánico no se atraviesa)
    if (G.NPCs && G.NPCs.list) for (const n of G.NPCs.list) {
      if (n.off || n.gone) continue;
      const dx = x - n.pos.x, dz = z - n.pos.z, d = Math.hypot(dx, dz), m = r + 0.32;
      if (d < m && d > 1e-4) return { x: dx / d * (m - d), z: dz / d * (m - d), what: 'person' };
    }
    if (!W.circleBlocked(x, z, r, 0, false, 0)) return null;
    // (el mapa no da el empuje: se busca el lado libre más cercano)
    for (let d = 0.04; d < 0.6; d += 0.04) {
      for (let a = 0; a < 8; a++) {
        const px = Math.cos(a * Math.PI / 4) * d, pz = Math.sin(a * Math.PI / 4) * d;
        if (!W.circleBlocked(x + px, z + pz, r, 0, false, 0)) return { x: px, z: pz, what: 'wall' };
      }
    }
    return { x: 0, z: 0, what: 'wall' };
  }

  // el coche solo (el final): hacia el siguiente punto, girando lo que haga falta y sin pasarse de velocidad
  // A.stop: frenar suave hasta quedarse en el último punto
  function autoInput() {
    const A = D.auto, c = car, fx = Math.sin(c.h), fz = Math.cos(c.h);
    let p = A.pts[A.i];
    // (los puntos ya pasados o que quedan detrás, fuera)
    while (p && A.i < A.pts.length - 1 && (Math.hypot(p.x - c.x, p.z - c.z) < 3.5 || ((p.x - c.x) * fx + (p.z - c.z) * fz < 0 && Math.hypot(p.x - c.x, p.z - c.z) < 10))) { A.i++; p = A.pts[A.i]; }
    const last = A.pts[A.pts.length - 1], dl = Math.hypot(last.x - c.x, last.z - c.z);
    if (!p || (A.i >= A.pts.length - 1 && (dl < (A.stop ? 0.8 : 3.5) || (last.x - c.x) * fx + (last.z - c.z) * fz < 0))) { A.done = true; return { gas: 0, brk: 1, st: 0, hold: true }; }
    const want = Math.atan2(p.x - c.x, p.z - c.z), err = U.angleDiff(want, c.h);
    const st = U.clamp(-err * 2.6, -1, 1);
    let vmax = (A.spd || 12) * (Math.abs(err) > 0.5 ? 0.5 : 1);
    if (A.stop) vmax = Math.min(vmax, Math.sqrt(2 * 5.0 * Math.max(0, dl - 0.6)));
    const v = Math.abs(c.v);
    const gas = v < vmax - 0.3 ? 0.75 : 0, brk = v > vmax + 0.3 ? U.clamp((v - vmax) * 0.4, 0.2, 1) : 0;
    return { gas, brk, st, hold: true };
  }
  function physics(dt, inp) {
    const c = car;
    // pedales con algo de inercia (el pie no va de 0 a 1 de golpe)
    c.thr += (inp.gas - c.thr) * Math.min(1, dt * 4);
    c.brk += (inp.brk - c.brk) * Math.min(1, dt * 7);
    // marcha atrás: parado y pisando el freno un momento (frenado por la escena: nunca)
    if (inp.hold) { c.rev = false; c.revT = 0; }
    else if (!c.rev && Math.abs(c.v) < 0.4 && inp.brk > 0.5 && inp.gas < 0.1) { c.revT += dt; if (c.revT > 0.35) c.rev = true; }
    else if (c.rev && (inp.gas > 0.3 && c.v > -0.4)) { c.rev = false; c.revT = 0; }
    else if (inp.brk < 0.1) c.revT = 0;
    let a = 0;
    if (!c.rev) {
      a += c.thr * ACC * Math.pow(Math.max(0, 1 - c.v / VMAX), 0.75) * (c.v < 4 ? 0.85 + c.v * 0.04 : 1);
      if (c.v > 0.05) a -= c.brk * BRAKE;
    } else {
      // atrás: el freno acelera hacia atrás, el acelerador frena
      a -= c.brk * 3.4 * Math.max(0, 1 + c.v / VREV);
      if (c.v < -0.05) a += c.thr * BRAKE;
    }
    // rozamiento y aire
    a -= Math.sign(c.v) * (0.32 + 0.0019 * c.v * c.v);
    const v0 = c.v;
    c.v += a * dt;
    if (!c.rev && v0 >= 0 && c.v < 0) c.v = 0;
    if (c.rev && v0 <= 0 && c.v > 0 && c.thr > 0.1) c.v = 0;
    if (Math.abs(c.v) < 0.05 && c.thr < 0.05 && !c.rev) c.v = 0;
    // dirección: gira menos cuanto más rápido; el volante va y vuelve con su tiempo
    const maxSt = 0.6 / (1 + Math.abs(c.v) / 9);
    const want = inp.st * maxSt;
    c.steer += U.clamp(want - c.steer, -dt * 2.2, dt * 2.2);
    const yawT = -c.v * Math.tan(c.steer) / WB;
    c.yaw += (yawT - c.yaw) * Math.min(1, dt * 7);
    // derrape: si se pide más giro del que agarran las ruedas, se recorta (y chirría)
    const lat = c.v * c.yaw;
    c.slip = Math.max(0, Math.abs(lat) - 7.5) / 4 + (c.brk > 0.6 && Math.abs(c.v) > 12 ? 0.35 : 0);
    if (Math.abs(lat) > 8.5) c.yaw *= 8.5 / Math.abs(lat);
    c.h += c.yaw * dt;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    let nx = c.x + fx * c.v * dt, nz = c.z + fz * c.v * dt;
    // choques: cada círculo del coche se empuja fuera; de frente, rebota; de lado, se desliza
    let px = 0, pz = 0, hitWhat = null;
    for (const o of CIRC) {
      const p = pushAt(nx + fx * o + px, nz + fz * o + pz, CR);
      // la reja de la salida del depósito: con impulso se lleva por delante (si no, aguanta)
      if (p && p.what === 'gate' && Math.abs(c.v) > 2.4 && G.RoadLife && G.RoadLife.smashGate) { G.RoadLife.smashGate(c); c.v *= 0.72; cam.shake = Math.max(cam.shake, 0.9); Snd.hit(0.8); continue; }
      if (p) { px += p.x; pz += p.z; hitWhat = p.what; }
    }
    if (hitWhat) {
      nx += px; nz += pz;
      const l = Math.hypot(px, pz);
      if (l > 1e-4) {
        const nnx = px / l, nnz = pz / l, dn = fx * nnx + fz * nnz;
        const into = c.v * dn;        // (negativo: va contra lo que tocó)
        if (into < 0) {
          const k = -into;
          c.v -= 1.25 * c.v * dn * dn;
          if (k > 1.5 && T - lastHit > 0.3) {
            lastHit = T;
            const s = U.clamp(k / 14, 0.1, 0.8);
            Snd.hit(s);
            cam.shake = Math.max(cam.shake, s * 0.9);
            c.pitchV -= dn * s * 1.2; c.rollV += s * (Math.random() - 0.5) * 2;
          }
        }
      }
      // si rozando se quedó encajado, que no tiemble: un poco más fuera
      if (D.road && G.Road.collide(nx, nz, CR * 0.6)) { nx = c.x; nz = c.z; c.v *= 0.5; }
    }
    c.x = nx; c.z = nz;
    // la carrocería: se inclina hacia fuera en las curvas y cabecea al acelerar y frenar (con muelle)
    const accLong = (c.v - v0) / Math.max(1e-4, dt);
    const rollT = U.clamp(lat * 0.011, -0.07, 0.07), pitchT = U.clamp(-accLong * 0.0065, -0.05, 0.05);
    c.rollV += ((rollT - c.roll) * 60 - c.rollV * 9) * dt; c.roll += c.rollV * dt;
    c.pitchV += ((pitchT - c.pitch) * 70 - c.pitchV * 10) * dt; c.pitch += c.pitchV * dt;
    // altura del suelo (la acera) y un poco de vaivén de la suspensión
    const gy = D.road ? G.Road.groundY(c.x, c.z) : 0;
    if (D.road && Math.abs(gy - c.y) > 0.08 && Math.abs(c.v) > 2 && T - lastHit > 0.25) { lastHit = T; Snd.hit(0.12); c.pitchV -= 0.6 * Math.sign(c.v); cam.shake = Math.max(cam.shake, 0.15); }
    c.y += (gy - c.y) * Math.min(1, dt * 12);
    c.bob += dt * (2 + Math.abs(c.v) * 0.8);
    // régimen del motor: marchas automáticas
    const sp = Math.abs(c.v);
    let g = 1; while (g < GEARS.length - 1 && sp > GEARS[g]) g++;
    c.gear = g;
    const lo = GEARS[g - 1], hi = GEARS[g];
    const frac = U.clamp((sp - lo) / (hi - lo), 0, 1);
    const target = sp < 0.3 && !c.rev ? 780 + c.thr * 2600 : 1400 + frac * 3600 + c.thr * 500;
    c.rpm += (target - c.rpm) * Math.min(1, dt * (target > c.rpm ? 5 : 3));
  }

  function place(dt) {
    const c = car;
    if (!model) return;
    model.root.position.set(c.x, c.y, c.z);
    model.root.rotation.y = c.h;
    model.body.rotation.set(c.pitch, 0, c.roll + Math.sin(c.bob * 3.1) * 0.003 * Math.min(1, Math.abs(c.v) / 6));
    model.body.position.y = Math.sin(c.bob * 2.3) * 0.006 * Math.min(1, Math.abs(c.v) / 6);
    // pilotos: al frenar, más fuertes; marcha atrás, blancas
    const L = model.L;
    L.tail.color.setHex(c.brk > 0.3 && !c.rev ? 0xff1a10 : 0x6a0c0c);
    for (const g of L.tailGlow) g.material.opacity = c.brk > 0.3 && !c.rev ? 0.75 : 0.3;
    L.rev.color.setHex(c.rev ? 0xf0f0e8 : 0x202020);
    // las del techo: rojo y azul alternando, con doble destello
    if (L.red) {
      const ph = (T * 2.2) % 2, on = (ph % 1) < 0.18 || ((ph % 1) > 0.3 && (ph % 1) < 0.46);
      const red = ph < 1 && on, blue = ph >= 1 && on;
      L.red.color.setHex(red ? 0xff2a20 : 0x400a0a); L.blue.color.setHex(blue ? 0x3050ff : 0x0a1240);
      L.redG.material.opacity = red ? 0.9 : 0; L.blueG.material.opacity = blue ? 0.9 : 0;
    }
    // los faros (la luz de la linterna, en modo faro)
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    head.pos.x = c.x + fx * (LEN / 2 + 0.15); head.pos.y = c.y + 0.78; head.pos.z = c.z + fz * (LEN / 2 + 0.15);
    head.dir.x = fx; head.dir.y = -0.07 - c.pitch * 0.5; head.dir.z = fz;
    const l = Math.hypot(head.dir.x, head.dir.y, head.dir.z); head.dir.x /= l; head.dir.y /= l; head.dir.z /= l;
    head.right.x = -Math.cos(c.h); head.right.y = 0; head.right.z = Math.sin(c.h);
    head.on = !D.lightsOff;
    L.head.color.setHex(D.lightsOff ? 0x3a3a34 : 0xfff2d8);
    if (G.Flash && G.Flash.external) G.Flash.external(head);
  }

  function updateCam(dt) {
    const c = car;
    if (!camera) return;
    // plano fijo desde lo alto (el final): como un dron, con un vaivén lento
    if (D.camFix) {
      const F = D.camFix; F.t = (F.t || 0) + dt;
      camera.position.set(F.eye.x + Math.sin(F.t * 0.31) * 0.6, F.eye.y + Math.sin(F.t * 0.23) * 0.4, F.eye.z + Math.cos(F.t * 0.27) * 0.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(F.at.x, F.at.y, F.at.z);
      if (G.Camera) G.Camera.fovOff = 0;
      return;
    }
    const sp = Math.abs(c.v);
    const back = D.road ? 6.0 + sp * 0.035 : 5.0, up = D.road ? 2.45 : 2.15;
    // la cámara sigue el rumbo con retraso (en las curvas se ve el costado del coche)
    if (!cam.ready) { cam.h = c.h; }
    cam.h += U.angleDiff(c.h, cam.h) * Math.min(1, dt * 3.2);
    const fx = Math.sin(cam.h), fz = Math.cos(cam.h);
    const wx = c.x - fx * back, wz = c.z - fz * back, wy = c.y + up;
    if (!cam.ready) { cam.x = wx; cam.y = wy; cam.z = wz; cam.ready = true; }
    const k = Math.min(1, dt * 7);
    cam.x += (wx - cam.x) * k; cam.y += (wy - cam.y) * k; cam.z += (wz - cam.z) * k;
    cam.shake *= Math.exp(-dt * (crash && crash.state === 'hit' ? 2.5 : 6));
    const s = cam.shake;
    camera.position.set(cam.x + (Math.random() - 0.5) * s * 0.5, cam.y + (Math.random() - 0.5) * s * 0.4, cam.z + (Math.random() - 0.5) * s * 0.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(c.x + Math.sin(c.h) * 5, c.y + 1.0, c.z + Math.cos(c.h) * 5);
    cam.roll += ((crash && crash.state === 'hit' ? Math.sin(T * 31) * 0.25 * s : 0) - cam.roll) * Math.min(1, dt * 12);
    camera.rotateZ(cam.roll + (Math.random() - 0.5) * s * 0.06);
    // (más campo de visión a más velocidad: se siente la velocidad)
    if (G.Camera) G.Camera.fovOff = 4 + Math.min(10, sp * 0.33) + (crash && crash.state === 'hit' ? 8 * s : 0);
  }

  function updateHud() {
    if (!hud) return;
    const c = car, kmh = Math.round(Math.abs(c.v) * 3.6);
    hud.querySelector('.dh-speed b').textContent = kmh;
    hud.querySelector('.dh-gear').textContent = c.rev ? 'R' : (Math.abs(c.v) < 0.3 && c.thr < 0.05 ? 'N' : 'D');
    hud.querySelector('.dh-rpm span').style.width = Math.round(U.clamp((c.rpm - 700) / 5200, 0, 1) * 100) + '%';
    hud.querySelector('.dh-wheel svg').style.transform = 'rotate(' + Math.round(c.steer / 0.6 * 110) + 'deg)';
    if (hintT > 0) { hintT -= 1 / 60; if (hintT <= 0) hud.querySelector('.dh-hint').classList.remove('in'); }
  }

  // ---------- La calle: escena, luz y lo de lejos ----------
  function buildRoadScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x05070a).convertSRGBToLinear();
    s.fog = new THREE.Fog(s.background.getHex(), 10, 72);
    const hemi = new THREE.HemisphereLight(0x4a5470, 0x0c0b0a, 0.62);
    s.add(hemi);
    const moon = new THREE.DirectionalLight(0x8494b8, 0.24);
    moon.position.set(-30, 60, 20); s.add(moon); s.add(moon.target);
    // incendios en el horizonte (lejos, sin niebla: un resplandor naranja detrás de los edificios)
    glows = [];
    for (const [x, y, z, sc, col] of [[-55, 16, 78, 70, 0xff6a28], [40, 12, 82, 55, 0xff8a3a], [8, 24, 86, 90, 0x6a3420]]) {
      const g = sprite(col, sc, 0.22); g.material.fog = false; g.scale.set(sc, sc * 0.55, 1); g.renderOrder = -1;
      s.add(g); glows.push({ g, x, y, z });
    }
    return s;
  }

  // ---------- El choque ----------
  // armed: esperando a que llegue al cruce; come: el otro coche, a toda velocidad por la transversal; hit: el golpe
  function stepCrash(dt) {
    const cr = crash, c = car;
    if (cr.state === 'armed') {
      const d = cr.z - c.z;
      if ((d < 30 && c.v > 3) || d < 9) {
        cr.state = 'come';
        // (una camioneta oscura, con las largas puestas)
        other = buildCar('camioneta', 0x2a2c30);
        other.L.head.color.setHex(0xffffff);
        for (const o of other.body.children) if (o.isSprite && o.position.z > 0) o.scale.set(2.8, 2.8, 1);
        roadScene.add(other.root);
        // tarda lo que tarde Javier en llegar al centro del cruce (si va muy lento, poco)
        const tc = U.clamp((cr.z - c.z) / Math.max(4, c.v), 0.7, 2.6);
        cr.ox = 4 + 30; cr.ov = U.clamp(30 / tc, 15, 36); cr.oz = cr.z;
        cr.t = 0;
        Snd.horn();
        if (cr.onWarn) cr.onWarn();
      }
    } else if (cr.state === 'come') {
      cr.t += dt;
      // por el carril de la transversal, apuntando a donde estará el patrullero
      cr.ox -= cr.ov * dt;
      cr.oz += ((c.z + 0.2) - cr.oz) * Math.min(1, dt * 3);
      other.root.position.set(cr.ox, 0, cr.oz); other.root.rotation.y = -Math.PI / 2;
      const gap = (cr.ox - other.len / 2) - (c.x + WID / 2 * Math.abs(Math.cos(c.h)) + LEN / 2 * Math.abs(Math.sin(c.h)));
      if (gap < 0.15 || cr.t > 4) {
        cr.state = 'hit'; cr.t = 0;
        Snd.crash(); Snd.stop(true);
        cam.shake = 1.6;
        // el patrullero sale despedido de lado y empieza a volcar; el otro se queda clavado
        cr.vx = -cr.ov * 0.55 - 3; cr.spin = 1.6 + Math.random() * 0.6; cr.rollW = -7.5; cr.vy = 3.2;
        c.v *= 0.4;
        if (hud) { const f = hud.querySelector('.dh-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
        if (G.Audio && G.Audio.daze) G.Audio.daze(0.7, 2.5);
      }
    } else if (cr.state === 'hit') {
      cr.t += dt;
      // vuelca (a cámara un poco lenta: la imagen va más despacio que el golpe)
      const k = cr.t < 0.5 ? 0.55 : 1;
      c.x += cr.vx * dt * k; c.z += c.v * dt * k;
      cr.vy -= 14 * dt * k; c.y = Math.max(0, c.y + cr.vy * dt * k);
      c.h += cr.spin * dt * k;
      c.roll += cr.rollW * dt * k;
      model.root.position.set(c.x, c.y + 0.6 * Math.abs(Math.sin(c.roll)), c.z); model.root.rotation.y = c.h;
      model.body.rotation.set(0, 0, c.roll);
      other.root.position.x += (cr.ox + 1 - other.root.position.x) * Math.min(1, dt * 6);
      if (cr.t > 0.62 && !cr.cut) { cr.cut = true; if (cr.onCut) cr.onCut(); }
    }
  }

  // ---------- API ----------
  const D = {
    active: false, road: false, frozen: false,
    get car() { return car; },
    get speed() { return Math.abs(car.v); },
    get crashState() { return crash ? crash.state : null; },
    // el garaje: el patrullero que estaba aparcado se cambia por este (que se puede mover); sale por el portón
    garage(o) {
      this.stop(true);
      camera = o.camera; onExit = o.onExit || null;
      // el aparcado (un mueble del mapa) desaparece: lo sustituye el que se conduce
      if (G.World.removeFurn) for (const { c, f } of G.World.furnNear(o.x, o.z, 1.2, 0)) if (f.type === 'patrulla') G.World.removeFurn(c, f);
      model = buildCar('patrulla');
      o.scene.add(model.root);
      Object.assign(car, { x: o.x, z: o.z, y: 0, h: o.h, v: 0, steer: 0, yaw: 0, roll: 0, pitch: 0, rollV: 0, pitchV: 0, thr: 0, brk: 0, rev: false, revT: 0, rpm: 800, slip: 0 });
      this.active = true; this.road = false; this.frozen = false; crash = null;
      cam.ready = false; cam.shake = 0;
      this.begin();
    },
    // la calle: escena propia (la estación ya se descargó)
    // o: z, v, x, h, type (el coche: el patrullero o, la segunda vez, el que está en el depósito), col,
    // road (opciones de G.Road: minK, endK) y engineOff (sin arrancar todavía: el puente)
    toRoad(o) {
      if (model) disposeCar(model);
      model = null;
      roadScene = buildRoadScene();
      G.Road.init(roadScene, o.road || null);
      model = buildCar(o.type || 'patrulla', o.col);
      roadScene.add(model.root);
      camera = o.camera;
      Object.assign(car, { x: o.x != null ? o.x : -1.9, z: o.z || 6, y: 0, h: o.h || 0, v: o.v || 0, steer: 0, yaw: 0, roll: 0, pitch: 0, rollV: 0, pitchV: 0, rev: false, revT: 0, thr: 0, brk: 0, rpm: 800 });
      this.active = true; this.road = true; this.frozen = false; crash = null; this.auto = null; this.camFix = null; this.fogFar = 0;
      this.lightsOff = !!o.engineOff;
      cam.ready = false; cam.shake = 0;
      G.Road.update(0, car.z, true);          // (lo de alrededor, ya: detrás de la pantalla de carga)
      place(0);
      if (!Snd.n && !o.engineOff) Snd.start();
    },
    get scene() { return roadScene; },
    get model() { return model; },
    // arrancar (después del puente): el motor, los faros y el HUD
    engineOn() {
      this.lightsOff = false;
      Snd.start();
      if (hud) hud.classList.remove('hidden');
    },
    begin(o) {
      buildHud();
      if (!(o && o.hud === false)) hud.classList.remove('hidden');
      hud.classList.toggle('dh-touch', !!(G.Input && G.Input.isTouch));
      document.body.classList.add('driving');
      if (!keysOn) { window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); keysOn = true; }
      for (const k in keys) keys[k] = false;
      touch.gas = touch.brake = false; touch.sid = null; touch.steer = 0;
      if (G.Camera) G.Camera.held = true;
      if (!(o && o.engineOff)) Snd.start();
      place(0);
    },
    hint(text, sec) {
      if (!hud) return;
      const h = hud.querySelector('.dh-hint');
      h.textContent = text; h.classList.add('in'); hintT = sec || 5;
    },
    // el choque en el cruce de z: onWarn (sale el otro coche), onCut (la imagen se corta)
    armCrash(z, onWarn, onCut) { crash = { state: 'armed', z, onWarn, onCut }; },
    update(dt) {
      if (!this.active) return;
      T += dt;
      if (crash && crash.state === 'hit') { stepCrash(dt); updateCam(dt); updateHud(); return; }
      const inp = this.frozen ? { gas: 0, brk: 1, st: 0, hold: true } : (this.auto ? autoInput() : readInput());
      physics(dt, inp);
      if (crash) stepCrash(dt);
      place(dt);
      updateCam(dt);
      updateHud();
      Snd.update(car.rpm, car.thr, Math.abs(car.v), car.slip);
      if (this.road) {
        G.Road.update(dt, car.z, false);
        // (los resplandores del horizonte, dentro de lo que se dibuja según la calidad)
        const k = Math.min(1, ((camera && camera.far) || 95) / 95);
        for (const g of glows) g.g.position.set(car.x + g.x * k, g.y * k, car.z + g.z * k);
      } else if (onExit && car.x > 61.2) {
        // fuera del garaje (por el portón): lo demás lo lleva la historia (a negro y la carga)
        const f = onExit; onExit = null; f();
      }
    },
    paused(p) { if (p !== this._paused) { this._paused = p; Snd.mute(p); } },
    render(renderer) {
      if (!roadScene || !camera) return;
      // la niebla acaba antes de donde se deja de dibujar (calidad baja: más cerca), que no se vea el corte
      const far = this.fogFar || Math.min(72, (camera.far || 95) - 4);
      if (roadScene.fog.far !== far) { roadScene.fog.far = far; roadScene.fog.near = Math.min(10, far * 0.2); }
      if (G.Flash) G.Flash.render(renderer, roadScene, null);
      renderer.render(roadScene, camera);
    },
    // todo fuera: el coche, la escena de la calle, el sonido, el HUD y los faros
    stop(quiet) {
      Snd.stop(quiet);
      if (model) disposeCar(model);
      if (other) disposeCar(other);
      model = null; other = null; crash = null;
      if (roadScene) { G.Road.clear(); roadScene = null; }
      if (hud) hud.classList.add('hidden');
      document.body.classList.remove('driving');
      if (G.Flash && G.Flash.external) G.Flash.external(null);
      if (this.active && G.Camera) { G.Camera.held = false; G.Camera.fovOff = 0; }
      this.active = false; this.road = false; this.frozen = false; this.auto = null; this.camFix = null; this.fogFar = 0; this.lightsOff = false;
      if (camera && camera._far0) { camera.far = camera._far0; camera._far0 = null; if (camera.updateProjectionMatrix) camera.updateProjectionMatrix(); }
      for (const k in keys) keys[k] = false;
    },
    Snd
  };
  G.Drive = D;
})(window.Game = window.Game || {});
