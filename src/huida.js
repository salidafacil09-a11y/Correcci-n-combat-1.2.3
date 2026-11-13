// La segunda parte del prólogo (modo historia): la huida. Después del corredor del cruce, Alem le devuelve a Javier
// su revólver (se le cayó en el choque) y empiezan a llegar más corredores desde todas partes: a pie, con Alem
// delante marcando el camino (calles, un callejón, una plaza, la avenida del norte) hasta el depósito municipal de
// vehículos. Por el camino, la ciudad que se cae: gente que huye, gente devorada, un avión que se estrella a lo
// lejos, disparos, sirenas y gritos. En el depósito: la entrada con la cámara en mano, Alem atranca la puerta, la
// búsqueda de las llaves en la garita del vigilante, Alem rompe una ventanilla y hace el puente... y la segunda
// parte al volante (la reja, la avenida con infectados y civiles, la estación en llamas, el plano final desde lo
// alto) la lleva G.RoadLife con G.Drive.
// Los corredores son los de siempre (G.Zombie, con la persecución de la Caza: saben dónde estás), sin nada del HUD
// de los enfrentamientos; nunca más de 14 a la vez. Las escenas de fondo (los que huyen, los que comen) son
// cuerpos sueltos con su pose: cuando Javier (o Alem) se acerca a uno que come, se convierte en un corredor de verdad.
// G.Huida.prepare(escena) arma los cuerpos (poco a poco: prepStep); start(jugador, kit) / resume(punto, jugador,
// kit) / update(dt, jugador) / clear(). El kit son las herramientas de G.Story (frases, objetivo, cámara...)
(function (G) {
  'use strict';
  const U = G.Util;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const MAX_RUN = 14;

  let K = null, pl = null, st = null;
  const MAP = () => G.Maps && G.Maps.get('cruce_2020');
  const HU = () => MAP().huida;
  const sceneOf = () => (K && K.host() ? K.host().scene : null);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const say = (who, text) => { if (K) K.say(who, text); };
  const talk = (list, done) => { if (K) K.play(list, done); };

  // ---------- Las frases ----------
  const GIVE = [['alem', 'Toma. Es tu revólver: se te cayó en el choque. Estaba debajo del coche.'], ['jav', 'Gracias...']];
  const HEAR = [['alem', 'Escucha eso. Disparos, sirenas... Toda la ciudad está igual.'], ['jav', '¿Qué ha sido eso?'], ['alem', 'Vienen más. ¡Tenemos que irnos de aquí, ya!']];
  const GO = [['alem', 'Conozco un sitio: el depósito municipal, donde llevan los coches requisados. Está a unas manzanas: allí cogemos un coche y volvemos a la estación.'], ['alem', '¡Sígueme y no te separes!']];
  const AT = {
    3: [['alem', '¡Por aquí! ¡Sigue la calle!']],
    8: [['alem', '¡La calle está cortada! ¡Por el callejón, a la izquierda!']],
    13: [['alem', '¡Cruza la plaza! ¡No te pares!']],
    16: [['alem', '¡Ya casi! ¡El depósito está al final de la avenida!']],
    19: [['alem', '¡Ahí! ¡La puerta! ¡Dentro, rápido!']]
  };
  const WAIT = ['¡Javier! ¡Vamos!', '¡No te quedes atrás!', '¡Por aquí, Javier!', '¡Muévete!', '¡Javier, aquí!'];
  const BARK = ['¡Abajo!', '¡Te tengo!', '¡Cuidado!', '¡A tu espalda!', '¡Uno más!'];
  const EV = {
    e1: [['jav', '¡Eh! ¡Señor! ¡Por aquí!'], ['alem', '¡No podemos ayudarle! ¡Corre!']],
    e2: [['jav', 'Dios... se lo está comiendo...'], ['alem', '¡No mires! ¡Sigue!']],
    plane0: [['alem', '¡Javier! ¡Arriba, mira!'], ['jav', '¿Eso es... un avión?']],
    plane1: [['alem', 'Dios mío...'], ['jav', 'Iba hacia el aeropuerto. Iba lleno de gente...'], ['alem', '¡No te pares! ¡Corre!']],
    woman: [['jav', '¡No! ¡Suéltala!'], ['alem', '¡Ya es tarde para ella, Javier!']],
    flee: [['jav', '¡Mira! ¡Hay gente huyendo!'], ['alem', 'Y los persiguen. ¡No te pares!']],
    block: [['jav', '¿Un control? ¿Dónde están los nuestros?'], ['alem', 'Lo abandonaron. O no les dio tiempo.']]
  };
  // el depósito
  const INSIDE = [['alem', '¡La puerta, la puerta!']];
  const BLOCK0 = [['alem', '¡Aguanta! ¡Necesito algo pesado!']];
  const BLOCK1 = [['alem', 'Eso... eso los aguantará un rato.'], ['jav', '¿Un rato? ¿Y después qué?'],
    ['alem', 'Después ya no estaremos aquí. Esto es el depósito: aquí traen los coches requisados. Necesitamos uno que arranque.'],
    ['jav', '¿Y las llaves?'], ['alem', 'Las guarda el vigilante, en su garita: esa puerta de la derecha. ¡Búscalas! Yo vigilo la puerta.']];
  const RESUME2 = [['alem', '¡Las llaves, Javier! ¡En la garita del vigilante! ¡Yo vigilo la puerta!']];
  const NAG = [[10, '¿Algo? ¿Las tienes?'], [22, '¡Date prisa, Javier! ¡La puerta no va a aguantar!'], [36, '¡Mira en las taquillas! ¡En el escritorio!'],
    [50, '¡Vamos, vamos, vamos!'], [64, '¡Están rompiendo la puerta!'], [80, '¡Javier!']];
  const NOPE = ['¿Nada?', '¡Sigue buscando!', '¡Mira en otro sitio!', '¿Y ahí?'];
  const ENOUGH = [['alem', '¡Basta! ¡Olvídate de las llaves, no hay tiempo!']];
  const SMASHED = [['alem', '¡Sube! ¡Al volante, rápido! ¡Yo hago el puente!']];
  // las cosas de la garita: dónde, qué dice el botón y qué se encuentra
  const SEARCH = [
    { x: 106.4, z: 137.75, face: Math.PI, label: 'Registrar el escritorio', got: 'Bolígrafos, facturas... un sándwich a medio comer. Ni rastro de llaves.' },
    { x: 104.95, z: 139.4, face: -Math.PI / 2, label: 'Registrar el archivador', got: 'Expedientes de coches requisados. Ninguna llave.' },
    { x: 104.95, z: 141.2, face: -Math.PI / 2, label: 'Abrir la taquilla', got: 'Un uniforme, una gorra... una linterna sin pilas. Nada.' },
    { x: 105.4, z: 141.05, face: 0, label: 'Abrir la otra taquilla', got: 'Tiene candado... ¡Vamos! ... Vacía.' },
    { x: 108.3, z: 136.75, face: Math.PI, label: 'Mirar el cajetín de las llaves', got: '¿El cajetín de las llaves, vacío? ¡Alguien se las ha llevado todas!' },
    { x: 106.4, z: 138.75, face: Math.PI, label: 'Registrar la chaqueta', got: 'Un mechero y la foto de una niña. Nada más.' }
  ];

  // ---------- Cuerpos de corredor (los de la reserva de G.Zombie, todos corredores) ----------
  const bindOf = (look) => look && look.mesh && G.CharMesh && G.CharMesh[look.mesh] && G.CharMesh[look.mesh].bind;
  function runnerLook() {
    const look = G.Zombie.randomLook();
    look.runner = true; look.fungus = Math.min(look.fungus, 1); look.facePlate = false; look.drag = false; look.armsUp = 0;
    if (G.CharMesh && G.CharMesh.corr) {
      look.mesh = look.female && G.CharMesh.corrf ? 'corrf' : 'corr';          // (hombre o mujer, y uno de sus colores)
      const nv = G.MESH_VARS && G.MESH_VARS[look.mesh] ? G.MESH_VARS[look.mesh].length : 0; look.meshVar = nv ? Math.floor(Math.random() * (nv + 1)) : 0;
    }
    return look;
  }
  function runnerModel(look) {
    const h = G.Models.createHumanoid(Object.assign({ zombie: true, blood: U.mulberry32(look.seed) }, look));
    G.Models.setLOD(h, 0, true); G.Models.setLOD(h, -1, true); G.Models.setLOD(h, 1, true);
    return h;
  }
  const Bodies = {
    looks: [],
    // uno nuevo, a la reserva (lo coge el próximo G.Zombie que se cree con su aspecto)
    make() {
      const P = G.Zombie.pool, look = runnerLook(), model = runnerModel(look);
      const e = P.mark({ look, model });
      P.bins.z.push(e); P.byLook.set(look, e);
      this.looks.push(look);
      return look;
    },
    // un aspecto con su cuerpo libre en la reserva (si no hay, se arma uno ahora)
    free() {
      const P = G.Zombie.pool;
      for (const l of this.looks) { const e = P.byLook.get(l); if (e && P.bins.z.indexOf(e) >= 0) return l; }
      return this.make();
    },
    ready() { const P = G.Zombie.pool; let n = 0; for (const l of this.looks) { const e = P.byLook.get(l); if (e && P.bins.z.indexOf(e) >= 0) n++; } return n; }
  };

  // ---------- Escenas de fondo: cuerpos sueltos con su pose ----------
  let bloodMat = null;
  function blood(sc, x, z, s) {
    if (!bloodMat) bloodMat = new THREE.MeshBasicMaterial({ color: 0x2e0806, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.CircleGeometry(s || 0.9, 10), bloodMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z); m.scale.set(1, 0.7 + Math.random() * 0.5, 1);
    m.userData.noFlashShadow = true;
    sc.add(m);
    return m;
  }
  class Actor {
    // kind 'z' (un corredor) o 'c' (una persona: pol, un policía); o: x, z, face, mode, fem
    constructor(sc, kind, o) {
      this.kind = kind; this.fem = !!o.fem; this.id = o.id || '';
      if (kind === 'z') {
        this.look = runnerLook(); this.h = runnerModel(this.look);
        G.Zombie.pool.mark({ look: this.look, model: this.h });
        const cb = bindOf(this.look);
        if (cb && cb.rootScale) this.h.root.scale.setScalar(cb.rootScale);
      } else {
        this.look = G.NPCs.lookOf(o.pol ? 'pol' : 'civ', this.fem, null);
        this.h = G.Models.createHumanoid(this.look);
        G.Models.setWeapon(this.h, null);
      }
      sc.add(this.h.root);
      this.sc = sc;
      this.pos = { x: o.x, z: o.z }; this.facing = o.face || 0;
      this.mode = o.mode || 'idle'; this.path = null; this.spd = 0; this.v = 0;
      this.phase = Math.random() * 6; this.time = Math.random() * 10; this.fall = 0; this.fallDir = 1; this.still = false;
      this.biteT = R(0.5, 2); this.decal = null; this.onDone = null;
      this.h.root.visible = false;
    }
    run(pts, spd, done) { this.path = pts.map((p) => ({ x: p[0], z: p[1] })); this.pi = 0; this.spd = spd; this.mode = 'run'; this.onDone = done || null; this.still = false; }
    lie(dir) { this.mode = 'lie'; this.fall = 1; this.fallDir = dir || 1; this.still = false; if (!this.decal) this.decal = blood(this.sc, this.pos.x, this.pos.z, 1.0); }
    decalAt(x, z) { if (this.decal) this.decal.position.set(x, 0.025, z); }
    decalOff() { if (this.decal) { if (this.decal.parent) this.decal.parent.remove(this.decal); this.decal.geometry.dispose(); this.decal = null; } }
    update(dt, cp) {
      if (this.mode === 'gone') return;
      this.time += dt;
      // moverse por su camino
      this.v = 0;
      if (this.mode === 'run' && this.path) {
        const p = this.path[this.pi];
        if (!p) { this.mode = this.kind === 'z' ? 'idle' : 'idle'; const f = this.onDone; this.onDone = null; if (f) f(this); }
        else {
          const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz), s = Math.min(d, this.spd * dt);
          if (d < 0.3) this.pi++;
          else {
            this.pos.x += dx / d * s; this.pos.z += dz / d * s; this.v = this.spd;
            this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), dt * 9);
          }
        }
      }
      if (this.mode === 'fall') { this.fall = Math.min(1, this.fall + dt * 2.2); if (this.fall >= 1) this.lie(this.fallDir); }
      this.phase += dt * (this.kind === 'z' ? (1.4 + this.v * 3.4) : Math.PI * 2 * (0.62 + 0.21 * Math.min(6, this.v)) * (this.v > 0.1 ? 1 : 0));
      // dibujarlo (solo cerca)
      const d = cp ? Math.hypot(cp.x - this.pos.x, cp.z - this.pos.z) : 0;
      const vis = d < 46;
      this.h.root.visible = vis;
      if (this.decal) this.decal.visible = vis;
      if (!vis) return;
      G.Models.setLOD(this.h, d < 16 ? 1 : (d < 32 ? 0 : -1));
      const gy = G.World.groundY(this.pos.x, this.pos.z, 0);
      this.h.root.position.set(this.pos.x, gy, this.pos.z);
      this.h.root.rotation.y = this.facing;
      if (this.still) return;
      if (this.kind === 'z') this.poseZ(dt); else this.poseC(dt);
      if (this.mode === 'lie') this.still = true;           // (tumbado: la pose ya no cambia)
      // comiendo: los mordiscos (de cerca se oyen)
      if (this.mode === 'feed' && d < 14 && (this.biteT -= dt) <= 0) {
        this.biteT = R(0.7, 1.6);
        if (G.Audio) G.Audio.play(Math.random() < 0.5 ? 'zBite' : 'hitFlesh', { x: this.pos.x, z: this.pos.z, lv: 0, vol: 0.55 });
      }
    }
    poseZ(dt) {
      const h = this.h, m = this.mode;
      if (h._ls) { G.Models.legSpread(h, -h._ls); h._ls = 0; }
      G.Models.poseZombie(h, {
        phase: this.phase, amt: m === 'run' ? 0.7 : 0, chase: m === 'run' || m === 'rattle', runner: true, sprint: m === 'run' ? 1 : 0,
        alert: 0, creep: 0, crouch: m === 'feed' ? 1 : 0, armsUp: 0, reach: m === 'rattle' ? 0.95 : 0, stagger: 0, flinch: 1, reactDur: 0.55,
        twitch: 0, twitchKind: 0, bang: 0, drag: false, seed: this.look.seed % 7, lean: 0, tilt: 0, dt, time: this.time
      });
      if (h.hipOff) h.hips.position.y += h.hipOff;
      const cb = bindOf(this.look);
      if (cb && cb.legSpread) { G.Models.legSpread(h, cb.legSpread); h._ls = cb.legSpread; }
      const t = this.time;
      if (m === 'feed') {
        // encorvado sobre el cuerpo, arrancando a tirones
        h.spine.rotation.x += 0.45; h.chest.rotation.x += 0.15;
        h.neck.rotation.x += 0.4 + Math.max(0, Math.sin(t * 7.5)) * 0.35; h.head.rotation.y += Math.sin(t * 3.1) * 0.25;
        h.armL.rotation.x = -0.85 + Math.sin(t * 5) * 0.12; h.armR.rotation.x = -0.75 + Math.sin(t * 5 + 1.7) * 0.12;
        h.foreL.rotation.x = -0.9; h.foreR.rotation.x = -1.0;
      } else if (m === 'rattle') {
        // agarrado a la reja, sacudiéndola
        const s1 = Math.sin(t * 17) * 0.16, s2 = Math.sin(t * 17 + 1.9) * 0.16;
        h.armL.rotation.x += s1; h.armR.rotation.x += s2; h.spine.rotation.x += 0.1 + s1 * 0.4; h.neck.rotation.x += 0.2 + Math.sin(t * 5.2) * 0.15;
      }
      if (m === 'lie') G.Models.poseFall(h, 1, this.fallDir);
      else { h.body.rotation.x = 0; h.body.position.y = 0; }
    }
    poseC(dt) {
      const h = this.h, m = this.mode, run = m === 'run';
      G.Models.posePlayer(h, {
        phase: this.phase, amt: run ? 1 : 0, run, speed: run ? this.spd : 0, crouch: 0, prone: 0, rel: 0, hop: 0, cat: 'none', two: false, aim: false,
        dt, time: this.time, action: null, t: 0, climb: null, ledge: false, jump: false, fall: 0, land: 0, dodge: null, dodgeRel: 0, gun: null, pitch: 0,
        grabKnife: false, searchLow: false, side: 1, weaponCat: 'none', guard: 0, female: this.fem, turn: 0, acc: 0, breath: run ? 0.9 : 0.3,
        breathT: this.time * 2.4, look: null, alert: run ? 1 : 0, fidget: null, blow: null, struggle: null, bossKill: null, cover: null, draw: null,
        npc: this.npcPose ? { kind: this.npcPose, k: 1 } : null, aimAt: null, contact: null
      });
      if (m === 'fall' || m === 'lie') G.Models.poseFall(h, m === 'lie' ? 1 : this.fall, this.fallDir);
      else { h.body.rotation.x = 0; h.body.position.y = 0; }
    }
    dispose() {
      if (this.h && this.h.root.parent) this.h.root.parent.remove(this.h.root);
      if (this.h && !this.given) { try { G.Models.disposeHumanoid(this.h); } catch (e) { /* nada */ } }
      if (this.decal && this.decal.parent) { this.decal.parent.remove(this.decal); this.decal.geometry.dispose(); }
      this.mode = 'gone';
    }
  }
  // el que come se levanta: pasa a ser un corredor de verdad (con el mismo cuerpo)
  function wakeActor(a) {
    if (!a || a.kind !== 'z' || a.mode === 'gone') return null;
    const h = a.h, x = a.pos.x, z = a.pos.z;
    if (h._ls) { G.Models.legSpread(h, -h._ls); h._ls = 0; }
    if (h.root.parent) h.root.parent.remove(h.root);
    let look = null;
    if (G.Zombie.pool.give('z', a.look, h)) { look = a.look; a.given = true; Bodies.looks.push(look); }
    a.dispose();
    return spawnZ(x, z, look);
  }

  // ---------- Los corredores de verdad ----------
  function spawnZ(x, z, look) {
    const sc = sceneOf();
    if (!sc || !pl) return null;
    const p = pl.pos;
    const zz = new G.Zombie(sc, x, z, look || Bodies.free(), Math.atan2(p.x - x, p.z - z), { lv: 0, hunter: true });
    zz.state = 'chase'; zz.target = { x: p.x, z: p.z, lv: 0 }; zz.lastSeen = 0; zz.screamed = true;
    // (los primeros, más lentos: Javier va cojeando; según se avanza, cogen su paso de siempre)
    zz.paceK = 0.66 + 0.24 * Math.min(1, st.prog || 0);
    G.Population.list.push(zz); st.zs.push(zz);
    if (G.Audio) G.Audio.play('zAlert', { x, z, lv: 0, runner: true, z0: zz, vol: R(0.85, 1.1) });
    return zz;
  }
  const aliveZ = () => st.zs.filter((z) => z.alive);
  // un sitio libre cerca de (x, z)
  function freeNear(x, z) {
    const W = G.World;
    if (!W.circleBlocked(x, z, 0.4, 0)) return { x, z };
    for (let r = 0.6; r < 3; r += 0.6) for (let a = 0; a < 8; a++) {
      const px = x + Math.cos(a * Math.PI / 4) * r, pz = z + Math.sin(a * Math.PI / 4) * r;
      if (!W.circleBlocked(px, pz, 0.4, 0)) return { x: px, z: pz };
    }
    return null;
  }
  // ¿lo ve la cámara? (delante y en línea de vista)
  function seen(x, z) {
    const C = G.Camera, cp = C && C.pos ? C.pos : pl.pos, f = C && C.forward ? C.forward() : { x: Math.sin(pl.facing), z: Math.cos(pl.facing) };
    const dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz) || 1;
    if ((dx * f.x + dz * f.z) / d < Math.cos(1.0)) return false;
    return G.World.hasLOS(cp.x, cp.z, x, z, 0);
  }
  // de dónde sale el próximo (como en la Caza: lejos de la vista; aquí, de los sitios del mapa)
  function pickSpawn(behind) {
    const p = pl.pos, H = HU(), dir = st.dir;
    let best = null, bs = -1e9;
    for (const s of H.spawns) {
      const dx = s[0] - p.x, dz = s[1] - p.z, d = Math.hypot(dx, dz);
      if (d < 11 || d > 40) continue;
      if (st.recent.indexOf(s) >= 0) continue;
      const vis = seen(s[0], s[1]);
      if (vis && d < 36) continue;
      const ahead = (dx * dir.x + dz * dir.z) / d;
      let sc = -Math.abs(d - 21) * 0.12 + Math.random() * 1.6 + (behind ? -ahead : ahead) * 1.4 + (vis ? -2 : 0);
      if (sc > bs) { const q = freeNear(s[0], s[1]); if (q) { bs = sc; best = { s, q }; } }
    }
    if (!best) return null;
    st.recent.push(best.s); if (st.recent.length > 4) st.recent.shift();
    return best.q;
  }
  function director(dt) {
    if (st.calm > 0) { st.calm -= dt; return; }
    st.spawnT -= dt;
    const n = aliveZ().length;
    const want = Math.min(MAX_RUN, Math.round(3 + st.prog * 8));
    if (st.spawnT > 0 || n >= want) return;
    let made = 0;
    const k = n < want - 2 && Math.random() < 0.5 ? 2 : 1;
    for (let i = 0; i < k && aliveZ().length < MAX_RUN; i++) {
      const q = pickSpawn(Math.random() < 0.35);
      if (q && spawnZ(q.x, q.z)) made++;
    }
    st.spawnT = made ? R(2.2, 4.4) * (1.2 - st.prog * 0.45) : 0.9;
  }
  // los muertos lejos y fuera de la vista se quitan (sus cuerpos vuelven a la reserva); los vivos muy atrás, también
  function tidy(dt) {
    if ((st.tidyT -= dt) > 0) return;
    st.tidyT = 1;
    const L = G.Population.list;
    for (let i = st.zs.length - 1; i >= 0; i--) {
      const z = st.zs[i], d = dist(z.pos, pl.pos);
      if (z.state === 'grapple' || (pl.struggle && pl.struggle.z === z)) continue;
      const gone = !z.alive ? (d > 26 && !seen(z.pos.x, z.pos.z)) : (d > 48 && !seen(z.pos.x, z.pos.z));
      if (!gone) continue;
      z.dispose();
      const j = L.indexOf(z); if (j >= 0) L.splice(j, 1);
      st.zs.splice(i, 1);
    }
  }

  // ---------- Alem: delante, marcando el camino; dispara a los que se acercan ----------
  function alemShoot(a, z) {
    let mz = null;
    if (a.model) {
      a.model.root.updateMatrixWorld(true);
      if (a.model.handR) { mz = new THREE.Vector3(); a.model.handR.getWorldPosition(mz); mz.x += Math.sin(a.facing) * 0.25; mz.z += Math.cos(a.facing) * 0.25; }
    }
    a.recoil = 1;
    if (mz && G.Humans && G.Humans.flash) G.Humans.flash(mz, 1.1);
    if (G.Audio) G.Audio.play('pistol', { x: a.pos.x, z: a.pos.z, lv: 0 });
    if (G.World.emit) G.World.emit(a.pos.x, a.pos.z, 16, 0);
    const dx = z.pos.x - a.pos.x, dz = z.pos.z - a.pos.z;
    // al que tiene agarrado a Javier, siempre a la cabeza; a los demás, casi siempre le da
    const onJav = pl.struggle && pl.struggle.z === z, r = Math.random();
    if (!onJav && r > 0.78) return;
    const head = onJav || r < 0.42;
    z.takeHit(head ? 999 : 1.5, 0.6, dx, dz, false, 1, 'shot', head ? 'head' : 'body', { w: 'pistola', foe: true });
    if (G.Guns && G.Guns.burst && z.model) {
      const hp = new THREE.Vector3(z.pos.x, (z.y || 0) + (head ? 1.6 : 1.2), z.pos.z);
      G.Guns.burst(hp, new THREE.Vector3(dx, 0, dz).normalize(), true, head ? 9 : 5);
    }
  }
  function alemUpdate(dt) {
    const a = K.npc('alem');
    if (!a) return;
    const H = HU(), route = H.route, A = st.al;
    A.cd -= dt; A.lineCD -= dt;
    // apuntando y disparando (parado)
    if (A.aim) {
      const z = A.aim.z;
      if (z && z.alive) a.facing = U.turnToward(a.facing, Math.atan2(z.pos.x - a.pos.x, z.pos.z - a.pos.z), dt * 12);
      A.aim.t -= dt;
      if (!A.aim.shot && A.aim.t <= 0) { if (z && z.alive) alemShoot(a, z); A.aim.shot = true; A.aim.t = 0.32; }
      else if (A.aim.shot && A.aim.t <= 0) {
        a.pose = null; a.aimOn = false; A.aim = null; A.cd = R(1.1, 2.2);         // (baja el arma; la sigue llevando en la mano)
      }
      return;
    }
    // ¿a quién dispara? al más peligroso, si lo ve (el que agarra a Javier, después de un momento, primero)
    if (A.cd <= 0) {
      let tz = null, td = 1e9;
      for (const z of st.zs) {
        if (!z.alive || !z.standing) continue;
        const dj = dist(z.pos, pl.pos), da = dist(z.pos, a.pos);
        if (da > 17) continue;
        const grab = pl.struggle && pl.struggle.z === z;
        if (grab && pl.struggle.t < 1.2) continue;
        const s = grab ? -1 : Math.min(dj, da * 1.15);
        if (s < 9 && s < td && G.World.hasLOS(a.pos.x, a.pos.z, z.pos.x, z.pos.z, 0)) { td = s; tz = z; }
      }
      if (tz) {
        A.aim = { z: tz, t: 0.42, shot: false };
        a.walk = null; a.pose = null; a.setGun(true); a.aimOn = true;
        if (A.lineCD <= 0 && Math.random() < 0.45) { A.lineCD = 5; say('alem', pick(BARK)); }
        return;
      }
    }
    // el camino: punto a punto; si Javier se queda atrás, espera (y lo llama)
    const tgt = route[A.i];
    const dJ = dist(a.pos, pl.pos);
    const jAhead = st.ri >= A.i - 1;
    if (!tgt) {
      // al final (la puerta del depósito): llamándolo
      if (!a.walk) { a.pose = 'wave'; a.facing = U.turnToward(a.facing, Math.atan2(pl.pos.x - a.pos.x, pl.pos.z - a.pos.z), dt * 6); }
      return;
    }
    if (dJ > 13 && !jAhead) {
      // esperando
      if (a.walk) a.walk = null;
      a.pose = 'wave';
      a.facing = U.turnToward(a.facing, Math.atan2(pl.pos.x - a.pos.x, pl.pos.z - a.pos.z), dt * 6);
      if (A.lineCD <= 0) { A.lineCD = R(5, 8); say('alem', pick(WAIT)); }
      return;
    }
    if (!a.walk || a.walk.done) {
      if (a.walk && a.walk.done) {
        // llegó a un punto: su frase (si toca) y al siguiente
        if (AT[A.i] && !A.said[A.i]) { A.said[A.i] = true; talk(AT[A.i]); }
        A.i++;
        if (!route[A.i]) { a.walk = null; return; }
      }
      const spd = (dJ < 6 ? 4.9 : 4.3) * (1 - 0.18 * (a.limp || 0));      // (cojea: no se le escapa a Javier, que también)
      a.walkTo([route[A.i]], null, spd);
      a.breath = 1;
    }
  }

  // ---------- Las escenas de fondo del camino ----------
  // e: id → { trigger (el jugador pasa por ahí), actores, qué hacen }
  function buildEvents(sc) {
    const A = (kind, o) => { const a = new Actor(sc, kind, o); st.actors.push(a); return a; };
    const E = st.ev = {};
    // E1: un hombre sale de la calle sin salida del norte, cruza corriendo y se mete en la del sur; uno lo persigue
    E.e1 = { at: (p) => p.x > 37, man: A('c', { x: 52, z: 47.5, face: Math.PI, mode: 'idle' }), z: A('z', { x: 52, z: 52.5, face: Math.PI, mode: 'idle' }) };
    E.e1.man.h.root.visible = false;
    // E2: en la curva, junto al coche con la puerta abierta: uno comiendo
    E.e2 = { at: (p) => p.x > 76, corpse: A('c', { x: 90.3, z: 36.1, face: 2.2, mode: 'idle' }), z: A('z', { x: 89.6, z: 35.3, face: 0.7, mode: 'feed' }) };
    E.e2.corpse.lie(1);
    // E3: en el callejón, otro
    E.e3 = { corpse: A('c', { x: 108.9, z: 68.9, face: 1.2, mode: 'idle', fem: true }), z: A('z', { x: 108.3, z: 68.2, face: 0.6, mode: 'feed' }) };
    E.e3.corpse.lie(-1);
    // la plaza: una mujer huye y uno la alcanza junto a la fuente; dos comen junto al autobús
    E.plaza = { woman: A('c', { x: 135, z: 76, face: -1.4, mode: 'idle', fem: true }), z: A('z', { x: 137, z: 93, face: -2.2, mode: 'idle' }),
      body: A('c', { x: 129.2, z: 95.6, face: 0.3, mode: 'idle' }), f1: A('z', { x: 128.5, z: 94.9, face: 0.8, mode: 'feed' }), f2: A('z', { x: 130.0, z: 96.2, face: -2.5, mode: 'feed' }) };
    E.plaza.body.lie(1);
    // la avenida del norte: dos que huyen hacia la calle del este, perseguidos; un policía muerto en el control
    E.flee = { a: A('c', { x: 123, z: 127, face: Math.PI, mode: 'idle' }), b: A('c', { x: 124.4, z: 128.5, face: Math.PI, mode: 'idle', fem: true }),
      z1: A('z', { x: 123.5, z: 133, face: Math.PI, mode: 'idle' }), z2: A('z', { x: 122.2, z: 134.5, face: Math.PI, mode: 'idle' }) };
    E.cop = A('c', { x: 122.6, z: 114.6, face: 0.4, mode: 'idle', pol: true }); E.cop.lie(-1);
    for (const k of ['a', 'b', 'z1', 'z2']) E.flee[k].hidden = true;
    E.plaza.woman.hidden = true; E.plaza.z.hidden = true; E.e1.z.hidden = true; E.e1.man.hidden = true;
  }
  function eventsUpdate(dt) {
    const E = st.ev, p = pl.pos, cp = (G.Camera && G.Camera.pos) || p, a = K.npc('alem');
    if (!E) return;
    for (const ac of st.actors) {
      if (ac.hidden) { ac.h.root.visible = false; continue; }
      ac.update(dt, cp);
    }
    // los que comen: si Javier se acerca (o Alem, que lo ve), se levantan
    for (const ac of st.actors) {
      if (ac.kind !== 'z' || ac.mode !== 'feed' || ac.hidden) continue;
      const dj = dist(ac.pos, p), da = a ? dist(ac.pos, a.pos) : 99;
      if (dj < 10 || da < 6.5) { const z = wakeActor(ac); if (z && G.Audio) G.Audio.play('zNotice', { x: z.pos.x, z: z.pos.z, lv: 0 }); }
    }
    // E1
    if (E.e1 && !E.e1.on && E.e1.at(p)) {
      E.e1.on = true;
      const m = E.e1.man, z = E.e1.z;
      m.hidden = false; z.hidden = false;
      m.run([[52.3, 40], [56, 31], [61.2, 22], [61.5, 11], [61.5, 8.2]], 5.4, (o) => { o.mode = 'fall'; o.fall = 0; o.fallDir = 1; if (G.Audio) G.Audio.play('pDeath', { x: o.pos.x, z: o.pos.z, lv: 0, vol: 0.8 }); });
      z.run([[52.3, 41], [56, 31.5], [61.2, 22.5], [61.5, 11.5], [61.6, 9.3]], 5.5, (o) => { o.mode = 'feed'; });
      if (G.Audio) G.Audio.play('pDeath', { x: 52, z: 45, lv: 0, vol: 0.5 });
      setTimeout(() => talk(EV.e1), 600);
    }
    // E2: al verlo, Javier
    if (E.e2 && !E.e2.said && E.e2.at(p)) { E.e2.said = true; talk(EV.e2); }
    // la plaza: el avión y, después, la mujer
    if (!st.plane && p.x > 113.5 && p.z > 72.5) startPlane();
    if (st.plane) stepPlane(dt);
    if (E.plaza && !E.plaza.on && st.plane && st.plane.done && st.plane.t > 1.5) {
      E.plaza.on = true;
      const w = E.plaza.woman, z = E.plaza.z;
      w.hidden = false; z.hidden = false;
      w.run([[129, 78.5], [121.3, 81.6]], 5.0, (o) => { o.mode = 'fall'; o.fall = 0; o.fallDir = 1; if (G.Audio) G.Audio.play('pDeath', { x: o.pos.x, z: o.pos.z, lv: 0, female: true }); });
      z.run([[131, 88], [124.5, 82.2], [121.9, 81.9]], 6.2, (o) => { o.mode = 'feed'; });
      if (G.Audio) G.Audio.play('pHurt', { x: 135, z: 77, lv: 0, female: true, vol: 0.9 });
      setTimeout(() => talk(EV.woman), 1600);
    }
    // la avenida del norte: los que huyen y el control abandonado
    if (E.flee && !E.flee.on && p.z > 99) {
      E.flee.on = true;
      const F = E.flee;
      for (const k of ['a', 'b', 'z1', 'z2']) F[k].hidden = false;
      F.a.run([[122.6, 112], [127.5, 105.6], [145, 105.6]], 5.2, (o) => o.dispose());
      F.b.run([[124, 112.5], [128.5, 105.2], [145.2, 105.2]], 4.9, (o) => o.dispose());
      F.z1.run([[123.2, 112.5], [128, 105.8], [145.2, 105.8]], 5.6, (o) => o.dispose());
      F.z2.run([[122.8, 113.5], [128.6, 105.0], [145.4, 105.0]], 5.4, (o) => o.dispose());
      setTimeout(() => talk(EV.flee), 900);
    }
    if (!st.blockSaid && p.z > 108) { st.blockSaid = true; talk(EV.block); }
  }

  // ---------- El avión que cae (desde la plaza) ----------
  let glowTexC = null;
  function glowTex() {
    if (glowTexC) return glowTexC;
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    glowTexC = new THREE.CanvasTexture(cv);
    return glowTexC;
  }
  function sprite(col, s, op, add) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, depthWrite: false, blending: add === false ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: op == null ? 1 : op, fog: false }));
    sp.material.toneMapped = false; sp.scale.set(s, s, 1); sp.userData.noFlashShadow = true;
    return sp;
  }
  function planeModel() {
    const g = new THREE.Group();
    const mat = (c) => { const m = new THREE.MeshBasicMaterial({ color: c, fog: false }); m.toneMapped = false; return m; };
    const body = mat(0x2a2c30), dark = mat(0x16181a);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.6, 36, 8), body); fus.rotation.x = Math.PI / 2; g.add(fus);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5, 8), body); nose.rotation.x = Math.PI / 2; nose.position.z = 20.5; g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 6), dark); wing.position.set(0, -0.6, 1); g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 3.5), dark); tail.position.set(0, 0.6, -16.5); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.5, 4.5), dark); fin.position.set(0, 3.6, -16); g.add(fin);
    for (const e of [-1, 1]) { const en = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4.2, 8), dark); en.rotation.x = Math.PI / 2; en.position.set(e * 7.5, -1.6, 3); g.add(en); }
    // luces de posición (roja, verde y la blanca que destella) y el motor ardiendo
    const L = {};
    L.red = sprite(0xff2020, 6, 1); L.red.position.set(-17, -0.5, 1); g.add(L.red);
    L.green = sprite(0x20ff40, 6, 1); L.green.position.set(17, -0.5, 1); g.add(L.green);
    L.strobe = sprite(0xffffff, 9, 0); L.strobe.position.set(0, 7, -16); g.add(L.strobe);
    L.fire = sprite(0xff8a30, 16, 1); L.fire.position.set(7.5, -1.6, 0); g.add(L.fire);
    g.userData.L = L;
    g.scale.setScalar(1);
    return g;
  }
  function startPlane() {
    const sc = sceneOf();
    if (!sc) return;
    const p = pl.pos;
    // hacia donde mira la cámara (más o menos hacia el centro de la plaza), arriba: cruza el cielo y cae detrás de los edificios
    const C = G.Camera, f0 = C && C.forward ? C.forward() : { x: 0.6, z: 0.8 };
    let fx = f0.x, fz = f0.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const rx = -fz, rz = fx;
    const P0 = { x: p.x + fx * 260 + rx * 170, y: 330, z: p.z + fz * 260 + rz * 170 };
    const P1 = { x: p.x + fx * 380 - rx * 90, y: 40, z: p.z + fz * 380 - rz * 90 };
    const m = planeModel();
    sc.add(m);
    st.plane = { m, P0, P1, t: 0, dur: 7.5, trail: [], trailT: 0, done: false, boomT: -1, sc, fx, fz, crash: { x: P1.x + fx * 30, z: P1.z + fz * 30 } };
    if (G.Audio) G.Audio.play('gust', { vol: 0.5 });
    talk(EV.plane0);
    // la cámara mira arriba un momento (Javier se queda mirando): de lado y desde abajo, en mano
    const near = aliveZ().some((z) => dist(z.pos, p) < 20 && z.state !== 'dead');
    if (!near && !pl.struggle) {
      st.plane.shot = true;
      K.lockAll(true);
      pl.storySafe = true;
      pl.noFace = true; pl.facing = Math.atan2(fx, fz);          // (mira al avión, no a Alem)
      st.calm = 8;
      const eye = { x: p.x - fx * 2.2 + rx * 0.9, y: 1.25, z: p.z - fz * 2.2 + rz * 0.9 };
      const at0 = { x: p.x + fx * 30, y: 26, z: p.z + fz * 30 }, at1 = { x: p.x + fx * 30 - rx * 5, y: 14, z: p.z + fz * 30 - rz * 5 };
      K.camShot([[0, eye, at0], [4.5, eye, at1], [6.5, { x: eye.x, y: 1.5, z: eye.z }, { x: p.x + fx * 30, y: 6, z: p.z + fz * 30 }]]);
    }
  }
  function stepPlane(dt) {
    const P = st.plane;
    if (!P) return;
    P.t += dt;
    const u = Math.min(1, P.t / P.dur), e = u * u * (1.6 - 0.6 * u);
    if (!P.done) {
      const x = P.P0.x + (P.P1.x - P.P0.x) * e, y = P.P0.y + (P.P1.y - P.P0.y) * e, z = P.P0.z + (P.P1.z - P.P0.z) * e;
      const m = P.m;
      const vx = P.P1.x - P.P0.x, vy = (P.P1.y - P.P0.y) * (1 + u), vz = P.P1.z - P.P0.z;
      m.position.set(x, y, z);
      m.lookAt(x + vx, y + vy, z + vz);
      m.rotateZ(0.35 + u * 0.5);
      const L = m.userData.L;
      L.strobe.material.opacity = (P.t % 1.1) < 0.08 ? 1 : 0;
      L.fire.scale.setScalar(14 + Math.sin(P.t * 23) * 3);
      // la estela de fuego y humo
      P.trailT -= dt;
      if (P.trailT <= 0) {
        P.trailT = 0.06;
        const f = sprite(0xff7a20, 18, 0.85); f.position.set(x, y, z); P.sc.add(f); P.trail.push({ sp: f, t: 0, life: 0.9, grow: 10 });
        const s = sprite(0x1a1614, 22, 0.5, false); s.position.set(x, y + 2, z); P.sc.add(s); P.trail.push({ sp: s, t: 0, life: 3.2, grow: 26, smoke: true });
      }
      // (la toma de cámara se suelta cuando ya cae detrás de los edificios)
      if (u >= 0.82 && P.shot) { K.endShot(); K.lockAll(false); freeLocks(); pl.storySafe = false; pl.noFace = false; P.shot = false; }
      if (u >= 1) {
        // el impacto: detrás de los edificios, un destello enorme; el estruendo llega después
        P.done = true; P.t = 0;
        P.sc.remove(m); m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        const c = P.crash;
        P.flash = sprite(0xffd090, 520, 1); P.flash.position.set(c.x, 40, c.z); P.sc.add(P.flash);
        P.glow = sprite(0xff6a20, 360, 0.55); P.glow.scale.set(360, 180, 1); P.glow.position.set(c.x, 20, c.z); P.sc.add(P.glow);
        P.smoke = [];
        for (let i = 0; i < 10; i++) { const s = sprite(0x2a1e18, 90, 0, false); s.position.set(c.x, 30, c.z); P.sc.add(s); P.smoke.push({ sp: s, t: i / 10 }); }
        P.boomT = 1.6;
        if (G.Camera && G.Camera.shake) G.Camera.shake(0.12);
      }
    } else {
      if (P.flash) { P.flash.material.opacity = Math.max(0, 1 - P.t / 1.4); if (P.t > 1.4) { P.sc.remove(P.flash); P.flash.material.dispose(); P.flash = null; } }
      if (P.glow) P.glow.material.opacity = 0.42 + Math.sin(P.t * 3.3) * 0.06;
      for (const s of P.smoke) { s.t = (s.t + dt * 0.05) % 1; s.sp.position.y = 30 + s.t * 160; const sc = 70 + s.t * 160; s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = 0.35 * Math.sin(Math.PI * s.t); }
      if (P.boomT > 0 && (P.boomT -= dt) <= 0) {
        if (G.Audio) { G.Audio.play('explosion', { vol: 1 }); G.Audio.play('wallBreak', { vol: 0.6, delay: 0.25 }); }
        if (G.Camera && G.Camera.shake) G.Camera.shake(0.45);
        talk(EV.plane1);
      }
    }
    for (let i = P.trail.length - 1; i >= 0; i--) {
      const q = P.trail[i];
      q.t += dt;
      const k = q.t / q.life;
      if (k >= 1) { P.sc.remove(q.sp); q.sp.material.dispose(); P.trail.splice(i, 1); continue; }
      const s = q.sp.scale.x + q.grow * dt; q.sp.scale.set(s, s, 1);
      q.sp.material.opacity = (q.smoke ? 0.5 : 0.85) * (1 - k);
      if (q.smoke) q.sp.position.y += dt * 3;
    }
  }
  function clearPlane() {
    const P = st && st.plane;
    if (!P) return;
    const rm = (s) => { if (s && s.parent) { s.parent.remove(s); if (s.material && s.material.dispose) s.material.dispose(); } };
    if (P.m && P.m.parent) { P.sc.remove(P.m); P.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    for (const q of P.trail) rm(q.sp);
    rm(P.flash); rm(P.glow);
    if (P.smoke) for (const s of P.smoke) rm(s.sp);
    st.plane = null;
  }

  // ---------- Luces de los incendios (unas pocas luces que van con los fuegos más cercanos) ----------
  function firesSetup(sc) {
    const fx = st.fires = { list: [], lights: [] };
    for (const [x, y, z, big] of HU().fires) {
      const s = big ? 4.2 : 2.6;
      const f = sprite(0xffa050, s, 1); f.material.fog = true; f.position.set(x, y + 0.4, z); f.scale.set(s, s * 1.2, 1); sc.add(f);
      const halo = sprite(0xff7a30, s * 3.2, 0.32); halo.material.fog = true; halo.position.set(x, y + 0.8, z); halo.scale.set(s * 3.2, s * 2.4, 1); sc.add(halo);
      fx.list.push({ x, y, z, s, f, halo, ph: Math.random() * 10 });
    }
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xff7a30, 0, 16, 1.6); l.position.set(0, -50, 0); sc.add(l); fx.lights.push(l); }
  }
  function firesUpdate(dt) {
    const F = st.fires;
    if (!F) return;
    const T = (st.t || 0);
    for (const f of F.list) {
      const q = 0.82 + 0.18 * Math.sin(T * 13 + f.ph) * Math.sin(T * 7.3 + f.ph * 2);
      f.f.scale.set(f.s * q, f.s * 1.2 * (0.9 + 0.1 * Math.sin(T * 9 + f.ph)), 1);
      f.halo.material.opacity = 0.26 + 0.08 * q;
    }
    // las dos luces, en los dos fuegos más cercanos a Javier
    const p = pl.pos;
    const near = F.list.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    F.lights.forEach((l, i) => {
      const f = near[i];
      if (!f || Math.hypot(f.x - p.x, f.z - p.z) > 40) { l.intensity = 0; return; }
      l.position.set(f.x, f.y + 1.2, f.z);
      l.intensity = 1.8 + Math.sin(T * 17 + f.ph) * 0.3 + (Math.random() - 0.5) * 0.3;
    });
  }
  function firesClear() {
    const F = st && st.fires;
    if (!F) return;
    for (const f of F.list) for (const s of [f.f, f.halo]) { if (s.parent) s.parent.remove(s); s.material.dispose(); }
    for (const l of F.lights) if (l.parent) l.parent.remove(l);
    st.fires = null;
  }

  // ---------- Objetos de las escenas (el revólver en la mano de Alem, el cajón, la llave inglesa) ----------
  function revolverMesh() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.7, roughness: 0.4 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.7 });
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.17), dark); barrel.position.set(0, 0.03, 0.09);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.045, 8), dark); cyl.rotation.x = Math.PI / 2; cyl.position.set(0, 0.022, 0.0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.04, 0.07), dark); frame.position.set(0, 0.01, -0.01);
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.08, 0.035), grip); g1.position.set(0, -0.035, -0.05); g1.rotation.x = 0.35;
    g.add(barrel, cyl, frame, g1);
    return g;
  }
  function crateMesh() {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a4a2c }), band = new THREE.MeshLambertMaterial({ color: 0x2a2a2c });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.5), wood); g.add(b);
    for (const x of [-0.26, 0.26]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.52), band); s.position.x = x; g.add(s); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function wrenchMesh() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x8a8c90, metalness: 0.8, roughness: 0.35 });
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.018), m); h.position.y = -0.12; g.add(h);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.02), m); hd.position.y = 0.04; g.add(hd);
    return g;
  }
  const disposeObj = (o) => { if (!o) return; if (o.parent) o.parent.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); if (q.material && q.material.dispose) q.material.dispose(); }); };

  // ---------- La cámara en mano (la entrada al depósito): detrás de Javier, con su temblor ----------
  function handCam(dt) {
    const H = K.host();
    if (!H || !H.camera) return;
    const cam = H.camera, c = st.hc || (st.hc = { x: pl.pos.x, y: 1.8, z: pl.pos.z - 3, t: 0, f: pl.facing });
    c.t += dt;
    c.f = c.f + U.angleDiff(pl.facing, c.f) * Math.min(1, dt * 2.5);
    const fx = Math.sin(c.f), fz = Math.cos(c.f);
    const wx = pl.pos.x - fx * 2.6 + Math.cos(c.f) * 0.35, wz = pl.pos.z - fz * 2.6 - Math.sin(c.f) * 0.35, wy = 1.75;
    const k = Math.min(1, dt * 4);
    c.x += (wx - c.x) * k; c.y += (wy - c.y) * k; c.z += (wz - c.z) * k;
    const sh = 0.035;
    cam.position.set(c.x + Math.sin(c.t * 2.3) * sh + Math.sin(c.t * 7.1) * sh * 0.4, c.y + Math.sin(c.t * 3.1) * sh + Math.sin(c.t * 9.3) * sh * 0.3, c.z + Math.cos(c.t * 1.9) * sh);
    cam.up.set(0, 1, 0);
    cam.lookAt(pl.pos.x + fx * 3, 1.25 + Math.sin(c.t * 2.7) * 0.03, pl.pos.z + fz * 3);
    cam.rotateZ(Math.sin(c.t * 1.7) * 0.025);
  }

  // ---------- Los golpes en la puerta y la reja (mientras se buscan las llaves) ----------
  function poundUpdate(dt) {
    const D = HU().depot;
    st.bangT -= dt;
    if (st.bangT <= 0) {
      const heavy = st.ph === 'search' && st.searchT > 55;
      st.bangT = heavy ? R(0.45, 1.0) : R(0.8, 1.8);
      if (G.Audio) G.Audio.play(Math.random() < 0.7 ? 'bang' : 'doorKick', { x: D.door.x + 0.5, z: D.door.z - 0.3, lv: 0, vol: heavy ? 1.1 : 0.85 });
      if (G.Audio && Math.random() < 0.3) G.Audio.play(pick(['zGrowl', 'zAttack', 'zGroan']), { x: D.door.x + R(-1, 1), z: D.door.z - 1.2, lv: 0, vol: 0.7 });
      const a = K.npc('alem');
      if (a && a.pose === 'brace' && G.Camera && G.Camera.shake && dist(pl.pos, a.pos) < 6) G.Camera.shake(0.05);
    }
    st.clangT -= dt;
    if (st.clangT <= 0) {
      st.clangT = R(0.6, 1.6);
      if (G.Audio) G.Audio.play('clang', { x: 117 + R(-2, 2), z: 154.3, lv: 0, vol: R(0.4, 0.75) });
    }
  }
  // la garita: el cajetín de las llaves en la pared (con sus ganchos vacíos) y la chaqueta del vigilante en la silla
  function guardDecor(sc) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a5e62 }));
    g.add(box);
    const hm = new THREE.MeshLambertMaterial({ color: 0xb8b8b0 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.05), hm); k.position.set(-0.24 + c * 0.096, 0.14 - r * 0.13, 0.07); g.add(k); }
    g.position.set(108.3, 1.45, 136.12);
    sc.add(g);
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.12), new THREE.MeshLambertMaterial({ color: 0x23293a }));
    jacket.position.set(106.4, 0.86, 138.2); jacket.rotation.x = -0.15;
    sc.add(jacket);
    st.decor = [g, jacket];
  }
  function yardActors(sc) {
    // los de la reja: agarrados a los barrotes, sacudiéndolos (desde dentro se los ve)
    st.yard = [];
    for (const [x, z, f] of [[114.9, 155.0, Math.PI], [116.7, 155.3, Math.PI], [118.4, 155.0, Math.PI], [119.6, 155.7, Math.PI]]) {
      const a = new Actor(sc, 'z', { x, z, face: f, mode: 'rattle' });
      st.yard.push(a); st.actors.push(a);
    }
  }

  // ---------- El depósito: la puerta ----------
  const doorRef = () => { const D = HU().depot; return { o: 'N', x: D.door.x, z: D.door.z, lv: 0 }; };
  function closeDoor() {
    const W = G.World, ref = doorRef();
    W.setEdge(ref, W.E.DOOR);
    if (W.lockEdge) W.lockEdge(ref);
    if (G.Audio) G.Audio.play('doorClose', { x: ref.x + 0.5, z: ref.z, lv: 0, vol: 1.2 });
  }
  // el cajón contra la puerta (y desde ahí ya no se mueve)
  function crateAtDoor(sc) {
    const D = HU().depot;
    if (!st.crate) { st.crate = crateMesh(); sc.add(st.crate); }
    st.crate.position.set(D.door.x + 0.5, 0.25, D.door.z + 0.42); st.crate.rotation.set(0, 0.2, 0);
  }

  // ---------- Prepararlo todo (cuerpos y escenas): poco a poco o de golpe detrás de la pantalla negra ----------
  const Prep = { q: [], done: true };
  function prepare(sc) {
    Prep.q = []; Prep.done = false;
    // (las luces de los fuegos, lo primero: al añadir luces se recompilan los materiales, mejor detrás del negro)
    Prep.q.push(() => { if (!st.fires) firesSetup(sc); });
    for (let i = 0; i < 12; i++) Prep.q.push(() => Bodies.make());
    Prep.q.push(() => { buildEvents(sc); });
    Prep.q.push(() => { yardActors(sc); guardDecor(sc); });
  }
  function prepStep(ms) {
    if (Prep.done) return true;
    const t0 = performance.now();
    while (Prep.q.length) { Prep.q.shift()(); if (performance.now() - t0 >= ms) break; }
    if (!Prep.q.length) Prep.done = true;
    return Prep.done;
  }

  // ---------- Fases ----------
  function fresh() {
    return { ph: null, t: 0, wt: 0, zs: [], actors: [], recent: [], spawnT: 2, calm: 0, tidyT: 1, prog: 0, ri: 0, dir: { x: 1, z: 0 },
      al: { i: 1, cd: 1.5, lineCD: 3, aim: null, said: {} }, bangT: 1, clangT: 1, searchT: 0, found: 0, nag: 0, props: [], ev: null, plane: null };
  }
  function freeLocks() { if (G.Input) G.Input.locks = null; document.body.classList.remove('st-lock'); }
  // la persecución: suelta a Javier (con todo: correr, apuntar, disparar, golpear)
  function startChase() {
    st.ph = 'chase'; st.t = 0;
    K.lockAll(false); freeLocks();
    if (G.Combat) G.Combat.peaceful = false;
    if (G.Audio) G.Audio.calm = false;
    if (G.CitySound) { G.CitySound.level = 1.3; G.CitySound.chaos = 1; }
    if (G.Flash && G.Flash.external) G.Flash.external(null);
    if (G.Flash && G.Flash.set && !G.Flash.on) G.Flash.set(true);
    pl.storyPose = null; pl.storySafe = false;
    K.setObj('Sigue a Alem');
    { const a = K.npc('alem'); if (a && a.setGun) a.setGun(true); }          // (con la pistola en la mano, como Javier)
    const H = K.host();
    if (H && H.toast) H.toast(G.Input && G.Input.isTouch ? 'Tu revólver está en la funda: Apuntar para sacarlo y Disparar' : 'Tu revólver está en la funda: clic derecho para apuntar y clic para disparar', 'info');
    // los primeros, por donde se oyeron (detrás y por la avenida)
    st.spawnT = 1.5;
    for (const s of [[28, 50.5], [6, 30]]) { const q = freeNear(s[0], s[1]); if (q) spawnZ(q.x, q.z); }
    talk(GO);
  }
  function giveRevolver() {
    // a la funda de siempre, con munición para la huida
    const w = G.Weapons.get('revolver');
    pl.hands[1] = { id: 'revolver', cond: 1, two: false, mag: w ? w.mag : 6 };
    pl.ammo.revolver = Math.max(pl.ammo.revolver || 0, 24);
    if (pl.items) pl.items.venda = Math.max(pl.items.venda || 0, 1);
    pl.equip(-1);
    pl.refreshModel();
    if (G.Audio) G.Audio.play('pickup');
  }
  // el progreso por el camino (el último punto por el que pasó Javier) y hacia dónde sigue
  function progress() {
    const H = HU(), r = H.route;
    for (let i = st.ri + 1; i < Math.min(r.length, st.ri + 4); i++) if (Math.hypot(pl.pos.x - r[i][0], pl.pos.z - r[i][1]) < 8) st.ri = i;
    st.prog = st.ri / (r.length - 1);
    const a = r[st.ri], b = r[Math.min(r.length - 1, st.ri + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    st.dir = { x: dx / l, z: dz / l };
  }

  const Huida = {
    get phase() { return st ? st.ph : null; },
    get state() { return st; },
    prepare(sc) { if (!st) st = fresh(); prepare(sc); },
    prepStep,
    get prepared() { return Prep.done; },
    // después del corredor del cruce (Alem ya junto a Javier): el revólver y a correr
    start(player, kit) {
      K = kit; pl = player;
      if (!st) st = fresh();
      st.ph = 'give'; st.t = 0;
      pl.storyPose = 'stomach';
      if (!Prep.done) prepStep(1e9);
      const a = K.npc('alem');
      if (a) {
        a.place(a.pos.x, a.pos.z, Math.atan2(pl.pos.x - a.pos.x, pl.pos.z - a.pos.z), 'offer');
        st.rev = revolverMesh();
        if (a.model.handR) { st.rev.position.set(0, -0.07, 0.03); st.rev.rotation.set(0.2, 0, 1.4); a.model.handR.add(st.rev); }
      }
      talk(GIVE, () => { st.ph = 'take'; st.wt = 0; });
      if (!st.fires) firesSetup(sceneOf());
    },
    // desde un punto de control: 1 (el cruce, con el revólver), 2 (dentro del depósito, la puerta atrancada), 3 (al volante)
    // lo pesado de un punto de control (detrás de la pantalla de carga): los cuerpos, las escenas, los fuegos o, en
    // el 3, la calle entera con el coche
    prepareCp(cp, player, kit) {
      K = kit; pl = player;
      st = fresh();
      const sc = sceneOf();
      if (cp === 3) { st.ph = 'car'; if (G.RoadLife) G.RoadLife.begin(pl, K, true); return; }
      prepare(sc); prepStep(1e9);
    },
    resume(cp, player, kit) {
      K = kit; pl = player;
      if (!st) this.prepareCp(cp, player, kit);
      if (cp === 3) { st.ph = 'car'; if (G.RoadLife) G.RoadLife.start(); return; }
      const sc = sceneOf();
      const a = K.npc('alem');
      giveRevolver();
      if (cp === 1) {
        const r = HU().route[0];
        pl.pos.x = r[0] - 1.2; pl.pos.z = r[1] + 1.6; pl.facing = Math.PI / 2;
        if (a) a.place(r[0] + 0.6, r[1] + 0.2, -Math.PI / 2, null);
        if (G.Camera) { G.Camera.yaw = pl.facing; G.Camera.pitch = 0.12; }
        st.ph = 'hear'; st.wt = 0.8;
        talk([HEAR[2]], () => startChase());
        st.ph = 'go';
      } else {
        // dentro del depósito: la puerta cerrada y atrancada, Alem aguantándola
        const D = HU().depot;
        G.World.setEdge(doorRef(), G.World.E.DOOR); if (G.World.lockEdge) G.World.lockEdge(doorRef());
        crateAtDoor(sc);
        pl.pos.x = 116.2; pl.pos.z = 140.2; pl.facing = Math.PI * 0.75;
        if (a) { a.place(D.door.x + 0.4, D.door.z + 1.0, Math.PI, 'brace'); }
        if (G.Camera) { G.Camera.yaw = pl.facing; G.Camera.pitch = 0.12; }
        for (const z0 of st.zs) z0.dispose();
        // los de fuera (golpeando la puerta)
        for (const [x, z] of [[114.8, 132.4], [117.6, 131.6], [116.2, 130.2]]) spawnZ(x, z);
        startSearch(true);
      }
    },
    update(dt, player) {
      if (!st || !st.ph) return;
      pl = player;
      st.t += dt;
      if (st.wt > 0) st.wt -= dt;
      const ph = st.ph;
      if (!Prep.done && (ph === 'give' || ph === 'take' || ph === 'hear')) prepStep(5);
      if (st.ev) eventsUpdate(dt);
      firesUpdate(dt);
      if (st.rev && ph !== 'give' && ph !== 'take') { disposeObj(st.rev); st.rev = null; }
      if (ph === 'take') {
        // Javier coge el revólver de la mano de Alem
        if (st.wt <= 0 && !st.taking) {
          st.taking = true;
          const a = K.npc('alem');
          let at = { x: pl.pos.x, y: 1.2, z: pl.pos.z };
          if (st.rev) { const v = new THREE.Vector3(); st.rev.getWorldPosition(v); at = { x: v.x, y: v.y, z: v.z }; }
          const far = Math.hypot(at.x - pl.pos.x, at.z - pl.pos.z) - 0.55;
          pl.action = { kind: 'pickupHi', t: 0, dur: 0.55, impact: 0.45, face: Math.atan2(at.x - pl.pos.x, at.z - pl.pos.z), item: at, done: false, step: far > 0.05 ? { len: Math.min(1.0, far), done: 0 } : null };
          st.wt = 0.5;
          if (a) a.pose = 'offer';
        } else if (st.taking && st.wt <= 0) {
          disposeObj(st.rev); st.rev = null;
          giveRevolver();
          const a = K.npc('alem'); if (a) a.pose = null;
          st.ph = 'hear'; st.wt = 0.6;
          // gritos y aullidos alrededor: llegan más
          if (G.Audio) { G.Audio.play('zAlert', { x: pl.pos.x + 22, z: pl.pos.z - 14, lv: 0, runner: true }); G.Audio.play('zAlert', { x: pl.pos.x - 18, z: pl.pos.z + 20, lv: 0, runner: true, delay: 0.7 }); }
          talk(HEAR, () => {
            // el primer punto de control: a partir de aquí, si mueres, se vuelve aquí
            if (K.checkpoint) K.checkpoint(1);
            startChase();
          });
          st.ph = 'go';
        }
        return;
      }
      if (ph === 'chase') {
        progress();
        alemUpdate(dt);
        director(dt);
        tidy(dt);
        if (G.Music && G.Music.hold && aliveZ().length) G.Music.hold(4);
        // a la puerta del depósito
        const D = HU().depot;
        const a = K.npc('alem');
        if (st.ri >= HU().route.length - 2 && Math.hypot(pl.pos.x - (D.door.x + 0.5), pl.pos.z - (D.door.z - 3.5)) < 4.5) arrive();
        else if (st.ri >= HU().route.length - 3 && st.calm <= 0) st.calm = 99;         // (en la recta final ya no salen más)
        if (a && st.al.i >= HU().route.length && !a.walk) a.pose = 'wave';
        return;
      }
      if (ph === 'arrive') { arriveStep(dt); return; }
      if (ph === 'block') { blockStep(dt); poundUpdate(dt); return; }
      if (ph === 'search') { searchStep(dt); poundUpdate(dt); return; }
      if (ph === 'smash') { smashStep(dt); poundUpdate(dt); return; }
      if (ph === 'board') { boardStep(dt); poundUpdate(dt); return; }
      if (ph === 'car' && G.RoadLife) G.RoadLife.flow(dt, pl);
    },
    // la segunda parte al volante (desde subir al coche del depósito o desde el punto de control 3)
    toCar(fromCp) { st.ph = 'car'; if (G.RoadLife) G.RoadLife.begin(pl, K, fromCp); },
    // al subir al coche: todo lo de la huida a pie fuera (antes de cambiar de mapa)
    dropFoot() {
      if (!st) return;
      for (const a of st.actors) a.dispose();
      st.actors = []; st.ev = null; st.yard = [];
      clearPlane(); firesClear();
      disposeObj(st.crate); disposeObj(st.wrench); disposeObj(st.hole); st.crate = st.wrench = st.hole = null;
      if (st.decor) for (const o of st.decor) disposeObj(o);
      if (st.glass) for (const g of st.glass) disposeObj(g.m);
      st.decor = null; st.glass = null;
      const L = G.Population ? G.Population.list : [];
      for (const z of st.zs) { z.dispose(); const j = L.indexOf(z); if (j >= 0) L.splice(j, 1); }
      st.zs = [];
    },
    Actor,
    clear() {
      if (st) {
        for (const a of st.actors) a.dispose();
        clearPlane(); firesClear();
        disposeObj(st.rev); disposeObj(st.crate); disposeObj(st.wrench); disposeObj(st.hole);
        if (st.decor) for (const o of st.decor) disposeObj(o);
        if (st.glass) for (const g of st.glass) disposeObj(g.m);
        for (const p of st.props) if (K) K.dropProp(p);
        const L = G.Population ? G.Population.list : [];
        for (const z of st.zs) { z.dispose(); const j = L.indexOf(z); if (j >= 0) L.splice(j, 1); }
      }
      if (G.RoadLife) G.RoadLife.clear();
      if (G.CitySound) G.CitySound.chaos = 0;
      if (pl) { pl.noFace = false; pl.limp = 0; }
      st = null; K = null; pl = null;
      Prep.q = []; Prep.done = true;
      Bodies.looks = [];
    }
  };

  // ---------- La llegada: dentro, la puerta, el cajón ----------
  function arrive() {
    st.ph = 'arrive'; st.t = 0; st.sub = 0;
    K.lockAll(true);
    if (G.Combat) G.Combat.peaceful = true;
    if (pl.struggle) pl.struggle = null;
    pl.action = null;
    K.objDone();
    // los que venían detrás, más atrás (llegan a la puerta cuando ya está cerrada)
    const D = HU().depot;
    let k = 0;
    for (const z of aliveZ()) {
      if (dist(z.pos, pl.pos) > 26) continue;
      const q = freeNear(118 + (k % 3) * 2.5 - 2.5, 104 + (k / 3 | 0) * 2.5);
      if (q) { z.pos.x = q.x; z.pos.z = q.z; z.enter('chase', 0); z.path = null; }
      k++;
    }
    if (G.Camera) G.Camera.held = true;
    st.hc = null;
    // los dos, corriendo hacia dentro
    pl.auto = { pts: [{ x: D.door.x + 0.45, z: D.door.z - 1.4 }, { x: D.door.x + 0.45, z: D.door.z + 1.4 }, { x: D.door.x - 0.8, z: D.door.z + 3.8 }], i: 0, face: Math.PI * 0.8, done: false, run: true };
    const a = K.npc('alem');
    if (a) { a.pose = null; a.setGun(false); st.al.aim = null; a.walkTo([[D.door.x + 1.7, D.door.z - 1.6]], Math.PI, 4.0); }
    talk(INSIDE);
    if (G.Music && G.Music.hold) G.Music.hold(10);
  }
  function arriveStep(dt) {
    const D = HU().depot, a = K.npc('alem');
    if (st.sub === 0) {
      handCam(dt);
      // (Alem entra detrás de Javier: primero él, para no chocar en la puerta)
      if (a && !st.aGo && pl.pos.z > D.door.z + 1.0) { st.aGo = true; a.walkTo([[D.door.x + 0.6, D.door.z - 0.6], [D.door.x + 0.55, D.door.z + 0.95]], Math.PI, 4.6); }
      const inside = pl.pos.z > D.door.z + 1.6, aIn = !a || (st.aGo && (!a.walk || a.walk.done));
      if ((inside && aIn) || st.t > 6) {
        // la puerta, de un portazo; Alem la aguanta
        if (a) { a.walk = null; a.place(D.door.x + 0.55, D.door.z + 0.95, Math.PI, 'brace'); }
        closeDoor();
        if (G.Camera && G.Camera.shake) G.Camera.shake(0.2);
        st.sub = 1; st.t = 0; st.bangT = 0.4;
        // la escena desde dentro: la puerta, Alem empujándola y Javier, agotado
        K.camShot([[0, { x: 112.8, y: 1.7, z: 141.6 }, { x: D.door.x + 0.3, y: 1.2, z: D.door.z + 0.6 }], [6, { x: 113.4, y: 1.6, z: 141.0 }, { x: D.door.x + 0.1, y: 1.15, z: D.door.z + 0.9 }]]);
        pl.auto = null; pl.storyPose = 'tired';
        talk(BLOCK0, () => { st.sub = 2; st.t = 0; });
      }
      return;
    }
    poundUpdate(dt);
    if (st.sub === 2 && st.t > 0.4) {
      // Alem va a por el cajón
      st.sub = 3; st.t = 0;
      if (a) a.walkTo([[D.crate.x + 0.7, D.crate.z + 0.2]], Math.atan2(-0.7, -0.2), 3.2);
      if (!st.crate) { st.crate = crateMesh(); sceneOf().add(st.crate); }
      st.crate.position.set(D.crate.x, 0.25, D.crate.z);
    } else if (st.sub === 3 && a && (!a.walk || a.walk.done || st.t > 4)) {
      // lo levanta (agachado, lo agarra, arriba)
      st.sub = 4; st.t = 0;
      a.walk = null; a.facing = Math.atan2(D.crate.x - a.pos.x, D.crate.z - a.pos.z);
      a.pose = 'lift'; a.poseU = 0; a.poseK = 1;
      if (G.Audio) G.Audio.play('pStrain', { x: a.pos.x, z: a.pos.z, lv: 0 });
    } else if (st.sub === 4) {
      a.poseU = Math.min(1, st.t / 1.3);
      // el cajón sube con las manos
      const up = U.smooth(U.clamp((a.poseU - 0.3) / 0.45, 0, 1));
      const fx = Math.sin(a.facing), fz = Math.cos(a.facing);
      st.crate.position.set(a.pos.x + fx * (0.55 - 0.12 * up), 0.25 + up * 0.8, a.pos.z + fz * (0.55 - 0.12 * up));
      st.crate.rotation.y = a.facing;
      if (st.t > 1.5) { st.sub = 5; st.t = 0; a.walkTo([[D.door.x + 0.5, D.door.z + 1.75]], Math.PI, 1.6); }
    } else if (st.sub === 5) {
      // lo lleva hasta la puerta (despacio: pesa)
      const fx = Math.sin(a.facing), fz = Math.cos(a.facing);
      st.crate.position.set(a.pos.x + fx * 0.43, 1.05 + Math.sin(st.t * 9) * 0.02, a.pos.z + fz * 0.43);
      st.crate.rotation.y = a.facing;
      a.pose = 'lift'; a.poseU = 1;
      if (!a.walk || a.walk.done || st.t > 4) { a.walk = null; a.facing = Math.PI; st.sub = 6; st.t = 0; a.pose = 'throw'; a.poseU = 0; }
    } else if (st.sub === 6) {
      // y lo arroja contra la puerta
      a.poseU = Math.min(1, st.t / 0.95);
      const u = a.poseU, fx = Math.sin(a.facing), fz = Math.cos(a.facing);
      if (u < 0.45) {
        const r = U.smooth(u / 0.4);
        st.crate.position.set(a.pos.x + fx * (0.43 - 0.3 * r), 1.05 + r * 0.95, a.pos.z + fz * (0.43 - 0.3 * r));
      } else if (!st.thrown) {
        st.thrown = { t: 0, x0: st.crate.position.x, y0: st.crate.position.y, z0: st.crate.position.z };
        if (G.Audio) G.Audio.play('pEffort', { x: a.pos.x, z: a.pos.z, lv: 0 });
      }
      if (st.thrown) {
        const T = st.thrown; T.t += dt;
        const k = Math.min(1, T.t / 0.42);
        const tx = D.door.x + 0.5, tz = D.door.z + 0.42;
        st.crate.position.set(T.x0 + (tx - T.x0) * k, T.y0 + (0.25 - T.y0) * k * k + Math.sin(Math.PI * k) * 0.25, T.z0 + (tz - T.z0) * k);
        st.crate.rotation.x = k * 1.2;
        if (k >= 1 && !T.landed) {
          T.landed = true;
          crateAtDoor(sceneOf());
          if (G.Audio) { G.Audio.play('brick', { x: tx, z: tz, lv: 0, vol: 1.2 }); G.Audio.play('wallBreak', { x: tx, z: tz, lv: 0, vol: 0.35 }); }
          if (G.Camera && G.Camera.shake) G.Camera.shake(0.3);
        }
      }
      if (st.t > 1.5) {
        st.sub = 7; st.t = 0;
        a.pose = 'tired'; a.poseU = 0; a.breath = 1;
        talk(BLOCK1, () => {
          // el segundo punto de control: dentro, la puerta atrancada
          if (K.checkpoint) K.checkpoint(2);
          startSearch(false);
        });
      }
    }
  }
  // ---------- La búsqueda de las llaves ----------
  function startSearch(resumed) {
    st.ph = 'search'; st.t = 0; st.searchT = 0; st.found = 0; st.nag = 0;
    K.endShot();
    if (G.Camera) { G.Camera.held = false; G.Camera.yaw = pl.facing; }
    K.lockAll(false); freeLocks();
    if (G.Combat) G.Combat.peaceful = true;
    pl.storyPose = null;
    const a = K.npc('alem'), D = HU().depot;
    if (a) { a.place(D.door.x + 0.4, D.door.z + 1.0, Math.PI, 'brace'); }
    if (resumed) talk(RESUME2);
    K.setObj('Busca las llaves en la garita del vigilante');
    for (const s of SEARCH) {
      const pr = K.addProp({ x: s.x, z: s.z, label: s.label, reach: 1.15, off: () => st.ph !== 'search' || s.done,
        use: (p) => { searchAt(p, s); return null; } });
      st.props.push(pr);
    }
  }
  function searchAt(p, s) {
    if (s.done || p.busy()) return;
    s.done = true;
    p.action = { kind: 'search', t: 0, dur: 1.25, impact: 0.82, face: s.face != null ? s.face : p.facing, target: null, low: s.z > 139.5, done: false };
    st.pending = { s, t: 1.05 };
  }
  function searchStep(dt) {
    st.searchT += dt;
    const a = K.npc('alem');
    // Alem, cada vez más nervioso
    const n = NAG[st.nag];
    if (n && st.searchT > n[0] && !K.talking()) { st.nag++; say('alem', n[1]); }
    if (a && Math.random() < dt * 0.25) a.pose = Math.random() < 0.7 ? 'brace' : 'brace';
    if (st.pending && (st.pending.t -= dt) <= 0) {
      const s = st.pending.s; st.pending = null;
      st.found++;
      // lo que encuentra lo dice Javier (con su subtítulo); a veces, Alem desde la puerta
      talk(Math.random() < 0.5 ? [['jav', s.got], ['alem', pick(NOPE)]] : [['jav', s.got]]);
      if (G.Audio) G.Audio.play('rustle', { x: pl.pos.x, z: pl.pos.z, lv: 0 });
    }
    const all = st.found >= SEARCH.length;
    if ((all && st.searchT > 30 && !st.pending) || st.searchT > 100) {
      // basta: Alem va a por un coche
      st.ph = 'smash'; st.t = 0; st.sub = 0;
      for (const p of st.props) K.dropProp(p);
      st.props = [];
      K.objDone();
      talk(ENOUGH);
    }
  }
  // ---------- La ventanilla ----------
  function smashStep(dt) {
    const a = K.npc('alem'), D = HU().depot, car = D.car;
    if (!a) { st.ph = 'board'; return; }
    const win = { x: car.x + 0.92, z: car.z + 0.55 };
    if (st.sub === 0 && st.t > 0.6) {
      // por la caja de herramientas (la llave inglesa) y a la puerta del conductor
      st.sub = 1; st.t = 0;
      a.pose = null;
      a.walkTo([[118.4, 143.6], [124.2, 144.2], [124.6, 147.4]], Math.PI / 2, 3.8);
    } else if (st.sub === 1 && (!a.walk || a.walk.done || st.t > 7)) {
      st.sub = 2; st.t = 0;
      st.wrench = wrenchMesh();
      if (a.model.handR) { st.wrench.position.set(0, -0.08, 0.02); st.wrench.rotation.set(1.4, 0, 0); a.model.handR.add(st.wrench); }
      if (G.Audio) G.Audio.play('clang', { x: a.pos.x, z: a.pos.z, lv: 0, vol: 0.4 });
      a.walkTo([[124.4, 151.0], [119.6, 151.3], [win.x + 0.63, win.z + 0.1]], -Math.PI / 2, 3.6);
    } else if (st.sub === 2 && (!a.walk || a.walk.done || st.t > 6)) {
      st.sub = 3; st.t = 0;
      a.walk = null; a.facing = -Math.PI / 2;
      a.pose = 'smash'; a.poseU = 0; a.poseK = 1;
      // la cámara: de cerca, desde el morro
      K.camShot([[0, { x: car.x + 3.4, y: 1.55, z: car.z + 3.6 }, { x: win.x, y: 1.0, z: win.z }]]);
      K.lockAll(true);
    } else if (st.sub === 3) {
      const u = Math.min(1, st.t / 1.5);
      a.poseU = u;
      if (u > 0.33 && !st.hit1) { st.hit1 = true; if (G.Audio) G.Audio.play('hitBlunt', { x: win.x, z: win.z, lv: 0 }); }
      if (u > 0.83 && !st.hit2) {
        st.hit2 = true;
        if (G.Audio) { G.Audio.play('glass', { x: win.x, z: win.z, lv: 0, vol: 1.2 }); G.Audio.play('window', { x: win.x, z: win.z, lv: 0 }); }
        windowBroken(sceneOf(), win);
      }
      if (u >= 1 && st.t > 1.8) {
        st.sub = 4; st.t = 0;
        disposeObj(st.wrench); st.wrench = null;
        a.pose = 'wave';
        talk(SMASHED);
        K.endShot(); K.lockAll(false); freeLocks();
        K.setObj('Sube al coche');
        // Alem, a la otra puerta
        a.walkTo([[car.x + 1.4, car.z + 3.0], [car.x - 1.7, car.z + 3.0], [car.x - 1.6, car.z + 0.8]], Math.PI / 2, 3.4);
        st.carProp = K.addProp({ x: win.x + 0.55, z: win.z, fx: car.x, fz: car.z, label: 'Subir al coche', reach: 2.4, off: () => st.ph !== 'smash' || st.sub !== 4,
          use: () => { boardCar(); return null; } });
        st.props.push(st.carProp);
      }
    }
    if (st.glass) glassStep(dt);
  }
  function windowBroken(sc, w) {
    // el hueco de la ventanilla (oscuro) y los cristales que saltan
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.36), new THREE.MeshBasicMaterial({ color: 0x0c0d0e }));
    m.position.set(w.x + 0.015, 1.16, w.z); m.rotation.y = Math.PI / 2; sc.add(m); st.hole = m;
    st.glass = [];
    const gm = new THREE.MeshBasicMaterial({ color: 0xbfd6e0, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + Math.random() * 0.06, 0.04 + Math.random() * 0.05), gm.clone());
      g.position.set(w.x + 0.05, 1.1 + Math.random() * 0.2, w.z + (Math.random() - 0.5) * 0.7); sc.add(g);
      st.glass.push({ m: g, vx: -R(0.4, 1.6), vy: R(0.2, 1.4), vz: R(-0.8, 0.8), wr: R(-9, 9), t: 0 });
    }
  }
  function glassStep(dt) {
    for (const g of st.glass) {
      if (g.m.position.y <= 0.02) { g.m.rotation.set(-Math.PI / 2, 0, g.m.rotation.z); continue; }
      g.vy -= 9.8 * dt; g.m.position.x += g.vx * dt; g.m.position.y = Math.max(0.02, g.m.position.y + g.vy * dt); g.m.position.z += g.vz * dt;
      g.m.rotation.x += g.wr * dt; g.m.rotation.y += g.wr * 0.7 * dt;
    }
  }
  // ---------- Subir al coche: a negro y a la segunda parte al volante ----------
  function boardCar() {
    if (st.ph !== 'smash' || st.sub !== 4) return;
    const car = HU().depot.car;
    st.ph = 'board'; st.t = 0; st.sub = 0;
    K.objDone(); K.lockAll(true);
    for (const p of st.props) K.dropProp(p);
    st.props = [];
    pl.auto = { pts: [{ x: car.x + 1.45, z: car.z + 0.6 }], i: 0, face: -Math.PI / 2, done: false };
  }
  function boardStep(dt) {
    if (st.sub === 0 && ((pl.auto && pl.auto.done) || st.t > 4)) {
      st.sub = 1; st.t = 0;
      pl.auto = null;
      if (G.Audio) G.Audio.play('doorOpen', { x: pl.pos.x, z: pl.pos.z, lv: 0, vol: 0.8 });
      const H = K.host();
      if (H && H.fadeTo) H.fadeTo(1, 0.8);
    } else if (st.sub === 1 && st.t > 0.6) {
      st.sub = 2; st.t = 0;
      pl.hidden = true;
      if (G.Audio) G.Audio.play('doorClose', { x: pl.pos.x, z: pl.pos.z, lv: 0, vol: 1 });
    } else if (st.sub === 2 && st.t > 0.5) {
      // el tercer punto de control: preparando el coche (el puente)
      if (K.checkpoint) K.checkpoint(3);
      Huida.toCar(false);
    }
  }

  G.Huida = Huida;
})(window.Game = window.Game || {});
