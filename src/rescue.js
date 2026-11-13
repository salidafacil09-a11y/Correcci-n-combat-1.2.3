(function (G) {
  'use strict';

  // ================= Presos, liberación y chasqueadores encadenados (Red del Capitolio) =================
  // En los mapas con celdas (map.cells), las celdas tienen presos:
  //   · en el modo Liberación, tus compañeros (los personajes que no llevas: uno o los dos) y, en otras celdas,
  //     Supervivientes;
  //   · en el resto de modos, solo Supervivientes (liberarlos es opcional).
  // Te acercas a la puerta de una celda y la abres (unos segundos agachada: hace algo de ruido). Salen todos los
  // de esa celda a la vez, sin armas: pelean a puñetazos y cogen las armas de los Escorpiones que caen.
  //   · Los compañeros te siguen (agachados si tú vas agachada) y pelean contigo.
  //   · Los Supervivientes van a lo suyo: abren las otras celdas de los suyos, pelean contra los Escorpiones (o
  //     los infectados) cuando pueden, cogen armas, se apartan cuando les va mal y, cuando ya no queda nada que
  //     hacer, se despiden (sin fiarse de ti) y se van por la salida.
  // Los Escorpiones van a por los que se escapan (y si los ven, saben que algo pasa).
  // Chasqueadores encadenados (map.clickers): la alarma de los Escorpiones. Oyen como siempre; si te oyen cerca,
  // chillan y avisan a toda la sede. Se pueden soltar (de cerca, en su poste): van a por lo que oigan, también a
  // los Escorpiones (y los Escorpiones a por ellos). Una buena distracción... o un problema.

  const U = G.Util;
  const TAU = Math.PI * 2;
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const OPEN_T = 2.4;              // segundos para abrir una celda
  const COMP_LIFE = 130, SURV_LIFE = 80;

  // ---------- La Trece (Eira) ----------
  // En un asalto en la Red del Capitolio por la tarde, con poca probabilidad (y solo hasta que la encuentres una
  // vez), una de las celdas tiene a «la Trece»: la superviviente que acabó con todo el asentamiento de los
  // Escorpiones en el barrio de Oceanside. Tres Escorpiones patrullan delante de su celda sin parar y todos hablan de
  // ella. Si la sacas, te tumba de un golpe, te quita un arma (de fuego, si llevas) y se esfuma; desde entonces
  // Eira Trece se puede comprar en Extras
  const TRECE_P = 0.45;            // probabilidad (asalto, capitolio, tarde)
  const TRECE_DMG = 12;
  const CHAT_TRECE = [
    ['¿Esa es la Trece? ¿La de verdad?', 'La de verdad. No le mires a los ojos.'],
    ['Dicen que ella sola se cargó el asentamiento entero de Oceanside.', 'No lo dicen. Yo estuve después. No quedó nadie para contarlo.'],
    ['¿Por qué no la matamos y ya está?', 'Porque el jefe quiere saber a cuántos más ha matado.', 'Y porque nadie se atreve a entrar.'],
    ['Lleva tres días sin comer.', 'Y aun así ayer le partió la muñeca a Ruiz a través de la reja.'],
    ['¿Por qué la Trece?', 'Era la trece de su camión. Los otros doce ya no están.'],
    ['No te acerques tanto a esa reja.', 'Está encadenada.', 'Los de Oceanside también se creían seguros.'],
    ['¿Cuántos de los nuestros lleva?', 'Nadie lo sabe. Ni ella, creo.'],
    ['Me toca la guardia con la Trece otra vez.', 'Mira el lado bueno: si se escapa, mueres rápido.'],
    ['¿La has oído hablar alguna vez?', 'Una. Dijo mi nombre. Nunca se lo había dicho.'],
    ['Oceanside era un barrio tranquilo, ¿sabes? Los nuestros vivían bien allí.', 'Hasta que llegó ella.']
  ];
  const ESCAPE_LN = ['¡La Trece! ¡La Trece está fuera!', '¡Se escapa la Trece!', '¡Que no salga! ¡Es la Trece!', '¡Disparad! ¡Es ella!'];

  // Si llevas a Eira (la Trece), tus compañeros no la conocen: al verla se preguntan si es de los Escorpiones, ella
  // contesta y ellos aceptan su ayuda (sin saber quién es). En Liberación y en Resistencia
  const STR_Q = ['¿Tú quién eres? ¿Eres de los Escorpiones?', '¿Eres de ellos? Dime que no eres de ellos.', 'No te conozco... ¿vienes con los Escorpiones?', 'Espera. ¿Quién eres? ¿Trabajas para ellos?'];
  const STR_A = ['No. Soy de los Supervivientes. A mí también me encerraron.', 'No soy de ellos. Cállate y déjame abrir.', 'Si lo fuera, no estaría forzando esta cadena. Quieta.', 'Superviviente. Ahora, silencio.'];
  const STR_A_R = ['No. Soy de los Supervivientes. Los Escorpiones me quitaron todo.', 'No soy de ellos. Si lo fuera, ya estarías muerto.', 'Superviviente. Los Escorpiones no son mis amigos.'];
  // y los Supervivientes (su facción): para ellos la Trece era un mito, un cuento que se contaba en los refugios
  const MYTH_A = ['Real. Y con prisa. Abro y os vais.', 'Los cuentos no abren cadenas. Callad.', 'No soy un mito. Soy lo que queda de Oceanside.', 'Menos hablar. Corred cuando abra.'];
  const STR_OK = ['Vale... te creo. De momento.', 'No sé quién eres, pero gracias. Te sigo.', 'Está bien. Pero no bajo la guardia.', 'Te debo una. Aunque no sepa quién eres.'];

  const SURV_NAMES = [['Marcos', 0], ['Elena', 1], ['Julián', 0], ['Inés', 1], ['Ramón', 0], ['Lidia', 1], ['Óscar', 0], ['Nuria', 1], ['Fermín', 0], ['Carla', 1], ['Teo', 0], ['Maite', 1], ['Bruno', 0], ['Sara', 1]];
  // cómo los llaman los Escorpiones (no saben sus nombres)
  const DESC = { vera: 'la del rifle', tomas: 'el grandote', diarco: 'la de las vendas en los brazos', eira: 'la Trece', booster: 'el viejo del brazo roto', paula: 'la vieja de la bandana' };

  const LN = {
    // dentro de la celda, al verte llegar
    cagedComp: ['¡Eh! ¡Aquí! ¡Sácame de aquí!', 'Sabía que vendrías...', '¡{p}! ¡Aquí, {p}!', 'Despacio. Hay guardias por todas partes.', '¡Por fin! La cadena tiene un candado.'],
    cagedSurv: ['¿Tú quién eres? ¿Eres de ellos?', 'Si vas a abrir, hazlo ya.', 'No nos mires así. Ábrenos.', '¿Vienes a sacarnos... o a qué?'],
    cagedCompStranger: STR_Q,
    // al abrir
    freeCompStranger: STR_OK,
    freeComp: ['Gracias. Ahora salgamos de aquí.', 'Gracias, {p}. Te debo la vida.', 'Dame un minuto... ya. Vamos.', 'Te debo una. Una grande.', 'Sin armas no voy a durar mucho. Busquemos algo.'],
    freeSurv: ['No te debemos nada. Pero gracias.', 'Esto no te hace de los nuestros.', 'Vamos a por los demás. Tú haz lo que quieras.', 'Ni una palabra a ellos. Ni a nadie.'],
    // (si llevas a Eira: los Supervivientes no se creen que exista)
    cagedSurvTrece: ['¿Eres... la Trece? ¿Entonces eres real?', 'No puede ser. La Trece... creíamos que era un cuento.', 'Mi hermano decía que la Trece existía. Nadie le creía.',
      'La de Oceanside... ¿de verdad eres tú?', 'Dicen que llegas de noche y no queda ni un escorpión. ¿Es verdad?', 'Si tú estás aquí, ellos están perdidos.'],
    freeSurvTrece: ['La Trece nos ha sacado. Nadie se lo va a creer.', 'Gracias... Trece. Se lo contaré a todos.', 'Lo de Oceanside era verdad, ¿no?', 'Vamos a por los demás. Que te vean.'],
    distrustTrece: ['Perdona... es que no me lo creo.', 'No te molesto. Solo... gracias.', 'En el refugio los críos juegan a ser la Trece. Si te vieran...'],
    leaveTrece: ['Nos vamos. Contaremos esto en el refugio.', 'Que sigas siendo real, Trece.', 'Ahora sí me lo creo. Gracias.'],
    // con Grimes: los Supervivientes ven a su antiguo líder
    cagedSurvGrimes: ['¿Grimes? ¿Eres tú? ¡Estás vivo!', 'Jefe... sabíamos que no te habían quebrado.', '¡Grimes! ¡Sácanos, como antes!', 'Grimes... decían que te habían matado en esa celda.'],
    freeSurvGrimes: ['Como en los viejos tiempos, Grimes.', 'Te seguimos. Siempre te seguimos.', 'Volviste a por nosotros. Lo sabía.'],
    distrustGrimes: ['Estás distinto, jefe...', '¿Qué te hicieron ahí dentro, Grimes?', 'Esa mirada... no es la tuya de antes.'],
    leaveGrimes: ['Nos vemos en el escondite, Grimes.', 'Vuelve con nosotros, jefe. Te necesitamos.'],
    // Grimes enjaulado (la caída de la Trece): la conoce
    cagedCompG: ['Eira. Sabía que vendrías.', 'Eira. Abre. Tenemos cuentas que cobrar.', 'Tardaste. Abre la reja.'],
    freeCompG: ['Dame un arma. Lo demás, déjamelo a mí.', 'Vamos. Esta noche cobran ellos.', 'Bien, Eira. Ahora, a cazar.'],
    fightCompG: ['Despacio. Que lo sienta.', 'Quieto. Así.', 'Uno.'],
    // los Supervivientes, al ver salir a Grimes
    seeGrimes: ['¿Grimes? ¡Es Grimes! ¡Está vivo!', 'Grimes... creíamos que te habían matado.', '¡El jefe! ¡Grimes está aquí!'],
    // con un arma en la mano
    armed: ['Esto me sirve.', 'Ahora sí.', 'Ya tengo con qué.', 'Que vengan ahora.'],
    // abren a los suyos
    freeOther: ['¡Aguanta, que te saco!', '¡Arriba, nos vamos!', 'Sal. Rápido y sin ruido.'],
    // pelean
    fightSurv: ['¡Por Andrés!', '¡Esto es por todos los que matasteis!', '¡A ver ahora sin las rejas!', '¡Cerdos!'],
    fightComp: ['¡Cuidado, a tu izquierda!', '¡Te cubro!', '¡Ahí hay otro!'],
    hurt: ['¡Agh!', '¡Me han dado!', '¡No aguanto mucho así!'],
    flee: ['¡Así no podemos! ¡Atrás!', '¡Me retiro!'],
    // desconfiados contigo
    distrust: ['No te acerques tanto.', '¿Por qué nos ayudas? ¿Qué quieres a cambio?', 'Te estoy vigilando.', 'Los de fuera no hacen nada gratis.'],
    // la Trece: en la celda, al verte; al salir (te pega y te quita un arma); al irse
    cagedTrece: ['...', 'Abre. No hables.', '¿Vas a abrir o a mirar?', 'Tú no eres de ellos. Eso ya es algo.', 'No me mires así. Abre la reja.'],
    treceHit: ['Gracias. Me la quedo.', 'No te lo tomes como algo personal.', 'Lo necesito más que tú.', 'Esto es mío ahora.'],
    treceNone: ['Ni un arma... ¿cómo sigues viva?', 'Nada. Qué pena.'],
    // se van
    leave: ['Nos vamos. No nos sigas.', 'Gracias... supongo. Cada uno por su lado.', 'Esto no lo olvidamos. Ni lo tuyo ni lo de ellos.', 'Si vuelves a vernos, no te acerques.'],
    // los compañeros, al salir por la salida
    out: ['Ya está. Fuera.', 'Vámonos antes de que vuelvan.']
  };
  // charlas de los Escorpiones del capitolio (de dos en dos, mientras no pasa nada)
  const CHAT = [
    ['Hoy toca media ración para los de la celda B.', '¿Otra vez? Así no van a poder ni cavar.'],
    ['¿Quién tiene la guardia de la perrera?', 'Yo no. Esos bichos me ponen los pelos de punta.'],
    ['El generador vuelve a fallar.', 'Que lo arreglen los presos. Para eso están.'],
    ['Anoche uno intentó escaparse por la cámara.', '¿Y?', 'Ya no lo intentará más.'],
    ['Mañana llega otro camión con gente.', '¿Más bocas? Apenas hay agua para los que tenemos.'],
    ['No me gusta esto. Antes no hacíamos estas cosas.', 'Antes nos moríamos de hambre. Calla y vigila.'],
    ['¿Has visto a los Supervivientes por el norte?', 'Rondan. Desde lo de Andrés no se acercan... todavía.'],
    ['Los del huerto se quejan de las manos.', 'Que se quejen. Mientras trabajen...'],
    ['Si sueltan a un chasqueador, aquí no queda nadie vivo.', 'Por eso nadie toca las cadenas. Nadie.'],
    ['¿Cuántos tenemos ya?', 'Treinta y algo. Sin contar los que no aguantaron.']
  ];
  // alrededor del fuego: cómo se vive ahora
  const CHAT_DAY = [
    ['¿Te acuerdas del café de verdad?', 'Ni me lo nombres. Esto sabe a tierra.', 'Es tierra, casi.'],
    ['Ayer encontré una lata de melocotones.', '¿Y la compartiste?', 'Te estoy hablando de ella, ¿no?'],
    ['Mi hermana vivía cerca de aquí. Antes.', '¿Y ahora?', 'Ahora no lo sé. Y prefiero no saberlo.'],
    ['Esta noche va a helar.', 'Pues echa más madera. Que sobra mueble en este edificio.'],
    ['Echo de menos dormir sin la escopeta al lado.', 'Yo echo de menos dormir.'],
    ['¿Cuánto llevamos así? ¿Cuatro años?', 'Cinco en primavera. Dejé de contar.'],
    ['El agua del pozo sabe rara.', 'Hiérvela. Y no preguntes qué hay en el fondo.'],
    ['Hoy he soñado con la playa. Sin nadie.', 'Sin nadie vivo, querrás decir.'],
    ['Me duele la muela desde hace una semana.', 'Te la saco yo con los alicates.', 'Prefiero el dolor.'],
    ['Si mañana se acaba todo esto, ¿qué harías?', 'Dormir tres días seguidos. Y luego comer.'],
    ['Las botas ya no aguantan otro invierno.', 'Quítaselas al próximo que no se levante.'],
    ['¿Oyes la radio todavía?', 'Solo ruido. Hace meses que nadie habla.'],
    ['Mi chico cumple diez años la semana que viene.', 'Búscale algo en el almacén. Algo que no dispare.'],
    ['Antes me quejaba del trabajo.', 'Ahora el trabajo es no morirte.']
  ];
  // y si en el modo Liberación están tus compañeros, hablan de ellos
  const CHAT_NEW = [
    ['¿Y los dos nuevos?', 'Rebeldes. {a} le escupió al jefe en la cara.'],
    ['{A} no ha probado bocado desde que llegó.', 'Que no coma. Ya se ablandará.'],
    ['Los nuevos no paran de mirar las cerraduras.', 'Ponles otra cadena. Y que nadie les hable.'],
    ['{A} preguntó por alguien. Que vendrán a por ellos, dice.', 'Que vengan. Aquí los esperamos.'],
    ['Esos dos dan más problemas que todos los demás juntos.', 'Por eso están solos. Que se cansen.']
  ];
  const CHAT_ONE = [
    ['¿Y el nuevo? ¿{A}?', 'Rebelde. Ayer le partió la nariz a uno de los nuestros.'],
    ['{A} no ha probado bocado desde que llegó.', 'Que no coma. Ya se ablandará.'],
    ['{A} dice que vendrán a por ella... o a por él, qué más da.', 'Que vengan. Aquí los esperamos.']
  ];

  // ---------- El preso (luego, aliado) ----------
  let Freed = null;
  let scene = null, player = null;
  function defineFreed() {
    const Ally = G.Humans.Ally, Z = G.Zombie;
    Freed = class extends Ally {
      constructor(sc, x, z, o) {
        super(sc, x, z, o.charId || 'tomas', o.life, o.surv ? { look: o.look, name: o.name } : null);
        this.freed = true; this.surv = !!o.surv; this.comp = !o.surv; this.caged = true; this.cell = o.cell || null;
        this.wl = ['manos']; this.mags = {}; this.reserve = {}; this.agr = false;
        this.setW('manos');
        this.home = { x, z };
        this.scanT = 0; this.seenT = 0; this.talk = {}; this.calmT = 0; this.pickT = 0;
        this.state = 'fight'; this.npcK = 0; this.sit = this.surv && Math.random() < 0.6;
      }
      get engaged() { return !this.caged; }
      sayL(k, prio, gap) {
        const now = G.Humans.time;
        if (now - (this.talk[k] || -99) < (gap || 10)) return;
        this.talk[k] = now;
        // ({p}: como llaman a quien llevas; a Di' Arco, «Arco»)
        const P = G.Humans.player, nm = P && G.Player.nick ? G.Player.nick(P.charId) : '';
        if (this.surv && Rescue.strangers() && LN[k + 'Trece']) k = k + 'Trece';          // (con Eira: la Trece era un mito para ellos)
        else if (this.surv && P && P.charId === 'grimes' && LN[k + 'Grimes']) k = k + 'Grimes';          // (con Grimes: su antiguo líder)
        if (this.grimes && LN[k + 'G']) k = k + 'G';          // (Grimes enjaulado, con la Trece)
        let line = pick(LN[k]);
        if (line.indexOf('{p}') >= 0) line = nm ? line.split('{p}').join(nm) : pick(LN[k].filter((l) => l.indexOf('{p}') < 0));
        G.Humans.Voice.say(this, line, { prio: prio || 2 });
      }
      // los infectados le quitan vida (como al compañero de la resistencia); los Escorpiones, con sus tiros y golpes
      hurtBy(d, by) {
        if (!this.alive || this.life <= 0 || this.trece || this.grimes) return;          // (a la Trece no la tumba nadie; a Grimes, tampoco)
        this.life = Math.max(0, this.life - d);
        this.hurtT = 0.35;
        if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: 'hurt' });
        if (Math.random() < 0.3) this.sayL('hurt', 2, 6);
        if (this.life <= 0) { this.act = null; this.hp = 0; this.killedBy = by || 'zombie'; this.die(Math.random() < 0.5 ? 1 : -1); if (S) S.onDown(this); }
      }
      takeHit(dmg, knock, dx, dz, behind, side, kind, part, src) {
        if (!src || !src.foe || this.caged || !this.alive || this.trece || this.grimes) return null;      // (tus golpes y balas no les hacen nada)
        this.hurtBy(dmg * (part === 'head' ? 2 : 1) * (kind === 'shot' ? 11 : 9), 'squad');
        return this.alive ? 'hit' : 'kill';
      }
      // a quién pegarle: Escorpiones (no los que se rinden) e infectados sueltos, a la vista
      scan(all) {
        let best = null, bd = this.surv ? 26 : 22;
        for (const q of all) {
          if (!q.alive || q.gone || q.ally || q.freed || (q.lv || 0) !== (this.lv || 0)) continue;
          if (q.human ? (q.state === 'beg' || q.state === 'hostage' || q.spared) : (q.chain || q.hongo)) continue;
          const d = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z);
          if (d < bd && G.World.hasLOS(this.pos.x, this.pos.z, q.pos.x, q.pos.z, this.lv)) { bd = d; best = q; }
        }
        return best;
      }
      arm(id, ammo) {
        const w = G.Weapons.get(id);
        if (!w) return;
        if (G.Weapons.isGun(w)) { this.wl = [id, 'manos']; this.mags[id] = Math.min(w.mag, Math.max(2, Math.round(w.mag * 0.7))); this.reserve[id] = ammo; }
        else this.wl = [id];
        this.setW(id);
        if (!this.trece) this.sayL('armed', 2, 20);
      }
      update(dt, player, all) {
        if (this.gone) return;
        this.time += dt;
        if (!this.alive || this.rag) { Z.prototype.step.call(this, dt, this.proxy, all, null); return; }
        if (this.atkCD > 0) this.atkCD -= dt;
        if (this.hurtT > 0) this.hurtT -= dt;
        if (!this.caged && this.climbStep(dt)) return;            // (saltando una ventana: lo termina)
        this.goal = null; this.moveSp = 0; this.faceYaw = null; this.wantCrouch = false; this.aiming = false;
        const dP = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        if (this.caged) {
          // en la celda: los compañeros, de pie junto a la reja; los supervivientes, de rodillas. Te llaman al verte
          if (dP < 7 && !player.dead && G.World.hasLOS(this.pos.x, this.pos.z, player.pos.x, player.pos.z, this.lv)) { this.faceYaw = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z); if (dP < 5) {
            if (this.comp && Rescue.strangers() && !this.grimes) { if (this.cell && !this.cell.asked) { this.cell.asked = true; Rescue.meet(this, false); } }          // (no la conocen: preguntan una sola vez)
            else {
              this.sayL(this.trece ? 'cagedTrece' : (this.comp ? 'cagedComp' : 'cagedSurv'), 2, this.trece ? 22 : 14);
              // (con Eira: la primera vez que la ven en esa celda, ella les contesta)
              if (this.surv && Rescue.strangers() && this.cell && !this.cell.myth) { this.cell.myth = true; Rescue.mythAnswer(); }
            }
          } }
          this.finish(dt, 0);
          return;
        }
        // recién abierta la celda: sale por la puerta en línea recta (primero a su lado de dentro y luego afuera), sin
        // depender de las rutas (entre las rejas a veces no encontraban camino y se quedaban dentro para siempre); si
        // algo lo frena, a los pocos segundos aparece ya en ese punto
        if (this.exitCell) {
          const E = this.exitCell, P0 = E.pts[0];
          E.t += dt;
          const dx = P0.x - this.pos.x, dz = P0.z - this.pos.z, dd = Math.hypot(dx, dz);
          if (dd < 0.3 || E.t > 2.6) {
            if (dd >= 0.3) { this.pos.x = P0.x; this.pos.z = P0.z; }
            E.pts.shift(); E.t = 0;
            if (!E.pts.length) this.exitCell = null;
          } else {
            const sp = 2.2 * dt, x0 = this.pos.x, z0 = this.pos.z;
            G.World.move(this.pos, dx / dd * sp, dz / dd * sp, 0.28, this.lv || 0, 0);
            const mv = Math.hypot(this.pos.x - x0, this.pos.z - z0);
            this.facing = U.turnToward(this.facing, Math.atan2(dx, dz), 8 * dt);
            this.speedNow += (mv / Math.max(dt, 1e-4) - this.speedNow) * Math.min(1, dt * 10);
          }
          this.state = 'fight'; this.updateGun(dt); this.anim(dt); this.apply(dt);
          return;
        }
        // la Trece: a por ti, un golpe, tu arma y se esfuma
        if (this.trece) { this.treceUpdate(dt, player, dP); this.finish(dt, 0); return; }
        // a quién
        this.scanT -= dt;
        if (this.scanT <= 0 || (this.tgt && (!this.tgt.alive || this.tgt.gone))) { this.scanT = 0.3; const b = this.scan(all); if (b && b !== this.tgt) this.reactT = rr(0.4, 0.9); this.tgt = b; }
        const z = this.tgt, d = z ? Math.hypot(z.pos.x - this.pos.x, z.pos.z - this.pos.z) : 99;
        if (z) this.seenT = 0; else this.seenT += dt;
        this.reactT -= dt; this.fireT -= dt;
        if (this.act && this.act.kind === 'pick') this.doPick(dt);
        else if (this.act && this.act.kind === 'unlock') this.doUnlock(dt);
        else if (this.act) this.punchUpdate(dt);
        else if (this.leaving) this.leave(dt, player, z, d);
        else this.think(dt, player, z, d, dP);
        this.finish(dt, d, z);
      }
      think(dt, player, z, d, dP) {
        const gun = this.gunW && (this.mag > 0 || (this.reserve[this.w.id] || 0) > 0);
        if (this.gunW && !gun) this.setW(this.wl[this.wl.length - 1]);
        // muy herido (el superviviente): se aparta del peligro hacia la salida
        if (this.surv && z && this.life < this.lifeMax * 0.3 && d < 14) { this.sayL('flee', 2, 15); this.leaving = true; return; }
        // un arma a mano (de un escorpión caído) y nadie encima: a cogerla
        if (!gun && S && (!z || d > 8)) {
          const dr = S.nearDrop(this, this.surv ? 18 : 14);
          if (dr) {
            const dd = Math.hypot(dr.x - this.pos.x, dr.z - this.pos.z);
            if (dd < 0.9) { this.act = { kind: 'pick', t: 0, dur: 0.9, dr }; dr.claim = this; return; }
            this.goal = { x: dr.x, z: dr.z, lv: 0 }; this.moveSp = 3.8; dr.claim = this;
            return;
          }
        }
        if (z) {
          const yaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
          if (this.gunW) {
            this.faceYaw = yaw; this.aiming = !this.g.reload;
            if (this.mag <= 0 && !this.g.reload) this.startReload();
            const aimed = Math.abs(U.angleDiff(yaw, this.facing)) < 0.18;
            if (d < 1.6) { const ux = (this.pos.x - z.pos.x) / (d || 1), uz = (this.pos.z - z.pos.z) / (d || 1); this.goal = { x: this.pos.x + ux * 1.5, z: this.pos.z + uz * 1.5, lv: 0 }; this.moveSp = 2.4; }
            if (aimed && this.reactT <= 0 && this.fireT <= 0 && !this.g.reload && this.mag > 0) this.shoot(z, d);
          } else {
            // a puñetazos (o con lo que cogieron): se lanzan si está cerca o si van varios; si no, esperan cubiertos
            const brave = this.surv ? (S && S.freeCount() >= 2) : true;
            const go = d < (this.comp ? 7 : 9) || (brave && d < 15);
            if (go) {
              this.faceYaw = yaw;
              if (d < (this.w.id === 'manos' ? 1.25 : 1.9) && this.atkCD <= 0) this.startPunch(z);
              else { this.goal = { x: z.pos.x, z: z.pos.z, lv: z.lv || 0 }; this.moveSp = 4.3; }
            } else if (this.comp) this.followP(player, dP, true);
            else { const ux = (this.pos.x - z.pos.x) / (d || 1), uz = (this.pos.z - z.pos.z) / (d || 1); this.goal = { x: this.pos.x + ux * 2.5, z: this.pos.z + uz * 2.5, lv: 0 }; this.moveSp = 2.6; }   // (sin armas y lejos: se aparta)
          }
          if (Math.random() < dt * 0.15) this.sayL(this.surv ? 'fightSurv' : 'fightComp', 2, 9);
          return;
        }
        // nadie a la vista
        if (this.gunW && this.mag < this.w.mag && !this.g.reload && (this.reserve[this.w.id] || 0) > 0) this.startReload();
        if (this.comp) { this.followP(player, dP, false); return; }
        // el superviviente: a abrir las celdas de los suyos; si no queda nada, se despide y se va
        const cell = S && S.cellFor(this);
        if (cell) {
          const dd = Math.hypot(cell.door.x + cell.door.fx * 0.8 - this.pos.x, cell.door.z + cell.door.fz * 0.8 - this.pos.z);
          if (dd < 0.7) { this.act = { kind: 'unlock', t: 0, dur: OPEN_T * 1.2, cell }; cell.busy = this; this.sayL('freeOther', 2, 6); return; }
          this.goal = { x: cell.door.x + cell.door.fx * 0.8, z: cell.door.z + cell.door.fz * 0.8, lv: 0 }; this.moveSp = 3.6; cell.busy = this;
          return;
        }
        // (desconfiados: no se te acercan)
        if (dP < 1.8 && !player.dead) { const ux = (this.pos.x - player.pos.x) / (dP || 1), uz = (this.pos.z - player.pos.z) / (dP || 1); this.goal = { x: this.pos.x + ux * 1.6, z: this.pos.z + uz * 1.6, lv: 0 }; this.moveSp = 1.8; this.faceYaw = Math.atan2(-ux, -uz); this.sayL('distrust', 2, 18); return; }
        this.calmT += dt;
        if (this.calmT > 10 && this.seenT > 8) { this.leaving = true; if (dP < 16) this.sayL('leave', 3, 99); }
      }
      // los compañeros: contigo (a 2 o 3 m, detrás); agachados si tú vas agachada; corren si te alejas
      followP(player, dP, cover) {
        if (player.dead) return;
        const want = cover ? 1.6 : 2.6;
        this.wantCrouch = player.stance === 'crouch' || player.stance === 'prone';
        if (dP > want) {
          const back = player.facing + Math.PI + (this.slot || 0) * 0.7;
          const gx = player.pos.x + Math.sin(back) * want * 0.8, gz = player.pos.z + Math.cos(back) * want * 0.8;
          this.goal = { x: gx, z: gz, lv: player.lv || 0 };
          this.moveSp = dP > 7 ? 4.4 : (this.wantCrouch ? 1.5 : 2.4);
        } else this.faceYaw = player.facing;
      }
      leave(dt, player, z, d) {
        const ex = S ? S.exit : { x: this.home.x, z: this.home.z };
        const dd = Math.hypot(ex.x - this.pos.x, ex.z - this.pos.z);
        // de camino, si les sale un escorpión al paso y tienen arma, disparan
        if (z && this.gunW && this.mag > 0 && d < 12) { const yaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z); this.faceYaw = yaw; this.aiming = true; if (Math.abs(U.angleDiff(yaw, this.facing)) < 0.2 && this.fireT <= 0 && this.reactT <= 0) this.shoot(z, d); return; }
        if (dd < 1.2) { this.vanish(); return; }
        this.goal = { x: ex.x, z: ex.z, lv: 0 }; this.moveSp = this.life < this.lifeMax * 0.3 ? 4.4 : 3.2;
      }
      vanish() {
        this.gone = true;
        if (this.model && this.model.root) this.model.root.visible = false;
        if (this.trece) { Rescue.treceGone(this); return; }
        if (S) S.onGone(this);
      }
      doPick(dt) {
        const a = this.act;
        a.t += dt / a.dur;
        if (a.t >= 1) {
          this.act = null;
          const dr = a.dr;
          if (dr && !dr.taken) { dr.taken = true; this.arm(dr.w, dr.ammo); if (dr.body && dr.body.model) G.Models.setWeapon(dr.body.model, 'manos'); }
        }
      }
      doUnlock(dt) {
        const a = this.act;
        a.t += dt / a.dur;
        this.wantCrouch = true;
        if (a.cell) this.faceYaw = Math.atan2(a.cell.door.x - this.pos.x, a.cell.door.z - this.pos.z);
        if (Math.random() < dt * 1.2) G.World.emit(this.pos.x, this.pos.z, 5, 0);
        if (a.t >= 1) { this.act = null; if (S && a.cell && !a.cell.open) S.openCell(a.cell, this); }
      }
      shoot(z, d) {
        const w = this.w, g = this.g;
        this.mag--; g.recoil = 1;
        if (this.gkind === 'shotgun' || this.gkind === 'rifle') g.cycle = 0;
        this.fireT = w.fire * 2 + rr(0.5, 1.1) + (w.gun === 'rifle' ? 1.0 : 0);
        const mz = this.muzzle(new THREE.Vector3()).clone();
        const tgt = new THREE.Vector3(z.pos.x, z.y + 1.3, z.pos.z);
        const sfx = { pistol: 'pistol', revolver: 'pistol', rifle: 'rifle', shotgun: 'shotgun', smg: 'smg' }[w.gun] || 'pistol';
        if (G.Audio) G.Audio.play(sfx, { x: this.pos.x, z: this.pos.z, lv: this.lv });
        G.Humans.flash(mz, 1);
        G.World.emit(this.pos.x, this.pos.z, w.noise || 25, this.lv);
        const hitP = (w.gun === 'rifle' ? 0.55 : 0.45) * U.clamp(1.15 - d / 22, 0.3, 1);
        if (Math.random() < hitP && G.World.coverHit(mz.x, mz.z, mz.y, tgt.x, tgt.z, tgt.y, this.lv, false) < 0) {
          G.Humans.tracer(mz, tgt);
          const head = Math.random() < 0.1;
          const dmg = rr(w.dmg[0], w.dmg[1]) * (head ? 2.5 : 1) * (w.pellets ? 0.5 : 0.7);
          const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z;
          const r = z.takeHit(dmg, (w.knock || 0.1) + 0.2, dx, dz, false, Math.random() < 0.5 ? 1 : -1, 'shot', head ? 'head' : 'body', { w: w.gun, dist: d, n: 1, by: this });
          if (G.Guns && G.Guns.burst) G.Guns.burst(tgt, new THREE.Vector3(dx, 0, dz).normalize(), true, 5);
          if (r === 'kill') z.killedBy = 'ally';
        } else this.missFx(mz, tgt, G.Humans.player || this.proxy);
      }
      startPunch(z) {
        const fists = this.w.id === 'manos';
        const kinds = fists ? ['punch1', 'punch2', 'punch3'] : (this.w.hands === 2 ? ['swing2', 'overhead', 'swing2b'] : ['swing1', 'swing1b']);
        this.atkN = ((this.atkN || 0) + 1) % kinds.length;
        const k = kinds[this.atkN];
        this.act = { kind: k, t: 0, dur: fists ? (k === 'punch3' ? 0.62 : 0.5) : 0.8, impact: fists ? (k === 'punch3' ? 0.52 : 0.42) : 0.5, hit: false, tgt: z };
        if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: this.female, k: 'atk', delay: 0.15 });
      }
      punchUpdate(dt) {
        const a = this.act, z = a.tgt;
        a.t += dt / a.dur;
        if (z && z.alive && a.t < a.impact) this.faceYaw = Math.atan2(z.pos.x - this.pos.x, z.pos.z - this.pos.z);
        if (!a.hit && a.t >= a.impact) {
          a.hit = true;
          if (z && z.alive) {
            const dx = z.pos.x - this.pos.x, dz = z.pos.z - this.pos.z, dd = Math.hypot(dx, dz), fists = this.w.id === 'manos';
            if (dd < (fists ? 1.45 : 2.0)) {
              const dmg = fists ? rr(0.35, 0.6) : (this.w.cat === 'sblade' ? rr(0.6, 0.9) : rr(0.9, 1.4));
              const r = z.takeHit(dmg, fists ? 0.35 : 0.6, dx, dz, false, 1, fists ? 'side' : (this.w.cat === 'sblade' ? 'stab' : 'heavy'), 'body', { by: this });
              if (r === 'kill') z.killedBy = 'ally';
              if (G.Audio) G.Audio.play(fists ? 'hitPunch' : 'hitBlunt', { x: z.pos.x, z: z.pos.z, lv: z.lv || 0, vol: 0.8 });
            }
          }
        }
        if (a.t >= 1) { this.act = null; this.atkCD = rr(0.25, 0.6); }
      }
      // la Trece fuera de la celda: te mira, se te echa encima, te tumba de un golpe, se queda con un arma tuya y se
      // va corriendo; desaparece en cuanto la pierdes de vista (o al llegar al borde del mapa)
      treceUpdate(dt, player, dP) {
        const T = this.trece;
        T.t += dt;
        const yawP = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        if (T.ph === 'out') { T.ph = 'look'; T.t = 0; }
        if (T.ph === 'look') { this.faceYaw = yawP; if (T.t > 0.45) { T.ph = 'go'; T.t = 0; } return; }
        if (T.ph === 'go') {
          if (player.dead || T.t > 6 || dP > 16 || (player.lv || 0) !== (this.lv || 0)) { this.treceRun(player); return; }
          this.faceYaw = yawP;
          if (dP < 1.25) {
            this.act = { kind: 'punch3', t: 0, dur: 0.62, impact: 0.5, hit: false, tgt: null };
            T.ph = 'hit'; T.t = 0;
            if (G.Audio) G.Audio.play('pGrunt', { x: this.pos.x, z: this.pos.z, lv: this.lv, female: true, k: 'atk', delay: 0.1 });
            return;
          }
          this.goal = { x: player.pos.x, z: player.pos.z, lv: player.lv || 0 }; this.moveSp = 5.0;
          return;
        }
        if (T.ph === 'hit') {
          const a = this.act;
          if (a) {
            a.t += dt / a.dur;
            if (a.t < a.impact) this.faceYaw = yawP;
            if (!a.hit && a.t >= a.impact) { a.hit = true; if (dP < 1.9 && !player.dead) Rescue.treceHit(this, player); }
            if (a.t >= 1) this.act = null;
          }
          if (!this.act) { T.ph = 'grab'; T.t = 0; }
          return;
        }
        if (T.ph === 'grab') {
          this.faceYaw = yawP; this.wantCrouch = T.t < 0.35;
          if (T.t > 0.6) {
            if (T.stole) this.arm(T.stole.id, T.stole.ammo); else if (!T.said) this.sayL('treceNone', 3, 99);
            this.treceRun(player);
          }
          return;
        }
        if (T.ph === 'run') {
          const E = T.exit, dE = Math.hypot(E.x - this.pos.x, E.z - this.pos.z);
          const seen = dP < 34 && G.World.hasLOS(player.pos.x, player.pos.z, this.pos.x, this.pos.z, player.lv || 0);
          T.hid = seen ? 0 : T.hid + dt;
          // (se esfuma: llegó al borde, la perdiste de vista un momento ya lejos, o lleva demasiado rato)
          if (dE < 1.5 || (T.hid > 1.2 && dP > 14) || dP > 40 || T.t > 26) { this.vanish(); return; }
          this.goal = { x: E.x, z: E.z, lv: 0 }; this.moveSp = 6.0;
          if (!T.shout && T.t > 0.8) { T.shout = true; Rescue.treceAlarm(this); }
        }
      }
      treceRun(player) {
        const T = this.trece;
        T.ph = 'run'; T.t = 0; T.hid = 0;
        // hacia el borde del mapa más lejos de ti
        const m = G.Maps && G.Maps.get(G.World.layout), b = (m && m.play && m.play[0]) || [G.World.ARENA_MIN, G.World.ARENA_MIN, G.World.ARENA_MAX, G.World.ARENA_MAX];
        const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2;
        const cand = [[b[0] + 1, b[1] + 1], [b[2] - 1, b[1] + 1], [b[0] + 1, b[3] - 1], [b[2] - 1, b[3] - 1], [b[0] + 1, cz], [b[2] - 1, cz], [cx, b[1] + 1], [cx, b[3] - 1]];
        let best = cand[0], bd = -1;
        for (const c of cand) {
          // (lejos de ti y sin pasar por encima de ti)
          const dp = Math.hypot(c[0] - player.pos.x, c[1] - player.pos.z), dm = Math.hypot(c[0] - this.pos.x, c[1] - this.pos.z);
          const sc = dp - dm * 0.35;
          if (sc > bd) { bd = sc; best = c; }
        }
        T.exit = { x: best[0], z: best[1] };
      }
      finish(dt, d, z) {
        this.state = this.act ? 'melee' : 'fight';
        if (this.caged && this.sit) this.wantCrouch = true;          // (en la celda, algunos agachados contra la pared)
        this.updateGun(dt);
        let moved = 0;
        if (this.goal && this.moveSp > 0) moved = this.moveTo(this.goal, this.moveSp, dt);
        else if (this.faceYaw != null) this.facing = U.turnToward(this.facing, this.faceYaw, 8 * dt);
        this.speedNow += (moved - this.speedNow) * Math.min(1, dt * 10);
        this.anim(dt);
        if (z) { const want = Math.atan2((this.y + 1.45) - (z.y + 1.2), Math.max(1, d)); this.aimPitch += (want - this.aimPitch) * Math.min(1, dt * 8); }
        this.apply(dt);
      }
    };
  }

  // ---------- Estado de la partida ----------
  let S = null;

  function doorMesh(cell) {
    // la puerta de reja abierta (girada sobre sus bisagras hacia fuera)
    const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x5a3e2e });
    const W = 1.1, H = 2.4;
    const add = (w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); };
    for (const y of [0.08, H / 2, H - 0.06]) add(W, 0.06, 0.05, W / 2, y, 0);
    for (let k = 0; k <= 7; k++) add(0.022, H - 0.1, 0.022, k * W / 7, H / 2, 0);
    const D = cell.door, gy = G.World.groundY(D.x, D.z, 0);
    // bisagra en un extremo del frente; se abre 100° hacia el pasillo
    if (D.fz) { g.position.set(D.x - W / 2, gy, D.z); g.rotation.y = -D.fz * 1.75; }
    else { g.position.set(D.x, gy, D.z - W / 2); g.rotation.y = -Math.PI / 2 + D.fx * 1.75; }
    return g;
  }

  const Rescue = {
    init(sc, pl) { scene = sc; player = pl; if (!Freed && G.Humans) defineFreed(); },
    get active() { return !!S; },
    get freed() { return S ? S.freed : []; },
    get comps() { return S ? S.comps : []; },
    get survs() { return S ? S.survs : []; },
    // ¿llevas a Eira? (sus compañeros no la conocen)
    strangers() { return !!(player && player.charId === 'eira'); },
    mythAnswer() { setTimeout(() => { if (player && !player.dead && G.Mode && G.Mode.active && G.Mode.playerSay) G.Mode.playerSay(pick(MYTH_A)); }, 2400); },
    // el encuentro: el compañero pregunta si es de los Escorpiones, Eira contesta y (accept) él acepta su ayuda
    meet(f, accept) {
      if (!f || !f.alive || f.gone || !G.Humans) return;
      G.Humans.Voice.say(f, pick(STR_Q), { prio: 4 });
      setTimeout(() => { if (player && !player.dead && G.Mode && G.Mode.active && G.Mode.playerSay) G.Mode.playerSay(pick(accept ? STR_A_R : STR_A)); }, 2400);
      if (accept) setTimeout(() => { if (f.alive && !f.gone) G.Humans.Voice.say(f, pick(STR_OK), { prio: 4 }); }, 5200);
    },

    // Al empezar un enfrentamiento en un mapa con celdas. o: { lib: true (modo Liberación), comps: [ids] }
    setup(mode, o) {
      this.reset();
      const m = G.Maps && G.Maps.get(G.World.layout);
      if (!m || !m.cells || !m.cells.length || !G.Humans) return;
      if (!Freed) defineFreed();
      o = o || {};
      const W = G.World;
      S = {
        lib: !!o.lib, cells: [], freed: [], comps: [], survs: [], drops: [], clickers: [], seenDead: new Set(),
        exit: { x: W.SPAWN.x, z: W.SPAWN.z }, alarm: false, alarmT: 0, crack: null, shriekN: 0, zOnHumans: false, garrison: [],
        nearDrop(f, R) { let b = null, bd = R; for (const dr of this.drops) { if (dr.taken || (dr.claim && dr.claim !== f && dr.claim.alive && !dr.claim.gone)) continue; const d = Math.hypot(dr.x - f.pos.x, dr.z - f.pos.z); if (d < bd) { bd = d; b = dr; } } return b; },
        freeCount() { return this.freed.filter((f) => f.alive && !f.gone && !f.caged).length; },
        cellFor(f) { let b = null, bd = 34; for (const c of this.cells) { if (c.open || !c.occ.length || c.occ.some((p) => p.comp) || (c.busy && c.busy !== f && c.busy.alive && !c.busy.gone && c.busy.act)) continue; const d = Math.hypot(c.door.x - f.pos.x, c.door.z - f.pos.z); if (d < bd) { bd = d; b = c; } } return b; },
        onDown: (f) => Rescue.onDown(f), onGone: (f) => Rescue.onGone(f), openCell: (c, by) => Rescue.openCell(c, by)
      };
      // las celdas (y la puerta de cada una en los muebles del mapa)
      for (const c0 of m.cells) S.cells.push(Object.assign({}, c0, { open: false, occ: [], busy: null, doorF: null }));
      W.forEachChunk((c) => { for (const f of c.furn || []) if (f.type === 'reja_puerta' && f.cell) { const cl = S.cells.find((q) => q.id === f.cell); if (cl) cl.doorF = { c, f }; } });
      // quién va en cada celda: los compañeros (lejos de la entrada, por separado o juntos) y los supervivientes
      const far = S.cells.slice().sort((a, b) => Math.hypot(b.door.x - S.exit.x, b.door.z - S.exit.z) - Math.hypot(a.door.x - S.exit.x, a.door.z - S.exit.z));
      const free = shuffle(far.slice(0, Math.max(3, Math.ceil(far.length * 0.6))));
      const comps = (o.comps || []).filter((id) => G.Player.CHARS[id]);
      const together = comps.length > 1 && Math.random() < 0.35;
      comps.forEach((id, i) => {
        const cell = together && i > 0 ? S.comps[0].cell : free.shift();
        if (!cell) return;
        const f = this.makePrisoner(cell, { charId: id, life: COMP_LIFE }, cell.occ.length);
        S.comps.push(f);
      });
      // la Trece (asalto en el capitolio por la tarde, con poca probabilidad): sola en una celda del fondo, con tres
      // guardias que patrullan delante sin parar
      if (this.treceOk(mode, o)) { const cell = free.shift(); if (cell) this.makeTrece(cell); }
      // Grimes (solo en la caída de la Trece): en una celda del fondo, solo
      if (o.grimes && G.Player.CHARS.grimes) { const cell = free.shift(); if (cell) this.makeGrimes(cell); }
      const pool = shuffle(S.cells.filter((c) => !c.occ.length));
      const nS = S.lib ? Math.min(pool.length, 3 + Math.floor(Math.random() * 2)) : Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
      const names = shuffle(SURV_NAMES.slice());
      for (let i = 0; i < nS; i++) {
        const cell = pool[i], k = Math.random() < 0.45 ? 2 : 1;
        for (let j = 0; j < k; j++) {
          const nm = names.pop() || ['Alguien', 0];
          const look = G.Humans.lookFor('superviviente', nm[1]);
          look.npc = true; look.hero = true; look.noBand = true;
          S.survs.push(this.makePrisoner(cell, { surv: true, look, name: nm[0], life: SURV_LIFE }, j));
        }
      }
      // los chasqueadores encadenados
      for (const k of m.clickers || []) this.chainClicker(k);
      // la guarnición (modo Liberación): repartida por TODO el capitolio, a lo suyo (sin saber que estás). Antes
      // eran tres grupos de cuatro o cinco que barrían juntos; ahora, como mucho tres juntos y alrededor de un
      // fuego (charlando de los presos o de cómo se vive ahora); el resto, de uno en uno o de dos en dos, cada
      // cual en su trozo del mapa
      if (S.lib && m.garrison) this.spreadGarrison(m);
      G.Humans.foes = S.freed;
    },
    spreadGarrison(m) {
      const W = G.World, step = G.Run && G.Run.active ? G.Run.tier : 2, emul = (m.enemyMul || 1) * (G.Sky ? G.Sky.enemyMul(true) : 1);
      // los papeles: los mismos que antes (y los mismos extra con más enemigos)
      let roles = [];
      for (const g of m.garrison) {
        const r = g.roles.slice(0, Math.max(2, Math.round(g.roles.length * Math.min(1.25, emul * 0.85))));
        if (emul > 1.2 && r.length < g.roles.length + 1) r.push(pick(['explorador', 'carronero', 'pistolero']));
        roles = roles.concat(r);
      }
      shuffle(roles);
      const take = (n, ok) => { const out = []; for (let i = 0; i < roles.length && out.length < n; i++) if (!ok || ok(roles[i])) { out.push(roles[i]); roles.splice(i--, 1); } return out; };
      const b = (m.play && m.play[0]) || [W.ARENA_MIN, W.ARENA_MIN, W.ARENA_MAX, W.ARENA_MAX];
      const clampZ = (x0, z0, x1, z1) => ({ x0: Math.max(b[0], x0), z0: Math.max(b[1], z0), x1: Math.min(b[2], x1), z1: Math.min(b[3], z1) });
      const farOk = (x, z) => Math.hypot(x - S.exit.x, z - S.exit.z) > 22;
      const groups = [];
      // los fuegos (el barril, la hoguera, el fuego entre las piedras): dos o tres alrededor (el líder, en uno)
      const fires = shuffle((m.fires || []).map((f) => ({ x: f[0], z: f[1], k: f[2] || 0 })).filter((f) => farOk(f.x, f.z)));
      for (const F of fires) {
        if (roles.length < 3) break;
        const n = Math.random() < 0.6 ? 3 : 2, calm = (r) => r !== 'tirador' && r !== 'sigilo';
        const rl = take(1, (r) => r === 'lider').concat([]);
        const got = rl.concat(take(n - rl.length, calm));
        if (got.length < 2) { roles = roles.concat(got); continue; }
        groups.push({ roles: got, fire: F, zone: clampZ(F.x - 12, F.z - 12, F.x + 12, F.z + 12) });
      }
      // el resto: de uno en uno (o de dos en dos), cada cual en su cuadro de una rejilla de 4 x 4 sobre el mapa
      const cells = [], NX = 4, NZ = 4, cw = (b[2] - b[0]) / NX, ch = (b[3] - b[1]) / NZ;
      for (let ix = 0; ix < NX; ix++) for (let iz = 0; iz < NZ; iz++) {
        const x0 = b[0] + ix * cw, z0 = b[1] + iz * ch;
        if (!farOk(x0 + cw / 2, z0 + ch / 2)) continue;           // (la entrada, libre)
        if (groups.some((g) => g.fire && g.fire.x >= x0 && g.fire.x < x0 + cw && g.fire.z >= z0 && g.fire.z < z0 + ch)) continue;
        cells.push({ x0, z0, x1: x0 + cw, z1: z0 + ch });
      }
      shuffle(cells);
      let ci = 0;
      while (roles.length) {
        const n = roles.length >= 2 && Math.random() < 0.3 ? 2 : 1;
        const c = cells.length ? cells[ci++ % cells.length] : { x0: b[0], z0: b[1], x1: b[2], z1: b[3] };
        groups.push({ roles: take(n), cell: c, zone: clampZ(c.x0 - 5, c.z0 - 5, c.x1 + 5, c.z1 + 5) });
      }
      for (const g of groups) {
        let at = null;
        if (g.fire) at = { x: g.fire.x, z: g.fire.z };
        else {
          const c = g.cell;
          for (let t = 0; t < 40 && !at; t++) { const x = rr(c.x0 + 1.5, c.x1 - 1.5), z = rr(c.z0 + 1.5, c.z1 - 1.5); if (!W.circleBlocked(x, z, 0.5, 0) && farOk(x, z)) at = { x, z }; }
          if (!at) for (let t = 0; t < 60 && !at; t++) { const x = rr(b[0] + 2, b[2] - 2), z = rr(b[1] + 2, b[3] - 2); if (!W.circleBlocked(x, z, 0.5, 0) && farOk(x, z)) at = { x, z }; }
        }
        const sq = G.Humans.spawnSquad({ roles: g.roles, at: at || { x: (g.zone.x0 + g.zone.x1) / 2, z: (g.zone.z0 + g.zone.z1) / 2 }, zone: g.zone, active: true, diff: 0.8 + step * 0.04, noRetreat: true });
        sq.mode = 'sweep'; sq.brainT = g.fire ? 0.2 : rr(1, 4);
        if (g.fire) { sq.fire = { x: g.fire.x, z: g.fire.z, r: g.fire.k === 1 ? 1.9 : 1.45, a0: Math.random() * Math.PI * 2 }; sq.banterT = rr(3, 7); }
        sq.chat = () => this.chatLine(!!g.fire);
        S.garrison.push(sq);
      }
    },
    makePrisoner(cell, o, j) {
      const a = cell.area, n = j || 0;
      const x = U.clamp(cell.spot.x + (n ? 0.55 : -0.35) * (cell.door.fz ? 1 : 0.4), a[0], a[2]), z = U.clamp(cell.spot.z + (n ? 0.4 : -0.3) * (cell.door.fx ? 1 : 0.4), a[1], a[3]);
      const f = new Freed(scene, x, z, Object.assign({ cell }, o));
      f.facing = Math.atan2(cell.door.x - x, cell.door.z - z) + rr(-0.4, 0.4);
      f.slot = S.freed.length % 2 ? 1 : -1;
      cell.occ.push(f); S.freed.push(f);
      return f;
    },
    // ¿toca la Trece? (o.trece / Rescue.forceTrece: para probarla)
    treceOk(mode, o) {
      if (o.lib || mode !== 'asalto' || G.World.layout !== 'capitolio') return false;
      if (o.trece || this.forceTrece) { S.sim = !!o.sim; return true; }
      if (!G.Extras || G.Extras.treceSeen || (player && player.charId === 'eira')) return false;
      const h = G.Sky ? G.Sky.hour : 10;
      if (!(h >= 12 && h < 18.75)) return false;          // (por la tarde)
      return Math.random() < TRECE_P;
    },
    // Grimes enjaulado: conoce a la Trece (es de los suyos); al salir la sigue como un compañero (no cuenta para el
    // objetivo) y no lo tumba nadie: es quien la vengará
    makeGrimes(cell) {
      const C = G.Player.CHARS.grimes;
      const look = Object.assign({}, C.opts, { npc: true, gear: {}, seed: 21 });
      const f = this.makePrisoner(cell, { surv: true, charId: 'grimes', look, name: 'Grimes', life: 999 }, 0);
      f.surv = false; f.comp = true; f.grimes = true; f.sit = false;
      f.facing = Math.atan2(cell.door.x - f.pos.x, cell.door.z - f.pos.z);
      return f;
    },
    makeTrece(cell) {
      const C = G.Player.CHARS.eira;
      if (!C) return null;
      const look = Object.assign({}, C.opts, { npc: true, gear: {}, seed: 13 });
      const f = this.makePrisoner(cell, { surv: true, charId: 'eira', look, name: '13', life: 999 }, 0);
      f.surv = false; f.comp = false; f.sit = false; f.agr = false;
      f.trece = { ph: 'cage', t: 0, hid: 0 };
      f.facing = Math.atan2(cell.door.x - f.pos.x, cell.door.z - f.pos.z);
      S.trece = f;
      // la guardia: tres Escorpiones que no se separan de su celda
      const W = G.World, D = cell.door, m = G.Maps.get(W.layout), b = (m && m.play && m.play[0]) || [W.ARENA_MIN, W.ARENA_MIN, W.ARENA_MAX, W.ARENA_MAX];
      const zone = { x0: Math.max(b[0], D.x - 8), z0: Math.max(b[1], D.z - 8), x1: Math.min(b[2], D.x + 8), z1: Math.min(b[3], D.z + 8) };
      let at = null;
      for (let k = 0; k < 30 && !at; k++) { const r = 3 + k * 0.15, a = Math.atan2(D.fx, D.fz) + rr(-0.6, 0.6); const x = D.x + Math.sin(a) * r, z = D.z + Math.cos(a) * r; if (!W.circleBlocked(x, z, 0.5, 0)) at = { x, z }; }
      const step = G.Run && G.Run.active ? G.Run.tier : 2;
      const sq = G.Humans.spawnSquad({ roles: ['escopetero', 'pistolero', 'tirador'], at: at || { x: D.x + D.fx * 3, z: D.z + D.fz * 3 }, zone, active: true, diff: 0.85 + step * 0.04, noRetreat: true });
      sq.mode = 'sweep'; sq.brainT = rr(1, 3); sq.banterT = rr(4, 8);
      sq.chat = () => pick(CHAT_TRECE);
      S.treceSq = sq;
      return f;
    },
    // las charlas de los Escorpiones mientras la Trece sigue en su celda (también los demás grupos del mapa)
    get treceChat() { return S && S.trece && S.trece.caged ? () => pick(CHAT_TRECE) : null; },
    get treceOn() { return !!(S && S.trece); },
    // el golpe: te tumba (sin matarte) y se queda con un arma tuya (la de fuego que llevas en la mano, o la mejor
    // que lleves encima; si no tienes ninguna, la de cuerpo a cuerpo)
    treceHit(f, p) {
      const T = f.trece;
      const dmg = Math.min(TRECE_DMG, Math.max(0, p.health - 8));
      if (dmg > 0) p.damage(dmg, '13 te mató.');
      if (G.Combat && G.Combat.stats) G.Combat.stats.hurt += dmg;
      const dx = p.pos.x - f.pos.x, dz = p.pos.z - f.pos.z;
      if (G.Camera && G.Camera.hurtFx) G.Camera.hurtFx(1, U.angleDiff(Math.atan2(-dx, -dz), p.facing) > 0 ? 1 : -1);
      if (p.takePunch && !p.dead) p.takePunch(f, 'heavy', 0, 3.0);
      if (G.Audio) { G.Audio.play('hitPunch', { x: p.pos.x, z: p.pos.z, lv: p.lv || 0, vol: 1 }); G.Audio.play('hitFlesh', { vol: 0.7 }); }
      if (S) S.crack = null;
      const st = this.steal(p);
      T.stole = st;
      const nm = st ? (G.Weapons.get(st.id) || {}).name || st.id : '';
      setTimeout(() => { if (f.alive && !f.gone) f.sayL(st ? 'treceHit' : 'treceNone', 4, 99); }, 350);
      if (st) T.said = true;
      if (G.Mode && G.Mode.onMessage) G.Mode.onMessage(st ? '13 te ha quitado: ' + nm : '13 te ha tumbado de un golpe', 'bad');
    },
    steal(p) {
      const gun = (s) => !!(s && G.Weapons.isGun(G.Weapons.get(s.id)));
      const order = [p.cur, 2, 3, 1, 4].filter((i) => i >= 1);
      let i = order.find((k) => gun(p.hands[k]));
      if (i == null) i = p.hands[0] ? 0 : order.find((k) => p.hands[k]);
      if (i == null) return null;
      const s = p.hands[i], w = G.Weapons.get(s.id);
      p.hands[i] = null;
      if (p.cur === i) { p.prev = -1; p.equip(-1); }
      if (p.refreshModel) p.refreshModel();
      // (se lleva lo cargado y algo de reserva para ella; tu reserva no la toca)
      const ammo = gun(s) ? Math.max(4, Math.round((w.mag || 6) * 1.2)) : 0;
      return { id: s.id, ammo };
    },
    // los Escorpiones que la ven escapar
    treceAlarm(f) {
      for (const h of G.Population.list) {
        if (!h.human || h.ally || h.freed || !h.alive || h.gone || !h.squad) continue;
        if (Math.hypot(h.pos.x - f.pos.x, h.pos.z - f.pos.z) > 30) continue;
        G.Humans.Voice.say(h, pick(ESCAPE_LN), { prio: 3 });
        break;
      }
    },
    // se esfumó: Eira Trece aparece en Extras (una sola vez)
    treceGone(f) {
      const sim = !!(S && S.sim);
      if (S) S.trece = null;
      const first = !sim && G.Extras && G.Extras.markTrece ? G.Extras.markTrece() : false;
      if (G.Mode && G.Mode.bark) setTimeout(() => G.Mode.bark('trece'), 600);
      if (G.Mode && G.Mode.onMessage) G.Mode.onMessage(first ? '13 ha desaparecido. Extras: 13 ya se puede comprar' : (sim ? '13 ha desaparecido (simulación: no cuenta para Extras)' : '13 ha desaparecido'), 'good');
      if (G.Mode && G.Mode.onTrece) G.Mode.onTrece(first);
    },
    chatLine(fire) {
      // alrededor del fuego, la mitad de las veces, la vida de ahora (no solo los presos)
      if (fire && Math.random() < 0.5) return pick(CHAT_DAY);
      if (S && S.lib && S.comps.length && Math.random() < 0.45) {
        const c = S.comps.filter((f) => f.caged), one = c.length === 1;
        if (c.length) {
          const p = pick(one ? CHAT_ONE : CHAT_NEW), d = DESC[c[0].charId] || 'el nuevo', d2 = c[1] ? (DESC[c[1].charId] || 'el otro') : d;
          const f = (t) => t.replace('{A}', d.charAt(0).toUpperCase() + d.slice(1)).replace('{a}', d2);
          return [f(p[0]), f(p[1])];
        }
      }
      return pick(CHAT);
    },
    chainClicker(k) {
      const W = G.World;
      const zb = new G.Zombie(scene, k.x + rr(-0.6, 0.6), k.z + rr(-0.6, 0.6), null, Math.random() * TAU, { blind: true, lv: 0 });
      zb.kind = 'blind'; zb.chain = { x: k.x, z: k.z, r: k.r };
      zb.enter('idle', 2);
      G.Population.list.push(zb);
      const link = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 4), new THREE.MeshLambertMaterial({ color: 0x7a7a72 }));
      link.castShadow = false; scene.add(link);
      S.clickers.push({ z: zb, post: { x: k.x, z: k.z, y: W.groundY(k.x, k.z, 0) + 1.05 }, link, cd: 0 });
    },
    reset() {
      if (S) {
        for (const f of S.freed) { try { f.dispose(); } catch (e) { /* nada */ } }
        for (const c of S.clickers) { if (c.link && c.link.parent) c.link.parent.remove(c.link); }
        for (const c of S.cells) if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
      }
      S = null;
      if (G.Humans) G.Humans.foes = [];
    },

    // ---------- Interacción: abrir una celda o soltar un chasqueador ----------
    interactFind(player, mode) {
      if (!S || player.dead || (player.lv || 0) || S.crack) return null;
      if (mode !== 'door' && mode !== 'loot') return null;
      let best = null, bd = 1.5;
      for (const c of S.cells) {
        if (c.open) continue;
        const d = Math.hypot(c.door.x + c.door.fx * 0.5 - player.pos.x, c.door.z + c.door.fz * 0.5 - player.pos.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        const who = best.occ.filter((p) => p.alive).map((p) => p.name);
        const label = who.length ? 'Liberar a ' + (who.length > 1 ? who.slice(0, -1).join(', ') + ' y ' + who[who.length - 1] + ' (salen todos a la vez)' : who[0]) : 'Abrir la celda (vacía)';
        return { kind: 'cell', label, cell: best, x: best.door.x, z: best.door.z };
      }
      for (const k of S.clickers) {
        if (!k.z.alive || !k.z.chain) continue;
        if (Math.hypot(k.post.x - player.pos.x, k.post.z - player.pos.z) < 1.3) return { kind: 'chain', label: 'Soltar al chasqueador (irá a por lo que oiga)', k, x: k.post.x, z: k.post.z };
      }
      return null;
    },
    interactUse(t, player) {
      if (!S) return null;
      if (t.kind === 'cell') {
        S.crack = { cell: t.cell, t: 0, clickT: 0 };
        player.facing = Math.atan2(t.cell.door.x - player.pos.x, t.cell.door.z - player.pos.z);
        if (player.stance === 'stand' && player.setStance) player.setStance('crouch');
        return 'Forzando la cadena... no te muevas';
      }
      if (t.kind === 'chain') { this.release(t.k, player); return 'Has soltado al chasqueador'; }
      return null;
    },
    release(k, by) {
      const z = k.z;
      z.chain = null;
      if (k.link) k.link.visible = false;
      S.zOnHumans = true;
      G.Humans.mixed = true;
      z.hunter = true;
      if (G.Audio) G.Audio.play('hitBlunt', { x: k.post.x, z: k.post.z, lv: 0, vol: 0.7 });
      G.World.emit(k.post.x, k.post.z, 9, 0);
      // va hacia el escorpión más cercano (lo oye)
      let b = null, bd = 30;
      for (const h of G.Population.list) { if (!h.human || h.ally || !h.alive || h.gone) continue; const d = Math.hypot(h.pos.x - z.pos.x, h.pos.z - z.pos.z); if (d < bd) { bd = d; b = h; } }
      if (b) { z.target = { x: b.pos.x, z: b.pos.z, lv: 0 }; z.enter('investigate', 12); z.investFast = true; }
      if (G.Mode && G.Mode.onMessage) G.Mode.onMessage('El chasqueador está suelto: va a por todo lo que oiga', 'warn');
    },
    openCell(cell, by) {
      if (!cell || cell.open) return;
      cell.open = true;
      const W = G.World;
      if (cell.doorF) W.smashFurn(cell.doorF.c, cell.doorF.f);
      cell.mesh = doorMesh(cell); scene.add(cell.mesh);
      if (G.Audio) { G.Audio.play('doorOpen', { x: cell.door.x, z: cell.door.z, lv: 0 }); G.Audio.play('hitBlunt', { x: cell.door.x, z: cell.door.z, lv: 0, vol: 0.5 }); }
      W.emit(cell.door.x, cell.door.z, 8, 0);
      const out = cell.occ.filter((p) => p.alive && p.caged);
      const D = cell.door;
      out.forEach((p, i) => {
        p.caged = false; p.state = 'fight'; p.npcK = 0; p.sit = false;
        // por la puerta: su lado de dentro y un paso afuera (el segundo, algo más lejos)
        p.exitCell = { t: -i * 0.5, pts: [{ x: D.x - D.fx * 0.75, z: D.z - D.fz * 0.75 }, { x: D.x + D.fx * (1.2 + i * 0.7), z: D.z + D.fz * (1.2 + i * 0.7) }] };
        if (p.trece) { p.trece.ph = 'out'; p.trece.t = 0; return; }
        setTimeout(() => { if (p.alive && !p.gone) p.sayL(p.comp ? (Rescue.strangers() && !p.grimes ? 'freeCompStranger' : 'freeComp') : 'freeSurv', 3, 30); }, 600 + i * 1400);
      });
      // (sale Grimes: los Supervivientes que andan sueltos cerca lo reconocen)
      if (out.some((p) => p.grimes)) setTimeout(() => {
        const g = out.find((p) => p.grimes), w = S && S.freed.find((q) => q.surv && q.alive && !q.gone && !q.caged && Math.hypot(q.pos.x - g.pos.x, q.pos.z - g.pos.z) < 18);
        if (w) w.sayL('seeGrimes', 3, 99);
      }, 2600);
      if (G.Mode && G.Mode.onCellOpen) G.Mode.onCellOpen(cell, out, by);
    },
    onDown(f) {
      if (G.Mode && G.Mode.onMessage) G.Mode.onMessage(f.name + (f.comp ? ' ha caído' : ' (superviviente) ha muerto'), f.comp ? 'bad' : 'warn');
      if (G.Mode && G.Mode.onFreedDown) G.Mode.onFreedDown(f);
    },
    onGone(f) {
      if (G.Mode && G.Mode.onMessage && f.surv) G.Mode.onMessage(f.name + ' se fue por su cuenta', 'good');
    },
    // un infectado: ¿a quién va? al más cercano entre tú, los presos sueltos y (si hay chasqueadores sueltos) los Escorpiones
    zTarget(z) {
      if (!S || z.human || z.ally || !z.alive) return null;
      if ((player.struggle && player.struggle.z === z) || (player.beaten && player.beaten.z === z) || (player.lifted && player.lifted.z === z)) { z.rTgt = null; return null; }
      z.rTT = (z.rTT || 0) - 1;
      const cur = z.rTgt;
      if (z.rTT <= 0 || (cur && (!cur.alive || cur.gone))) {
        z.rTT = 30;
        const BUSYZ = { attack: 1, combo: 1, grapple: 1, runatk: 1, tdash: 1, tcharge: 1 };
        if (!BUSYZ[z.state] || (cur && (!cur.alive || cur.gone))) {
          let best = null, bd = player.dead ? 999 : Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
          for (const f of S.freed) { if (!f.alive || f.gone || f.caged || f.trece) continue; const d = Math.hypot(f.pos.x - z.pos.x, f.pos.z - z.pos.z) * 1.1; if (d < bd) { bd = d; best = f; } }
          if (S.zOnHumans && !z.chain) for (const h of G.Population.list) { if (!h.human || h.ally || !h.alive || h.gone || h.state === 'hostage') continue; const d = Math.hypot(h.pos.x - z.pos.x, h.pos.z - z.pos.z); if (d < bd) { bd = d; best = h; } }
          z.rTgt = best;
        }
      }
      const t = z.rTgt;
      if (!t) return null;
      return { p: t.freed ? t.proxy : t.zProxy(), c: G.Humans.AllyCombat };
    },

    // ---------- Cada fotograma ----------
    update(dt) {
      if (!S) return;
      const W = G.World, all = G.Population.list;
      // forzando una celda (tú)
      const C = S.crack;
      if (C) {
        const D = C.cell.door, d = Math.hypot(D.x + D.fx * 0.5 - player.pos.x, D.z + D.fz * 0.5 - player.pos.z);
        if (d > 1.9 || (player.speedNow || 0) > 0.9 || (player.blow && player.blow.t < 0.3) || player.struggle || player.dead) {
          S.crack = null;
          if (G.Mode && G.Mode.onMessage) G.Mode.onMessage('Se cortó: vuelve a empezar', 'warn');
        } else {
          C.t += dt; C.clickT -= dt;
          if (C.clickT <= 0) { C.clickT = 0.6; if (G.Audio) G.Audio.play('slide', { x: D.x, z: D.z, lv: 0, vol: 0.3 }); W.emit(D.x, D.z, 4, 0); }
          if (G.Mode && G.Mode.setTimer) G.Mode.setTimer('FORZANDO LA CELDA', Math.max(0, OPEN_T - C.t));
          if (C.t >= OPEN_T) { S.crack = null; if (G.Mode && G.Mode.setTimer) G.Mode.setTimer(null); this.openCell(C.cell, player); }
        }
      }
      // las armas de los escorpiones que caen (para los presos)
      for (const h of all) {
        if (!h.human || h.alive || h.ally || S.seenDead.has(h)) continue;
        S.seenDead.add(h);
        if (h.w && h.w.id && h.w.id !== 'manos') {
          const am = G.Weapons.isGun(h.w) ? Math.max(4, Math.round((h.w.mag || 6) * 1.5)) : 0;
          S.drops.push({ x: h.pos.x, z: h.pos.z, w: h.w.id, ammo: am, body: h, taken: false });
        }
      }
      // los presos
      for (const f of S.freed) f.update(dt, player, all);
      G.Humans.foes = S.freed.filter((f) => f.alive && !f.gone && !f.caged);
      // los escorpiones tranquilos que ven a un preso suelto dan la voz
      S.seeT = (S.seeT || 0) - dt;
      if (S.seeT <= 0) {
        S.seeT = 0.3;
        for (const f of G.Humans.foes) {
          for (const h of all) {
            if (!h.human || h.ally || h.freed || !h.alive || h.gone || !h.squad || h.squad.mode === 'combat') continue;
            if (h.state === 'beg' || h.state === 'hostage' || h.state === 'flee') continue;
            const d = Math.hypot(f.pos.x - h.pos.x, f.pos.z - h.pos.z), R0 = (h.R.sight || 28) * (f.wantCrouch ? 0.45 : 0.75);
            if (d > R0) continue;
            const ang = Math.abs(U.angleDiff(Math.atan2(f.pos.x - h.pos.x, f.pos.z - h.pos.z), h.facing));
            if (ang > (h.R.fov || 1) + 0.35 && d > 4) continue;
            if (!W.hasLOS(h.pos.x, h.pos.z, f.pos.x, f.pos.z, h.lv)) continue;
            h.squad.know(f.proxy, true, h);
            if (f.trece) G.Humans.Voice.say(h, pick(ESCAPE_LN), { prio: 3 }); else h.say('pfight', null, { prio: 3 });
            break;
          }
        }
      }
      // la alarma de la sede: si un grupo entra en combate, a los pocos segundos lo saben todos
      if (S.garrison.length) {
        const hot = S.garrison.find((q) => !q.done && q.mode === 'combat' && q.known);
        if (hot && !S.alarm) { S.alarm = true; S.alarmT = 3.5; S.alarmAt = { x: hot.known.x, z: hot.known.z }; }
        if (S.alarmT > 0) {
          S.alarmT -= dt;
          if (S.alarmT <= 0) this.raiseAlarm(S.alarmAt.x, S.alarmAt.z, false);
        }
      }
      // chasqueadores encadenados: la cadena (dibujo) y la alarma cuando te oyen cerca
      for (const k of S.clickers) {
        const z = k.z;
        if (k.cd > 0) k.cd -= dt;
        if (!z.alive || !z.chain) { if (k.link) k.link.visible = false; continue; }
        // la cadena: del poste al cuello
        const a = new THREE.Vector3(k.post.x, k.post.y, k.post.z), b = new THREE.Vector3(z.pos.x, (z.y || 0) + 1.1, z.pos.z);
        const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
        k.link.position.copy(mid); k.link.scale.set(1, Math.max(0.05, len), 1);
        k.link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        const near = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z) < 12 || S.freed.some((f) => f.alive && !f.caged && Math.hypot(f.pos.x - z.pos.x, f.pos.z - z.pos.z) < 10);
        const on = z.state === 'chase' || z.state === 'alert' || z.state === 'attack' || z.state === 'combo' || (z.state === 'investigate' && z.investFast);
        if (on && near && k.cd <= 0) {
          k.cd = 22;
          if (G.Audio) G.Audio.play('nShriek', { x: z.pos.x, z: z.pos.z, lv: 0 });
          W.emit(z.pos.x, z.pos.z, 34, 0);
          S.shriekN++;
          this.raiseAlarm(z.pos.x, z.pos.z, true);
        }
      }
      if (G.Mode && G.Mode.rescueTick) G.Mode.rescueTick(dt, S);
    },
    // toda la sede se pone a buscar (los que no están ya peleando)
    raiseAlarm(x, z, clicker) {
      if (!S) return;
      const first = !S.alarmSaid;
      for (const sq of S.garrison.length ? S.garrison : G.Humans.squads) {
        if (sq.done || sq.mode === 'combat') continue;
        sq.known = { x: x + rr(-5, 5), z: z + rr(-5, 5), lv: 0, t: 1, seen: false };
        sq.mode = 'search'; sq.searchT = 0; sq.brainT = 0.4;
        if (!sq.active) sq.begin(true);
        const sp = sq.leader || sq.alive()[0];
        if (sp && Math.random() < 0.7) sp.say('shotHeard', null, { prio: 3 });
      }
      if (first && S.garrison.length) {
        S.alarmSaid = true;
        if (G.Mode && G.Mode.onMessage) G.Mode.onMessage(clicker ? '¡Un chasqueador ha chillado! Los Escorpiones van hacia allí' : '¡Alarma! Toda la sede sabe que hay alguien dentro', 'bad');
      }
    },
    get state() { return S; }
  };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  G.Rescue = Rescue;
})(window.Game = window.Game || {});
