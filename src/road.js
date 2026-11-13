// La carretera de la noche del apagón (prólogo del modo historia): una avenida recta de Seattle que se arma por
// tramos delante del patrullero y se deshace detrás (no hay mapa entero cargado: unos 160 m a la vez). Cada tramo
// (SL m) se genera igual siempre que vuelva a hacer falta (semilla por tramo): calzada, aceras, coches aparcados,
// farolas apagadas, árboles, edificios (los bloques de pisos de los mapas, con las ventanas a oscuras) o casas con
// su jardín, y cada pocos tramos un cruce con su calle a los lados (cortada a lo lejos). Todo con colores por
// vértice (G.Mesher) y Lambert: así lo alumbran los faros (G.Flash, en modo faro). En una escena propia (la
// estación se descarga entera antes): la pinta G.Drive.
// Ejes: la avenida va a lo largo de +z, centrada en x = 0. El carril de ida (el del patrullero) es el de x < 0.
(function (G) {
  'use strict';
  const U = G.Util;

  // ---------- Medidas ----------
  const SL = 30;                 // largo de un tramo (m)
  const LANE = 3.6;              // carril (de 0 al borde del de aparcar)
  const CURB = 6.0;              // bordillo (fin del asfalto)
  const WALK = 9.2;              // fin de la acera (fachadas)
  const CROSS_W = 6.0;           // media calle transversal (asfalto)
  const CROSS_END = 44;          // hasta dónde se puede entrar en una calle transversal
  const BEHIND = 45, AHEAD = 120;      // lo que se tiene armado detrás y delante del coche (m)
  const BUDGET_MS = 7;           // tiempo por fotograma para armar tramos
  const isCross = (k) => ((k % 5) + 5) % 5 === 2;
  const crossZ = (k) => k * SL + SL / 2;
  // tipo de barrio por manzana (de casas, comercial o de pisos altos): según se va hacia el centro, más alto
  const blockOf = (k) => Math.floor((k + 2) / 5);
  function district(b) {
    const r = U.mulberry32(b * 7919 + 13)();
    if (b <= 0) return 'casas';
    if (b === 1) return r < 0.6 ? 'casas' : 'comercio';
    if (b <= 3) return r < 0.25 ? 'casas' : (r < 0.75 ? 'comercio' : 'pisos');
    return r < 0.15 ? 'comercio' : 'pisos';
  }

  // ---------- Colores ----------
  const ASPH = 0x1d1e21, ASPH2 = 0x232427, LINE_Y = 0xb89a3a, LINE_W = 0x9a9a94, WALKC = 0x55554f, CURBC = 0x6d6c66, DIRT = 0x1a1814;
  const GRASS = 0x24301f, HOUSE = [0x5d6a72, 0x6e6a5a, 0x4f5e52, 0x7a6e60, 0x5a4a44, 0x8a8478, 0x3e4a58, 0x6a5040];
  const CARS = [0x5a6a7a, 0x8a3a32, 0x2e3e5a, 0xb8b0a0, 0x3a3a3a, 0x6a5a3a, 0x4a5a6a, 0x7a7a72, 0x2a4a3a, 0x9a9a92, 0x1e2226, 0x5a2a2a];

  // ---------- Estado ----------
  let scene = null, matSolid = null, matGlow = null, glowTex = null, fireTex = null;
  const sectors = new Map();          // k -> { k, parts: [meshes], obs: [], blink: [], fires: [] }
  const queue = [];                   // tramos por armar: { k, step, ctx }
  let blinkOn = true, blinkT = 0, T = 0;
  // la segunda vez (la huida, prólogo): minK, el primer tramo (antes, el depósito: lo pone G.RoadLife); endK, el
  // cruce del final (la estación en llamas al otro lado: no sigue la avenida y la transversal llega lejos)
  let cfg = { minK: -1e9, endK: 1e9 };
  const extra = [];                   // obstáculos que no son de ningún tramo (la nave del depósito, la reja...)
  const CROSS_FAR = 130;              // la transversal del final: larga (por ahí se va el coche)
  const ceOf = (k) => (k === cfg.endK ? CROSS_FAR : CROSS_END);

  function fx(f) { return Object.assign({ lv: 0, y: 0, cont: null, solid: true }, f); }
  // un mueble del juego en el mesher (las mismas medidas y el mismo dibujo que en los mapas)
  function fput(m, type, x, z, fxv, fz, ex, obs) {
    const t = G.Furniture.T[type];
    if (!t) return null;
    const along = Math.abs(fz) > 0.5;
    const hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
    const f = fx(Object.assign({ type, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, h: t.h, fx: fxv, fz, seed: Math.floor(Math.random() * 1e9) }, ex || {}));
    G.Furniture.draw(m, f);
    // (lo que choca: los vehículos y lo que bloquea; lo fino, como círculo)
    if (obs && (t.block || t.vehicle) && !t.deco) {
      const w = f.x1 - f.x0, d = f.z1 - f.z0;
      if (Math.min(w, d) < 0.6) obs.push({ c: true, x, z, r: Math.max(0.18, Math.max(w, d) / 2) });
      else obs.push({ c: false, x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, car: !!t.vehicle });
    }
    return f;
  }

  // ---------- Piezas propias ----------
  // farola (apagada: no hay luz en media ciudad)
  function lamp(m, s, z, obs) {
    const x = s * (CURB + 0.45);
    m.cyl(x, 2.6, z, 0.07, 0.09, 5.2, 0x2a2c2e, 8);
    m.box(x - s * 0.9, 5.15, z, 1.8, 0.08, 0.08, 0x2a2c2e);
    m.box(x - s * 1.7, 5.05, z, 0.5, 0.14, 0.24, 0x34363a);
    m.box(x - s * 1.7, 4.97, z, 0.4, 0.02, 0.18, 0x3c4248);
    obs.push({ c: true, x, z, r: 0.16 });
  }
  // árbol de acera (o de jardín): tronco, alcorque y una copa de varias bolas, verde muy oscuro de noche
  function tree(m, x, z, rnd, obs, pit) {
    if (pit) m.box(x, 0.155, z, 1.1, 0.01, 1.1, DIRT);
    const h = 2.4 + rnd() * 1.4;
    m.cyl(x, h / 2, z, 0.16, 0.11, h, 0x3a3026, 7);
    const g = [0x1e2a1a, 0x24321e, 0x1a2418, 0x2a3420];
    for (let i = 0; i < 4; i++) m.sphere(x + (rnd() - 0.5) * 1.4, h + 0.6 + rnd() * 1.2, z + (rnd() - 0.5) * 1.4, 1.1 + rnd() * 0.5, 0.9 + rnd() * 0.4, 1.1 + rnd() * 0.5, U.pick(rnd, g), 1);
    obs.push({ c: true, x, z, r: 0.22 });
  }
  // casa de madera de dos plantas (las de Seattle): porche, tejado a dos aguas, ventanas oscuras, jardín y valla
  function house(m, glow, s, z0, w, rnd, obs) {
    const zc = z0 + w / 2, X = WALK + 3.6, dep = 8, floors = rnd() < 0.7 ? 2 : 1, H = floors * 2.9 + 0.5;
    const col = U.pick(rnd, HOUSE), trim = 0xd8d2c4, dk = U.shade(col, 0.7), xc = s * (X + dep / 2), front = s * X;
    // jardín: césped, el camino a la puerta y la valla baja (con su portillo)
    m.box(s * (WALK + 2), 0.08, zc, 4.4 - 0.4, 0.16, w, GRASS);
    m.box(s * (WALK + 2), 0.165, zc, 4.0, 0.01, 1.0, 0x6a6660);
    const fence = U.pick(rnd, [0xc8c4b8, 0x6a5a48, 0x3a3a3a]);
    for (const e of [-1, 1]) {
      const a = e < 0 ? z0 + 0.3 : zc + 0.7, b = e < 0 ? zc - 0.7 : z0 + w - 0.3, L = b - a;
      if (L <= 0.3) continue;
      m.box(s * (WALK + 0.25), 0.55, (a + b) / 2, 0.05, 0.08, L, fence);
      m.box(s * (WALK + 0.25), 0.25, (a + b) / 2, 0.05, 0.08, L, fence);
      for (let q = a; q <= b; q += 0.5) m.box(s * (WALK + 0.25), 0.45, q, 0.06, 0.9, 0.08, fence);
      obs.push({ c: false, x0: s > 0 ? WALK + 0.15 : -WALK - 0.35, x1: s > 0 ? WALK + 0.35 : -WALK - 0.15, z0: a, z1: b });
    }
    // la casa
    m.box(xc, 0.4, zc, dep, 0.8, w - 1.6, 0x4a4844);                    // cimiento
    m.box(xc, 0.8 + (H - 0.8) / 2, zc, dep, H - 0.8, w - 1.6, col);
    for (let f = 1; f < floors; f++) m.box(front - s * 0.04, 0.8 + f * 2.9, zc, 0.12, 0.12, w - 1.5, trim);
    // tejado a dos aguas (cumbrera a lo largo de la calle)
    const rw = dep / 2 + 0.5, ang = 0.5;
    for (const e of [-1, 1]) m.box(xc + e * rw * Math.cos(ang) / 2, H + rw * Math.sin(ang) / 2, zc, rw * 1.04, 0.16, w - 1.0, 0x2c2a2a, 0, undefined, 0, -e * ang);
    m.box(xc, H + 0.05, zc, dep * 0.98, 0.1, w - 1.7, dk);
    // porche, escalones, puerta y ventanas
    const pz = zc + (rnd() < 0.5 ? -1 : 1) * (w / 2 - 2.6);
    m.box(front - s * 1.0, 0.45, pz, 2.0, 0.12, 3.4, 0x5a5048);
    m.box(front - s * 2.1, 0.22, pz, 0.6, 0.12, 1.4, 0x5a5048);
    m.box(front - s * 1.0, 2.75, pz, 2.2, 0.12, 3.6, 0x3a3634);
    for (const e of [-1, 1]) m.box(front - s * 1.85, 1.6, pz + e * 1.5, 0.12, 2.3, 0.12, trim);
    m.box(front - s * 0.03, 1.35, pz, 0.06, 1.95, 0.95, U.pick(rnd, [0x3a2a22, 0x5a2a2a, 0x2a3a4a, 0x1e1e1e]));
    for (let f = 0; f < floors; f++) {
      const y = 1.9 + f * 2.9;
      for (let q = zc - w / 2 + 1.8; q < zc + w / 2 - 1.6; q += 2.2) {
        if (f === 0 && Math.abs(q - pz) < 1.9) continue;
        m.box(front - s * 0.04, y, q, 0.08, 1.4, 1.1, trim);
        const lit = rnd() < 0.025;
        (lit ? glow : m).box(front - s * 0.07, y, q, 0.04, 1.2, 0.9, lit ? 0x5a3a12 : U.pick(rnd, [0x161b20, 0x1d232a, 0x12161a]));
      }
    }
    // buzón, algún arbusto y algún árbol en el jardín
    fput(m, 'buzon', s * (WALK + 0.7), pz + 1.4 * (rnd() < 0.5 ? -1 : 1), -s, 0, { y: 0.15 }, obs);
    if (rnd() < 0.5) fput(m, 'seto', s * (WALK + 2.4), z0 + 1.2, 0, 1, { y: 0.15, x0: s * (WALK + 2.4) - 0.35, x1: s * (WALK + 2.4) + 0.35, z0: z0 + 0.4, z1: z0 + 2.4 }, null);
    if (rnd() < 0.45) tree(m, s * (WALK + 2.6), z0 + w - 1.6, rnd, obs, false);
    obs.push({ c: false, x0: s > 0 ? X : -X - dep, x1: s > 0 ? X + dep : -X, z0: zc - (w - 1.6) / 2, z1: zc + (w - 1.6) / 2 });
  }
  // bloque de pisos o de locales: la fachada de los mapas (sin luz: el apagón)
  function block(m, s, z0, w, h, rnd, style) {
    const D = 5.5, X = WALK + 0.2;
    fput(m, 'fachada', s * (X + D / 2), z0 + w / 2, -s, 0, { x0: s > 0 ? X : -X - D, x1: s > 0 ? X + D : -X, z0: z0 + 0.15, z1: z0 + w - 0.15, h, style: style != null ? style : Math.floor(rnd() * 3), clean: true, dark: true }, null);
  }
  // callejón entre dos edificios: oscuro, con un contenedor y bolsas de basura
  function alley(m, s, z0, w, rnd, obs) {
    m.box(s * (WALK + 6), 0.02, z0 + w / 2, 12, 0.04, w, 0x1a1a1a);
    if (rnd() < 0.7) fput(m, 'cubos', s * (WALK + 1.6), z0 + w / 2, -s, 0, { y: 0.02 }, obs);
    for (let i = 0; i < 3; i++) m.sphere(s * (WALK + 0.6 + rnd() * 1.6), 0.25, z0 + 0.6 + rnd() * (w - 1.2), 0.35, 0.28, 0.32, U.pick(rnd, [0x141414, 0x1e1e22, 0x2a2a20]), 1);
  }

  // ---------- Un tramo ----------
  // se arma en pasos (uno por fotograma si hace falta): suelo, un lado, el otro, la calle transversal
  function sectorRnd(k, salt) { return U.mulberry32((k * 92821 + 7 + (salt || 0) * 131) >>> 0); }
  function newPart(sec, m, glow) {
    if (m && m.count) { const g = m.build(); const mesh = new THREE.Mesh(g, matSolid); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh); sec.parts.push(mesh); }
    if (glow && glow.count) { const g = glow.build(); const mesh = new THREE.Mesh(g, matGlow); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh); sec.parts.push(mesh); }
  }
  function blinkPart(sec, b) {
    if (!b.count) return;
    const mesh = new THREE.Mesh(b.build(), matGlow); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.visible = blinkOn;
    scene.add(mesh); sec.parts.push(mesh); sec.blink.push(mesh);
  }
  // las luces de emergencia (intermitentes naranjas) de un coche aparcado, a los cuatro lados
  function hazards(b, x, z, len, wid) {
    for (const ez of [-1, 1]) for (const ex of [-1, 1]) b.box(x + ex * (wid / 2 - 0.12), 0.78, z + ez * (len / 2 + 0.01), 0.18, 0.08, 0.03, 0xffa020);
  }
  function addFire(sec, x, y, z, big) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa050 }));
    sp.material.toneMapped = false;
    sp.position.set(x, y, z); const s = big ? 4.2 : 2.6; sp.scale.set(s, s * 1.2, 1);
    scene.add(sp); sec.parts.push(sp); sec.fires.push({ sp, s, ph: Math.random() * 10 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xff7a30, opacity: 0.35 }));
    halo.material.toneMapped = false;
    halo.position.set(x, y + 0.5, z); halo.scale.set(s * 3.5, s * 2.6, 1);
    scene.add(halo); sec.parts.push(halo); sec.fires.push({ sp: halo, s: s * 3.5, ph: Math.random() * 10, halo: true });
  }

  function buildStep(job) {
    const k = job.k, sec = job.sec, z0 = k * SL, z1 = z0 + SL, zc = z0 + SL / 2, cross = isCross(k), dist = district(blockOf(k));
    const end = k === cfg.endK, CE = end ? CROSS_FAR : CROSS_END;
    const obs = sec.obs;
    if (job.step === 0) {
      // ---- suelo: calzada, líneas, bordillos, aceras y el terreno de detrás (y la calle transversal en un cruce) ----
      const m = new G.Mesher(), rnd = sectorRnd(k, 0);
      m.box(0, -0.05, zc, CURB * 2, 0.1, SL, ASPH);
      // parches y tapas de alcantarilla
      for (let i = 0; i < 3; i++) m.box((rnd() - 0.5) * 9, 0.004, z0 + rnd() * SL, 0.8 + rnd() * 2.2, 0.008, 0.6 + rnd() * 2.6, ASPH2);
      if (rnd() < 0.6) m.cyl((rnd() < 0.5 ? -1 : 1) * 1.8, 0.008, z0 + rnd() * SL, 0.35, 0.35, 0.016, 0x2c2c2c, 10);
      const gapA = cross ? zc - CROSS_W - 3.4 : z1, gapB = cross ? zc + CROSS_W + 3.4 : z1;
      const runs = cross ? (end ? [[z0, gapA]] : [[z0, gapA], [gapB, z1]]) : [[z0, z1]];
      for (const [a, b] of runs) {
        const L = b - a, mid = (a + b) / 2;
        if (L <= 0.05) continue;
        // doble línea amarilla y las de aparcar (discontinuas)
        for (const e of [-1, 1]) m.box(e * 0.12, 0.006, mid, 0.1, 0.012, L, LINE_Y);
        for (const e of [-1, 1]) for (let q = a; q < b - 0.5; q += 6) m.box(e * LANE, 0.006, q + 1.5, 0.1, 0.012, Math.min(3, b - q), LINE_W);
        for (const e of [-1, 1]) {
          m.box(e * (CURB + 0.08), 0.06, mid, 0.16, 0.22, L, CURBC);
          m.box(e * ((CURB + WALK) / 2 + 0.08), 0.03, mid, WALK - CURB - 0.16, 0.24, L, WALKC);
          for (let q = Math.ceil(a / 3) * 3; q < b; q += 3) m.box(e * ((CURB + WALK) / 2 + 0.08), 0.152, q, WALK - CURB - 0.2, 0.006, 0.05, 0x46463f);
          m.box(e * (WALK + 20), -0.03, mid, 40, 0.06, L, DIRT);
        }
      }
      if (cross) {
        // la calle transversal: asfalto hasta lejos, aceras a los dos lados, pasos de cebra en las cuatro bocas
        m.box(0, -0.05, zc, CE * 2 + 8, 0.1, CROSS_W * 2, ASPH);
        for (const e of [-1, 1]) {
          m.box(0, -0.05, zc + e * (CROSS_W + 1.7), CURB * 2, 0.1, 3.4, ASPH);
          for (const side of [-1, 1]) {
            const xa = CURB + 0.08, xb = CE + 4, L = xb - xa, mx = side * (xa + L / 2);
            m.box(mx, 0.06, zc + e * (CROSS_W + 0.08), L, 0.22, 0.16, CURBC);
            m.box(mx, 0.03, zc + e * (CROSS_W + 1.7), L, 0.24, 3.24, WALKC);
            m.box(side * (WALK + 22), -0.03, zc + e * (CROSS_W + 14), 44, 0.06, 20, DIRT);
          }
          for (let q = -CURB + 0.6; q < CURB - 0.3; q += 1.0) m.box(q, 0.007, zc + e * (CROSS_W - 1.6), 0.55, 0.012, 2.6, 0x8a8a84);
          for (let q = CROSS_W - 1.4; q > -CROSS_W + 1.4; q -= 1.0) m.box(e * (CURB + 1.8), 0.007, zc + q, 2.6, 0.012, 0.55, 0x8a8a84);
          // líneas de detención
          m.box(e < 0 ? -LANE / 2 : LANE / 2, 0.007, zc + e * (CROSS_W + 0.4), LANE, 0.012, 0.3, LINE_W);
        }
        m.box(0, 0.006, zc, CE * 2, 0.012, 0.1, LINE_Y);
      }
      newPart(sec, m, null);
    } else if (job.step === 1 || job.step === 2) {
      // ---- un lado: los solares (casas, bloques, callejones), la acera y los coches aparcados ----
      const s = job.step === 1 ? -1 : 1, rnd = sectorRnd(k, job.step);
      const m = new G.Mesher(), glow = new G.Mesher(), bl = new G.Mesher();
      // solares
      const lots = [];
      if (cross) { lots.push([z0, zc - CROSS_W - 3.4]); if (!end) lots.push([zc + CROSS_W + 3.4, z1]); }
      else {
        let z = z0;
        while (z < z1 - 0.1) {
          let w = dist === 'casas' ? 9 + rnd() * 4 : (dist === 'pisos' ? 12 + rnd() * 10 : 8 + rnd() * 7);
          if (z1 - (z + w) < 6) w = z1 - z;
          lots.push([z, Math.min(z1, z + w)]); z += w;
        }
      }
      for (const [a, b] of lots) {
        const w = b - a, r = rnd();
        if (w < 3) continue;
        if (!cross && r < 0.08 && w > 4) { alley(m, s, a, Math.min(w, 4), rnd, obs); if (w > 8) block(m, s, a + 4, w - 4, 8 + rnd() * 5, rnd); continue; }
        if (dist === 'casas' && !cross) house(m, glow, s, a, w, rnd, obs);
        else block(m, s, a, w, dist === 'pisos' ? 13 + Math.floor(rnd() * 4) * 3 : (dist === 'casas' ? 7 : 7 + Math.floor(rnd() * 2) * 3), rnd, dist === 'casas' ? 1 : undefined);
      }
      // acera: farolas, árboles, bocas de riego, papeleras, una parada de autobús...
      const sideRuns = cross ? (end ? [[z0, zc - CROSS_W - 3.4]] : [[z0, zc - CROSS_W - 3.4], [zc + CROSS_W + 3.4, z1]]) : [[z0, z1]];
      for (const [a, b] of sideRuns) {
        if (b - a < 2) continue;
        for (let q = a + 4; q < b - 2; q += 15) lamp(m, s, q, obs);
        if (dist !== 'pisos') for (let q = a + 9 + rnd() * 2; q < b - 3; q += 11 + rnd() * 4) tree(m, s * (CURB + 1.2), q, rnd, obs, true);
      }
      if (!cross) {
        const zz = () => z0 + 3 + rnd() * (SL - 6);
        if (rnd() < 0.45) fput(m, 'hidrante', s * (CURB + 0.6), zz(), -s, 0, { y: 0.15 }, obs);
        if (rnd() < 0.55) fput(m, 'papelera', s * (CURB + 0.7), zz(), -s, 0, { y: 0.15 }, obs);
        if (rnd() < 0.18) fput(m, 'parada', s * (WALK - 1.0), zc, -s, 0, { y: 0.15 }, obs);
        else if (rnd() < 0.2) fput(m, 'banco_parque', s * (WALK - 0.6), zz(), -s, 0, { y: 0.15 }, obs);
        if (rnd() < 0.25) fput(m, 'buzon', s * (CURB + 0.6), zz(), -s, 0, { y: 0.15 }, obs);
        if (dist !== 'casas' && rnd() < 0.2) fput(m, 'cubos', s * (WALK - 0.6), zz(), 0, 1, { y: 0.15 }, obs);
        // cosas tiradas: alguna maleta, bolsas, cajas (gente que se fue con prisa)
        if (rnd() < 0.35) for (let i = 0; i < 2 + rnd() * 3; i++) m.box(s * (CURB + 0.6 + rnd() * 2.4), 0.15 + 0.1, zz(), 0.3 + rnd() * 0.4, 0.2 + rnd() * 0.2, 0.25 + rnd() * 0.4, U.pick(rnd, [0x3a2a22, 0x2a3a4a, 0x5a5a52, 0x6a2a2a]));
      }
      // coches aparcados (en el carril de aparcar): de cara al sentido de su lado; alguno con las de emergencia
      const pz = [];
      for (let q = z0 + 3; q < z1 - 2; q += 6.2) if (!(cross && Math.abs(q - zc) < CROSS_W + 5) && !(end && q > zc)) pz.push(q);
      let skip = 0;
      for (const q of pz) {
        if (skip-- > 0) continue;
        if (rnd() > 0.55) continue;
        const r = rnd(), type = r < 0.7 ? 'coche' : (r < 0.9 ? 'camioneta' : (r < 0.94 ? 'patrulla' : (r < 0.97 && dist !== 'casas' ? 'camion' : 'ambulancia')));
        const T0 = G.Furniture.T[type], x = s * (LANE + 1.25 + (rnd() - 0.5) * 0.25), z = q + (rnd() - 0.5) * 0.6;
        if (type === 'camion' && (z + 3.8 > z1 || (cross && Math.abs(z - zc) < CROSS_W + 8))) continue;
        if (type === 'camion' || type === 'ambulancia') skip = 1;
        fput(m, type, x, z, 0, -s, { col: U.pick(rnd, CARS) }, obs);
        if (rnd() < 0.12) hazards(bl, x, z, T0.d, T0.w);
        // (alguno quemado, con el fuego todavía vivo)
        if (k > 2 && rnd() < 0.035) addFire(sec, x, 1.4, z, false);
      }
      newPart(sec, m, glow); blinkPart(sec, bl);
    } else if (job.step === 3) {
      // ---- en la calzada: algún coche abandonado de mala manera, cajas, un carrito (deja siempre un carril) ----
      // y, en los cruces, semáforos apagados, señales, los edificios de la transversal y el corte al fondo
      const m = new G.Mesher(), bl = new G.Mesher(), rnd = sectorRnd(k, 3);
      if (!cross && k > 2 && rnd() < 0.2) {
        const s = rnd() < 0.5 ? -1 : 1, x = s * (1.4 + rnd() * 1.6), z = z0 + 6 + rnd() * (SL - 12), a = (rnd() - 0.5) * 0.9;
        fput(m, 'coche', x, z, Math.sin(a) * -s, Math.cos(a) * -s, { col: U.pick(rnd, CARS) }, obs);
        hazards(bl, x, z, 4.4, 1.8);
        if (rnd() < 0.3) addFire(sec, x, 1.2, z + 1.5 * -s, true);
      }
      if (!cross && rnd() < 0.18) for (let i = 0; i < 4; i++) m.box((rnd() - 0.5) * 8, 0.12, z0 + rnd() * SL, 0.3 + rnd() * 0.5, 0.2 + rnd() * 0.2, 0.3 + rnd() * 0.5, U.pick(rnd, [0x3a2a22, 0x4a4a42, 0x6a6a5a, 0x2a2a2a]));
      if (cross) {
        for (const e of [-1, 1]) for (const s of [-1, 1]) {
          fput(m, 'semaforo', s * (CURB + 0.5), zc + e * (CROSS_W + 0.6), 0, -e, { y: 0.15 }, obs);
          if (end && e > 0) continue;          // (al norte del cruce del final, la explanada de la estación)
          // los edificios de la calle transversal (a los dos lados, hacia el fondo)
          const rr = sectorRnd(k, 10 + (e + 1) * 2 + (s + 1));
          let x = WALK + 6.0;          // (la esquina ya la ocupa el bloque de la avenida)
          while (x < CE + 2) {
            const w = 9 + rr() * 9, hh = 7 + Math.floor(rr() * 4) * 3, D = 5.5, zf = zc + e * (CROSS_W + 3.4);
            fput(m, 'fachada', s * (x + w / 2), zf + e * D / 2, 0, -e, { x0: s > 0 ? x : -x - w, x1: s > 0 ? x + w : -x, z0: e > 0 ? zf : zf - D, z1: e > 0 ? zf + D : zf, h: hh, style: Math.floor(rr() * 3), clean: true, dark: true }, null);
            x += w + (rr() < 0.25 ? 3 : 0);
          }
          if (rr() < 0.6) fput(m, 'coche', s * (CURB + 8 + rr() * 20), zc + e * (CROSS_W - 1.2), e > 0 ? 1 : -1, 0, { col: U.pick(rr, CARS) }, obs);
        }
        // el fondo de la transversal: cortada (barreras con luces, un camión cruzado). La del final, no: por ahí se va
        if (!end) for (const s of [-1, 1]) {
          const x = s * (CROSS_END - 1);
          for (const q of [-3.6, -1.2, 1.2, 3.6]) fput(m, 'barrera', x, zc + q, -s, 0, null, obs);
          for (const q of [-3.6, 1.2]) bl.box(x, 0.98, zc + q, 0.1, 0.1, 0.1, 0xffa020);
          if ((k & 1) === (s > 0 ? 1 : 0)) fput(m, 'camion', s * (CROSS_END + 3.5), zc, 0, 1, { col: 0x5a5a52 }, obs);
          else fput(m, 'ambulancia', s * (CROSS_END + 3), zc - 1.5, 0.3, 0.95, null, obs);
        }
        fput(m, 'senal', -(CURB + 0.6), zc - CROSS_W - 2.4, 0, 1, { y: 0.15 }, obs);
      }
      newPart(sec, m, null); blinkPart(sec, bl);
    }
    job.step++;
    return job.step > 3;
  }

  // ---------- Choques ----------
  // ¿dónde puede estar un círculo (x, z, r)? En la avenida (entre las fachadas) o en una transversal de un cruce.
  // Devuelve el empuje para sacarlo (o null) y qué tocó
  const _hit = { x: 0, z: 0, what: '' };
  function limitAt(z, r) {
    // en la boca de un cruce se puede salir de la avenida
    const k = Math.floor(z / SL);
    for (const kk of [k - 1, k, k + 1]) if (isCross(kk) && kk >= cfg.minK && kk <= cfg.endK && Math.abs(z - crossZ(kk)) < WALK - r) return { cross: true, zc: crossZ(kk), ce: ceOf(kk) };
    return null;
  }
  function collide(x, z, r) {
    let px = 0, pz = 0, what = '';
    // el corredor de la avenida y, en un cruce, el de la transversal
    const inMain = Math.abs(x) <= WALK - r;
    if (!inMain) {
      const c = limitAt(z, r);
      if (c && Math.abs(x) <= c.ce - r) { /* dentro de la transversal */ }
      else {
        // al punto válido más cercano
        let bx = Math.sign(x) * (WALK - r), bz = z, bd = Math.abs(x - bx);
        const k = Math.floor(z / SL);
        for (const kk of [k - 1, k, k + 1]) {
          if (!isCross(kk) || kk < cfg.minK || kk > cfg.endK) continue;
          const zc = crossZ(kk), cz = U.clamp(z, zc - (WALK - r), zc + (WALK - r)), cx = U.clamp(x, -(ceOf(kk) - r), ceOf(kk) - r);
          const d = Math.hypot(x - cx, z - cz);
          if (d < bd) { bd = d; bx = cx; bz = cz; }
        }
        px += bx - x; pz += bz - z; what = 'wall';
      }
    }
    // más allá del cruce del final no se pasa (la explanada de la estación)
    if (cfg.endK < 1e8) {
      const zEnd = crossZ(cfg.endK) + CROSS_W;
      if (z + pz > zEnd - r) { pz += (zEnd - r) - (z + pz); what = what || 'wall'; }
    }
    // los obstáculos sueltos (la nave del depósito, su reja...)
    for (const o of extra) {
      if (o.off) continue;
      const qx = x + px, qz = z + pz;
      const cx = U.clamp(qx, o.x0, o.x1), cz = U.clamp(qz, o.z0, o.z1), dx = qx - cx, dz = qz - cz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-4) { px += dx / d * (r - d); pz += dz / d * (r - d); }
      else {
        const l = qx - o.x0, rr = o.x1 - qx, b = qz - o.z0, t = o.z1 - qz, mn = Math.min(l, rr, b, t);
        if (mn === l) px -= l + r; else if (mn === rr) px += rr + r; else if (mn === b) pz -= b + r; else pz += t + r;
      }
      what = o.what || (o.car ? 'car' : 'thing');
    }
    // lo que hay en los tramos de alrededor
    const k = Math.floor(z / SL);
    for (const kk of [k - 1, k, k + 1]) {
      const sec = sectors.get(kk);
      if (!sec || !sec.ready) continue;
      for (const o of sec.obs) {
        const qx = x + px, qz = z + pz;
        if (o.c) {
          const dx = qx - o.x, dz = qz - o.z, d = Math.hypot(dx, dz), m = r + o.r;
          if (d < m && d > 1e-4) { px += dx / d * (m - d); pz += dz / d * (m - d); what = what || 'pole'; }
        } else {
          const cx = U.clamp(qx, o.x0, o.x1), cz = U.clamp(qz, o.z0, o.z1), dx = qx - cx, dz = qz - cz, d = Math.hypot(dx, dz);
          if (d < r) {
            if (d > 1e-4) { px += dx / d * (r - d); pz += dz / d * (r - d); }
            else {
              // (el centro dentro de la caja: por el lado más corto)
              const l = qx - o.x0, rr = o.x1 - qx, b = qz - o.z0, t = o.z1 - qz, mn = Math.min(l, rr, b, t);
              if (mn === l) px -= l + r; else if (mn === rr) px += rr + r; else if (mn === b) pz -= b + r; else pz += t + r;
            }
            what = o.car ? 'car' : (what || 'thing');
          }
        }
      }
    }
    if (!what) return null;
    _hit.x = px; _hit.z = pz; _hit.what = what;
    return _hit;
  }
  // altura del suelo bajo el coche: acera (0,15) o calzada
  function groundY(x, z) {
    if (Math.abs(x) <= CURB || z < cfg.minK * SL) return 0;
    const c = limitAt(z, 0);
    if (c && Math.abs(z - c.zc) < CROSS_W) return 0;
    return 0.15;
  }

  // ---------- Texturas de brillo ----------
  function radial(stops) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, c] of stops) g.addColorStop(o, c);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }

  const Road = {
    SL, LANE, CURB, WALK, CROSS_W, isCross, crossZ,
    get count() { return sectors.size; },
    // la escena donde se arma (la de G.Drive)
    init(sceneRef, opt) {
      this.clear();
      scene = sceneRef;
      cfg = Object.assign({ minK: -1e9, endK: 1e9 }, opt || {});
      if (!matSolid) {
        matSolid = new THREE.MeshLambertMaterial({ vertexColors: true });
        matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
        matGlow.toneMapped = false;
        glowTex = radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
        fireTex = radial([[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,160,60,0.85)'], [0.6, 'rgba(200,60,10,0.35)'], [1, 'rgba(120,20,0,0)']]);
      }
      T = 0;
    },
    get glowTex() { return glowTex; },
    get fireTex() { return fireTex; },
    get cfg() { return cfg; },
    extra,
    // arma (o deja en cola) lo que hace falta alrededor de z; force: todo ya (detrás de la pantalla de carga)
    update(dt, z, force) {
      T += dt;
      const k0 = Math.max(cfg.minK, Math.floor((z - BEHIND) / SL)), k1 = Math.min(cfg.endK, Math.floor((z + AHEAD) / SL));
      // lo que quedó atrás se deshace
      for (const [k, sec] of sectors) if (k < k0 - 1 || k > k1 + 1) { this.drop(sec); sectors.delete(k); }
      for (let i = queue.length - 1; i >= 0; i--) if (!sectors.has(queue[i].k)) queue.splice(i, 1);
      // lo que falta, en orden de cercanía
      for (let k = k0; k <= k1; k++) {
        if (sectors.has(k)) continue;
        const sec = { k, parts: [], obs: [], blink: [], fires: [], ready: false };
        sectors.set(k, sec);
        queue.push({ k, sec, step: 0 });
      }
      queue.sort((a, b) => Math.abs(crossZ(a.k) - z) - Math.abs(crossZ(b.k) - z));
      const t0 = performance.now();
      while (queue.length && (force || performance.now() - t0 < BUDGET_MS)) {
        const job = queue[0];
        if (buildStep(job)) { job.sec.ready = true; queue.shift(); }
      }
      // intermitentes de emergencia (todos a la vez) y el fuego que tiembla
      blinkT += dt;
      if (blinkT > 0.45) { blinkT = 0; blinkOn = !blinkOn; for (const [, sec] of sectors) for (const b of sec.blink) b.visible = blinkOn; }
      for (const [, sec] of sectors) for (const f of sec.fires) {
        const q = 0.82 + 0.18 * Math.sin(T * 13 + f.ph) * Math.sin(T * 7.3 + f.ph * 2);
        f.sp.scale.set(f.s * q, f.s * (f.halo ? 0.75 : 1.2) * (0.9 + 0.1 * Math.sin(T * 9 + f.ph)), 1);
        if (f.halo) f.sp.material.opacity = 0.28 + 0.1 * q;
      }
    },
    get pending() { return queue.length; },
    drop(sec) {
      for (const o of sec.parts) {
        if (o.parent) o.parent.remove(o);
        if (o.geometry) o.geometry.dispose();
        if (o.isSprite && o.material) o.material.dispose();
      }
      sec.parts.length = 0; sec.obs.length = 0; sec.blink.length = 0; sec.fires.length = 0;
    },
    clear() {
      for (const [, sec] of sectors) this.drop(sec);
      sectors.clear(); queue.length = 0; extra.length = 0;
    },
    collide, groundY,
    // el próximo cruce cuyo centro está por delante de z (al menos ahead m)
    nextCross(z, ahead) {
      let k = Math.floor((z + (ahead || 0)) / SL);
      while (!isCross(k) || crossZ(k) < z + (ahead || 0)) k++;
      return { k, z: crossZ(k) };
    },
    district: (z) => district(blockOf(Math.floor(z / SL)))
  };
  G.Road = Road;
})(window.Game = window.Game || {});
