// Muerte súbita (Retorno, una vez por carrera). Si terminas un enfrentamiento casi sin balas (ninguna arma de
// fuego con más de 3, contando las cargadas y las de reserva), al volver al refugio todo parece normal... hasta que
// tocas algo: un temblante que estaba encerrado en el trastero, detrás del comercio, revienta la pared y el comercio
// con ella. Hay que matarlo ahí dentro (con las balas que el comercio deja tiradas por el suelo). Si volviste con
// menos de 6 balas entre todas, aguanta más. El comercio queda destrozado el resto de la carrera; tras el siguiente
// enfrentamiento, en el trastero está Vera (si eres Vera, Di' Arco) con un armario precario que hace de comercio, y
// te echa en cara que bajaras la guardia en el refugio.
(function (G) {
  'use strict';
  const R = (a, b) => a + Math.random() * (b - a);
  const HARD_K = 1.6;              // el temblante, si volviste con menos de 6 balas: aguanta un poco más
  // las balas que suelta el comercio al romperse (por tipo), en dos o tres montones
  const DROP = { '9mm': 18, cartucho: 7, rifle: 6, revolver: 10, smg: 20, flecha: 6, gas: 40 };

  let scene = null, S = null, K = null;   // S: la pelea; K: quien lleva el comercio de después

  function play(id, o) { if (G.Audio) G.Audio.play(id, o || {}); }
  function msg(t, k) { if (G.Refugio && G.Refugio._msg) G.Refugio._msg(t, k || 'bad'); }
  // quien habla en el refugio (los subtítulos y la voz de los humanos)
  function speaker(id, x, z) {
    const C = G.Player.CHARS[id] || {}, fem = !!(C.opts && C.opts.female);
    return { name: C.name || id, pos: { x, z }, female: fem, vp: fem ? 1.2 : 0.8, vr: 1, vIdx: 0, color: '#e8d6a8', alive: true, gone: false };
  }
  function say(sp, lines, gap) {
    if (!G.Humans || !G.Humans.Voice) return;
    lines.forEach((t, i) => setTimeout(() => { if (sp) G.Humans.Voice.say(sp, t, { prio: 4 }); }, i * (gap || 3400)));
  }
  function me(player) { return speaker(player.charId, player.pos.x, player.pos.z); }

  // la pared del comercio (la del trastero: x = el borde oeste de la sala grande) y el comercio
  function shopWall() { const F = G.World.refuge; return { o: 'W', x: F.x0, z: F.z0 + 3, lv: 0 }; }
  function shopStation() { return G.World.stations.find((s) => s.id === 'tienda' && s.f.type === 'puesto'); }

  // las balas del comercio, por el suelo delante de lo que quedó (de las armas que llevas y algo más)
  function dropAmmo(player) {
    const F = G.World.refuge, A = G.Weapons.AMMO, want = {};
    const slots = player.hands.concat(player.stored || [], (player.packless && G.Run.st && G.Run.st.rack) || []);
    for (const s of slots) { if (!s) continue; const w = G.Weapons.get(s.id); if (G.Weapons.isGun(w) && w.ammo) want[w.ammo] = 1; }
    want['9mm'] = 1;                      // (algo de pistola siempre)
    let k = 0;
    for (const a in want) {
      if (!A[a] || !DROP[a]) continue;
      const tot = DROP[a], piles = tot >= 12 ? 3 : 2;
      for (let i = 0; i < piles; i++) {
        const x = F.x0 + 1.0 + R(0, 2.4), z = F.z0 + 1.6 + (k++ % 5) * 0.75 + R(-0.2, 0.2);
        G.Pickups.add(A[a].item, Math.max(1, Math.round(tot / piles)), { x, y: G.World.groundY(x, z, 0), z, lv: 0 });
      }
    }
  }

  // ---------- la pelea ----------
  function start(player) {
    G.Run.suddenStart();
    if (G.Refugio && G.Refugio.panelOpen) G.Refugio.close(false);
    const SD = G.Run.sudden, F = G.World.refuge;
    // el temblante, todavía en el trastero (oculto hasta que reviente la pared)
    const z = new G.Zombie(scene, F.ax0 + 2.6, F.z0 + 3.0, null, Math.PI / 2, { temb: true, lv: 0 });
    z.kind = 'temb'; z.sudden = true; z.model.root.visible = false;
    if (SD && SD.hard) { z.hp *= HARD_K; z.hpMax = z.hp; }
    S = { t: 0, z, hits: 0, broke: false, won: false, hard: !!(SD && SD.hard) };
    const w = shopWall();
    play('bang', { x: w.x - 0.3, z: w.z, lv: 0, vol: 1.5 });
    if (G.Camera.shake) G.Camera.shake(0.14);
    if (G.Input) G.Input.clear && G.Input.clear();
    setTimeout(() => say(me(player), [player.charId === 'tomas' ? '¿Y eso? Dime que es una rata. Una rata grande.' : '¿Qué ha sido eso...? Detrás del comercio.']), 500);
  }
  function burst(player) {
    const W = G.World, w = shopWall(), F = G.World.refuge;
    // la pared cae hacia dentro (los cascotes salen hacia la sala) y el comercio con ella
    if (G.BossFx) G.BossFx.breakAround(w, 1, 1, 0);
    const s = shopStation();
    if (s) {
      const c = W.chunkAt(0, 0);
      if (G.BossFx && G.BossFx.smashFurn) G.BossFx.smashFurn(c, s.f, 1, 0); else W.smashFurn(c, s.f);
      const p = G.Props.list.find((q) => q.id === 'tienda');
      if (p) G.Props.remove(p);
    }
    play('wallBreak', { x: w.x, z: w.z, lv: 0, big: true });
    dropAmmo(player);
    // sale el temblante: ruge y va a por ti
    const z = S.z;
    z.pos.x = F.x0 - 0.9; z.pos.z = w.z; z.y = W.groundY(z.pos.x, z.pos.z, 0);
    z.facing = Math.atan2(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
    z.model.root.visible = true;
    G.Population.list.push(z);
    z.hunter = true; z.target = { x: player.pos.x, z: player.pos.z, lv: 0 }; z.lastSeen = 0;
    z.enter('troar', 1.3);
    play('tRoar', { x: z.pos.x, z: z.pos.z, lv: 0, z0: z, vol: 1.4 });
    // ahora sí se pelea en el refugio
    G.Combat.peaceful = false;
    msg('¡Un temblante reventó la pared del comercio! Las balas del comercio quedaron por el suelo');
    setTimeout(() => say(me(player), [S && S.hard ? '¡Un temblante! Y yo sin una bala... ¡las del comercio, rápido!' : '¡Un temblante! ¡Aquí dentro! Las balas del suelo, cógelas.']), 900);
  }
  function won(player) {
    S.won = true;
    // logros: sobrevivir, sin balas (si volviste con menos de 6) y rematarlo cuerpo a cuerpo
    const z = S.z, kb = z && z.killedBy;
    const got = ['subita'].concat(S.hard ? ['subita_dura'] : [], kb === 'melee' || kb === 'exec' || kb === 'stealth' ? ['subita_palos'] : [])
      .map((id) => G.Run.achieve(id)).filter(Boolean);
    got.forEach((a, i) => setTimeout(() => { msg('Logro desbloqueado: ' + a.name, 'good'); if (G.Audio) G.Audio.play('pickup'); }, 2600 + i * 1600));
    G.Combat.peaceful = true;
    G.Run.suddenDone();
    G.Run.keep(player);
    msg('El temblante cayó... pero el comercio quedó destrozado', 'warn');
    setTimeout(() => say(me(player), ['Se acabó. Y el comercio, también.', 'Me confié. En el refugio, de todos los sitios.'], 3000), 1400);
  }

  // ---------- el comercio de después ----------
  const SCOLD = {
    // Vera (a quien sea; a Di' Arco la llama «Arco»)
    vera: ['Mírate. Volviste sin una sola bala y te paseas por aquí como si nada, {n}.',
      'Bajaste la guardia. En el refugio, que es donde más hay que mirar.',
      'Un temblante. Detrás de una pared. Y tú sin balas. No vuelvas así nunca más.',
      'El comercio ya no existe. Ahora lo que haya, lo tengo yo en este armario. Y la próxima vez, te preparas.'],
    // Di' Arco (a Vera): agresiva, sin rodeos
    diarco: ['¿Tú eras la que pensaba antes de moverse, Vera? Volviste vacía. Vacía.',
      'Un temblante dentro del refugio. Por bajar la guardia. Me cago en todo.',
      'Ahora el comercio soy yo. Lo que queda está en este armario de mierda, y te lo cobro.',
      'La próxima vez que vuelvas sin balas, te dejo sola con el bicho.'],
    tomas: ['Vaya. El comercio hecho pedazos y tú sin balas. Qué día tan precioso.',
      'Bajaste la guardia en el refugio, {n}. En el refugio. Tiene mérito.',
      'Lo que quedó está en este armario. No es gran cosa, como tu planificación.',
      'La próxima vez, vuelve con algo en el cargador. Por favor.']
  };
  function keeperModel(id) {
    const F = G.World.refuge, C = G.Player.CHARS[id];
    if (!C) return null;
    const h = G.Models.createHumanoid(G.Player.optsOf ? G.Player.optsOf(id) : C.opts);
    if (G.Models.setBackpack) G.Models.setBackpack(h, false);
    h.female = !!C.opts.female;
    const x = F.ax0 + 1.7, z = F.z0 + 4.45;          // (junto al armario, a la vista por el hueco)
    h.root.position.set(x, G.World.groundY(x, z, 0), z);
    if (C.scale) h.root.scale.setScalar(C.scale);
    h.root.rotation.y = Math.atan2(F.x0 + 2 - x, F.z0 + 3.2 - z);       // mira hacia el hueco de la pared
    h.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(h.root);
    return { id, h, x, z, t: Math.random() * 10, pose: {} };
  }
  function poseKeeper(dt) {
    const k = K; if (!k) return;
    k.t += dt;
    const t = k.t, sin = Math.sin;
    Object.assign(k.pose, {
      phase: 0, amt: 0, run: false, crouch: 0, prone: 0, rel: 0, hop: 0, cat: 'none', two: false, aim: false, dt, time: t,
      action: null, t: 0, climb: null, dodge: null, dodgeRel: 0, gun: null, pitch: 0, guard: 0, speed: 0, female: k.h.female,
      turn: 0, acc: 0, breath: 0.15, breathT: t * 1.6, look: { yaw: 0.2 + sin(t * 0.31) * 0.3, pitch: 0.04 + sin(t * 0.19) * 0.05, w: 1 },
      alert: 0, fidget: null, blow: null, struggle: null, cover: null, draw: null
    });
    G.Models.posePlayer(k.h, k.pose);
  }

  const Sudden = {
    // al entrar al refugio (en una carrera): el comercio de después, si toca, con su bronca la primera vez
    enter(sc, player) {
      this.clear();
      scene = sc;
      const SD = G.Run && G.Run.active && G.Run.sudden;
      if (!SD) return;
      if (SD.phase === 'fight') SD.phase = 'armed';          // (saliste a mitad de la pelea: vuelve a empezar)
      if (SD.gone && SD.keeper) {
        K = keeperModel(SD.keeper);
        if (K && !SD.scolded) {
          const L = SCOLD[SD.keeper] || SCOLD.vera, n = (G.Player.nick && G.Player.nick(player.charId)) || player.charName || '';
          setTimeout(() => {
            if (!K) return;
            say(speaker(K.id, K.x, K.z), L.map((t) => t.split('{n}').join(n)), 3900);
            G.Run.suddenScolded();
          }, 2200);
        }
      }
    },
    // al tocar cualquier cosa del refugio: ¿empieza ahora? (true: no se usa lo que tocaste)
    intercept(p, player) {
      if (S && !S.won) { msg('¡Ahora no!', 'warn'); return true; }
      const SD = G.Run && G.Run.active && G.Run.inRefuge && G.Run.sudden;
      if (!SD || SD.phase !== 'armed' || !G.Refugio || !G.Refugio.inside || player.dead) return false;
      if (!shopStation()) return false;
      start(player);
      return true;
    },
    update(dt, player) {
      if (K) poseKeeper(dt);
      if (!S || S.won) return;
      S.t += dt;
      const w = shopWall();
      // golpes tras la pared, cada vez más fuertes, y revienta
      if (S.hits === 0 && S.t > 1.3) { S.hits = 1; play('bang', { x: w.x - 0.3, z: w.z, lv: 0, vol: 1.9 }); play('tScream', { x: w.x - 1.2, z: w.z, lv: 0, z0: S.z, vol: 1.2 }); if (G.Camera.shake) G.Camera.shake(0.22); }
      if (S.hits === 1 && S.t > 2.5) { S.hits = 2; play('bang', { x: w.x - 0.3, z: w.z, lv: 0, vol: 2.2 }); if (G.Camera.shake) G.Camera.shake(0.3); }
      if (!S.broke && S.t > 3.4) { S.broke = true; burst(player); }
      if (S.broke && !S.z.alive && !S.won && !player.dead) won(player);
    },
    get active() { return !!(S && !S.won); },
    get keeper() { return K ? K.id : null; },
    get dbg() { return { fight: S ? { t: +S.t.toFixed(1), broke: S.broke, won: S.won, hp: S.z ? Math.round(S.z.hp) : null, hard: S.hard } : null, keeper: K ? K.id : null, sd: G.Run && G.Run.sudden }; },
    // al salir del refugio o al rehacer el mundo
    clear() {
      if (S && S.z && G.Population.list.indexOf(S.z) < 0) S.z.dispose();
      if (S && !S.won && G.Combat) G.Combat.peaceful = true;
      S = null;
      if (K) { if (K.h.root.parent) K.h.root.parent.remove(K.h.root); K = null; }
    }
  };
  G.Sudden = Sudden;
})(window.Game = window.Game || {});
