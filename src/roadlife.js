// La segunda parte al volante (prólogo del modo historia, la huida). En la escena de la calle (G.Drive con G.Road):
//   · la nave del depósito (z < 0): el coche requisado, otros coches, estanterías, las luces de emergencia y, en la
//     salida, la reja con los corredores agarrados a los barrotes. El puente (chispas, dos intentos y arranca) y a
//     atravesar la reja de un acelerón
//   · la avenida, con gente: corredores que esperan, comen o se lanzan contra el coche (se los atropella o se agarran
//     a la puerta), civiles que huyen o cruzan (también se los puede atropellar) y la charla de los dos: Javier no
//     quiere atropellar a nadie, Alem solo quiere salir de ahí
//   · el cruce del final: al otro lado, la estación de policía en llamas (solo por fuera) y corredores alrededor. Se
//     paran, hablan, la pantalla se oscurece, el plano desde lo alto (como un dron) y el coche se va solo por la
//     transversal hasta perderse; a negro y al menú principal
// G.RoadLife.begin(jugador, kit, desdePuntoDeControl) / flow(dt, jugador) / smashGate(coche) / clear()
(function (G) {
  'use strict';
  const U = G.Util;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const END_K = 27;                      // el cruce del final (z 825): la estación, al otro lado
  const LEN = 4.4, WID = 1.8;

  let K = null, pl = null, S = null;
  const say = (who, text) => { if (K) K.say(who, text); };
  const talk = (list, done) => { if (K) K.play(list, done); };

  // ---------- Las frases ----------
  // el puente: [segundo, quién, qué] (y lo que suena, en HOT_FX)
  const HOT = [[0.8, 'alem', 'Sujeta la linterna... no, aquí abajo. Apunta aquí.'], [3.6, 'jav', '¿Sabes hacer esto de verdad?'],
    [5.8, 'alem', 'Mi padre tenía un taller. Rojo con rojo... y el marrón, al encendido...'], [9.4, 'jav', '¡Date prisa! ¡La reja no va a aguantar!'],
    [11.2, 'alem', 'Vamos, vamos, bonita...'], [13.3, 'alem', '¡Venga!'], [15.3, 'alem', '¡Ahí está! ¡Agárrate! ¡Pisa a fondo y atraviesa la reja!']];
  const HOT_FX = [[1.0, 'panel'], [2.4, 'spark'], [3.0, 'spark'], [6.9, 'spark'], [7.5, 'spark'], [8.1, 'crank'], [10.4, 'spark'], [12.2, 'spark'], [12.5, 'cough'], [14.1, 'start']];
  const RIDE = [
    { z: 22, l: [['alem', '¡Sigue, sigue! ¡No pares!'], ['jav', '¿Adónde vamos?'], ['alem', 'A la estación. Hay generador, armas y gente. Allí estaremos a salvo.']] },
    { z: 150, l: [['jav', 'Hay gente, Alem... ¡Hay gente corriendo por la calle!'], ['alem', 'No podemos parar. Ahora no podemos ayudar a nadie.']] },
    { z: 320, l: [['jav', 'Somos policías. Se supone que tenemos que protegerlos.'], ['alem', 'Se supone que tenemos que seguir vivos para poder hacerlo.'],
      ['jav', '¿Y eso quién lo decide? ¿Tú?'], ['alem', '¡Lo decide eso de ahí fuera, Javier! ¡Conduce!']] },
    { z: 470, l: [['jav', '¿Y si tiene cura? ¿Y si mañana hay una cura y nosotros los estamos...?'], ['alem', 'Si mañana hay una cura, mañana lo hablamos. Hoy, conduce.']] },
    { z: 570, l: [['radio', '... a todas las unidades... la estación... repliéguense a... (interferencias)'], ['alem', '¿Has oído eso? ¿Qué ha dicho de la estación?'], ['jav', 'No lo sé. Se ha cortado.']] },
    { z: 680, l: [['jav', 'Antes... te he gritado. Lo siento.'], ['alem', 'Y yo a ti. Cuando lleguemos, me invitas a un café y estamos en paz.'], ['alem', 'La estación está al final de la avenida, en el cruce. Ya casi.']] }
  ];
  const HIT_CIV = [[['jav', '¡No! ¡No, no, no! ¡Lo he atropellado!'], ['alem', '¡No frenes! ¡Si paramos, estamos muertos!']],
    [['jav', '¡Era una persona, Alem!'], ['alem', '¡Era uno de ellos o lo iba a ser en un minuto! ¡Sigue!']],
    [['jav', 'Dios mío... otra vez...'], ['alem', 'No mires atrás. No mires atrás, Javier.']]];
  const NEAR_CIV = [['jav', '¡Cuidado! ¡Casi lo atropello!'], ['alem', '¡Sigue! ¡No te pares!']];
  const HIT_Z = ['¡Eso es!', '¡Por encima!', '¡Dale!', '¡Otro menos!'];
  const CLING = ['¡Tienes uno en la puerta!', '¡Acelera! ¡Quítatelo de encima!', '¡Está en mi lado! ¡Acelera!'];
  const BEG = [['civ', '¡Paren! ¡Por favor! ¡Ayúdenme!'], ['jav', 'Alem... está pidiendo ayuda.'], ['alem', '¡Mírale el cuello, Javier! ¡Está mordida! ¡No pares!']];
  const STOP = [['alem', 'Para. Para el coche.']];
  const LOOK = [['alem', 'No... No, no, no...'], ['alem', '¡Mierda! ¡MIERDA!'], ['jav', 'Está ardiendo... entera.'],
    ['alem', 'Reyes, Ortiz, el jefe Webb... estaban todos ahí dentro.'], ['jav', 'Mira la entrada. Están por todas partes.'],
    ['alem', '¿Y ahora qué, Javier? ¿Adónde vamos? ¡Ya no queda nada!'], ['jav', 'A mi casa. En Ballard, al norte. Mi madre está sola.']];
  const FINAL = [['alem', '... Vale. A tu casa.'], ['jav', 'Agárrate.']];
  // los encuentros por la avenida (z: dónde están; se preparan cuando el coche se acerca)
  const ENC = [
    { z: 75, k: 'pack', n: 2 }, { z: 140, k: 'feed' }, { z: 205, k: 'cross' }, { z: 270, k: 'pack', n: 3 }, { z: 350, k: 'flee' },
    { z: 420, k: 'feed' }, { z: 490, k: 'pack', n: 2 }, { z: 560, k: 'beg' }, { z: 630, k: 'pack', n: 3 }, { z: 700, k: 'cross' }, { z: 760, k: 'pack', n: 2 }
  ];

  // ---------- Gente en la calle (cuerpos de G.Huida, con su manera de moverse aquí) ----------
  const ground = (x, z) => (G.Road ? G.Road.groundY(x, z) : 0);
  function makeWalker(sc, kind, fem) {
    const A = G.Huida.Actor;
    const w = new A(sc, kind, { x: 0, z: -500, face: 0, mode: 'off', fem });
    w.mode = 'off'; w.h.root.visible = false;
    return w;
  }
  function reset(w) {
    const h = w.h;
    h.body.rotation.set(0, 0, 0); h.body.position.set(0, 0, 0);
    w.still = false; w.fall = 0; w.fly = null; w.cling = null; w.path = null; w.v = 0; w.npcPose = null; w.hitDone = false; w.decalOff();
  }
  function getW(kind) {
    const pool = kind === 'z' ? S.wz : S.wc;
    for (const w of pool) if (w.mode === 'off') { reset(w); return w; }
    return null;
  }
  function put(w, x, z, face, mode) { w.pos.x = x; w.pos.z = z; w.facing = face; w.mode = mode; w.h.root.visible = true; w.on = true; w.y = ground(x, z); }
  function free(w) { w.mode = 'off'; w.on = false; w.h.root.visible = false; w.decalOff(); }

  // un encuentro, preparado unos 85 m por delante (en la niebla: aparecen sin que se vea)
  function setupEnc(e) {
    const z = e.z, side = Math.random() < 0.5 ? -1 : 1;
    if (e.k === 'pack') {
      for (let i = 0; i < e.n; i++) {
        const w = getW('z'); if (!w) break;
        put(w, side * R(5.5, 8.4), z + R(-4, 4), side > 0 ? -Math.PI / 2 : Math.PI / 2, Math.random() < 0.5 ? 'idle' : 'wander');
        w.home = { x: w.pos.x, z: w.pos.z };
      }
    } else if (e.k === 'feed') {
      const body = getW('c'), x = R(-3.6, 2.4);
      if (body) { put(body, x, z, R(0, 6), 'lie'); body.lie(1); }
      for (let i = 0; i < 2; i++) { const w = getW('z'); if (!w) break; put(w, x + (i ? 0.7 : -0.6), z + (i ? 0.5 : -0.4), i ? -2.2 : 0.8, 'feed'); }
    } else if (e.k === 'cross') {
      // alguien cruza corriendo de un lado al otro (y uno detrás): justo delante del coche
      const c = getW('c');
      if (c) { put(c, side * 9.0, z, -side * Math.PI / 2, 'wait'); c.crossTo = -side * 11; c.fem = c.fem; e.civ = c; }
      const w = getW('z');
      if (w) { put(w, side * 9.0, z + 3.5, -side * Math.PI / 2, 'wait'); e.chaser = w; w.crossTo = -side * 11; }
    } else if (e.k === 'flee') {
      // dos que huyen por la calzada en el mismo sentido que el coche, con corredores detrás
      const sx = R(-3.2, -1.2);
      for (let i = 0; i < 2; i++) { const c = getW('c'); if (!c) break; put(c, sx + i * 1.6, z + i * 2, 0, 'run'); c.spd = R(4.6, 5.2); c.path = [{ x: sx + i * 1.6, z: z + 160 }]; c.pi = 0; c.flee = true; }
      for (let i = 0; i < 2; i++) { const w = getW('z'); if (!w) break; put(w, sx + i * 1.4 - 0.6, z - 6 - i * 2, 0, 'run'); w.spd = R(5.0, 5.6); w.path = [{ x: sx + i * 1.4, z: z + 160 }]; w.pi = 0; w.flee = true; }
    } else if (e.k === 'beg') {
      const c = getW('c');
      if (c) { put(c, R(-2.5, -0.5), z, Math.PI, 'beg'); c.npcPose = 'wave'; c.fem = true; e.civ = c; }
    }
  }
  // el corredor ve el coche y se lanza
  function charge(w) {
    w.mode = 'charge'; w.spd = R(5.4, 6.4);
    if (G.Audio && Math.random() < 0.7) G.Audio.play('zAlert', { vol: 0.5, runner: true, pan: U.clamp(w.pos.x / 9, -0.8, 0.8) });
  }
  function hitWalker(w, c, speed) {
    // atropellado: sale despedido (muñeco de trapo) y queda tirado con su charco
    const fx = Math.sin(c.h), fz = Math.cos(c.h), side = (w.pos.x - c.x) * Math.cos(c.h) - (w.pos.z - c.z) * Math.sin(c.h);
    const k = Math.min(1, speed / 14);
    w.fly = { vx: fx * speed * 0.9 + Math.cos(c.h) * side * 1.5, vz: fz * speed * 0.9 - Math.sin(c.h) * side * 1.5, vy: 2.5 + k * 4.5, rx: 0, rz: 0, wx: -(3 + k * 6), wz: (Math.random() - 0.5) * 6, y: 0.2, t: 0 };
    w.mode = 'fly'; w.cling = null;
    c.v *= w.kind === 'c' ? 0.9 : 0.86;
    const D = G.Drive;
    if (D && D.Snd) D.Snd.hit(0.35 + k * 0.3);
    if (G.Audio) { G.Audio.play('hitFlesh', { vol: 1 }); if (w.kind === 'c') G.Audio.play('pDeath', { vol: 0.7, female: !!w.fem }); else G.Audio.play('zPain', { vol: 0.6 }); }
    if (G.Camera && G.Camera.shake) G.Camera.shake(0.3);
    S.hits[w.kind]++;
    react(w.kind === 'c' ? 'civ' : 'z');
  }
  function react(kind) {
    if (kind === 'civ') {
      const L = HIT_CIV[S.civN++ % HIT_CIV.length];
      S.pendingTalk = L;
    } else if (!K.talking() && S.zSay <= 0 && Math.random() < 0.5) { S.zSay = 6; say('alem', pick(HIT_Z)); }
  }
  function walkerUpdate(w, dt, c) {
    w.time += dt;
    const D = G.Drive, speed = Math.abs(c.v);
    // lejos por detrás: fuera
    if (w.pos.z < c.z - 45 && w.mode !== 'rattle') { free(w); return; }
    if (w.pos.z > c.z + 110) { w.h.root.visible = false; return; }
    w.h.root.visible = true;
    const dx = c.x - w.pos.x, dz = c.z - w.pos.z, d = Math.hypot(dx, dz);
    w.v = 0;
    switch (w.mode) {
      case 'rattle':
        // la reja ya no está: a por el coche
        if (!S.gateOn && w.kind === 'z') charge(w);
        break;
      case 'idle': case 'feed': case 'wander':
        if (w.kind === 'z' && d < 30 && dz < 0 && dz > -30 && speed > 0.5) charge(w);
        if (w.mode === 'wander') {
          w.wt = (w.wt || 0) - dt;
          if (w.wt <= 0) { w.wt = R(1.5, 3.5); w.wf = Math.random() * Math.PI * 2; }
          const sp = 0.7, nx = w.pos.x + Math.sin(w.wf) * sp * dt, nz = w.pos.z + Math.cos(w.wf) * sp * dt;
          if (w.home && Math.hypot(nx - w.home.x, nz - w.home.z) < 3.5 && Math.abs(nx) < 8.6) { w.pos.x = nx; w.pos.z = nz; w.v = sp; w.facing = U.turnToward(w.facing, w.wf, dt * 3); }
        }
        break;
      case 'wait':
        // los que cruzan: cuando el coche está cerca, salen corriendo
        if (dz < 0 && dz > -34) { w.mode = 'run'; w.spd = w.kind === 'c' ? 5.6 : 6.0; w.path = [{ x: w.crossTo, z: w.pos.z + (w.kind === 'c' ? 1.5 : -1) }]; w.pi = 0; if (w.kind === 'c' && G.Audio) G.Audio.play('pHurt', { female: !!w.fem, vol: 0.6 }); }
        break;
      case 'beg':
        if (!S.begSaid && d < 45) { S.begSaid = true; S.pendingTalk = BEG; }
        if (d < 9 && speed > 1) { w.mode = 'run'; w.npcPose = null; w.spd = 4.5; w.path = [{ x: w.pos.x - 6, z: w.pos.z - 2 }]; w.pi = 0; }
        break;
      case 'run': {
        const p = w.path && w.path[w.pi];
        if (!p) { w.mode = w.kind === 'z' ? 'idle' : 'idle'; if (w.flee || Math.abs(w.pos.x) > 9.5) free(w); break; }
        const ex = p.x - w.pos.x, ez = p.z - w.pos.z, ed = Math.hypot(ex, ez), s = Math.min(ed, w.spd * dt);
        if (ed < 0.3) w.pi++;
        else { w.pos.x += ex / ed * s; w.pos.z += ez / ed * s; w.v = w.spd; w.facing = U.turnToward(w.facing, Math.atan2(ex, ez), dt * 9); }
        break;
      }
      case 'charge': {
        // a por el coche (un poco por delante de donde está)
        const tx = c.x + Math.sin(c.h) * c.v * 0.35, tz = c.z + Math.cos(c.h) * c.v * 0.35;
        const ex = tx - w.pos.x, ez = tz - w.pos.z, ed = Math.hypot(ex, ez) || 1;
        w.pos.x += ex / ed * w.spd * dt; w.pos.z += ez / ed * w.spd * dt; w.v = w.spd;
        w.facing = U.turnToward(w.facing, Math.atan2(ex, ez), dt * 10);
        break;
      }
      case 'cling': {
        // agarrado a la puerta: golpea la ventanilla. Con el coche parado no se suelta nunca; se cae si el coche
        // corre mucho, o tras un rato en marcha (C.t solo cuenta mientras el coche se mueve)
        const C = w.cling;
        if (speed > 2.5) C.t += dt;
        const ca = Math.cos(c.h), sa = Math.sin(c.h);
        w.pos.x = c.x + (-ca) * C.side * 1.25 + sa * C.along; w.pos.z = c.z + sa * C.side * 1.25 + ca * C.along;
        w.facing = c.h - C.side * Math.PI / 2 * -1;
        // (en la parada final, frente a la estación, golpea menos y más flojo: que la charla se oiga)
        const endStop = S.ph === 'stop' || S.ph === 'look' || S.ph === 'dark' || S.ph === 'drone';
        if ((C.bang -= dt) <= 0) { C.bang = endStop ? R(1.2, 2.2) : R(0.35, 0.7); if (G.Audio) G.Audio.play(Math.random() < 0.6 ? 'bang' : 'hitBlunt', { vol: endStop ? 0.4 : 0.7 }); if (G.Camera && G.Camera.shake) G.Camera.shake(0.1); if (D && D.car) D.car.rollV += C.side * 0.25; }
        if (speed > 7.5 || (C.t > 3.5 && speed > 4)) { w.mode = 'fly'; w.fly = { vx: -Math.cos(c.h) * C.side * 3 + Math.sin(c.h) * c.v * 0.6, vz: Math.sin(c.h) * C.side * 3 + Math.cos(c.h) * c.v * 0.6, vy: 2, rx: 0, rz: 0, wx: -4, wz: C.side * 4, y: 1.0, t: 0 }; w.cling = null; if (G.Audio) G.Audio.play('hitFlesh', { vol: 0.7 }); }
        break;
      }
      case 'fly': {
        const F = w.fly;
        F.t += dt; F.vy -= 9.8 * dt;
        w.pos.x += F.vx * dt; w.pos.z += F.vz * dt; F.y += F.vy * dt;
        F.vx *= 1 - dt * 0.6; F.vz *= 1 - dt * 0.6;
        F.rx += F.wx * dt; F.rz += F.wz * dt;
        if (F.y <= 0.15 && F.vy < 0) {
          if (Math.abs(F.vy) > 3 && F.t < 2) { F.vy *= -0.3; F.y = 0.15; F.wx *= 0.5; if (G.Audio) G.Audio.play('land', { vol: 0.4 }); }
          else { w.lie(Math.cos(F.rx) > 0 ? 1 : -1); w.fly = null; w.decalAt(w.pos.x, w.pos.z); break; }
        }
        break;
      }
    }
    // contra el coche (los que están de pie)
    if (w.mode !== 'fly' && w.mode !== 'lie' && w.mode !== 'cling' && w.mode !== 'off') {
      const ca = Math.cos(c.h), sa = Math.sin(c.h);
      const rx = w.pos.x - c.x, rz = w.pos.z - c.z;
      const lx = rx * ca - rz * sa, lz = rx * sa + rz * ca;
      if (Math.abs(lx) < WID / 2 + 0.32 && Math.abs(lz) < LEN / 2 + 0.38) {
        if (speed > 3.0) hitWalker(w, c, speed);
        else if (w.kind === 'z' && (w.mode === 'charge' || w.mode === 'rattle') && Math.abs(lz) < LEN / 2 - 0.4 && !S.gateOn) {
          w.mode = 'cling'; w.cling = { side: lx > 0 ? -1 : 1, along: U.clamp(lz, -1.2, 1.2), t: 0, bang: 0.2 };
          if (!K.talking() && S.clingSay <= 0) { S.clingSay = 8; say('alem', pick(CLING)); }
        } else {
          // de lado y despacio: lo aparta
          const push = (WID / 2 + 0.33 - Math.abs(lx)) * Math.sign(lx || 1);
          w.pos.x += ca * push; w.pos.z -= sa * push;
        }
      }
      // los que cruzan: si pasa rozando, Javier lo dice
      if (w.kind === 'c' && !w.nearSaid && Math.abs(lx) < WID / 2 + 1.4 && Math.abs(lz) < 3 && speed > 4 && w.mode !== 'fly') { w.nearSaid = true; if (!S.hitsAny()) S.pendingTalk = S.pendingTalk || NEAR_CIV; }
    }
    // dibujarlo
    w.phase += dt * (w.kind === 'z' ? (1.4 + w.v * 3.4) : Math.PI * 2 * (0.62 + 0.21 * Math.min(6, w.v)) * (w.v > 0.1 ? 1 : 0));
    const h = w.h;
    h.root.position.set(w.pos.x, w.mode === 'fly' ? w.fly.y : (w.mode === 'cling' ? 0 : ground(w.pos.x, w.pos.z)), w.pos.z);
    h.root.rotation.y = w.facing;
    if (w.still) return;
    const m0 = w.mode;
    // (en el aire: la pose de correr congelada, el cuerpo dando vueltas)
    if (w.kind === 'z') { w.mode = m0 === 'charge' || m0 === 'run' ? 'run' : (m0 === 'cling' ? 'rattle' : (m0 === 'wander' ? 'idle' : m0)); w.poseZ(dt); }
    else { w.mode = m0 === 'beg' || m0 === 'wait' ? 'idle' : m0; w.poseC(dt); }
    w.mode = m0;
    if (m0 === 'fly') { h.body.rotation.set(w.fly.rx, 0, w.fly.rz); h.body.position.y = 0.9; }
    if (m0 === 'lie') w.still = true;
  }

  // ---------- La nave del depósito (antes de la avenida) y la reja ----------
  const basic = (c) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.toneMapped = false; return m; };
  function buildDepot(sc) {
    const m = new G.Mesher(), E = G.Road.extra;
    const X = 8.6, Z0 = -20, Z1 = -2, H = 5.0;
    m.box(0, -0.05, (Z0 + Z1) / 2 - 0.2, X * 2 + 0.6, 0.1, Z1 - Z0 + 0.4, 0x4a4a46);                       // suelo
    for (const z of [-17, -13, -9, -5]) m.box(0, 0.004, z, X * 2, 0.008, 0.08, 0x3a3a36);                    // juntas
    m.box(0, -0.05, -1, 20, 0.1, 2.2, 0x55554f);                                                              // la explanada de la salida
    const wallC = 0x6a6e6c;
    for (const s of [-1, 1]) { m.box(s * (X + 0.15), H / 2, (Z0 + Z1) / 2, 0.3, H, Z1 - Z0, wallC); E.push({ x0: s > 0 ? X : -X - 0.3, x1: s > 0 ? X + 0.3 : -X, z0: Z0, z1: Z1 }); }
    m.box(0, H / 2, Z0 - 0.15, X * 2 + 0.6, H, 0.3, wallC); E.push({ x0: -X, x1: X, z0: Z0 - 0.3, z1: Z0 });
    for (const s of [-1, 1]) { m.box(s * (X + 3) / 2, H / 2, Z1 + 0.15, X - 3, H, 0.3, wallC); E.push({ x0: s > 0 ? 3 : -X, x1: s > 0 ? X : -3, z0: Z1, z1: Z1 + 0.3 }); }
    m.box(0, 4.1, Z1 + 0.15, 6.2, 1.8, 0.3, wallC);                                                          // dintel sobre la salida
    m.box(0, H + 0.05, (Z0 + Z1) / 2, X * 2 + 0.6, 0.1, Z1 - Z0 + 0.3, 0x3a3c3a);                           // techo
    // el portón subido, enrollado arriba
    m.cyl(0, 3.05, Z1 + 0.35, 0.28, 0.28, 6.0, 0x4a4c4e, 10, undefined, 0, 0, Math.PI / 2);
    // dentro: los otros coches requisados, estanterías, neumáticos, bidones
    const fput = (type, x, z, fx, fz, ex) => {
      const t = G.Furniture.T[type], along = Math.abs(fz) > 0.5, hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
      const f = Object.assign({ type, lv: 0, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y: 0, h: t.h, fx, fz, seed: Math.floor(Math.random() * 1e9), cont: null, solid: true }, ex || {});
      G.Furniture.draw(m, f);
      if (t.vehicle || t.block || t.tall) E.push({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, car: !!t.vehicle });
    };
    fput('camioneta', -4.8, -9.5, 0, 1, { col: 0x5a5a52 }); fput('coche', 5.2, -9.8, 0, -1, { col: 0x6a2a2a }); fput('coche', 4.8, -16.2, -1, 0, { col: 0x9a9a92 });
    for (const z of [-18.4, -16.4, -12.6, -10.6, -5.4]) fput('estanteria', 8.42, z, -1, 0);
    fput('neumaticos', 7.8, -3.4, -1, 0); fput('bidones', -6.0, -2.9, 0, -1); fput('montacargas', -6.6, -5.8, 0, -1); fput('cajas', -8.2, -17.0, 1, 0); fput('palets', -8.3, -14.4, 1, 0);
    const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    sc.add(mesh); S.objs.push(mesh);
    // las luces de emergencia: una roja que gira junto a la salida y una blanca, débil, al fondo
    const red = new THREE.PointLight(0xff2a14, 1.6, 14, 1.6); red.position.set(-3.6, 4.2, -2.6); sc.add(red); S.objs.push(red); S.red = red;
    const em = basic(0x501010); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.25), em); lamp.position.copy(red.position); sc.add(lamp); S.objs.push(lamp); S.redM = em;
    const wl = new THREE.PointLight(0xb8c8d8, 0.55, 18, 1.8); wl.position.set(0, 4.6, -15); sc.add(wl); S.objs.push(wl);
    // las chispas del puente (dentro del coche, bajo el volante)
    const sp = new THREE.PointLight(0xffd8a0, 0, 4, 2); sp.position.set(0.4, 0.8, -11.2); sc.add(sp); S.objs.push(sp); S.spark = sp;
    // la reja: tres hojas de barrotes en la salida (x -3 a 3)
    S.gate = [];
    const gm = new THREE.MeshLambertMaterial({ color: 0x3a3c3e });
    for (const x of [-2, 0, 2]) {
      const g = new THREE.Group();
      const fr = (w, h, px, py) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), gm); b.position.set(px, py, 0); g.add(b); };
      fr(2.0, 0.08, 0, 2.45); fr(2.0, 0.08, 0, 0.1); fr(2.0, 0.06, 0, 1.25);
      for (let q = -0.9; q <= 0.91; q += 0.15) fr(0.035, 2.4, q, 1.25);
      g.position.set(x, 0, Z1 + 0.5);
      sc.add(g); S.objs.push(g);
      S.gate.push({ g, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, fly: false, x });
    }
    S.gateObs = { x0: -3, x1: 3, z0: Z1 + 0.4, z1: Z1 + 0.6, what: 'gate' };
    E.push(S.gateObs);
    S.gateOn = true;
    // los corredores agarrados a la reja (por fuera)
    for (const x of [-2.2, -0.7, 0.8, 2.3]) { const w = getW('z'); if (!w) break; put(w, x, Z1 + 1.15 + R(0, 0.3), Math.PI, 'rattle'); }
  }
  function smashGate(c) {
    if (!S || !S.gateOn) return;
    S.gateOn = false;
    S.gateObs.off = true;
    const v = Math.abs(c.v);
    for (const p of S.gate) { p.fly = true; p.vx = (p.x) * R(0.6, 1.2) + R(-1, 1); p.vz = v * R(0.7, 1.0); p.vy = R(2, 4); p.wx = R(-4, -2); p.wz = R(-3, 3); }
    if (G.Audio) { G.Audio.play('clang', { vol: 1 }); G.Audio.play('clang', { vol: 0.8, delay: 0.08 }); G.Audio.play('doorBreak', { vol: 0.9 }); }
    if (K) K.objDone();
    S.gateT = 0;
  }
  function gateUpdate(dt) {
    for (const p of S.gate || []) {
      if (!p.fly) continue;
      p.vy -= 9.8 * dt;
      p.g.position.x += p.vx * dt; p.g.position.z += p.vz * dt; p.g.position.y = Math.max(0, p.g.position.y + p.vy * dt);
      if (p.g.position.y <= 0 && p.vy < 0) { p.vx *= 0.5; p.vz *= 0.5; p.vy = 0; p.wx *= 0.4; p.wz *= 0.4; p.g.rotation.x = U.lerp(p.g.rotation.x, -Math.PI / 2, 0.3); if (Math.abs(p.vz) < 0.2) p.fly = false; }
      else { p.g.rotation.x += p.wx * dt; p.g.rotation.z += p.wz * dt; }
    }
  }

  // ---------- La estación en llamas (solo por fuera), al otro lado del cruce del final ----------
  function signTex(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const x = cv.getContext('2d');
    x.fillStyle = '#1c2a44'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = '#e8e6de'; x.font = '700 58px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 50);
    return new THREE.CanvasTexture(cv);
  }
  function buildStation(sc) {
    const zc = G.Road.crossZ(END_K), Z0 = zc + 9.4, ZB = zc + 30, ZB1 = zc + 46, HW = 23;
    const m = new G.Mesher(), glow = new G.Mesher();
    // la explanada (aparcamiento) y la acera
    m.box(0, -0.04, (Z0 + ZB) / 2, 90, 0.08, ZB - Z0, 0x26272a);
    for (let x = -18; x <= 18; x += 4) m.box(x, 0.006, Z0 + 6, 0.08, 0.012, 5, 0x9a9a94);
    m.box(0, 0.03, ZB - 1.2, HW * 2 + 6, 0.24, 2.4, 0x55554f);
    // el edificio: dos plantas, cuerpo central con la entrada y dos alas
    const wall = 0x5c6466, dk = 0x2a2e30, lt = 0x8a9294;
    m.box(0, 4.6, (ZB + ZB1) / 2, HW * 2, 9.2, ZB1 - ZB, wall);
    m.box(0, 9.5, (ZB + ZB1) / 2, HW * 2 + 0.4, 0.6, ZB1 - ZB + 0.4, lt);
    m.box(0, 5.4, ZB - 1.4, 12, 10.8, 2.8, U.shade(wall, 1.08));                    // el cuerpo de la entrada
    for (const x of [-4.6, -1.6, 1.6, 4.6]) m.box(x, 1.8, ZB - 3.0, 0.5, 3.6, 0.5, lt);   // columnas
    m.box(0, 3.75, ZB - 3.0, 11, 0.3, 1.2, lt);                                      // marquesina
    m.box(0, 1.4, ZB - 2.82, 4.2, 2.6, 0.06, 0x1a1e22);                              // puertas de cristal (rotas, a oscuras)
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) m.box(s * (1.6 + i * 0.1), 0.18 + i * 0.12, ZB - 3.6 - i * 0.35, 6, 0.12, 0.35, 0x6a6a64);   // escalones
    // ventanas: muchas iluminadas por el fuego de dentro (naranja), otras negras, rotas
    for (const fl of [0, 1]) for (let x = -21; x <= 21; x += 3) {
      if (Math.abs(x) < 6.5) continue;
      const y = 2.0 + fl * 4.0, fire = Math.random() < (fl ? 0.55 : 0.4);
      m.box(x, y, ZB - 0.03, 1.6, 1.8, 0.06, dk);
      (fire ? glow : m).box(x, y, ZB - 0.07, 1.4, 1.6, 0.04, fire ? pick([0xff8a2a, 0xffa040, 0xe0601a]) : 0x0e1012);
    }
    // el portón del garaje de las patrullas (a un lado), abierto y oscuro; el mástil con la bandera
    m.box(HW - 4.5, 1.8, ZB - 0.04, 6, 3.6, 0.08, 0x101214);
    m.cyl(-HW + 3, 5, ZB - 6, 0.08, 0.1, 10, 0xb8b8b0, 8);
    m.box(-HW + 3 + 0.9, 9.2, ZB - 6, 1.8, 1.0, 0.04, 0x3a4a7a);
    // los patrulleros de la explanada (uno ardiendo) y barreras
    const fput = (type, x, z, fx, fz, ex) => { const t = G.Furniture.T[type], along = Math.abs(fz) > 0.5, hw = (along ? t.w : t.d) / 2, hd = (along ? t.d : t.w) / 2;
      G.Furniture.draw(m, Object.assign({ type, lv: 0, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y: 0, h: t.h, fx, fz, seed: Math.floor(Math.random() * 1e9), cont: null, solid: true }, ex || {})); };
    fput('patrulla', -12, Z0 + 7, 0, 1); fput('patrulla', -6.5, Z0 + 8, 0.3, 0.95); fput('patrulla', 9, Z0 + 6.5, 0, 1); fput('ambulancia', 16, Z0 + 12, -0.6, 0.8);
    for (const x of [-3.5, -1.2, 1.2, 3.5]) fput('barrera', x, Z0 + 1.2, 0, -1);
    const mesh = new THREE.Mesh(m.build(), new THREE.MeshLambertMaterial({ vertexColors: true })); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); sc.add(mesh); S.objs.push(mesh);
    const mg = new THREE.MeshBasicMaterial({ vertexColors: true }); mg.toneMapped = false;
    const gmesh = new THREE.Mesh(glow.build(), mg); gmesh.matrixAutoUpdate = false; gmesh.updateMatrix(); sc.add(gmesh); S.objs.push(gmesh);
    // el letrero
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: signTex('POLICÍA · DISTRITO NORTE') }));
    sign.position.set(0, 7.8, ZB - 2.84); sign.rotation.y = Math.PI; sc.add(sign); S.objs.push(sign);
    // el fuego: en el tejado, por las ventanas y en un patrullero; el humo que sube y el resplandor
    const fire = G.Road.fireTex, glowT = G.Road.glowTex;
    S.flames = [];
    const flame = (x, y, z, s) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa050, fog: false }));
      sp.material.toneMapped = false; sp.position.set(x, y, z); sp.scale.set(s, s * 1.3, 1); sc.add(sp); S.objs.push(sp);
      S.flames.push({ sp, s, ph: Math.random() * 10 });
    };
    for (const [x, s] of [[-17, 7], [-9, 9], [-2, 6], [6, 10], [14, 8], [20, 6]]) flame(x, 10.8 + s * 0.3, ZB + R(2, 9), s);
    for (const x of [-15, -6, 12, 18]) flame(x, 6, ZB - 0.3, 3.2);
    flame(-12, 1.8, Z0 + 7, 4);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff6a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, fog: false }));
    halo.material.toneMapped = false; halo.position.set(0, 12, ZB + 6); halo.scale.set(110, 50, 1); sc.add(halo); S.objs.push(halo); S.halo = halo;
    S.smoke = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0x1e1814, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      s.position.set(R(-15, 15), 12, ZB + R(3, 12)); sc.add(s); S.objs.push(s); S.smoke.push({ sp: s, t: i / 14, x: s.position.x });
    }
    const L1 = new THREE.PointLight(0xff7a2a, 0, 55, 1.4); L1.position.set(-8, 8, ZB - 6); sc.add(L1);
    const L2 = new THREE.PointLight(0xff8a3a, 0, 55, 1.4); L2.position.set(10, 7, ZB - 5); sc.add(L2);
    S.objs.push(L1, L2); S.fireL = [L1, L2];
    // los corredores de alrededor (en la explanada, en la entrada; uno comiendo)
    for (const [x, z, mode] of [[-3, ZB - 5, 'wander'], [2.5, ZB - 6.5, 'wander'], [-14, Z0 + 10, 'wander'], [11, Z0 + 3, 'idle'], [6, ZB - 4, 'wander']]) {
      const w = getW('z'); if (!w) break;
      put(w, x, z, R(0, 6), mode); w.home = { x, z }; w.station = true;
    }
    S.stationZ = ZB;
  }
  function stationUpdate(dt) {
    const T = S.T;
    for (const f of S.flames || []) { const q = 0.82 + 0.18 * Math.sin(T * 11 + f.ph) * Math.sin(T * 6.3 + f.ph * 2); f.sp.scale.set(f.s * q, f.s * 1.3 * (0.88 + 0.12 * Math.sin(T * 8 + f.ph)), 1); }
    if (S.halo) S.halo.material.opacity = 0.36 + Math.sin(T * 2.3) * 0.05;
    for (const s of S.smoke || []) { s.t = (s.t + dt * 0.06) % 1; s.sp.position.y = 12 + s.t * 40; s.sp.position.x = s.x + s.t * 8; const sc = 10 + s.t * 30; s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = 0.42 * Math.sin(Math.PI * s.t); }
    const c = G.Drive && G.Drive.car;
    const near = c && S.stationZ && c.z > S.stationZ - 130;
    for (const L of S.fireL || []) L.intensity = near ? 2.2 + Math.sin(T * 13 + L.position.x) * 0.4 + (Math.random() - 0.5) * 0.3 : 0;
  }

  // ---------- El puente: chispas, dos intentos y arranca ----------
  function hotFx(kind) {
    const D = G.Drive;
    if (kind === 'panel') { if (G.Audio) { G.Audio.play('rustle', { vol: 0.8 }); G.Audio.play('clang', { vol: 0.25, delay: 0.3 }); } }
    else if (kind === 'spark') { if (D && D.Snd) D.Snd.spark(1); if (G.Audio) G.Audio.play('crackle', { vol: 1 }); S.sparkT = 0.25; }
    else if (kind === 'crank') { if (D && D.Snd) D.Snd.crank(); }
    else if (kind === 'cough') { if (D && D.Snd) D.Snd.cough(); }
    else if (kind === 'start') {
      if (D) D.engineOn();
      if (G.Audio) G.Audio.play('crackle', { vol: 0.6 });
    }
  }

  // ---------- El final: el plano desde lo alto y el coche que se va ----------
  function droneOn() {
    const D = G.Drive, zc = G.Road.crossZ(END_K), cam = K.host() && K.host().camera;
    D.camFix = { eye: { x: 15, y: 24, z: zc - 27 }, at: { x: -5, y: 3, z: zc + 16 } };
    D.fogFar = 96;
    if (cam) { cam._far0 = cam._far0 || cam.far; cam.far = Math.max(cam.far || 0, 160); if (cam.updateProjectionMatrix) cam.updateProjectionMatrix(); }
    const hud = document.getElementById('drive-hud'); if (hud) hud.classList.add('hidden');
  }
  function leave() {
    const D = G.Drive, zc = G.Road.crossZ(END_K), c = D.car;
    D.frozen = false;
    D.auto = { pts: [{ x: c.x, z: zc - 9 }, { x: c.x - 3.6, z: zc - 3.4 }, { x: -20, z: zc - 2.6 }, { x: -70, z: zc - 2.6 }, { x: -128, z: zc - 2.6 }], i: 0, spd: 13 };
  }

  // ---------- Las fases ----------
  function fresh() {
    return { ph: 'load', t: 0, T: 0, objs: [], wz: [], wc: [], enc: ENC.map((e) => Object.assign({}, e)), ride: 0, hot: 0, hotFx: 0, gateOn: false, gate: null,
      hits: { c: 0, z: 0 }, civN: 0, zSay: 0, clingSay: 0, pendingTalk: null, begSaid: false, sparkT: 0, hitsAny() { return this.hits.c > 0; } };
  }
  const RoadLife = {
    get active() { return !!S; },
    get phase() { return S ? S.ph : null; },
    get state() { return S; },
    END_K,
    // al volante: la pantalla de carga (se tira el mapa a pie; la calle, la nave y la estación, detrás)
    begin(player, kit, fromCp) {
      K = kit; pl = player;
      S = fresh();
      const H = K.host();
      const work = () => {
        if (G.NPCs) G.NPCs.clear();
        if (G.Huida && G.Huida.dropFoot) G.Huida.dropFoot();
        if (!fromCp) H.map('vacio');            // (desde el punto de control, el mapa ya lo puso la partida)
        player.hidden = true; player.auto = null; player.storyPose = null; player.struggle = null;
        if (G.Combat) G.Combat.peaceful = true;
        G.Drive.toRoad({ camera: H.camera, x: 0, z: -11.6, v: 0, h: 0, type: 'coche', col: 0x2c3e34, engineOff: true, road: { minK: 0, endK: END_K } });
        G.Drive.begin({ engineOff: true, hud: false });
        G.Drive.frozen = true;
        const sc = G.Drive.scene;
        for (let i = 0; i < 16; i++) S.wz.push(makeWalker(sc, 'z'));
        for (let i = 0; i < 7; i++) S.wc.push(makeWalker(sc, 'c', i % 2 === 1));
        buildDepot(sc);
        buildStation(sc);
        if (G.CitySound) { G.CitySound.start(1.2); G.CitySound.chaos = 1; }
        K.quiet(true);
      };
      if (fromCp) { work(); S.ph = 'ready'; return; }
      if (H && H.loading) H.loading(work, () => { if (H.fadeTo) { H.fadeTo(1, 0); H.fadeTo(0, 1.6); } S.ph = 'hot'; S.t = 0; }, 3.0);
      else { work(); S.ph = 'hot'; }
    },
    // (desde el punto de control: ya está todo armado; empieza el puente)
    start() { if (S && S.ph === 'ready') { S.ph = 'hot'; S.t = 0; } },
    smashGate,
    // cada fotograma (desde G.Huida.update)
    flow(dt, player) {
      if (!S) return;
      pl = player;
      S.t += dt; S.T += dt;
      S.zSay -= dt; S.clingSay -= dt;
      const D = G.Drive, c = D && D.car;
      if (!c || S.ph === 'load' || S.ph === 'ready') return;
      // las luces de emergencia de la nave, las chispas, la reja que vuela
      if (S.red) { const v = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(S.T * 2.4)), 2); S.red.intensity = 1.6 * v; S.redM.color.setRGB(0.4 + 0.6 * v, 0.06 * v, 0.04 * v); }
      if (S.spark) { S.sparkT -= dt; S.spark.intensity = S.sparkT > 0 ? 1.4 + Math.random() * 1.6 : 0; }
      gateUpdate(dt);
      stationUpdate(dt);
      // los encuentros que se acercan
      for (const e of S.enc) if (!e.done && c.z > e.z - 92) { e.done = true; setupEnc(e); }
      for (const w of S.wz) if (w.on && w.mode !== 'off') walkerUpdate(w, dt, c);
      for (const w of S.wc) if (w.on && w.mode !== 'off') walkerUpdate(w, dt, c);
      // los de la reja: con el coche en marcha cerca, golpean (el sonido de los barrotes)
      if (S.gateOn && (S.clangT = (S.clangT || 0) - dt) <= 0) { S.clangT = R(0.4, 1.1); if (G.Audio) G.Audio.play('clang', { vol: R(0.35, 0.7), pan: R(-0.4, 0.4) }); }
      if (S.ph === 'hot') {
        // el puente: las frases y lo que suena, a su tiempo
        while (S.hot < HOT.length && S.t >= HOT[S.hot][0]) { const [, w, l] = HOT[S.hot++]; say(w, l); }
        while (S.hotFx < HOT_FX.length && S.t >= HOT_FX[S.hotFx][0]) hotFx(HOT_FX[S.hotFx++][1]);
        if (S.t > 15.6) {
          S.ph = 'drive'; S.t = 0;
          D.frozen = false;
          K.quiet(false);
          K.setObj('Atraviesa la reja');
          D.hint(G.Input && G.Input.isTouch ? 'Acelera a fondo contra la reja' : 'W: acelerar a fondo contra la reja', 5);
        }
        return;
      }
      if (S.ph === 'drive') {
        // las charlas por la avenida (y las de lo que va pasando)
        if (!K.talking() && S.pendingTalk) { const L = S.pendingTalk; S.pendingTalk = null; talk(L); }
        if (!K.talking() && S.ride < RIDE.length && c.z > RIDE[S.ride].z) talk(RIDE[S.ride++].l);
        if (!S.gateOn && !S.objSet && c.z > 6) { S.objSet = true; K.setObj('Llega a la estación de policía'); }
        // se queda parado mucho rato: Alem lo apura
        S.idle = (Math.abs(c.v) < 1 && !S.gateOn) ? (S.idle || 0) + dt : 0;
        if (S.idle > 14 && !K.talking()) { S.idle = 0; say('alem', pick(['¡Javier! ¡Arranca!', '¡No te pares aquí!', '¡Vamos, conduce!'])); }
        // la estación a la vista: el coche se para solo, siempre en el mismo sitio (a unos 50 m de la estación)
        const zc = G.Road.crossZ(END_K);
        if (c.z > zc - 72) {
          S.ph = 'stop'; S.t = 0;
          D.auto = { pts: [{ x: U.clamp(c.x, -3.4, 3.4), z: zc - 18 }], i: 0, spd: Math.max(6, Math.abs(c.v)), stop: true };
          K.objDone();
          talk(STOP);
        }
        return;
      }
      if (S.ph === 'stop') {
        if (D.auto && D.auto.done && Math.abs(c.v) < 0.3 && S.t > 1.2) {
          D.auto = null; D.frozen = true;
          S.ph = 'look'; S.t = 0;
          talk(LOOK, () => { S.ph = 'dark'; S.t = 0; const H = K.host(); if (H && H.fadeTo) H.fadeTo(1, 3.4); });
        }
        return;
      }
      if (S.ph === 'dark' && S.t > 3.8) {
        // el plano desde lo alto: la estación ardiendo, el coche pequeño en el cruce
        S.ph = 'drone'; S.t = 0;
        droneOn();
        const H = K.host(); if (H && H.fadeTo) H.fadeTo(0, 2.4);
        return;
      }
      if (S.ph === 'drone') {
        if (S.t > 2.6 && !S.finalTalk) { S.finalTalk = true; talk(FINAL, () => { S.ph = 'leave'; S.t = 0; leave(); }); }
        return;
      }
      if (S.ph === 'leave') {
        // el coche se va por la transversal hasta perderse; a negro
        if ((c.x < -62 || S.t > 13) && !S.out) {
          S.out = true; S.t = 0; S.ph = 'out';
          const H = K.host(); if (H && H.fadeTo) H.fadeTo(1, 3.0);
        }
        return;
      }
      if (S.ph === 'out' && S.t > 3.4 && !S.ended) {
        S.ended = true;
        if (K.finish) K.finish();
      }
    },
    clear() {
      if (!S) return;
      for (const w of S.wz.concat(S.wc)) { w.dispose(); }
      for (const o of S.objs) { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && o.material.map.dispose && o.material.map !== G.Road.fireTex && o.material.map !== G.Road.glowTex) o.material.map.dispose(); if (o.material.dispose) o.material.dispose(); } if (o.traverse) o.traverse((q) => { if (q !== o && q.geometry) q.geometry.dispose(); }); }
      S = null; K = null; pl = null;
    }
  };
  G.RoadLife = RoadLife;
})(window.Game = window.Game || {});
