// Las heridas del choque (prólogo del modo historia): sangre pintada sobre la textura de la malla de un personaje
// (Javier, Alem), sin modelos nuevos. Se pinta poco a poco mientras se conduce (los dos van dentro del coche y no
// se ven): cada mancha es un punto del cuerpo (en 3D, en la pose de reposo de la malla) y se pinta sobre los
// triángulos de alrededor, cada uno con su trozo de textura (así la mancha sale redonda en el cuerpo aunque la
// textura esté hecha de piezas sueltas). El resultado queda en G.CharMesh[id].hurt (un lienzo): la malla con
// meshVar 'herido' lo usa (G.Models). G.Wounds.prepare(id, plan) / step(ms) / ready(id)
(function (G) {
  'use strict';
  const jobs = new Map();       // id -> { img, cv, ctx, P, UV, I, tris, list, i, done }

  // dónde está la cabeza: sumando los huesos desde la cadera (bind.bones del convertidor)
  function headY(bind) {
    let y = 0;
    for (const b of ['hips', 'spine', 'spine2', 'chest', 'neck', 'head']) y += (bind.bones[b] || [0, 0, 0])[1];
    return y;
  }
  // el vértice de la superficie más cercano a un punto (para clavar una mancha en el cuerpo)
  function nearest(J, x, y, z, filter) {
    let best = -1, bd = 1e9;
    const P = J.P;
    for (let i = 0, n = P.length / 3; i < n; i++) {
      if (filter && !filter(i)) continue;
      const dx = P[i * 3] - x, dy = P[i * 3 + 1] - y, dz = P[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  // el plan de manchas: frente (con gotas que bajan por la cara), una ceja, el cuello de la camisa, el pecho, una
  // manga, las manos (salir a rastras entre cristales) y las rodillas y algún muslo
  function plan(J, opt) {
    const P = J.P, R = J.reg, hy = J.hy, out = [];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const at = (i, r, a) => ({ x: P[i * 3], y: P[i * 3 + 1], z: P[i * 3 + 2], r, a: a == null ? 0.9 : a });
    const front = (y, x, maxR) => nearest(J, x, y, 0.4, (i) => Math.abs(P[i * 3 + 1] - y) < 0.025 && Math.abs(P[i * 3] - x) < (maxR || 0.05) && P[i * 3 + 2] > 0);
    const fy = hy + 0.13, side = opt.side || 1;
    // la frente: la herida y la sangre que corre hacia abajo por un lado de la cara
    let i = front(fy, 0.014 * side); if (i >= 0) out.push(at(i, 0.04, 0.95));
    i = front(fy + 0.02, 0.045 * side); if (i >= 0) out.push(at(i, 0.022, 0.85));
    for (let k = 1; k <= 5; k++) { i = front(fy - k * 0.026, (0.035 + k * 0.004) * side, 0.03); if (i >= 0) out.push(at(i, 0.011 - k * 0.0008, 0.8)); }
    i = front(fy - 0.14, 0.04 * side, 0.04); if (i >= 0) out.push(at(i, 0.016, 0.7));             // la barbilla
    // por el cuerpo: puntos al azar en cada zona (pecho, espalda, brazos, manos, piernas)
    const pickIn = (f) => { for (let n = 0; n < 400; n++) { const j = Math.floor(Math.random() * (P.length / 3)); if (f(j)) return j; } return -1; };
    const zone = (f, n, r0, r1, a) => { for (let k = 0; k < n; k++) { const j = pickIn(f); if (j >= 0) out.push(at(j, rnd(r0, r1), a)); } };
    zone((j) => R[j] === 0 && P[j * 3 + 1] > hy - 0.1 && P[j * 3 + 1] < hy + 0.02 && P[j * 3 + 2] > 0, 2, 0.02, 0.035, 0.8);      // el cuello
    zone((j) => R[j] === 0 && P[j * 3 + 1] > 0.95 && P[j * 3 + 1] < hy - 0.08 && P[j * 3 + 2] > 0.02, opt.chest || 4, 0.025, 0.06, 0.75);
    zone((j) => R[j] === 0 && P[j * 3 + 1] > 0.95 && P[j * 3 + 1] < hy - 0.08 && P[j * 3 + 2] < -0.02, 2, 0.03, 0.05, 0.6);
    zone((j) => (R[j] === 1 || R[j] === 2) && P[j * 3 + 1] > 0.95, opt.arms || 3, 0.02, 0.045, 0.75);
    zone((j) => (R[j] === 1 || R[j] === 2) && P[j * 3 + 1] < 0.9, opt.hands || 4, 0.015, 0.03, 0.85);
    zone((j) => (R[j] === 3 || R[j] === 4) && P[j * 3 + 1] > 0.35 && P[j * 3 + 1] < 0.6 && P[j * 3 + 2] > 0, opt.knees || 3, 0.03, 0.055, 0.7);
    zone((j) => (R[j] === 3 || R[j] === 4) && P[j * 3 + 1] > 0.6 && P[j * 3 + 1] < 0.9, opt.legs || 2, 0.025, 0.05, 0.6);
    // cada mancha con un par de salpicaduras pequeñas alrededor (que no sean círculos perfectos)
    const extra = [];
    for (const s of out) for (let k = 0; k < 2; k++) {
      const j = nearest(J, s.x + rnd(-1, 1) * s.r * 1.1, s.y + rnd(-1, 1) * s.r * 1.1, s.z + rnd(-1, 1) * s.r * 0.6);
      if (j >= 0) extra.push(at(j, s.r * rnd(0.3, 0.55), s.a * 0.8));
    }
    return out.concat(extra);
  }

  // pinta una mancha: en cada triángulo cercano, un degradado redondo con su propio mapa de 3D a textura
  function paint(J, s) {
    const { P, UV, I, ctx, W, H } = J;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
      const dd = Math.hypot(cx - s.x, cy - s.y, cz - s.z);
      if (dd > s.r + J.tr[t / 3]) continue;
      // el triángulo en 3D (e1, e2) y en la textura (en píxeles)
      const e1x = P[b * 3] - P[a * 3], e1y = P[b * 3 + 1] - P[a * 3 + 1], e1z = P[b * 3 + 2] - P[a * 3 + 2];
      const e2x = P[c * 3] - P[a * 3], e2y = P[c * 3 + 1] - P[a * 3 + 1], e2z = P[c * 3 + 2] - P[a * 3 + 2];
      const u0 = UV[a * 2] * W, v0 = (1 - UV[a * 2 + 1]) * H, u1 = UV[b * 2] * W, v1 = (1 - UV[b * 2 + 1]) * H, u2 = UV[c * 2] * W, v2 = (1 - UV[c * 2 + 1]) * H;
      const d11 = e1x * e1x + e1y * e1y + e1z * e1z, d12 = e1x * e2x + e1y * e2y + e1z * e2z, d22 = e2x * e2x + e2y * e2y + e2z * e2z;
      const den = d11 * d22 - d12 * d12;
      if (den < 1e-12) continue;
      // dónde cae el centro de la mancha en el plano del triángulo (y de ahí, en la textura)
      const qx = s.x - P[a * 3], qy = s.y - P[a * 3 + 1], qz = s.z - P[a * 3 + 2];
      const q1 = qx * e1x + qy * e1y + qz * e1z, q2 = qx * e2x + qy * e2y + qz * e2z;
      const al = (d22 * q1 - d12 * q2) / den, be = (d11 * q2 - d12 * q1) / den;
      const pu = u0 + al * (u1 - u0) + be * (u2 - u0), pv = v0 + al * (v1 - v0) + be * (v2 - v0);
      // escala: píxeles por metro en este triángulo
      const a3 = Math.sqrt(den) / 2, a2 = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) / 2;
      if (a3 < 1e-9 || a2 < 0.01) continue;
      const k = Math.sqrt(a2 / a3), rad = s.r * k;
      if (rad < 0.6) continue;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.lineTo(u2, v2); ctx.closePath();
      // (un pelo más grande: que no queden rayas en las costuras entre triángulos)
      ctx.lineWidth = 1.5; ctx.clip();
      const g = ctx.createRadialGradient(pu, pv, 0, pu, pv, rad);
      g.addColorStop(0, 'rgba(70,4,3,' + s.a + ')');
      g.addColorStop(0.45, 'rgba(105,9,6,' + (s.a * 0.85) + ')');
      g.addColorStop(0.8, 'rgba(120,14,8,' + (s.a * 0.45) + ')');
      g.addColorStop(1, 'rgba(120,14,8,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(u0, u1, u2) - 2, Math.min(v0, v1, v2) - 2, Math.max(u0, u1, u2) - Math.min(u0, u1, u2) + 4, Math.max(v0, v1, v2) - Math.min(v0, v1, v2) + 4);
      ctx.restore();
    }
  }

  const Wounds = {
    // empieza a preparar la malla herida de id (opt: side 1/-1 de la cara, cuántas manchas en el pecho, manos...)
    prepare(id, opt) {
      const D = G.CharMesh && G.CharMesh[id];
      if (!D || jobs.has(id)) return;
      // (ya pintada en una partida anterior: la misma)
      if (D.hurt) { jobs.set(id, { id, done: true }); return; }
      const J = { id, opt: opt || {}, list: null, i: 0, done: false, img: new Image(), cv: null };
      J.img.onload = () => {
        J.W = J.img.naturalWidth || 1024; J.H = J.img.naturalHeight || 1024;
        J.cv = document.createElement('canvas'); J.cv.width = J.W; J.cv.height = J.H;
        J.ctx = J.cv.getContext('2d');
        J.ctx.drawImage(J.img, 0, 0, J.W, J.H);
      };
      J.img.src = D.tex;
      const d = D.data;
      J.P = d.wpos || d.pos; J.UV = d.uv; J.I = d.idx; J.reg = d.reg || [];
      J.hy = D.bind && D.bind.bones ? headY(D.bind) : 1.4;
      // radio de cada triángulo (para descartar rápido los que quedan lejos)
      const P = J.P, I = J.I, tr = new Float32Array(I.length / 3);
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], b = I[t + 1], c = I[t + 2];
        const cx = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, cy = (P[a * 3 + 1] + P[b * 3 + 1] + P[c * 3 + 1]) / 3, cz = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
        let m = 0;
        for (const v of [a, b, c]) m = Math.max(m, Math.hypot(P[v * 3] - cx, P[v * 3 + 1] - cy, P[v * 3 + 2] - cz));
        tr[t / 3] = m;
      }
      J.tr = tr;
      jobs.set(id, J);
    },
    // un poco cada fotograma (ms: lo que se puede gastar)
    step(ms) {
      const t0 = performance.now();
      for (const [, J] of jobs) {
        if (J.done || !J.ctx) continue;
        if (!J.list) J.list = plan(J, J.opt);
        while (J.i < J.list.length && performance.now() - t0 < (ms || 3)) paint(J, J.list[J.i++]);
        if (J.i >= J.list.length) {
          J.done = true;
          // (un poco de suciedad general: polvo del choque)
          J.ctx.globalAlpha = 0.07; J.ctx.fillStyle = '#3a3026'; J.ctx.fillRect(0, 0, J.W, J.H); J.ctx.globalAlpha = 1;
          G.CharMesh[J.id].hurt = J.cv;
        }
        if (performance.now() - t0 >= (ms || 3)) return;
      }
    },
    // termina lo que falte de golpe (detrás de la pantalla a negro)
    finish() { for (let n = 0; n < 400 && !this.allReady(); n++) this.step(50); },
    ready(id) { const J = jobs.get(id); return !!(J && J.done); },
    allReady() { for (const [, J] of jobs) if (!J.done) return false; return true; },
    progress(id) { const J = jobs.get(id); return J && J.list ? J.i / J.list.length : 0; },
    clear() { jobs.clear(); }
  };
  G.Wounds = Wounds;
})(window.Game = window.Game || {});
