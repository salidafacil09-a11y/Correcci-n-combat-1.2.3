(function (G) {
  'use strict';

  // Ciclo de día y noche y clima de los mapas (todos menos el del jefe final y el refugio).
  //
  // La hora avanza sola (un día entero dura DAY_LEN segundos) y cada enfrentamiento empieza a una hora al azar;
  // el clima se elige al empezar cada enfrentamiento según el mapa y dura hasta el final (la nieve, solo en el
  // supermercado). Cada fotograma se
  // recalcula la luz a partir de la del mapa (su «mood»): el cielo, el sol (y la luna), la luz ambiente y la
  // niebla. Los enemigos lo notan: de noche los infectados ven peor pero oyen más y salen más (los acechadores ya
  // no se esconden del sol); de día, contra los Escorpiones, vienen más; la lluvia tapa los ruidos y la niebla
  // la vista (ver sight/hear y G.Mode).
  //
  // Con la calidad «Muy alta», partículas en el aire alrededor de la cámara: polvo, arena, polvo que levanta
  // el viento, hojas secas, hojas, lluvia y nieve.
  const U = G.Util;
  const DAY_LEN = 720;                 // segundos por día (12 minutos)
  const BLEND = 18;                    // segundos que tarda en cambiar

  // climas posibles de cada mapa (los repetidos salen más)
  const CLIMA = {
    terminal: ['despejado', 'despejado', 'nublado', 'lluvia', 'niebla', 'viento'],
    barrio: ['nublado', 'nublado', 'lluvia', 'niebla', 'despejado'],
    barrio_completo: ['nublado', 'nublado', 'lluvia', 'niebla', 'despejado'],
    comisaria_2020: ['nublado'],          // (el prólogo: Seattle, una mañana de octubre)
    servicio: ['despejado', 'nublado', 'lluvia', 'viento', 'niebla'],
    super: ['nieve', 'nieve', 'nublado', 'ventisca'],
    playa: ['despejado', 'despejado', 'viento', 'nublado', 'lluvia'],
    oceanside: ['despejado', 'niebla', 'niebla', 'nublado', 'viento', 'despejado'],      // (la bruma del mar, por las mañanas)
    capitolio: ['despejado', 'despejado', 'viento', 'nublado', 'niebla']
  };
  // sun: luz del sol · sky: color del cielo y cuánto se mezcla · fog: niebla (menos = más cerca) ·
  // sight/hear: cuánto ven y oyen los enemigos · acc: puntería de los humanos · part: partículas
  const WX = {
    despejado: { label: 'Despejado', sun: 1, hemi: 1, sky: [0xffffff, 0], fog: 1, sight: 1, hear: 1, acc: 1, part: null },
    nublado: { label: 'Nublado', sun: 0.5, hemi: 0.9, sky: [0x8c9094, 0.45], fog: 0.9, sight: 0.95, hear: 1, acc: 1, part: null },
    lluvia: { label: 'Lluvia', sun: 0.28, hemi: 0.78, sky: [0x5c636a, 0.62], fog: 0.66, sight: 0.75, hear: 0.62, acc: 0.85, part: 'lluvia', on: 'Empieza a llover: tapa los ruidos (y te oyen menos)' },
    niebla: { label: 'Niebla', sun: 0.4, hemi: 0.95, sky: [0xb4b8b4, 0.72], fog: 0.42, sight: 0.55, hear: 1, acc: 0.8, part: null, on: 'Entra la niebla: casi no se ve nada a lo lejos' },
    viento: { label: 'Viento', sun: 0.9, hemi: 1, sky: [0xc8b49a, 0.22], fog: 0.82, sight: 0.9, hear: 0.78, acc: 0.88, part: 'viento', on: 'Se levanta viento' },
    nieve: { label: 'Nieve', sun: 0.5, hemi: 0.95, sky: [0xd2d8de, 0.5], fog: 0.75, sight: 0.85, hear: 0.9, acc: 0.95, part: 'nieve' },
    // tormenta seca (solo la pide un enfrentamiento: la noche de la última liberación): relámpagos y truenos, sin lluvia
    tormenta: { label: 'Tormenta', sun: 0.15, hemi: 0.7, sky: [0x3c434c, 0.75], fog: 0.62, sight: 0.7, hear: 0.75, acc: 0.85, part: null, storm: true },
    ventisca: { label: 'Ventisca', sun: 0.3, hemi: 0.9, sky: [0xe2e6ea, 0.7], fog: 0.5, sight: 0.6, hear: 0.7, acc: 0.8, part: 'nieve', heavy: true, on: 'Ventisca: no se ve a dos pasos' }
  };
  const NIGHT_SKY = 0x0b1120, DUSK = 0xf09a62, MOON = 0x9fb4e6, NIGHT_HEMI = 0x7c90c4;

  const C = (h) => new THREE.Color(h);
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();
  let active = false, layout = null;
  let hour = 12, wx = 'despejado', prevWx = 'despejado', blend = 1, hourFixed = false;   // (hourFixed: la hora no avanza)
  let base = null;                     // la luz del mapa: { sky, hemi, hemiG, hemiI, sun, sunI }
  let fogBase = { near: 16, far: 58 };
  let wasNight = null;
  let night = 0;                       // 0 de día, 1 de noche (con el amanecer y el atardecer en medio)
  let cache = { sight: 1, hear: 1, acc: 1, fog: 1 };
  let fill = null;                     // de noche, una luz suave alrededor (los ojos que se acostumbran)
  let inner = false;                   // mapa cerrado (sin cielo) con sus partículas
  // relámpagos (con tormenta): cuánto falta para el próximo, el destello que se apaga y el trueno que llega después
  const bolt = { t: 3, k: 0, seq: [], thunder: -1, near: 0.5 };

  // ---- hora ----
  function dayK(h) {
    // 0 de noche, 1 de día: amanece de 5:30 a 7:00 y anochece de 18:45 a 20:15
    if (h < 5.5 || h > 20.25) return 0;
    if (h < 7) return U.smooth((h - 5.5) / 1.5);
    if (h > 18.75) return U.smooth(1 - (h - 18.75) / 1.5);
    return 1;
  }
  function goldK(h) { return Math.max(0, 1 - Math.abs(h - 6.6) / 1.3, 1 - Math.abs(h - 19.2) / 1.3); }
  const pickWx = (list, not) => { let w; for (let i = 0; i < 6; i++) { w = list[Math.floor(Math.random() * list.length)]; if (w !== not) break; } return w; };

  // ---- La bóveda del cielo ----
  // Una esfera alrededor de la cámara: del color de la niebla en el horizonte (así lo lejano se funde con él) a
  // un cénit más hondo, con el resplandor del sol, nubes que pasan despacio (más con mal tiempo) y, de noche,
  // estrellas. Va detrás de todo (sin profundidad) y no tiene niebla
  const DOME_V = [
    'varying vec3 vDir;',
    'void main() {',
    '  vDir = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'].join('\n');
  const DOME_F = [
    'uniform vec3 uHor; uniform vec3 uZen; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uCloud; uniform vec3 uCloudLit;',
    'uniform float uGlow; uniform float uCover; uniform float uTime; uniform float uStars;',
    'varying vec3 vDir;',
    'float dh( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }',
    'float dn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );',
    '  return mix( mix( dh( i ), dh( i + vec2( 1.0, 0.0 ) ), f.x ), mix( dh( i + vec2( 0.0, 1.0 ) ), dh( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }',
    'void main() {',
    '  vec3 d = normalize( vDir );',
    '  float h = d.y;',
    '  float t = smoothstep( 0.0, 0.62, h );',
    '  vec3 col = mix( uHor, uZen, pow( t, 0.75 ) );',
    // bruma: una franja algo más clara justo encima del horizonte
    '  col = mix( col, uHor * 1.06, exp( - max( h, 0.0 ) * 9.0 ) * 0.5 );',
    // el sol: halo ancho, resplandor y disco (detrás de las nubes)
    '  float sd = max( dot( d, uSunDir ), 0.0 );',
    '  col += uSunCol * ( pow( sd, 6.0 ) * 0.16 + pow( sd, 48.0 ) * 0.35 + smoothstep( 0.9993, 0.9997, sd ) * 1.6 ) * uGlow;',
    // nubes: ruido proyectado sobre una cúpula plana, se mueven con el tiempo
    '  if ( h > 0.0 ) {',
    '    vec2 cp = d.xz / ( h + 0.12 ) * 1.6 + vec2( uTime * 0.012, uTime * 0.004 );',
    '    float n = dn( cp ) * 0.55 + dn( cp * 2.3 + 5.1 ) * 0.28 + dn( cp * 5.2 + 1.7 ) * 0.17;',
    '    float c = smoothstep( 1.0 - uCover - 0.18, 1.0 - uCover + 0.32, n ) * smoothstep( 0.0, 0.22, h );',
    '    float lit = pow( max( dot( d, uSunDir ), 0.0 ), 3.0 );',
    '    vec3 cc = mix( uCloud, uCloudLit, 0.35 + 0.65 * lit );',
    '    col = mix( col, cc, c * 0.85 );',
    // estrellas (de noche, donde no hay nubes)
    '    vec2 sp = d.xz / ( h + 0.35 ) * 90.0;',
    '    float st = step( 0.9965, dh( floor( sp ) ) ) * ( 1.0 - c ) * smoothstep( 0.05, 0.4, h );',
    '    col += vec3( 0.75, 0.8, 0.95 ) * st * uStars;',
    '  }',
    '  gl_FragColor = vec4( col, 1.0 );',
    '}'].join('\n');
  const Dome = {
    mesh: null, u: null,
    make() {
      const u = {
        uHor: { value: new THREE.Color() }, uZen: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
        uCloud: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uGlow: { value: 1 }, uCover: { value: 0.3 }, uTime: { value: 0 }, uStars: { value: 0 }
      };
      const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: DOME_V, fragmentShader: DOME_F, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
      mesh.frustumCulled = false; mesh.renderOrder = -20;
      Dome.mesh = mesh; Dome.u = u;
    },
    show(scene, on) {
      if (on && !Dome.mesh) Dome.make();
      if (!Dome.mesh) return;
      if (on && Dome.mesh.parent !== scene) scene.add(Dome.mesh);
      Dome.mesh.visible = !!on;
    }
  };
  const tmpC = new THREE.Color(), tmpD = new THREE.Color(), tmpV = new THREE.Vector3();

  const Sky = {
    // 0-1: dentro de un edificio con la luz encendida (la estación en 2020): la luz ambiente pasa a ser la de los
    // fluorescentes, cálida y alta, y la niebla de la noche se aleja (lo pone main.js cada fotograma)
    indoorLit: 0,
    // la luz de relleno de la noche, desde el principio (apagada): ver setFill
    init(scene) { setFill(0, scene); },
    DAY_LEN, WX, CLIMA,
    get active() { return active; },
    get hour() { return hour; },
    get weather() { return wx; },
    get night() { return active && night > 0.5; },
    get nightK() { return active ? night : 0; },
    get label() { return active ? (WX[wx].label + ' · ' + Sky.clock()) : ''; },
    onMessage: null,
    clock() { const h = Math.floor(hour), m = Math.floor((hour - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; },

    // Al cambiar de mapa (setLighting): la luz del mapa como base, hora y clima nuevos
    reset(id, mood) {
      const m = G.Maps && G.Maps.get(id);
      active = !!(m && !m.boss && mood);
      layout = id;
      wasNight = null;
      // (interiores sin cielo: sin hora ni clima, pero con sus partículas en la calidad más alta)
      inner = !!(m && m.interior);
      if (!active) { base = null; Particles.clear(); setFill(0); if (Dome.mesh) Dome.mesh.visible = false; if (inner) Particles.setup(id); return; }
      base = { sky: C(mood.sky), hemi: C(mood.hemi[0]), hemiG: C(mood.hemi[1]), hemiI: mood.hemi[2], sun: C(mood.sun[0]), sunI: mood.sun[1] };
      // hora: casi siempre de día (desde media mañana a la tarde); una de cada cuatro, de noche o al caer
      const r = Math.random();
      hour = r < 0.72 ? 8 + Math.random() * 9.5 : (r < 0.86 ? 18.2 + Math.random() * 1.4 : (Math.random() < 0.5 ? 21 + Math.random() * 3 : Math.random() * 4.5));
      if (m && m.hour != null) hour = m.hour;          // (mapas con la hora fija: el prólogo del modo historia)
      hourFixed = !!(m && m.hourFixed);
      const list = CLIMA[id] || ['despejado', 'nublado'];
      wx = prevWx = pickWx(list); blend = 1;
      night = 1 - dayK(hour);
      Particles.setup(id);
    },
    // para pruebas: fijar la hora y el clima
    set(h, w) { if (h != null) hour = ((h % 24) + 24) % 24; if (w && WX[w]) { prevWx = wx = w; blend = 1; } night = 1 - dayK(hour); wasNight = null; Particles.snap = true; },
    setFogBase(n, f) { fogBase = { near: n, far: f }; },

    update(dt) {
      if (!active) return;
      if (!hourFixed) hour = (hour + dt * 24 / DAY_LEN) % 24;
      night = 1 - dayK(hour);
      if (blend < 1) blend = Math.min(1, blend + dt / BLEND);
      // tormenta: cada pocos segundos un relámpago (dos o tres destellos seguidos) y, al rato, el trueno
      if (WX[wx].storm) {
        bolt.t -= dt;
        if (bolt.t <= 0) {
          bolt.t = 5 + Math.random() * 9;
          bolt.near = Math.random();
          bolt.seq = [0, 0.09 + Math.random() * 0.05, Math.random() < 0.6 ? 0.26 + Math.random() * 0.1 : -1].filter((x) => x >= 0).map((x) => ({ at: x, done: false }));
          bolt.el = 0;
          bolt.thunder = 0.35 + (1 - bolt.near) * 2.2;
        }
        if (bolt.seq.length) {
          bolt.el += dt;
          for (const q of bolt.seq) if (!q.done && bolt.el >= q.at) { q.done = true; bolt.k = 0.6 + bolt.near * 0.4; }
          if (bolt.seq.every((q) => q.done)) bolt.seq = [];
        }
        if (bolt.thunder >= 0) { bolt.thunder -= dt; if (bolt.thunder < 0 && G.Audio) G.Audio.play('thunder', { k: bolt.near }); }
      }
      bolt.k = Math.max(0, bolt.k - dt * 7);
      // (el clima no cambia en medio del enfrentamiento: el que toca al empezar dura hasta el final)
      const isN = night > 0.5;
      if (wasNight !== null && isN !== wasNight && Sky.onMessage) {
        Sky.onMessage(isN ? 'Anochece: salen más infectados' : 'Amanece');
      }
      wasNight = isN;
    },

    // ---- mezcla de los dos climas (el que se va y el que llega) ----
    mixWx(k) { const a = WX[prevWx][k], b = WX[wx][k]; return a + (b - a) * blend; },

    // Cada fotograma, después de la luz del mapa: cielo, sol, luna, ambiente y niebla
    apply(o) {
      if (!active || !base) return;
      const day = 1 - night, gold = goldK(hour) * (1 - night * 0.5);
      const sunW = Sky.mixWx('sun'), hemiW = Sky.mixWx('hemi'), fogW = Sky.mixWx('fog');
      // el cielo: el del mapa, con el clima, el tono del amanecer o atardecer y la noche
      const skyOf = (w) => tmpA.copy(base.sky).lerp(C(WX[w].sky[0]), WX[w].sky[1]);
      const sky = skyOf(prevWx).clone().lerp(skyOf(wx), blend);
      sky.lerp(tmpB.setHex(DUSK), gold * 0.32 * Math.max(0.3, sunW));
      sky.lerp(tmpB.setHex(NIGHT_SKY), night * 0.9);
      // (el cielo y la niebla, algo más claros que el color «lineal» exacto: la bruma del aire se ve luminosa y lo
      // lejano se aclara, como en la realidad)
      o.scene.background.setRGB(Math.pow(sky.r, 1.75), Math.pow(sky.g, 1.75), Math.pow(sky.b, 1.75));
      // el horizonte (montes, edificios lejanos): más oscuro de noche y del color del cielo con mal tiempo
      if (G.Maps && G.Maps.skyTint) {
        const wmix = WX[prevWx].sky[1] + (WX[wx].sky[1] - WX[prevWx].sky[1]) * blend;
        // (lejos, la bruma se los come casi del todo: si no, el horizonte se ve más oscuro que lo que está más cerca)
        G.Maps.skyTint((0.25 + 0.75 * day) * (0.75 + 0.25 * sunW), tmpB.copy(sky), Math.min(0.9, 0.55 + wmix * 0.35 + night * 0.2), o.scene.fog ? o.scene.fog.color : null);
      }
      if (o.scene.fog) {
        o.scene.fog.color.copy(o.scene.background);
        const fk = fogW * (1 - night * 0.38);
        o.scene.fog.near = fogBase.near * Math.max(0.35, fk); o.scene.fog.far = fogBase.far * fk;
      }
      // luz ambiente: más azul y más baja de noche (pero se ve: la luna)
      o.hemi.color.copy(base.hemi).lerp(tmpB.setHex(NIGHT_HEMI), night * 0.7);
      o.hemi.groundColor.copy(base.hemiG).multiplyScalar(1 - night * 0.6);
      o.hemi.intensity = base.hemiI * hemiW * (0.36 + 0.64 * day);
      // el sol (o la luna): de día con el clima; al amanecer y atardecer, cálido; de noche, la luna fría
      o.sun.color.copy(base.sun).lerp(tmpB.setHex(DUSK), gold * 0.4).lerp(tmpB.setHex(MOON), night);
      o.sun.intensity = base.sunI * sunW * day + night * 0.2 * (0.5 + sunW * 0.5);
      // el relámpago: todo blanco azulado un instante
      if (bolt.k > 0.01) {
        o.hemi.intensity += bolt.k * 1.4;
        o.sun.color.lerp(tmpB.setHex(0xdfe8ff), bolt.k); o.sun.intensity += bolt.k * 2.4;
        o.scene.background.lerp(tmpB.setHex(0x6a7898).convertSRGBToLinear(), bolt.k * 0.6);
        if (o.scene.fog) o.scene.fog.color.copy(o.scene.background);
      }
      // dentro, con la luz encendida
      const il = Sky.indoorLit || 0;
      if (il > 0.001) {
        o.hemi.color.lerp(tmpB.setHex(0xfff0dc), il);
        o.hemi.groundColor.lerp(tmpB.setHex(0x8a7c68), il);
        o.hemi.intensity += (1.0 - o.hemi.intensity) * il;
        o.sun.intensity *= 1 - il * 0.6;
        if (o.scene.fog) {
          o.scene.fog.near *= 1 + il * 1.4; o.scene.fog.far *= 1 + il * 1.4;
          o.scene.fog.color.lerp(tmpB.setHex(0x3a3732).convertSRGBToLinear(), il * 0.6);
        }
      }
      // la bóveda: el horizonte, del color de la niebla; el cénit, más hondo (azulado con el cielo limpio, gris con
      // nubes; casi negro de noche); el sol y las nubes
      {
        Dome.show(o.scene, true);
        const u = Dome.u, wmix = WX[prevWx].sky[1] + (WX[wx].sky[1] - WX[prevWx].sky[1]) * blend;
        const hor = o.scene.fog ? o.scene.fog.color : o.scene.background;
        u.uHor.value.copy(hor);
        const clear = 1 - Math.min(1, wmix * 1.4);
        tmpC.setRGB(0.6, 0.78, 1.08).lerp(tmpD.setRGB(0.88, 0.9, 0.93), 1 - clear);
        u.uZen.value.copy(hor).multiply(tmpC).multiplyScalar(0.96 - 0.06 * clear).lerp(tmpD.setHex(0x05070e), night * 0.6);
        // (el sol que se ve: sale y se pone en el horizonte, aunque la luz de las sombras venga siempre de algo
        // más arriba)
        const so = Sky.sunOffset(), hz = Math.hypot(so[0], so[2]) || 1;
        const el = night > 0.5 ? 0.6 : Math.max(-0.08, Math.sin(Math.PI * U.clamp((hour - 6.1) / 13.4, 0, 1))) * 1.05;
        tmpV.set(so[0] / hz * Math.cos(el), Math.sin(el), so[2] / hz * Math.cos(el)).normalize();
        u.uSunDir.value.copy(tmpV);
        u.uSunCol.value.copy(o.sun.color).multiplyScalar(day > 0.5 ? 1 : 0.35);
        u.uGlow.value = (day * (0.25 + 0.75 * clear) * Math.min(1, sunW * 1.3) + gold * 0.6) * (1 - night * 0.7);
        u.uCover.value = Math.min(0.95, 0.22 + wmix * 0.95);
        // nubes: con buen tiempo, blancas y luminosas (algo grises por debajo); cubierto, un gris algo más oscuro
        u.uCloud.value.copy(hor).multiplyScalar(0.86 + 0.24 * clear * day);
        u.uCloudLit.value.copy(hor).lerp(tmpD.copy(o.sun.color).multiplyScalar(0.7 + 0.3 * day), 0.5 * clear * day + gold * 0.4).multiplyScalar(1.0 + 0.35 * clear * day);
        u.uStars.value = night * night * (1 - Math.min(1, wmix * 1.2));
      }
      // de noche, una luz suave alrededor de la cámara
      setFill(night * (0.55 + (1 - hemiW) * 0.3), o.scene, o.at);
      cache = { sight: Sky.mixWx('sight'), hear: Sky.mixWx('hear'), acc: Sky.mixWx('acc'), fog: fogW };
    },
    // de dónde viene la luz (para el sol del juego): gira con la hora; de noche, la luna del otro lado
    sunOffset() {
      if (!active) return [-16, 32, 11];
      const day = night < 0.5;
      const t = day ? U.clamp((hour - 5.5) / 14.75, 0, 1) : ((hour + 24 - 20.25) % 24) / 9.25;
      const a = (t - 0.5) * 2.0;                 // de -1 rad (mañana) a +1 (tarde)
      const elev = 34 - Math.abs(a) * 12;
      return [Math.sin(a) * 26 * (day ? -1 : 1), elev, 11 + Math.cos(a) * 4];
    },

    // ---- lo que notan los enemigos ----
    // cuánto ven: zombis de noche algo menos (se guían por el oído); los humanos, bastante menos
    sight(human) {
      if (!active) return 1;
      const nk = human ? 1 - night * 0.42 : 1 - night * 0.2;
      return cache.sight * nk;
    },
    // cuánto oyen: la lluvia y el viento tapan los ruidos; de noche, los infectados oyen más
    hear(human) {
      if (!active) return 1;
      return cache.hear * (human ? 1 : 1 + night * 0.25);
    },
    // puntería de los humanos (lluvia, niebla, viento; de noche, peor)
    acc() { return active ? cache.acc * (1 - night * 0.18) : 1; },
    // cuántos enemigos más: de noche, infectados; de día, Escorpiones
    enemyMul(humans) {
      if (!active) return 1;
      if (humans) return night < 0.5 ? 1.2 : 1;
      return night >= 0.5 ? 1.3 : 1;
    },
    // de noche los infectados se mueven algo más (más activos); con nieve o lluvia fuerte, algo menos
    speedMul() {
      if (!active) return 1;
      const w = WX[wx];
      return (1 + night * 0.08) * (w.part === 'nieve' ? (w.heavy ? 0.9 : 0.95) : 1);
    },

    update3d(dt, camera, target) {
      // la bóveda va con la cámara (dentro de su distancia de dibujo)
      if (Dome.mesh && Dome.mesh.visible && camera) {
        Dome.mesh.position.copy(camera.position);
        Dome.mesh.scale.setScalar(camera.far * 0.9);
        Dome.u.uTime.value += dt;
      }
      if (active || inner) Particles.update(dt, camera, target, Sky);
    }
  };

  function setFill(k, scene, at) {
    // (se crea de una vez, aunque sea de día: una luz nueva en mitad del juego obliga a recompilar todos los
    // materiales, y eso da un tirón al caer la noche)
    if (!fill && scene) {
      fill = new THREE.PointLight(0x9ab0e0, 0, 9, 1.6);
      scene.add(fill);
    }
    if (!fill) return;
    if (scene && fill.parent !== scene) scene.add(fill);
    fill.intensity = k * 0.9;
    fill.visible = k > 0.01;
    if (at) fill.position.set(at.x, at.y + 2.6, at.z);
  }

  // =====================================================================================================
  // Partículas (calidad «Muy alta»): capas de puntos alrededor de la cámara que se reciclan al salir de la caja
  // =====================================================================================================
  const BOX = 15, TOP = 11;
  let dotTex = null, leafTex = null;
  function texDot() {
    if (dotTex) return dotTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const x = cv.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    dotTex = new THREE.CanvasTexture(cv);
    return dotTex;
  }
  function texLeaf() {
    if (leafTex) return leafTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(16, 16, 13, 7, 0.6, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(6, 23); x.lineTo(26, 9); x.stroke();
    leafTex = new THREE.CanvasTexture(cv);
    return leafTex;
  }

  // tipos de capa: n (cuántas), size, colores, caída (vy), viento (cuánto las arrastra), vaivén, altura, opacidad
  const KIND = {
    polvo: { n: 260, size: 0.07, cols: [0xfff2d8, 0xe8dcc4], vy: [-0.05, 0.05], drift: 0.25, sway: 0.25, h: [0.2, 5], op: 0.55 },
    arena: { n: 420, size: 0.065, cols: [0xe0c49a, 0xd4b48a, 0xc8a87c], vy: [-0.2, 0.15], drift: 2.2, sway: 0.4, h: [0, 1.4], op: 0.75 },
    viento: { n: 520, size: 0.08, cols: [0xc8b498, 0xb4a084, 0xd8c8b0], vy: [-0.3, 0.3], drift: 6.5, sway: 0.8, h: [0, 4], op: 0.6 },
    hojas_secas: { n: 70, size: 0.3, cols: [0xb4642a, 0xc88a3a, 0x8a4a22, 0xd4a040], vy: [-0.9, -0.45], drift: 0.9, sway: 1.2, h: [0, 9], op: 1, leaf: true },
    hojas: { n: 50, size: 0.26, cols: [0x6a8a3a, 0x8aa04a, 0xb4a040], vy: [-0.8, -0.4], drift: 0.8, sway: 1.1, h: [0, 9], op: 1, leaf: true },
    nieve: { n: 1600, size: 0.12, cols: [0xffffff, 0xf0f4f8], vy: [-1.4, -0.8], drift: 1.1, sway: 0.5, h: [0, 11], op: 0.95 },
    lluvia: { n: 1100, rain: true, cols: [0xb8c4d0], vy: [-17, -14], drift: 1.2, h: [0, 11], op: 0.42 },
    tormenta: { n: 1800, rain: true, cols: [0xc0ccd8], vy: [-23, -19], drift: 2.8, h: [0, 11], op: 0.5 },
    // interiores cerrados (la estación de policía): polvo suspendido, gris y quieto, y esporas del hongo (pardas y
    // anaranjadas, algo más grandes) que flotan despacio y suben con el aire
    polvo_int: { n: 320, size: 0.05, cols: [0xb8b4a8, 0x9c988c, 0xd0ccc0], vy: [-0.03, 0.03], drift: 0.05, sway: 0.12, h: [0.1, 3.4], op: 0.5 },
    // copos de polvo y ceniza que caen despacio, dando vueltas (como las hojas, pero grises)
    polvo_caida: { n: 110, size: 0.14, cols: [0x8a8880, 0x6e6c66, 0xa8a49a], vy: [-0.32, -0.12], drift: 0.08, sway: 0.7, h: [0, 3.5], op: 0.9, leaf: true },
    esporas: { n: 150, size: 0.1, cols: [0xd8954a, 0xc87a3a, 0xe8b070, 0xb86a30], vy: [0.03, 0.14], drift: 0.04, sway: 0.3, h: [0.05, 3.3], op: 0.75 }
  };
  // qué capas lleva cada mapa siempre (y las del clima se suman)
  const AMB = {
    comisaria: ['polvo_int', 'esporas', 'polvo_caida'], comisaria_2020: ['hojas'], terminal: ['polvo'], barrio: ['polvo', 'hojas'], barrio_completo: ['polvo', 'hojas'], servicio: ['polvo', 'hojas'],
    super: ['polvo', 'nieve'], playa: ['polvo', 'arena', 'hojas_secas'], oceanside: ['polvo', 'arena'], capitolio: ['polvo', 'hojas_secas']
  };

  // lo que cae del cielo (lluvia, nieve, hojas, arena) no entra en los edificios: se corta sobre los techos
  const OUTDOOR = { lluvia: 1, tormenta: 1, nieve: 1, hojas: 1, hojas_secas: 1, arena: 1, viento: 1 };
  const CG = 2 * BOX + 4;                                   // rejilla de casillas techadas alrededor de la cámara
  const cover = { grid: new Uint8Array(CG * CG), x0: 1e9, z0: 1e9, map: null };
  function refreshCover(cx, cz, mapId) {
    const x0 = Math.floor(cx) - (CG >> 1), z0 = Math.floor(cz) - (CG >> 1);
    if (Math.abs(x0 - cover.x0) < 3 && Math.abs(z0 - cover.z0) < 3 && cover.map === mapId) return;
    cover.x0 = x0; cover.z0 = z0; cover.map = mapId;
    const W = G.World;
    for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) {
      let v = 0;
      try { v = W && W.bldAt && W.bldAt(x0 + i, z0 + j, 0) ? 1 : 0; } catch (e) { v = 0; }
      cover.grid[j * CG + i] = v;
    }
  }
  function covered(x, z) {
    const i = Math.floor(x) - cover.x0, j = Math.floor(z) - cover.z0;
    return i >= 0 && j >= 0 && i < CG && j < CG && cover.grid[j * CG + i] === 1;
  }

  const Particles = {
    layers: [], group: null, mapId: null,
    on() { return !!(G.Quality && G.Quality.cur && G.Quality.cur.particles); },
    clear() {
      for (const L of this.layers) { L.obj.geometry.dispose(); L.obj.material.dispose(); if (L.obj.parent) L.obj.parent.remove(L.obj); }
      this.layers = [];
    },
    setup(id) { this.clear(); this.mapId = id; cover.map = null; },
    layer(kind, scene) {
      const K = KIND[kind], n = K.n;
      const pos = new Float32Array(n * (K.rain ? 6 : 3)), col = new Float32Array(n * (K.rain ? 6 : 3));
      const vel = new Float32Array(n * 3), ph = new Float32Array(n);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.setHex(K.cols[i % K.cols.length]);
        const reps = K.rain ? 2 : 1;
        for (let r = 0; r < reps; r++) { const k = (i * reps + r) * 3; col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
        vel[i * 3] = (Math.random() - 0.5) * 0.3; vel[i * 3 + 1] = K.vy[0] + Math.random() * (K.vy[1] - K.vy[0]); vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        ph[i] = Math.random() * 100;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      let obj;
      if (K.rain) {
        obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: K.op, depthWrite: false, fog: true }));
      } else {
        obj = new THREE.Points(geo, new THREE.PointsMaterial({ size: K.size, map: K.leaf ? texLeaf() : texDot(), vertexColors: true, transparent: true, opacity: K.op, depthWrite: false, sizeAttenuation: true, alphaTest: K.leaf ? 0.4 : 0.02 }));
      }
      obj.frustumCulled = false; obj.renderOrder = 5;
      scene.add(obj);
      const L = { kind, K, obj, pos, vel, ph, n, init: false, k: 0 };
      this.layers.push(L);
      return L;
    },
    // las capas que tocan ahora (las del mapa y las del clima), con cuánto se ven (k: 0 a 1)
    wanted(S) {
      const want = {};
      for (const k of AMB[this.mapId] || ['polvo']) want[k] = 1;
      if (!S.active) return want;            // (interiores: sin clima)
      const add = (w, f) => {
        const p = WX[w].part; if (!p || f <= 0) return;
        if (p === 'viento') { want.viento = Math.max(want.viento || 0, f); if (want.arena) want.arena = 1; want.hojas_secas = want.hojas_secas ? 1 : 0; if (this.mapId !== 'playa' && this.mapId !== 'super') want.hojas = Math.max(want.hojas || 0, f); }
        else want[WX[w].storm ? 'tormenta' : p] = Math.max(want[WX[w].storm ? 'tormenta' : p] || 0, f * (WX[w].heavy ? 1 : 0.75));
      };
      add(S.WXprev(), 1 - S.blendK()); add(S.WXcur(), S.blendK());
      // con lluvia, menos polvo y arena; con nieve en el súper, la base siempre
      if (want.tormenta) delete want.lluvia;
      const wet = Math.max(want.lluvia || 0, want.tormenta || 0);
      if (wet) { if (want.polvo) want.polvo *= 1 - wet * 0.8; if (want.arena) want.arena *= 1 - wet * 0.9; }
      return want;
    },
    update(dt, camera, target, S) {
      if (!this.on()) { if (this.layers.length) this.clear(); return; }
      const scene = target.scene;
      const want = this.wanted(S);
      for (const k in want) if (want[k] > 0.01 && !this.layers.some((L) => L.kind === k)) this.layer(k, scene);
      const wind = !S.active ? 0 : S.WXcur() === 'viento' || S.WXcur() === 'ventisca' ? 1 : (S.WXcur() === 'lluvia' ? 0.5 : 0.25);
      const wx = 0.8 * wind, wz = 0.35 * wind;          // de dónde sopla
      const cx = target.x, cz = target.z, cy = target.y;
      const t = performance.now() / 1000;
      refreshCover(cx, cz, this.mapId);
      for (const L of this.layers) {
        const K = L.K, want0 = want[L.kind] || 0;
        L.k = this.snap ? want0 : L.k + (want0 - L.k) * Math.min(1, dt * 0.6);
        L.obj.visible = L.k > 0.02;
        if (!L.obj.visible) continue;
        L.obj.material.opacity = K.op * Math.min(1, L.k * 1.2);
        const pos = L.pos, vel = L.vel, n = L.n;
        // cuántas se ven (las de más, al fondo bajo el suelo)
        const live = Math.floor(n * Math.min(1, L.k));
        const hy0 = K.h[0], hy1 = K.h[1];
        const st = K.rain ? 6 : 3;
        for (let i = 0; i < n; i++) {
          const p = i * st;
          let x = pos[p], y = pos[p + 1], z = pos[p + 2];
          if (!L.init || i >= live || Math.abs(x - cx) > BOX * 2 || Math.abs(z - cz) > BOX * 2 || Math.abs(y - cy) > 30) {     // (al empezar o tras un salto lejos)
            x = cx + (Math.random() * 2 - 1) * BOX; z = cz + (Math.random() * 2 - 1) * BOX;
            y = i >= live ? -50 : cy + hy0 + Math.random() * (hy1 - hy0);
          } else {
            const s = L.ph[i];
            const sw = K.sway ? Math.sin(t * 1.3 + s) * K.sway : 0;
            x += (vel[i * 3] + wx * K.drift + sw * 0.6) * dt;
            z += (vel[i * 3 + 2] + wz * K.drift + Math.cos(t * 1.1 + s) * (K.sway || 0) * 0.5) * dt;
            y += (vel[i * 3 + 1] + (K.drift > 2 ? Math.sin(t * 2 + s) * 0.4 : 0)) * dt;
            // fuera de la caja: vuelve por el otro lado (y arriba si cayó)
            if (x < cx - BOX) x += BOX * 2; else if (x > cx + BOX) x -= BOX * 2;
            if (z < cz - BOX) z += BOX * 2; else if (z > cz + BOX) z -= BOX * 2;
            if (y < cy + hy0 - 0.3 || y < cy - 2) { y = cy + hy1 - Math.random() * 1.5; if (hy1 < 3) y = cy + hy0 + Math.random() * (hy1 - hy0); }
            else if (y > cy + hy1 + 0.5) y = cy + hy0;
          }
          // bajo un techo no cae nada: se esconde (y vuelve a salir arriba, en otro sitio)
          if (OUTDOOR[L.kind] && y > -40 && covered(x, z)) y = -50;
          pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
          if (K.rain) { pos[p + 3] = x - (wx * K.drift) * 0.04; pos[p + 4] = y + 0.55; pos[p + 5] = z - (wz * K.drift) * 0.04; }
        }
        L.init = true;
        L.obj.geometry.attributes.position.needsUpdate = true;
      }
      this.snap = false;
    }
  };
  Sky.WXcur = () => wx;
  Sky.WXprev = () => prevWx;
  Sky.blendK = () => blend;
  Sky.Particles = Particles;

  G.Sky = Sky;
})(window.Game = window.Game || {});
