// La vieja estación de policía de Oceanside en el final variante (el enfrentamiento final tras la caída):
//  · la entrada: tras la carga, la pantalla negra se aclara despacio y se ve al personaje llegar desde el patio y
//    entrar por la puerta de las oficinas; dentro, la puerta queda atrancada a su espalda;
//  · la primera misión: encontrar el casillero de armas de la policía, escondido en un rincón distinto cada vez.
//    Dentro: la escopeta de corredera, el rifle y el revólver, mejorados al máximo.
//  · mientras se busca: chasqueadores por las salas (solo te oyen si caminas, corres o corres agachada; agachada y
//    despacio, no), los dos temblantes encerrados en la armería (se les oye todo el rato, de lejos) y cosas que se
//    oyen tras las paredes sin que haya nada: arrastres, una respiración, un golpe en una puerta;
//  · al coger las armas, todo se despierta: los temblantes derriban la puerta de la armería y, por la puerta de
//    fuera, entran tres Escorpiones (escopeta, rifle y pistola) que te siguieron hasta aquí, más listos que de
//    costumbre. Dos le echan en cara al tercero el ruido que hizo; los chasqueadores lo oyen y van a por ellos.
//    Luego salen dos corredores y un observador, y algo enorme empieza a golpear la pared de los calabozos (los
//    golpes del hongomorfo del salón; este no sale nunca). Tienes 1:50 para matar a los tres y huir por la valla
//    derribada del patio. Todos los de este enfrentamiento tienen el doble de vida.
(function (G) {
  'use strict';
  const U = G.Util;
  const R = (a, b) => a + Math.random() * (b - a);
  const el = (id) => document.getElementById(id);
  const KIT = ['escopeta', 'rifle', 'revolver'];
  const AMMO = { cartucho: 12, rifle: 10, revolver: 18 };
  const INTRO_T = 7.5;               // como mucho (si algo la frena, igual termina)
  const TIMER = 110;                 // 1:50 para matar a los tres Escorpiones y huir
  const HP_K = 2;                    // el doble de vida (todos los enemigos de este jefe)
  const KEEN = 1.8;                  // los chasqueadores de aquí oyen más lejos
  // dónde esperan los chasqueadores (cada uno en su sala: vestíbulo, sala de descanso, comedor y archivo)
  const BLIND_AT = [{ x: 17.5, z: 40.0 }, { x: 42.0, z: 23.0 }, { x: 51.0, z: 43.0 }, { x: 5.5, z: 11.5 }];
  // de dónde salen luego los dos corredores y el observador (los más lejos de ti y sin verte)
  const LATE_AT = [{ x: 46.0, z: 10.0 }, { x: 50.0, z: 53.0 }, { x: 40.0, z: 40.0 }, { x: 5.0, z: 37.5 }, { x: 55.0, z: 24.0 }, { x: 34.0, z: 6.0 }, { x: 20.0, z: 52.0 }];
  // los golpes del hongomorfo: la pared de los calabozos, la que da a la sala principal
  const BREACH = { x: 17, z: 6.6 };
  // los tres Escorpiones: el de la escopeta es el que reventó la puerta
  const ESC = ['tirador', 'pistolero', 'escopetero'];
  const HV = { hongo: true };        // (la voz del hongomorfo, para el rugido tras la pared)

  let S = null;                      // { intro, locker, open, taken, hintT, hints, seq... }
  let scene = null;
  const input = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
  const cam = { yaw: Math.PI, forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }, right() { return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }; } };

  function say(lines, who) {
    const s0 = el('m-sub');
    if (!s0) return;
    lines.forEach((ln, i) => setTimeout(() => {
      if (!S) return;
      s0.innerHTML = '<b>' + who + ':</b> ' + ln;
      s0.classList.remove('hidden');
      clearTimeout(s0._t);
      s0._t = setTimeout(() => s0.classList.add('hidden'), 3400);
    }, i * 3800));
  }
  function title(a, b) {
    const t = el('m-title');
    if (!t) return;
    t.innerHTML = '<b>' + a + '</b><span>' + b + '</span>';
    t.classList.remove('hidden', 'out');
  }

  // ---------- el casillero (abierto: las puertas de par en par y las tres armas de pie dentro) ----------
  let mat = null;
  function openMesh(f) {
    if (!mat) mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const T = G.Furniture.T.taquilla_pol, W = T.w, D = T.d, H = T.h;
    const g = new THREE.Group();
    const ry = Math.atan2(f.fx, f.fz);
    g.position.set((f.x0 + f.x1) / 2, f.y || 0, (f.z0 + f.z1) / 2);
    g.rotation.y = ry;
    // el frente cerrado queda tapado por el hueco abierto: fondo oscuro, laterales y estante (un poco hacia fuera)
    const F0 = D / 2 + 0.07, DEP = 0.2;
    const m = new G.Mesher();
    m.box(0, H / 2, F0, W - 0.04, H - 0.06, 0.012, 0x0e1218);                        // el fondo, oscuro
    for (const sx of [-1, 1]) m.box(sx * (W / 2 - 0.01), H / 2, F0 + DEP / 2, 0.025, H, DEP, 0x27354a);   // laterales
    m.box(0, H - 0.015, F0 + DEP / 2, W, 0.03, DEP, 0x27354a); m.box(0, 0.015, F0 + DEP / 2, W, 0.03, DEP, 0x1d2838);
    m.box(0, H / 2, F0 + DEP / 2, 0.02, H - 0.05, DEP, 0x1d2838);                       // la división del medio
    m.box(W / 4, H * 0.62, F0 + DEP / 2, W / 2 - 0.04, 0.02, DEP, 0x3a4450);           // estante (lado del revólver)
    const body = new THREE.Mesh(m.build(), mat);
    g.add(body);
    // las puertas, abiertas hacia fuera (bisagras en los laterales)
    const doors = [];
    for (const sx of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(sx * W / 2, 0, F0 + DEP);
      const dm = new G.Mesher();
      dm.box(-sx * W / 4, H / 2, 0.01, W / 2 - 0.01, H - 0.06, 0.02, 0x27354a);
      for (let k = 0; k < 5; k++) dm.box(-sx * W / 4, H - 0.22 - k * 0.045, 0.024, W * 0.3, 0.014, 0.01, 0x1d2838);
      dm.box(-sx * (W / 2 - 0.06), H * 0.5, 0.03, 0.022, 0.14, 0.025, 0xb8bcc0);
      hinge.add(new THREE.Mesh(dm.build(), mat));
      g.add(hinge);
      doors.push({ hinge, sx });
    }
    // las armas: la escopeta y el rifle de pie a la izquierda; el revólver tumbado en el estante de la derecha
    const guns = [];
    const B = new THREE.Matrix4(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const put = (id, basis, x, y) => {
      const gm = new THREE.Mesh(G.Models.weaponGeometry(id === 'revolver' ? 'revolver' : id + '_body'), mat);
      B.makeBasis(basis[0], basis[1], basis[2]); gm.setRotationFromMatrix(B);
      gm.updateMatrix();
      const bb = new THREE.Box3().setFromBufferAttribute(gm.geometry.attributes.position).applyMatrix4(gm.matrix);
      const holder = new THREE.Group(); holder.add(gm);
      gm.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      holder.position.set(x, y, F0 + DEP * 0.5);
      g.add(holder); guns.push(holder);
      return bb;
    };
    const UP = [V(0, 0, 1), V(0, 1, 0), V(-1, 0, 0)], FLAT = [V(0, 0, -1), V(1, 0, 0), V(0, -1, 0)];
    put('escopeta', UP, -W * 0.36, 0.035); put('rifle', UP, -W * 0.14, 0.035);
    put('revolver', FLAT, W / 4, H * 0.62 + 0.012);
    scene.add(g);
    return { g, doors, guns, t: 0 };
  }

  function findLocker() {
    const mp = G.Maps.get('comisaria'), at = mp && mp.lockerAt;
    if (!at) return null;
    const hit = G.World.furnNear(at.x, at.z, 1.2, 0).find((q) => q.f.type === 'taquilla_pol');
    return hit ? { f: hit.f, at } : null;
  }

  function giveKit(player) {
    // mejoras al máximo (en la carrera quedan guardadas)
    const up = G.Run && G.Run.maxUpgrades ? G.Run.maxUpgrades(KIT) : null;
    if (!up) {
      const u = {};
      for (const id of KIT) { u[id] = {}; for (const x of G.Weapons.UPGRADES[id] || []) u[id][x.id] = true; }
      G.Weapons.applyUpgrades(u);
    }
    const got = [], left = [], full = [];
    // (lo que no cabe o lo que sueltas para cogerlas queda en el suelo, delante del casillero: no se pierde nada)
    const fp = S && S.locker ? G.Furniture.frontPoint(S.locker.f) : { x: player.pos.x, z: player.pos.z };
    const drop = (id, mag, k) => { const it = G.World.dropItem(fp.x + (k - 1) * 0.45, fp.z, id, mag || 0, 0); if (it) it.dur = 1; };
    KIT.forEach((id, k) => {
      const w = G.Weapons.get(id);
      if (!player.canUse(id)) { left.push(w.name); drop(id, w.mag, k); return; }
      // (si ya la llevas, la tuya queda mejorada al máximo igual: no hace falta otra)
      if (player.hands.concat(player.stored || []).some((q) => q && q.id === id)) { got.push(w.name); return; }
      const r = player.pickUp(id, w.mag);
      if (r && r.ok) { got.push(w.name); if (r.old && KIT.indexOf(r.old.id) < 0) drop(r.old.id, r.old.mag, k); }
      else { full.push(w.name); drop(id, w.mag, k); }
    });
    for (const k in AMMO) player.ammo[k] = (player.ammo[k] || 0) + AMMO[k];
    player.refreshModel();
    if (G.Run && G.Run.active) G.Run.keep(player);
    return { got, left, full };
  }

  // ---------- los enemigos ----------
  function freeSpot(x, z) {
    const W = G.World;
    for (let k = 0; k < 24; k++) {
      const a = k * 2.4, r = k * 0.18;
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (!W.circleBlocked(px, pz, 0.45, 0)) return { x: px, z: pz };
    }
    return { x, z };
  }
  function mkZ(kind, x, z, face, extra) {
    const p = freeSpot(x, z);
    const o = Object.assign({ lv: 0, blind: kind === 'blind', temb: kind === 'temb', stalker: kind === 'stalker' }, extra || {});
    const zz = new G.Zombie(scene, p.x, p.z, null, face || 0, o);
    zz.kind = kind; zz.station = true;
    zz.hp *= HP_K; zz.hpMax = zz.hp;
    return zz;
  }
  function enlist(zz) {
    zz.model.root.visible = true;
    if (G.Population.list.indexOf(zz) < 0) G.Population.list.push(zz);
    const L = G.Mode && G.Mode.list;
    if (L && L.indexOf(zz) < 0) L.push(zz);
  }
  function hostile(z) { return z && z.alive && !z.gone && !z.human && !z.ally && !z.phantom; }
  // un punto a «d» metros de ti, tras una pared (sin línea de vista): para lo que se oye y no se ve
  function behindWall(player, d0, d1) {
    const W = G.World;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, d = R(d0, d1);
      const x = player.pos.x + Math.sin(a) * d, z = player.pos.z + Math.cos(a) * d;
      if (x < 1.5 || z < 1.5 || x > 59.5 || z > 61.5) continue;
      if (!W.bldAt(Math.floor(x), Math.floor(z), 0)) continue;
      if (W.hasLOS(player.pos.x, player.pos.z, x, z, 0)) continue;
      return { x, z };
    }
    return null;
  }
  function play(id, o) { if (G.Audio) G.Audio.play(id, o || {}); }
  function msg(t, k) { if (G.Mode && G.Mode.onMessage) G.Mode.onMessage(t, k || 'bad'); }
  // lo que dice un escorpión: con su voz si estás cerca; si no, el subtítulo (se oye a gritos por el edificio)
  function escSay(h, text, player) {
    if (!h || !h.alive) return;
    const d = Math.hypot(h.pos.x - player.pos.x, h.pos.z - player.pos.z);
    if (d < 30 && G.Humans && G.Humans.Voice) { G.Humans.Voice.say(h, text, { prio: 4 }); return; }
    const s0 = el('m-sub');
    if (!s0) return;
    s0.innerHTML = '<b>' + h.name + ' (Escorpión):</b> ' + text;
    s0.classList.remove('hidden');
    clearTimeout(s0._t);
    s0._t = setTimeout(() => s0.classList.add('hidden'), 3300);
  }

  // la armería: su puerta atrancada (en la pared oeste, x 24) y lo que hay delante
  function armoryDoor() {
    const A = G.Maps.get('comisaria').armory;
    for (let z = A.z0; z < A.z1; z++) { const ref = { o: 'W', x: A.x0, z, lv: 0 }; if (G.World.isLocked(ref)) return ref; }
    return null;
  }

  // ---------- lo que se oye mientras buscas ----------
  function ambience(dt, player) {
    const A = S.armory;
    // (para el desafío «Ni un chasquido»: ¿te oyó alguno antes de coger las armas?)
    if (!S.heard && S.blind.some((z) => z.alive && z.locked)) S.heard = true;
    // los temblantes encerrados: gruñidos, algún golpe contra la puerta (se les oye de lejos)
    S.tembT -= dt;
    if (S.tembT <= 0 && S.temb.length) {
      S.tembT = R(4.5, 8.5);
      const t = S.temb[Math.floor(Math.random() * S.temb.length)];
      const r = Math.random(), at = { x: t.pos.x, z: t.pos.z, lv: 0, z0: t, vol: 1.7 };
      if (r < 0.22 && S.door) {
        const dx = S.door.x - 0.4, dz = S.door.z + 0.5;
        play('bang', { x: dx, z: dz, lv: 0, vol: 1.5 });
        if (Math.random() < 0.5) setTimeout(() => play('bang', { x: dx, z: dz, lv: 0, vol: 1.3 }), R(300, 520));
        if (G.Music) G.Music.dread(0.4, 6);
      } else play(r < 0.6 ? 'nGrowl' : 'zGroan', at);
    }
    // cerca de la armería: la presencia se nota
    const dA = Math.hypot(player.pos.x - A.cx, player.pos.z - A.cz);
    if (dA < 13 && G.Music) G.Music.dread(0.55 * (1 - dA / 13) + 0.15, 1);
    // tras las paredes, sin nada: un arrastre, una respiración, una puerta que golpea, un crujido
    S.presT -= dt;
    if (S.presT <= 0) {
      S.presT = R(22, 42);
      const r = Math.random();
      let p = null;
      if (r < 0.32 && (p = behindWall(player, 6, 11))) {
        play('drag', { x: p.x, z: p.z, lv: 0, vol: 1.3 });
        if (G.Music) G.Music.dread(0.45, 9);
      } else if (r < 0.55 && (p = behindWall(player, 3, 5))) {
        play('sBreath', { x: p.x, z: p.z, lv: 0, vol: 1.2 });
        setTimeout(() => { if (S) play('sBreath', { x: p.x, z: p.z, lv: 0, vol: 1.0 }); }, 1700);
        if (G.Music) G.Music.dread(0.6, 7);
      } else if (r < 0.75 && (p = behindWall(player, 10, 18))) {
        play('bang', { x: p.x, z: p.z, lv: 0, vol: 1.2 });
        if (G.Music) G.Music.dread(0.35, 6);
      } else if (r < 0.88 && (p = behindWall(player, 7, 14))) {
        for (let i = 0; i < 4; i++) setTimeout(() => { if (S) play('zStep', { x: p.x + i * 0.5, z: p.z, lv: 0, drag: i % 2 === 1, w: 1, heavy: true }); }, i * R(520, 700));
        if (G.Music) G.Music.dread(0.4, 7);
      } else play(Math.random() < 0.5 ? 'creakFar' : 'clang', { vol: 0.9 });
    }
  }

  // ---------- al coger las armas: todo se despierta ----------
  function breakArmory(player) {
    const W = G.World, ref = S.door;
    if (ref) {
      W.unlockEdge(ref);
      W.setEdge(ref, W.E.DOOR_BROKEN);
      // el escombro que la tapaba por fuera sale despedido (no estorba)
      for (const q of W.furnNear(ref.x - 0.8, ref.z + 0.5, 1.8, 0)) if (q.f.type === 'escombro_grande') W.smashFurn(q.c, q.f);
      const x = ref.x - 0.2, z = ref.z + 0.5;
      play('doorBreak', { x, z, lv: 0, vol: 1.6 }); play('wallBreak', { x, z, lv: 0, vol: 0.7 });
      W.emit(x, z, 18, 0);
      if (G.Camera.shake) G.Camera.shake(0.2);
    }
    // los dos temblantes salen: van a por ti
    S.temb.forEach((t, i) => {
      enlist(t); t.hunter = true; t.homebound = false;
      t.target = { x: player.pos.x, z: player.pos.z, lv: 0 }; t.lastSeen = 0;
      setTimeout(() => { if (t.alive) { play('tRoar', { x: t.pos.x, z: t.pos.z, lv: 0, z0: t }); t.enter('chase', 0); } }, 250 + i * 650);
    });
    S.temb = [];
    if (G.Mode) setTimeout(() => G.Mode.bark('stTemb'), 1800);
    msg('¡Los temblantes rompieron la puerta de la armería!');
  }
  function escEnter(player) {
    const W = G.World, E0 = G.Maps.get('comisaria').entry;
    // la puerta de fuera, la que se cerró a tu espalda: de una patada
    const ref = E0.door;
    W.unlockEdge(ref);
    W.setEdge(ref, W.E.DOOR_BROKEN);
    play('doorKick', { x: ref.x + 0.5, z: ref.z, lv: 0, vol: 1.6 }); play('doorBreak', { x: ref.x + 0.5, z: ref.z, lv: 0, vol: 1.4 });
    W.emit(ref.x + 0.5, ref.z, 22, 0);
    const sq = G.Humans.spawnSquad({ roles: ESC, at: { x: E0.from.x, z: E0.from.z - 1.2 }, active: false, face: Math.PI, diff: 1.25, noBeg: true, noRetreat: true, hpMul: HP_K });
    // más listos que de costumbre: ven antes y más lejos, reaccionan rápido y apuntan mejor
    for (const h of sq.members) {
      const r0 = h.R;
      h.R = Object.assign({}, r0, { react: [r0.react[0] * 0.55, r0.react[1] * 0.55], sight: r0.sight * 1.25, acc: Math.min(0.95, (r0.acc || 0.5) * 1.2) });
      if (r0.fov != null) h.R.fov = r0.fov * 1.2;
      if (h.pers) { h.pers.alert = 1; h.pers.brave = 1; }
      h.stationEsc = true;
      const L = G.Mode && G.Mode.list; if (L) L.push(h);
    }
    S.sq = sq; S.esc = sq.members.slice();
    if (G.Refugio && G.Refugio.ping) G.Refugio.ping(ref.x + 0.5, ref.z + 1, 'escorpion', 5);
    msg('Alguien reventó la puerta de fuera... Escorpiones');
    // el reproche: dos le echan en cara al de la escopeta el ruido que hizo
    const [ti, pi, es] = ['tirador', 'pistolero', 'escopetero'].map((r) => S.esc.find((h) => h.role === r));
    const her = player.female, la = her ? 'la' : 'lo', ella = her ? 'ella' : 'él';
    const L = [
      [ti, '¡Joder, ' + (es ? es.name : 'tío') + '! ¿Tenías que reventar la puerta? Ahora ya sabe que estamos aquí.'],
      [pi, 'Y no solo ' + ella + '. ¿Lo oís? Has despertado a todo el puto edificio, imbécil.'],
      [es, '¡Cerrad la boca de una vez! ' + (her ? 'La' : 'Lo') + ' seguimos hasta aquí para acabar con esto. Separaos y encontrad' + la + '.'],
      [ti, 'Como nos coman por tu culpa, te mato yo.']
    ];
    L.forEach(([h, t], i) => setTimeout(() => { if (S && h) escSay(h, t, player); }, 1300 + i * 3300));
  }
  // los Escorpiones se ponen en marcha: te buscan (solo atacan cuando te ven)
  function escHunt(player) {
    const sq = S.sq;
    if (!sq) return;
    sq.begin(true);
    sq.suspect(player.pos.x, player.pos.z, 0, 6);
    G.Humans.mixed = true;               // (y pelean contra los infectados que les salen)
  }
  // los chasqueadores oyeron el ruido: van a por ellos
  function blindWake() {
    S.mix = true;
    for (const z of S.blind) {
      if (!z.alive) continue;
      z.stMix = 'esc'; z.homebound = false; z.hunter = true;
      setTimeout(() => { if (z.alive) play('bClick', { x: z.pos.x, z: z.pos.z, lv: 0, z0: z, hunt: true, vol: 1.3 }); }, R(0, 900));
    }
    msg('Los chasqueadores los oyeron... van a por ellos');
  }
  // luego, dos corredores y un observador (de lejos, por donde no los veas)
  function lateWave(player) {
    const W = G.World;
    const spots = LATE_AT.filter((p) => !W.hasLOS(p.x, p.z, player.pos.x, player.pos.z, 0))
      .sort((a, b) => Math.hypot(b.x - player.pos.x, b.z - player.pos.z) - Math.hypot(a.x - player.pos.x, a.z - player.pos.z));
    S.late.forEach((z, i) => {
      const p = freeSpot((spots[i] || LATE_AT[i]).x, (spots[i] || LATE_AT[i]).z);
      z.pos.x = p.x; z.pos.z = p.z; z.y = W.groundY(p.x, p.z, 0);
      z.facing = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
      enlist(z); z.hunter = true;
      if (z.kind === 'runner') { z.stMix = 'near'; z.target = { x: player.pos.x, z: player.pos.z, lv: 0 }; z.enter('investigate', 12); }
      else { z.enter('hide', 5); z.spot = null; }
      if (i === 0) play('zAlert', { x: p.x, z: p.z, lv: 0, z0: z, vol: 1.4 });
    });
    S.late = [];
    msg('Se oyen más... corredores. Y algo que observa');
  }
  // golpe del hongomorfo contra la pared de los calabozos (cada vez más seguidos y más fuertes)
  function wallBang(prog) {
    play('bang', { x: BREACH.x, z: BREACH.z, lv: 0, vol: 2.2 });
    play('bang', { vol: 0.35 + prog * 0.35, delay: 0.03 });            // (se oye en todo el edificio)
    if (Math.random() < 0.4 + prog * 0.4) setTimeout(() => play('bang', { x: BREACH.x + 0.6, z: BREACH.z, lv: 0, vol: 1.8 }), R(220, 380));
    if (G.Camera.shake) G.Camera.shake(0.08 + prog * 0.16);
    if (G.Music) { G.Music.thump(0.55 + prog * 0.45); G.Music.dread(0.5, 6); }
    if (prog > 0.55 && Math.random() < 0.3) setTimeout(() => play('hRoar', { x: BREACH.x, z: BREACH.z - 2.5, lv: 0, vol: 0.55, z0: HV }), 900);
  }

  function escAlive() { return S.esc.filter((h) => h.alive && !h.gone).length; }

  // la secuencia, una vez cogidas las armas
  function seqUpdate(dt, player) {
    const Q = S.seq;
    Q.t += dt;
    const at = (k, t, f) => { if (!Q[k] && Q.t >= t) { Q[k] = true; f(); } };
    at('door', 2.2, () => { breakArmory(player); escEnter(player); if (G.Mode) G.Mode.fighting = true; });
    at('hunt', 15.5, () => { escHunt(player); if (G.Mode) G.Mode.bark(player.charId === 'vera' || player.charId === 'eira' || player.charId === 'grimes' ? 'stEscV' : 'stEsc'); });
    at('blind', 17, () => blindWake());
    at('late', 25, () => lateWave(player));
    at('clock', 32, () => {
      Q.left = TIMER; Q.bangT = 0.4;
      msg('Algo enorme golpea la pared de los calabozos... ¡mata a los Escorpiones y huye!');
      setTimeout(() => { if (G.Mode) G.Mode.bark('stThump'); }, 2600);
    });
    // los Escorpiones: no te pierden el rastro (te siguieron hasta aquí) y se defienden de los infectados
    if (S.sq && Q.hunt) {
      Q.trackT = (Q.trackT || 0) - dt;
      if (Q.trackT <= 0) { Q.trackT = 12; if (S.sq.mode !== 'combat') S.sq.suspect(player.pos.x, player.pos.z, 0, 5); }
      Q.zfT = (Q.zfT || 0) - dt;
      if (Q.zfT <= 0) {
        Q.zfT = 0.4;
        const CALM = { patrol: 1, guard: 1, loot: 1, check: 1, idle: 1 };
        for (const h of S.esc) {
          if (!h.alive || h.gone || !CALM[h.state]) continue;
          if (G.Population.list.some((z) => hostile(z) && Math.hypot(z.pos.x - h.pos.x, z.pos.z - h.pos.z) < 13 && G.World.hasLOS(h.pos.x, h.pos.z, z.pos.x, z.pos.z, 0))) h.enter('fight', 0);
        }
      }
    }
    // a Vera, cada escorpión que cae
    if (S.esc.length) {
      const n = escAlive();
      if (n < Q.escN) {
        for (const h of S.esc) if (!h.alive && !h.stDown) { h.stDown = true; if ((player.charId === 'vera' || player.charId === 'eira' || player.charId === 'grimes') && h.killedBy !== 'zombie' && G.Mode) setTimeout(() => G.Mode.bark('stEscKillV'), 500); }
        Q.escN = n;
      }
    }
    if (Q.left == null || Q.done) return;
    // el reloj
    Q.left -= dt;
    const prog = 1 - Math.max(0, Q.left) / TIMER, n = escAlive();
    if (G.Mode) G.Mode.setTimer(n > 0 ? 'MATA A LOS ESCORPIONES (' + n + ') Y HUYE' : 'HUYE POR LA VALLA DEL PATIO', Math.max(0, Q.left));
    Q.bangT -= dt;
    if (Q.bangT <= 0 && Q.left > 0) { wallBang(prog); Q.bangT = U.lerp(5.5, 1.3, prog) * R(0.8, 1.15); }
    if (Q.left < 25 && !Q.hurry) { Q.hurry = true; if (G.Mode) G.Mode.bark('hurry'); }
    // los tres muertos: la salida
    if (n === 0 && !Q.exit) {
      Q.exit = true;
      if (G.Mode) {
        // los tres muertos antes de los golpes; y con Vera, todos por su mano
        if (Q.left == null || Q.left > TIMER - 0.5) G.Mode.chal('st_antes');
        if (player.charId === 'vera' && S.esc.every((h) => h.killedBy !== 'zombie' && h.killedBy !== 'squad' && h.killedBy !== 'friendly')) G.Mode.achieve('ajuste');
      }
      const X = G.Maps.get('comisaria').exit;
      if (G.Refugio && G.Refugio.ping) { Q.ping = G.Refugio.ping(X.x, X.z, 'exit', Infinity, 'SALIDA'); if (Q.ping) Q.ping.mark.classList.add('ready'); }
      msg('Los tres Escorpiones están muertos: ¡fuera, por la valla caída del patio!', 'good');
      setTimeout(() => { if (G.Mode) G.Mode.bark('stRun'); }, 800);
    }
    const X = G.Maps.get('comisaria').exit, dX = Math.hypot(player.pos.x - X.x, player.pos.z - X.z);
    if (dX < 2.4) {
      if (n > 0) { if (!Q.notYet) { Q.notYet = true; msg('Con esos ' + (n > 1 ? n + ' ' : '') + 'detrás no llego lejos. Primero ellos.', 'warn'); } }
      else { Q.done = true; Q.won = true; if (G.Mode) G.Mode.stationWin(Q.left); return; }
    } else if (dX > 6) Q.notYet = false;
    // se acabó el tiempo: la pared cede (no se le llega a ver)
    if (Q.left <= 0) {
      Q.done = true;
      if (G.Mode) G.Mode.setTimer(null);
      play('wallBreak', { big: true, vol: 1.3 }); play('hRoar', { x: BREACH.x, z: BREACH.z, lv: 0, vol: 1.6, z0: HV });
      if (G.Camera.shake) G.Camera.shake(0.7);
      setTimeout(() => { if (G.Mode && G.Mode.onFade) G.Mode.onFade(1, 0.4); }, 600);
      setTimeout(() => {
        if (!player.dead) player.die('La pared de los calabozos cedió. No saliste a tiempo.');
        if (G.Mode && G.Mode.onFade) G.Mode.onFade(0, 1.6);
      }, 1150);
    }
  }

  const Station = {
    // al empezar un enfrentamiento: en la estación, el jefe del final variante (o su prueba) tiene la entrada y la misión
    begin(sc, player, type) {
      this.stop();
      scene = sc;
      const mp = G.Maps.get(G.World.layout);
      if (!mp || G.World.layout !== 'comisaria' || type !== 'jefe') return false;
      const L = findLocker();
      S = { intro: null, locker: L, open: null, taken: false, hintT: 0, hints: 0, who: player.charName || '' };
      // la entrada: desde el patio, por la puerta de las oficinas
      const E = mp.entry;
      if (E) {
        player.pos.x = E.from.x; player.pos.z = E.from.z; player.lv = 0;
        player.vel.x = 0; player.vel.z = 0;
        player.facing = Math.atan2(E.to.x - E.from.x, E.to.z - E.from.z);
        player.y = G.World.groundY(E.from.x, E.from.z, 0);
        player.aiming = false; player.cur = -1; player.refreshModel();
        S.intro = { t: 0, E, h: player.facing };
        G.Camera.yaw = player.facing + 0.95; G.Camera.pitch = 0.04;
        if (G.Input) { G.Input.enabled = false; if (G.Input.clear) G.Input.clear(); }
        if (G.Flash) G.Flash.set(true);
        document.body.classList.add('st-intro');
      }
      // la armería (el casillero), a la vista para el que entra
      if (L) G.Props.add({
        x: G.Furniture.frontPoint(L.f).x, z: G.Furniture.frontPoint(L.f).z, label: 'Abrir el casillero de la policía', reach: 1.7, kind: 'station', id: 'casillero',
        off: () => !S || S.taken || !!S.intro,
        use: (pl) => this.use(pl),
        dispose() { }
      });
      title('ESTACIÓN DE POLICÍA', 'ENCUENTRA EL CASILLERO DE ARMAS DE LA POLICÍA');
      // los que esperan: chasqueadores en sus salas (de entrada), los temblantes encerrados en la armería y los que
      // saldrán luego (preparados ya, ocultos y fuera de la lista: así no cuesta un tirón cuando salgan)
      const A = mp.armory;
      S.armory = { cx: (A.x0 + A.x1) / 2, cz: (A.z0 + A.z1) / 2 };
      S.door = armoryDoor();
      S.blind = BLIND_AT.map((p) => {
        const z = mkZ('blind', p.x, p.z, Math.random() * Math.PI * 2, { homebound: true });
        z.keen = KEEN; enlist(z);
        return z;
      });
      S.temb = A.temb.map((p) => { const z = mkZ('temb', p.x, p.z, -Math.PI / 2, {}); z.model.root.visible = false; return z; });
      S.late = [mkZ('runner', 46, 10, 0, {}), mkZ('runner', 50, 53, 0, {}), mkZ('stalker', 40, 40, 0, {})];
      for (const z of S.late) z.model.root.visible = false;
      S.tembT = 3; S.presT = R(14, 24); S.esc = []; S.sq = null; S.mix = false; S.seq = null;
      if (G.Humans && G.Humans.prepare) G.Humans.prepare(ESC);
      return true;
    },
    // a quién va un infectado de la estación (undefined: lo de siempre, a ti). Los chasqueadores, a por los
    // Escorpiones mientras quede alguno; los corredores, al más cercano (tú o ellos)
    targetFor(z, player) {
      if (!S || !S.mix || !z.stMix || !z.alive || z.human) return undefined;
      if ((player.struggle && player.struggle.z === z) || (player.beaten && player.beaten.z === z) || (player.lifted && player.lifted.z === z)) return null;
      z.stTT = (z.stTT || 0) - 1;
      const cur = z.stT;
      if (z.stTT <= 0 || (cur && (!cur.alive || cur.gone))) {
        z.stTT = 20;
        const BUSYZ = { attack: 1, combo: 1, grapple: 1, runatk: 1, tdash: 1, tcharge: 1 };
        if (!BUSYZ[z.state] || !cur || !cur.alive || cur.gone) {
          const dP = player.dead ? 999 : Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
          let best = null, bd = z.stMix === 'esc' ? (dP < 2.2 ? dP : 1e9) : dP;
          for (const h of S.esc) {
            if (!h.alive || h.gone) continue;
            const d = Math.hypot(h.pos.x - z.pos.x, h.pos.z - z.pos.z);
            if (d < bd) { bd = d; best = h; }
          }
          if (best !== cur) {
            z.stT = best;
            if (best) {
              z.hunter = true; z.target = { x: best.pos.x, z: best.pos.z, lv: 0 }; z.lastSeen = 0;
              if (z.blind) z.locked = true;
              if (z.state === 'idle' || z.state === 'wander' || z.state === 'investigate') z.enter('chase', 0);
            } else if (z.blind) z.locked = false;
          }
        }
      }
      return z.stT ? { p: z.stT.zProxy(), c: G.Humans.AllyCombat } : null;
    },
    // para la puntuación y la pantalla de muerte
    get result() {
      if (!S) return null;
      const Q = S.seq;
      return { taken: S.taken, esc: S.esc.length, escDead: S.esc.filter((h) => !h.alive).length, left: Q && Q.left != null ? Math.max(0, Q.left) : null, won: !!(Q && Q.won), clock: !!(Q && Q.left != null) };
    },
    get intro() { return !!(S && S.intro); },
    get input() { return input; },
    get cam() { return cam; },
    get active() { return !!S; },
    get dbg() {
      if (!S) return null;
      const Q = S.seq;
      return { open: S.open ? S.open.t : -1, intro: !!S.intro, blind: (S.blind || []).filter((z) => z.alive).length, esc: (S.esc || []).filter((h) => h.alive).length,
        seq: Q ? { t: +Q.t.toFixed(1), left: Q.left != null ? +Q.left.toFixed(1) : null, exit: !!Q.exit, done: !!Q.done, won: !!Q.won } : null };
    },
    // pruebas: adelanta la secuencia (o el reloj)
    skip(sec) { const Q = S && S.seq; if (!Q) return; if (Q.left != null) Q.left -= sec; else Q.t += sec; },
    // la escena de la entrada: camina sola hacia dentro mientras la cámara pasa de su costado a su espalda
    update(dt, player) {
      if (!S) return;
      const I = S.intro;
      if (I) {
        I.t += dt;
        const k = U.smooth(U.clamp((I.t - 0.6) / 5.2, 0, 1));
        G.Camera.yaw = I.h + 0.95 * (1 - k);
        G.Camera.pitch = 0.04 + 0.06 * k;
        cam.yaw = I.h;
        const go = I.t > 0.9;
        const dz = I.E.to.z - player.pos.z, dx = I.E.to.x - player.pos.x;
        const far = Math.hypot(dx, dz);
        input.move.y = go && far > 0.25 ? -0.5 : 0;
        const r = cam.right();
        input.move.x = go ? U.clamp((dx * r.x + dz * r.z) * 1.2, -0.3, 0.3) : 0;
        if ((go && far <= 0.25) || I.t > INTRO_T) this.endIntro(player);
        return;
      }
      if (S.seq) seqUpdate(dt, player);
      else ambience(dt, player);
      if (!S.taken) {
        // pistas si tarda en encontrarlo
        S.hintT += dt;
        const at = S.locker && S.locker.at;
        if (at && S.hintT > 100 && S.hints === 0) { S.hints = 1; say(['Un casillero de la policía... ¿dónde lo guardarían?', 'Quizás en ' + at.hint + '.'], S.who); }
        else if (at && S.hintT > 200 && S.hints === 1) { S.hints = 2; say(['Tiene que estar en ' + at.hint + '. Seguro.'], S.who); }
      }
      // las puertas del casillero se abren
      const O = S.open;
      if (O && O.t < 1) {
        O.t = Math.min(1, O.t + dt * 1.6);
        const a = U.smooth(O.t) * 1.75;
        for (const d of O.doors) d.hinge.rotation.y = d.sx * a;
      }
    },
    endIntro(player) {
      const I = S && S.intro;
      if (!I) return;
      S.intro = null;
      input.move.x = input.move.y = 0;
      document.body.classList.remove('st-intro');
      // la puerta se cierra a su espalda y queda atrancada (no se sale por ahí)
      const W = G.World, ref = I.E.door;
      W.setEdge(ref, W.E.DOOR);
      W.lockEdge(ref);
      if (G.Audio) G.Audio.play('doorClose', { x: ref.x + 0.5, z: ref.z, lv: 0 });
      if (G.Input) { G.Input.enabled = true; if (G.Input.clear) G.Input.clear(); }
      G.Camera.yaw = player.facing;
      setTimeout(() => say(['Ya está. No hay vuelta atrás.', 'Los polis guardaban las armas en un casillero. Tengo que encontrarlo.'], S ? S.who : ''), 900);
    },
    use(player) {
      if (!S || S.taken || !S.locker) return null;
      if (!S.open) {
        S.open = openMesh(S.locker.f);
        if (G.Audio) { G.Audio.play('doorOpen', { x: S.locker.at.x, z: S.locker.at.z, lv: 0 }); G.Audio.play('pickup'); }
        const p = G.Props.list.find((q) => q.id === 'casillero');
        if (p) p.label = 'Coger las armas de la policía';
        return 'El casillero de la policía: una escopeta, un rifle y un revólver';
      }
      S.taken = true;
      S.seq = { t: 0, escN: 3 };            // (y todo se despierta)
      if (G.Mode) { G.Mode.achieve('casillero'); if (!S.heard && !S.blind.some((z) => z.alive && z.locked)) G.Mode.chal('st_silencio'); }
      for (const gm of S.open.guns) gm.visible = false;
      const r = giveKit(player);
      if (G.Audio) G.Audio.play('pickup');
      title('ARMADA', 'ESCOPETA, RIFLE Y REVÓLVER · MEJORADOS AL MÁXIMO');
      setTimeout(() => say(['Esto sí. Mejoradas y todo.'], S ? S.who : ''), 700);
      if (r.left.length || r.full.length) return 'Cogiste: ' + (r.got.join(', ') || 'nada') + (r.left.length ? ' · no puedes usar (en el suelo): ' + r.left.join(', ') : '') + (r.full.length ? ' · no te cabe (en el suelo): ' + r.full.join(', ') : '');
      return 'Cogiste la escopeta, el rifle y el revólver (mejorados al máximo)';
    },
    stop() {
      if (S && S.open && S.open.g.parent) S.open.g.parent.remove(S.open.g);
      // los que no llegaron a salir (ocultos, fuera de la lista)
      if (S) for (const z of (S.temb || []).concat(S.late || [])) { if (G.Population.list.indexOf(z) < 0) z.dispose(); }
      if (S && S.seq && S.seq.ping) S.seq.ping.remove();
      if (S && S.intro && G.Input) G.Input.enabled = true;
      document.body.classList.remove('st-intro');
      const p = G.Props && G.Props.list.find((q) => q.id === 'casillero');
      if (p) G.Props.remove(p);
      S = null;
    }
  };
  G.Station = Station;
})(window.Game = window.Game || {});
