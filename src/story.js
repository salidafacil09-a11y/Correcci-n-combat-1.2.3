// Modo historia: lo que pasa en cada capítulo (objetivos y escenas habladas). Por ahora, el prólogo:
//   1. (la cinemática del teléfono, que llegará: por ahora, la llamada de la secretaria en subtítulos)
//   2. Ve a la oficina del jefe → la charla con el jefe Webb (sentado en su escritorio)
//   3. Por megafonía: una patrulla urgente a Pine con la Cuarta → el jefe le manda ir a él
//   4. Ve al garaje → pantalla a negro y la frase de Javier (sin video)
//   5. Alem, el compañero, le tiende las llaves: se cogen con el botón de interactuar; Javier pide manejar
//   6. Sube al patrullero: los dos van a su puerta, la abren y se meten (ya no se les ve); charla y arranca
//   7. Saca el patrullero del garaje (G.Drive): al salir por el portón, a negro y la pantalla de carga: la
//      estación se descarga entera y empieza la calle (G.Road), que se arma delante y se deshace detrás
//   8. Por la calle, de noche y sin luz: la charla (la ciudad vacía, el hongo, el generador), la radio, los
//      disparos y las sirenas a lo lejos (G.CitySound). Mientras, la sangre de las heridas se va pintando en las
//      texturas de los dos (G.Wounds: no se les ve, van dentro)
//   9. En un cruce, una camioneta los embiste por el costado: la imagen se corta
//  10. El cruce (mapa cruce_2020): el patrullero volcado; Javier sale a rastras, herido y aturdido; un corredor
//      se le echa encima (el agarre, con su pulsar Atacar, más largo); Alem le dispara a la cabeza
//  11. La huida (G.Huida, G.RoadLife): el revólver, la persecución a pie hasta el depósito de vehículos, las llaves,
//      el puente, la segunda vez al volante, la estación en llamas y el plano final; vuelta al menú principal.
//      Puntos de control (se guardan): 1, después del corredor del cruce; 2, dentro del depósito con la puerta
//      atrancada; 3, preparando el coche (el puente). Si mueres o sales, se sigue desde el último
// Las frases salen como las de los aliados (G.Humans.Voice: subtítulo con el nombre y la voz, si está activa);
// mientras dura una escena, la gente de la estación no charla (G.NPCs.quiet).
// G.Story.begin(capítulo, jugador) al quitarse la pantalla negra; update(dt, jugador) cada fotograma; clear() al salir.
(function (G) {
  'use strict';

  // ---------- El objetivo en pantalla ----------
  let box = null, boxT = 0;
  function objBox() {
    if (box) return box;
    box = document.createElement('div');
    box.id = 'st-obj';
    box.className = 'hidden';
    box.innerHTML = '<small>Objetivo</small><span class="st-oi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke-width="2"/></svg></span><b></b>';
    document.body.appendChild(box);
    return box;
  }
  function setObj(text, label) {
    const b = objBox();
    b.querySelector('b').textContent = text;
    b.querySelector('small').textContent = label || 'Nuevo objetivo';
    b.classList.remove('hidden', 'done', 'end');
    b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
    boxT = 0;
  }
  function objDone() { if (box) { box.classList.add('done'); box.querySelector('small').textContent = 'Objetivo cumplido'; boxT = 2.6; } }
  function hideObj() { if (box) box.classList.add('hidden'); boxT = 0; }

  // ---------- Quién habla ----------
  // El jefe y Alem, si están en el mapa (G.NPCs), hablan desde donde están; si no (el teléfono, la megafonía, la
  // radio del coche, Alem dentro del patrullero o al otro lado del coche volcado), «desde» Javier
  let pl = null;
  const here = () => (pl ? pl.pos : { x: 0, z: 0 });
  const FIX = {
    jav: { name: 'Javier', color: '#e8d6a6', alive: true, gone: false, female: false, vIdx: 11, vp: 0.86, vr: 1.0, get pos() { return here(); } },
    sec: { name: 'Secretaria (teléfono)', color: '#d8b8e0', alive: true, gone: false, female: true, vIdx: 5, vp: 1.2, vr: 1.05, get pos() { return here(); } },
    pa: { name: 'Megafonía', color: '#c8d0d8', alive: true, gone: false, female: true, vIdx: 9, vp: 1.0, vr: 0.95, get pos() { return here(); } },
    jefe: { name: 'Jefe Webb', color: '#e8c89a', alive: true, gone: false, female: false, vIdx: 2, vp: 0.8, vr: 0.95, pos: { x: 29.95, z: 21.2 } },
    alem: { name: 'Alem', color: '#c8d8a0', alive: true, gone: false, female: false, vIdx: 3, vp: 0.9, vr: 1.02, get pos() { return here(); } },
    radio: { name: 'Radio', color: '#8fb0c0', alive: true, gone: false, female: false, vIdx: 7, vp: 0.78, vr: 1.12, get pos() { return here(); } },
    civ: { name: 'Mujer', color: '#d8c0a8', alive: true, gone: false, female: true, vIdx: 6, vp: 1.15, vr: 1.12, get pos() { return here(); } }
  };
  function spk(k) {
    if (k === 'jefe' || k === 'alem') { const n = G.NPCs && G.NPCs.get(k); if (n && !n.gone && !n.off) return n; }
    return FIX[k];
  }
  const npc = (k) => { const n = G.NPCs && G.NPCs.get(k); return n && !n.gone ? n : null; };

  // ---------- Las escenas del prólogo ----------
  const CALL = [
    ['sec', 'Javier, soy Linda. El jefe Webb quiere verte en su oficina. Dice que ahora, si puedes.'],
    ['jav', 'Voy para allá.']
  ];
  const TALK = [
    ['jefe', 'Pasa, Javier. Siéntate si quieres... bueno, como prefieras.'],
    ['jefe', 'Veinte años y ya con la estrella de sheriff. Tienes suerte, chico. Mucha.'],
    ['jav', 'Suerte, o que nadie más quería el puesto, jefe.'],
    ['jefe', 'Un poco de las dos. Yo entré en el cuerpo más o menos con tu edad. Turno de noche en Rainier Valley: ahí se aprende rápido o no se aprende.'],
    ['jefe', 'Bueno, al grano. ¿Cómo va lo del muelle 66?'],
    ['jav', 'Cerrado. Los dos detenidos están abajo, en los calabozos. El informe lo tienes en la bandeja.'],
    ['jefe', 'Lo vi. Bien escrito, por cierto. ¿Y el que trajeron anoche? Dicen que no para de gritar.'],
    ['jav', 'Tiene fiebre alta y se ha mordido la mano. Pedí un médico, pero de Harborview no mandan a nadie.'],
    ['jefe', 'Harborview no da abasto. Lo de esta semana no es normal, Javier: agresiones, mordiscos, gente que no siente los golpes...'],
    ['jav', '¿Drogas?'],
    ['jefe', 'Eso dicen los de arriba. Yo llevo treinta años en esto y nunca había visto nada igual.'],
    ['jefe', 'Con media plantilla de baja vas a tener que doblar turnos. Fírmame aquí los horarios.'],
    ['jav', 'Hecho.'],
    ['jefe', 'Y una cosa más: ahí fuera, nada de heroísmos. Si algo no te cuadra, pides apoyo y esperas.']
  ];
  const PA = [
    ['pa', 'Atención, unidades disponibles: se necesita una patrulla urgente en la calle Pine, a la altura de la Cuarta avenida. Varias llamadas por agresiones. Hay heridos.'],
    ['pa', 'Repito: patrulla urgente a Pine con la Cuarta.']
  ];
  const AFTER = [
    ['jefe', '... Lo que te decía. Reyes está con la sesión del turno, y Ortiz y Brennan no llegan a tiempo.'],
    ['jefe', 'Id Alem y tú. Ya te está esperando en el garaje, con el patrullero. Y Javier... tened cuidado.'],
    ['jav', 'Voy.']
  ];
  // en el garaje, a negro: lo que dice Javier (ya sin video)
  const CINE = { who: 'jav', text: '¿Te vas sin las llaves?' };
  // Alem, ya en el juego, con la mano tendida
  const KEYS = [['alem', '¿Sin llaves? Aquí las tienes, listillo. Llevo un rato esperándote.']];
  // con las llaves en la mano: Javier pide manejar
  const DRIVE = [
    ['jav', 'Ya que las tengo yo... esta vez manejo yo.'],
    ['alem', '¿Tú? La última vez te subiste a la acera de la Quinta.'],
    ['jav', 'Una vez. Y había un perro cruzando.'],
    ['alem', 'Siempre hay un perro. Vale, maneja tú. Pero si le haces un rayón, se lo explicas tú a Webb.'],
    ['jav', 'Trato hecho. Sube.']
  ];
  // dentro del patrullero, antes de arrancar
  const CAR = [
    ['alem', 'Pine con la Cuarta. ¿Sabes qué es lo raro? Que es la quinta llamada así esta noche.'],
    ['jav', 'Webb dice que en treinta años no había visto nada igual.'],
    ['alem', 'Webb dice eso de todo. Hasta del café de la máquina nueva. Venga, arranca.']
  ];
  // por la calle: charlas de dos amigos de hace años, con lo que está pasando de fondo (una detrás de otra, con
  // un rato de silencio entre medias; la radio del coche se cuela de vez en cuando)
  const ROAD = [
    [['alem', 'Mira esto. Ni un alma. Son las once menos cuarto y parece que fueran las cuatro de la mañana.'],
      ['jav', 'Un martes. A esta hora, por aquí, siempre hay alguien paseando al perro.'],
      ['alem', 'Y ni una ventana encendida.']],
    [['alem', 'Tenemos suerte de que la estación de policía tenga un generador eléctrico. Durante todo el día, gran parte de la ciudad estuvo sin luz.'],
      ['jav', 'Dicen que fue la subestación de Georgetown. Que alguien entró y la dejó hecha polvo.'],
      ['alem', '¿Alguien? ¿Para qué?'],
      ['jav', 'No lo sé. Para lo mismo que muerden, supongo.']],
    [['radio', '... a todas las unidades: se recomienda no salir del vehículo sin apoyo... repito, no salgan sin apoyo...'],
      ['alem', 'Eso es nuevo.']],
    [['alem', '¿Leíste lo que mandó el departamento de salud esta mañana? Lo del hongo.'],
      ['jav', 'Pandora Formicae. Lo dijeron en la radio. Que llegó en un cargamento de grano al puerto.'],
      ['alem', 'Dicen que se te mete en los pulmones. Primero la fiebre, después la cabeza... y después ya no eres tú.'],
      ['jav', 'Como las hormigas de los documentales. Las que se suben a una hoja y se quedan ahí.'],
      ['alem', 'Qué bonito. Gracias, Javier, ahora no voy a dormir.']],
    [['jav', '¿Te acuerdas de la academia? Me ayudabas con las prácticas de tiro.'],
      ['alem', 'Y en el examen me ganaste por un punto. Todavía no te lo perdono.'],
      ['jav', 'Fue suerte.'],
      ['alem', 'Nada de suerte. Oye, ¿y tu madre? ¿Cómo está?'],
      ['jav', 'Bien. Pregunta por ti cada domingo. Dice que hace mucho que no vienes a comer.'],
      ['alem', 'Dile que este domingo voy. Si esta noche no se complica, claro.'],
      ['jav', 'No digas eso.']],
    [['radio', '... Central, disparos en la Sexta con Pike... sin unidades disponibles... ¿alguien me copia?...'],
      ['jav', 'Si fuera un hongo, ya habrían cerrado la ciudad.'],
      ['alem', 'A lo mejor por eso está vacía. A lo mejor la gente sabe algo que nosotros no.']]
  ];
  const PRE_CRASH = [['alem', 'Pine queda a un par de calles. En el próximo cruce, sigue recto.'], ['jav', 'Recibido.']];
  const NUDGE = ['Javier... ¿qué haces? Arranca, que nos esperan.', 'Venga, que no llegamos.', '¿Te has dormido? Dale.'];
  // después del choque
  const WAKE = [['jav', 'Alem... ¿Alem?']];
  const UP = [['jav', '¡Alem! ¿Estás bien?'], ['alem', 'Aquí... al otro lado. Estoy bien. Creo. Me he dado en la pierna.']];
  const ENDING = [
    ['alem', '¿Qué demonios le pasaba a ese tipo?'],
    ['jav', 'No lo sé... Me quería morder. Me quería morder, Alem.'],
    ['alem', 'Tienes sangre por toda la cara. ¿Puedes andar?'],
    ['jav', 'Creo que sí...']
  ];
  // dónde: la oficina del jefe (la armería de la estación abandonada) y el garaje
  const OFFICE = { x0: 24.3, x1: 31.7, z0: 17.3, z1: 24.7 }, GARAGE = { x0: 36, x1: 60, z0: 1, z1: 15 };
  // el patrullero de los dos (maps.js: el de más al sur del garaje, mirando al portón, +x): su centro, dónde
  // se ponen tras la cinemática, a qué lado de cada puerta y los asientos. El conductor, a la izquierda (-z)
  const CAR_AT = { x: 46.0, z: 10.4 }, HALF_W = 0.925;
  // (de lado al coche, mirándose: la cámara, detrás de Javier, queda en el hueco del garaje y no contra la pared)
  const AFTER_CINE = { jav: { x: 45.6, z: 12.4, face: Math.PI / 2 }, alem: { x: 47.0, z: 12.4, face: -Math.PI / 2 } };
  const DOORS = { jav: { x: 45.95, z: 8.95, face: 0, seat: { x: 46.2, z: 9.95 } }, alem: { x: 45.95, z: 11.85, face: Math.PI, seat: { x: 46.2, z: 10.85 } } };
  const inRect = (p, r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

  // ---------- Una escena: las frases una detrás de otra ----------
  // near: quién tiene que estar cerca para que siga (si Javier se va, la charla espera a que vuelva)
  let scene = null;
  function play(list, done, near) { scene = { list, i: 0, t: 0.4, done, near: near || null }; }
  function stepScene(dt, player) {
    const s = scene, V = G.Humans && G.Humans.Voice;
    if (!s || !V) return;
    if (s.near && Math.hypot(player.pos.x - s.near.pos.x, player.pos.z - s.near.pos.z) > 6.5) return;
    s.t -= dt;
    if (s.t > 0 || !V.idle()) return;          // (la frase anterior, hasta que acabe de oírse)
    if (s.i >= s.list.length) { scene = null; if (s.done) s.done(); return; }
    const [who, text] = s.list[s.i++];
    V.say(spk(who), text, { prio: 3, force: true });
    s.t = 0.45;
    // el jefe, mientras le toca hablar, gesticula
    const j = npc('jefe');
    if (j && j.def) j.pose = who === 'jefe' ? 'sittalk' : 'desk';
  }

  // ---------- Las llaves (en la mano de Alem; luego, un momento, en la de Javier) ----------
  function keyMesh() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8c8c0, metalness: 0.8, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0028, 6, 14), metal);
    const fob = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.014), dark);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.05, 0.004), metal);
    fob.position.y = -0.03; blade.position.y = -0.075; ring.position.y = 0.008;
    g.add(ring, fob, blade);
    return g;
  }
  let keyAlem = null, keyJav = null, keyJavT = 0;
  function dropKey(k) { if (k && k.parent) k.parent.remove(k); if (k) k.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  function handKey(model) {
    if (!model || !model.handR) return null;
    const k = keyMesh(), palm = model.palm || 0.06;
    k.position.set(0, -palm * 1.1, 0.025); k.rotation.set(0.3, 0, 0.2);
    model.handR.add(k);
    return k;
  }

  // ---------- Las puertas del patrullero (se abren al subir) ----------
  // dos tableros sueltos, pegados al costado del coche, con la bisagra delante: se abren hacia fuera
  let doors = null;
  function makeDoors(scene) {
    if (!scene) return null;
    const mk = (side) => {
      const g = new THREE.Group();
      g.position.set(CAR_AT.x + 0.86, 0, CAR_AT.z + side * (HALF_W + 0.022));
      const white = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.55 });
      const blue = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.5 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x2c3a44, roughness: 0.2, metalness: 0.3 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.54, 0.035), white); panel.position.set(-0.49, 0.63, 0);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.12, 0.04), blue); stripe.position.set(-0.49, 0.66, 0);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.025), glass); win.position.set(-0.47, 1.12, 0);
      for (const m of [panel, stripe, win]) { m.castShadow = true; g.add(m); }
      g.visible = false;
      g.position.y = G.World.groundY ? G.World.groundY(g.position.x, g.position.z, 0) : 0;
      scene.add(g);
      // el hueco de la puerta (oscuro), en el costado, mientras está abierta
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.9, 0.01), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }));
      hole.position.set(g.position.x - 0.48, g.position.y + 0.86, CAR_AT.z + side * (HALF_W + 0.006));
      hole.visible = false;
      scene.add(hole);
      return { g, hole, side, a: 0, to: 0 };
    };
    return { jav: mk(-1), alem: mk(1) };
  }
  function stepDoors(dt) {
    if (!doors) return;
    for (const k of ['jav', 'alem']) {
      const d = doors[k];
      if (d.a === d.to && d.a === 0) { d.g.visible = d.hole.visible = false; continue; }
      d.g.visible = d.hole.visible = true;
      d.a += Math.sign(d.to - d.a) * Math.min(Math.abs(d.to - d.a), dt * 2.4);
      const e = d.a * d.a * (3 - 2 * d.a);
      // (el tablero va de la bisagra hacia atrás, -x: girando side·1,15 rad, el conductor abre hacia -z y el acompañante hacia +z)
      d.g.rotation.y = d.side * 1.15 * e;
    }
  }
  function clearDoors() {
    if (!doors) return;
    for (const k of ['jav', 'alem']) for (const g of [doors[k].g, doors[k].hole]) { if (g.parent) g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    doors = null;
  }

  // ---------- Sillas para sentarse (con el botón de recoger / interactuar) ----------
  // face: hacia dónde mira sentado. La de la oficina del jefe, delante de su escritorio
  const SEATS = { prologo: [{ x: 28.25, z: 21.0, face: Math.PI / 2 }] };
  function addSeats(ch, player) {
    if (!G.Props) return;
    for (const s of SEATS[ch] || []) {
      G.Props.add({ x: s.x, z: s.z, label: 'Sentarse', reach: 1.25, kind: 'seat', off: () => !!player.sitting, use: (pl) => { pl.sitDown(s); return null; }, dispose() {} });
      G.Props.add({ x: s.x, z: s.z, label: 'Levantarse', reach: 0.6, kind: 'seat', off: () => !player.sitting, use: (pl) => { pl.standUp(); return null; }, dispose() {} });
    }
  }

  // ---------- El cruce del choque: el coche volcado, sus luces y el fuego ----------
  // El patrullero volcado no choca como mueble (Javier sale de debajo): lo aparta esto, como una caja girada
  let wreck = null;
  function wreckBox() {
    const m = G.Maps && G.Maps.get('cruce_2020'), w = m && m.wreck;
    if (!w) return null;
    const l = Math.hypot(w.fx, w.fz);
    return { x: w.x, z: w.z, dx: w.fx / l, dz: w.fz / l, hl: 2.35, hw: 0.98 };
  }
  // saca un círculo (pos, r) de la caja del coche volcado
  function pushOutWreck(pos, r) {
    const b = wreck && wreck.box;
    if (!b) return;
    const rx = pos.x - b.x, rz = pos.z - b.z;
    const u = rx * b.dx + rz * b.dz, v = -rx * b.dz + rz * b.dx;         // a lo largo y de lado
    const cu = Math.max(-b.hl, Math.min(b.hl, u)), cv = Math.max(-b.hw, Math.min(b.hw, v));
    let du = u - cu, dv = v - cv, d = Math.hypot(du, dv);
    if (d >= r) return;
    if (d < 1e-4) { if (b.hw - Math.abs(v) < b.hl - Math.abs(u)) { dv = Math.sign(v) || 1; du = 0; d = 0; } else { du = Math.sign(u) || 1; dv = 0; d = 0; } }
    const k = d < 1e-4 ? r + (Math.abs(dv) ? b.hw - Math.abs(v) : b.hl - Math.abs(u)) : (r - d) / d;
    const pu = du * k, pv = dv * k;
    pos.x += pu * b.dx - pv * b.dz; pos.z += pu * b.dz + pv * b.dx;
  }
  function wreckFx(scene) {
    const b = wreckBox();
    const fx = { box: b, objs: [], t: 0, sprites: [], smoke: [] };
    if (!scene || !b) return fx;
    // el puente de luces, roto bajo el coche: rojo y azul que se escapan por los lados y parpadean
    const red = new THREE.PointLight(0xff2a1a, 0, 9, 2), blue = new THREE.PointLight(0x2a4aff, 0, 9, 2);
    red.position.set(b.x - b.dz * 1.3, 0.35, b.z + b.dx * 1.3); blue.position.set(b.x + b.dz * 1.3, 0.35, b.z - b.dx * 1.3);
    scene.add(red); scene.add(blue); fx.objs.push(red, blue); fx.red = red; fx.blue = blue;
    // el fuego del motor de la camioneta (luz naranja que tiembla) y su humo
    const p = { x: 34.4 - 0.85 * 2.4, z: 23.6 - 0.53 * 2.4 };
    const fire = new THREE.PointLight(0xff7a2a, 2.2, 11, 2); fire.position.set(p.x, 1.3, p.z);
    scene.add(fire); fx.objs.push(fire); fx.fire = fire;
    const tex = G.Road && G.Road.glowTex;
    const mk = (col, s, add, op) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex || null, color: col, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: op }));
      sp.material.toneMapped = false; sp.scale.set(s, s, 1); scene.add(sp); fx.objs.push(sp); return sp;
    };
    if (tex) {
      for (let i = 0; i < 3; i++) { const f = mk(0xff8a3a, 1.2, true, 0.9); f.position.set(p.x + (i - 1) * 0.3, 1.1 + i * 0.15, p.z); fx.sprites.push({ sp: f, s: 1.0 + i * 0.25, ph: i * 2.1 }); }
      for (let i = 0; i < 8; i++) { const s = mk(0x2a2622, 1.6, false, 0.0); s.position.set(p.x, 1.5, p.z); fx.smoke.push({ sp: s, t: i / 8 }); }
      // el destello de las luces del coche (en el suelo, a los lados)
      fx.redG = mk(0xff2010, 3.4, true, 0); fx.redG.position.copy(red.position);
      fx.blueG = mk(0x2040ff, 3.4, true, 0); fx.blueG.position.copy(blue.position);
    }
    // un faro que sigue encendido (la luz de la linterna, en modo faro), que tiembla de vez en cuando
    fx.head = { pos: { x: b.x + b.dx * 2.4, y: 0.62, z: b.z + b.dz * 2.4 }, dir: { x: b.dx, y: -0.015, z: b.dz }, right: { x: -b.dz, y: 0, z: b.dx },
      range: 30, outer: 0.42, vert: 0.42, power: 2.4, color: [1.0, 0.94, 0.82], bounce: 0.04, on: true };
    if (G.Flash && G.Flash.external) G.Flash.external(fx.head);
    return fx;
  }
  function stepWreck(dt) {
    const fx = wreck;
    if (!fx) return;
    fx.t += dt;
    const T = fx.t;
    // rojo y azul alternando (con el doble destello), cada vez más débiles no: siguen
    const ph = (T * 2.2) % 2, on = (ph % 1) < 0.18 || ((ph % 1) > 0.3 && (ph % 1) < 0.46);
    if (fx.red) { fx.red.intensity = ph < 1 && on ? 3.2 : 0; fx.blue.intensity = ph >= 1 && on ? 3.2 : 0; }
    if (fx.redG) { fx.redG.material.opacity = ph < 1 && on ? 0.8 : 0; fx.blueG.material.opacity = ph >= 1 && on ? 0.8 : 0; }
    if (fx.fire) fx.fire.intensity = 1.8 + Math.sin(T * 17) * 0.35 + Math.sin(T * 7.7) * 0.3 + (Math.random() - 0.5) * 0.3;
    for (const f of fx.sprites) { const q = 0.85 + 0.15 * Math.sin(T * 13 + f.ph); f.sp.scale.set(f.s * q, f.s * 1.3 * q, 1); }
    for (const s of fx.smoke) {
      s.t = (s.t + dt * 0.12) % 1;
      s.sp.position.y = 1.5 + s.t * 5; s.sp.position.x = 32.0 + s.t * 1.4;
      const sc = 1.2 + s.t * 3.4; s.sp.scale.set(sc, sc, 1);
      s.sp.material.opacity = 0.32 * Math.sin(Math.PI * s.t);
    }
    // el faro: alguna vez parpadea (el cable suelto)
    if (fx.head) { fx.head.power = Math.random() < 0.02 ? 0.4 : 2.4; }
  }
  function clearWreck() {
    if (!wreck) return;
    for (const o of wreck.objs) { if (o.parent) o.parent.remove(o); if (o.material && o.material.dispose) o.material.dispose(); }
    if (G.Flash && G.Flash.external) G.Flash.external(null);
    wreck = null;
  }

  // ---------- La cámara de las escenas (cuando no la lleva el juego) ----------
  // tomas: [t, ojo {x,y,z}, adónde mira {x,y,z}] (entre una y otra, suave)
  let shot = null;
  function camShot(keys) { shot = { keys, t: 0 }; if (G.Camera) G.Camera.held = true; }
  function stepShot(dt) {
    if (!shot || !G.StoryHost) return;
    const cam = G.StoryHost.camera;
    if (!cam) return;
    shot.t += dt;
    const K = shot.keys;
    let i = 0; while (i < K.length - 1 && K[i + 1][0] <= shot.t) i++;
    const a = K[i], b = K[Math.min(K.length - 1, i + 1)];
    const u = b === a ? 1 : Math.max(0, Math.min(1, (shot.t - a[0]) / (b[0] - a[0]))), e = u * u * (3 - 2 * u);
    const L = (p, q) => ({ x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e, z: p.z + (q.z - p.z) * e });
    const eye = L(a[1], b[1]), at = L(a[2], b[2]);
    // (un temblor de cámara en mano: está aturdido)
    const sw = Math.sin(shot.t * 1.3) * 0.03;
    cam.position.set(eye.x + sw, eye.y + Math.sin(shot.t * 0.9) * 0.02, eye.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(at.x, at.y, at.z);
    cam.rotateZ(Math.sin(shot.t * 0.7) * 0.03);
  }
  function endShot() { shot = null; if (G.Camera) G.Camera.held = false; }

  // ---------- El capítulo ----------
  let step = null, waitT = 0;
  // (al empezar una escena, la charla de fondo que estaba en cola se descarta: no se cuela entre las frases)
  const quiet = (on) => {
    if (G.NPCs) G.NPCs.quiet = on;
    const V = G.Humans && G.Humans.Voice;
    if (on && V && V.q) V.q = V.q.filter((it) => it.prio >= 3);
  };
  // los bloqueos del capítulo (los de siempre) y, durante una escena, todo (ni moverse ni tocar nada)
  let baseLocks = null;
  const lockAll = (on) => {
    if (!G.Input) return;
    if (on) { if (!(G.Input.locks && G.Input.locks.all)) baseLocks = G.Input.locks; G.Input.locks = Object.assign({}, baseLocks || {}, { all: true }); }
    else if (G.Input.locks && G.Input.locks.all) G.Input.locks = baseLocks;
  };
  // el forcejeo con el corredor: se puede pulsar Atacar (y el botón se ve)
  const qte = (on) => {
    if (!G.Input) return;
    if (on) { G.Input.locks = Object.assign({}, baseLocks || G.Input.locks || {}, { attack: false, all: false }); document.body.classList.add('st-qte'); if (G.Combat) G.Combat.peaceful = false; }
    else { document.body.classList.remove('st-qte'); if (G.Combat) G.Combat.peaceful = true; }
  };
  let propKey = null, propCar = null, board = null;
  // la calle: charlas, silencio entre una y otra, la espera si se para, el choque
  let road = null;
  // el cruce: el corredor y lo que dura el agarre
  let runner = null, grabT = 0, shotT = 0;
  const sceneOf = (player) => (player && player.model && player.model.root && player.model.root.parent) || null;
  const addProp = (p) => (G.Props ? G.Props.add(Object.assign({ kind: 'story', dispose() {} }, p)) : null);
  const dropProp = (p) => { if (p && G.Props) G.Props.remove(p); return null; };
  const host = () => G.StoryHost || null;

  // ---- en las escenas (todo bloqueado): Javier se pone frente a Alem y lo mira ----
  // Si Alem está quieto y lejos, se le acerca (a paso corto) hasta quedar a un par de metros; si Alem está haciendo
  // algo con las manos (levantar, lanzar, golpear, aguantar la puerta), solo lo mira. Alem, quieto, sin pose y
  // con la charla en marcha, también se gira hacia él. noFace (en el jugador): esta vez no (el avión)
  const FA_BUSY = { lift: 1, throw: 1, smash: 1, brace: 1, aimgun: 1 };
  function faceAlem(dt, p) {
    // (fuera de la escena, el paso de acercarse se suelta: el jugador vuelve a mandar)
    if (!G.Input || !G.Input.locks || !G.Input.locks.all) { if (p && p.auto && p.auto.fa) p.auto = null; return; }
    if (!p || p.dead || p.hidden || p.struggle || p.sitting || p.action || p.noFace || p.climb) return;
    if (G.Drive && G.Drive.active) return;
    if (p.auto && !p.auto.fa) return;          // (un camino de la escena: manda la escena)
    const a = npc('alem');
    if (!a || a.off || !a.model.root.visible) { if (p.auto) p.auto = null; return; }
    const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d > 10 || d < 0.05) { if (p.auto) p.auto = null; return; }
    const ang = Math.atan2(dx, dz), still = !a.walk || a.walk.done, busy = !!FA_BUSY[a.pose] || !!a.aimOn;
    if (p.auto) {
      // (si algo le corta el paso, se queda donde está)
      if (p.auto.done || !still || busy || d < 2.1 || (p.auto.t = (p.auto.t || 0) + dt) > 2.5) p.auto = null;
      else p.auto.face = ang;
    } else if (still && !busy && d > 3.0) {
      // hasta unos 2 m de él, por el lado donde ya está Javier (sin cruzarse por delante de nada)
      const k = (d - 1.9) / d;
      p.auto = { pts: [{ x: p.pos.x + dx * k, z: p.pos.z + dz * k }], i: 0, face: ang, done: false, fa: true };
    }
    const U = G.Util;
    if (!p.auto) p.facing = U.turnToward(p.facing, ang, dt * 3.5);
    if (scene && still && !a.pose && d < 5) a.facing = U.turnToward(a.facing, Math.atan2(-dx, -dz), dt * 3);
  }

  // ---- de la estación a la calle: a negro, la carga (se tira la estación entera) y la calle ----
  function toRoad(player) {
    const H = host();
    step = 'loadroad';
    if (!H) return;
    H.loading(() => {
      if (G.NPCs) G.NPCs.clear();
      H.map('vacio');
      player.hidden = true;
      if (G.Drive) G.Drive.toRoad({ camera: H.camera, z: 6, v: 6 });
      // mientras se conduce, las heridas de los dos se van pintando (no se les ve: van dentro)
      if (G.Wounds) { G.Wounds.prepare('javier', { side: 1, hands: 5, knees: 3 }); G.Wounds.prepare('alem', { side: -1, chest: 3, legs: 3 }); }
      if (G.CitySound) G.CitySound.start(1);
      quiet(true);
    }, () => {
      if (H.fadeTo) { H.fadeTo(1, 0); H.fadeTo(0, 1.6); }
      setObj('Ve a Pine con la Cuarta');
      if (G.Drive) G.Drive.hint(G.Input && G.Input.isTouch ? 'Volante a la izquierda · pedales a la derecha' : 'W / S: acelerar y frenar · A / D: girar', 6);
      road = { talk: 0, gap: 6, idle: 0, nudge: 0, armed: false };
      step = 'road';
    }, 3.2);
  }

  // ---- el choque: se corta la imagen; detrás del negro se arma el cruce ----
  function onCrash() {
    const H = host();
    if (H && H.fadeTo) H.fadeTo(1, 0);
    step = 'blackout'; waitT = 0.05;
    scene = null;
    hideObj();
  }
  function buildWreck(player) {
    const H = host();
    if (G.Drive) G.Drive.stop(true);
    if (G.CitySound) G.CitySound.level = 0.8;
    if (G.Wounds) G.Wounds.finish();
    // Javier, herido (la textura con la sangre); el cruce; Alem (herido, al otro lado del coche, aún no se le ve)
    if (G.Player && G.Player.STORY && G.Player.STORY.javier) G.Player.STORY.javier.opts.meshVar = 'herido';
    if (H) H.map('cruce_2020');
    player.rebuildModel();
    player.limp = 1;            // (cojea: el choque)
    // (el revólver se le cayó en el choque: se lo devuelve Alem)
    if (player.hands && player.hands[1]) { player.hands[1] = null; if (player.equip) player.equip(-1); if (player.refreshModel) player.refreshModel(); }
    if (G.NPCs && H) G.NPCs.setup('accidente', H.scene);
    wreck = wreckFx(H && H.scene);
    // (el cuerpo del corredor, ya armado: que no se trabe al aparecer)
    if (G.Zombie && G.Zombie.pool && G.Zombie.pool.need) { G.Zombie.pool.need({ z: 1 }); for (let i = 0; i < 20 && G.Zombie.pool.missing(); i++) G.Zombie.pool.step(40); }
    // la huida: los cuerpos y las escenas del camino (casi todo ahora, detrás del negro y del pitido; lo que falte,
    // mientras se despierta)
    if (G.Huida && H) { G.Huida.prepare(H.scene); G.Huida.prepStep(4000); }
    // Javier, boca abajo, medio fuera de la ventanilla del conductor
    const b = wreck.box;
    if (b) {
      const px = -b.dz, pz = b.dx;              // de lado al coche (hacia el sur)
      player.pos.x = b.x + px * 1.2; player.pos.z = b.z + pz * 1.2;
      player.facing = Math.atan2(px, pz);
      player.setStance('prone'); player.proneAmt = 1;
      player.auto = null; player.hidden = false; player.sitting = null;
      player.storySafe = true;
      wreck.crawlTo = { x: b.x + px * 2.75, z: b.z + pz * 2.75 };
      wreck.out = { x: px, z: pz };
    }
    lockAll(true);
    if (G.Combat) G.Combat.peaceful = true;
    // la primera toma: baja, desde la acera, con el coche volcado y Javier saliendo hacia la cámara
    if (b) {
      const px = -b.dz, pz = b.dx;
      const at = { x: b.x + px * 1.6, y: 0.35, z: b.z + pz * 1.6 };
      const eye = { x: b.x + px * 5.2 - b.dx * 2.6, y: 0.5, z: b.z + pz * 5.2 - b.dz * 2.6 };
      const eye2 = { x: b.x + px * 5.6 - b.dx * 2.2, y: 1.45, z: b.z + pz * 5.6 - b.dz * 2.2 };
      const at2 = { x: b.x + px * 2.8, y: 1.15, z: b.z + pz * 2.8 };
      camShot([[0, eye, at], [5.5, eye, { x: at.x + px * 1.0, y: 0.4, z: at.z + pz * 1.0 }], [8.5, eye2, at2]]);
    }
  }

  // ---- el corredor: aparece a la espalda de Javier, fuera de cuadro, y va a por él ----
  // detrás de Javier, a 3 m (la cámara va a 2,4 m: queda detrás del objetivo, fuera de lo que se ve), en el suelo libre
  function behindSpot(player) {
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    let p = null;
    for (let d = 3.0; d <= 6; d += 0.4) {
      p = { x: player.pos.x - fx * d, z: player.pos.z - fz * d };
      if (!G.World || !G.World.circleBlocked || !G.World.circleBlocked(p.x, p.z, 0.3, player.lv || 0)) break;
    }
    return p;
  }
  function spawnRunner(player) {
    const H = host();
    if (!H || !G.Zombie) return null;
    // siempre detrás de Javier, fuera de la cámara (que va unos 2,4 m detrás de él) y lo más cerca posible
    const p = behindSpot(player);
    const zz = new G.Zombie(H.scene, p.x, p.z, null, Math.atan2(player.pos.x - p.x, player.pos.z - p.z), { lv: 0, hunter: true });
    zz.quick = true;                       // (más rápido que un corredor normal y ataca sin apenas preparar el salto)
    zz.state = 'chase'; zz.target = { x: player.pos.x, z: player.pos.z, lv: 0 }; zz.lastSeen = 0; zz.screamed = true;
    if (G.Population) G.Population.list.push(zz);
    if (G.Audio) G.Audio.play('zAlert', { x: p.x, z: p.z, lv: 0, vol: 1.2 });
    if (G.Music && G.Music.hold) G.Music.hold(14);
    return zz;
  }
  // Alem dispara: a la cabeza del corredor (que se suelta: el agarre termina solo)
  function alemShoots(player) {
    const a = npc('alem'), z = runner;
    if (!z || !z.alive) return;
    let mz = null;
    if (a && a.model) {
      a.model.root.updateMatrixWorld(true);
      if (a.model.handR) { mz = new THREE.Vector3(); a.model.handR.getWorldPosition(mz); mz.x += Math.sin(a.facing) * 0.25; mz.z += Math.cos(a.facing) * 0.25; }
    }
    if (a) a.recoil = 1;
    if (mz && G.Humans && G.Humans.flash) G.Humans.flash(mz, 1.1);
    if (G.Audio) G.Audio.play('pistol', { x: a ? a.pos.x : player.pos.x, z: a ? a.pos.z : player.pos.z, lv: 0 });
    const dx = z.pos.x - (a ? a.pos.x : player.pos.x), dz = z.pos.z - (a ? a.pos.z : player.pos.z);
    let hp = null;
    if (z.model && z.model.head) { hp = new THREE.Vector3(); z.model.head.getWorldPosition(hp); }
    z.takeHit(999, 0.4, dx, dz, false, 1, 'shot', 'head', { w: 'rifle', foe: true });
    if (G.Guns && G.Guns.burst) G.Guns.burst(hp || new THREE.Vector3(z.pos.x, (z.y || 0) + 1.6, z.pos.z), new THREE.Vector3(dx, 0, dz).normalize(), true, 9);
    if (G.Camera && G.Camera.shake) G.Camera.shake(0.35);
  }

  // ---------- Los puntos de control (se guardan en este navegador) ----------
  const SAVE_KEY = 'ceniza.historia';
  let lastCp = 0, cpPrepared = 0;
  function saveCp(n) {
    lastCp = n;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ch: 'prologo', cp: n, t: Date.now() })); } catch (e) { /* sin guardado */ }
    const H = host();
    if (H && H.toast) H.toast('Punto de control', 'info');
  }
  function readSave() { try { const t = localStorage.getItem(SAVE_KEY); const o = t ? JSON.parse(t) : null; return o && o.v === 1 && o.cp ? o : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ } }

  // ---------- Lo que usan G.Huida y G.RoadLife (la segunda parte) ----------
  const kit = {
    play: (list, done) => play(list, done),
    talking: () => !!scene,
    say(who, text) { const V = G.Humans && G.Humans.Voice; if (V) V.say(spk(who), text, { prio: 3, force: true }); },
    setObj: (t, l) => setObj(t, l), objDone: () => objDone(), hideObj: () => hideObj(),
    camShot: (k) => camShot(k), endShot: () => endShot(),
    npc: (k) => npc(k), spk: (k) => spk(k),
    lockAll: (on) => lockAll(on), quiet: (on) => quiet(on),
    host: () => host(),
    addProp: (p) => addProp(p), dropProp: (p) => dropProp(p),
    checkpoint: (n) => saveCp(n),
    // el prólogo, terminado: se borra el punto de control y al menú principal
    finish() { clearSave(); lastCp = 0; const H = host(); if (H && H.toMenu) H.toMenu(); }
  };

  const Story = {
    get step() { return step; },
    get cp() { return lastCp; },
    saved: () => readSave(),
    clearSave: () => clearSave(),
    // lo pesado de empezar desde un punto de control (la partida lo llama detrás de la pantalla de carga, con el mapa
    // ya puesto): Javier y Alem heridos, Alem, las luces del choque, la huida preparada (o, en el 3, la calle)
    prepareCp(cp, player) {
      this.clear();
      pl = player; lastCp = cp; cpPrepared = cp;
      const H = host();
      if (G.Wounds) { G.Wounds.prepare('javier', { side: 1, hands: 5, knees: 3 }); G.Wounds.prepare('alem', { side: -1, chest: 3, legs: 3 }); G.Wounds.finish(); }
      if (G.Player && G.Player.STORY && G.Player.STORY.javier) G.Player.STORY.javier.opts.meshVar = 'herido';
      if (player.rebuildModel) player.rebuildModel();
      player.limp = cp < 3 ? 1 : 0;
      if (cp < 3 && G.NPCs && H) G.NPCs.setup('accidente', H.scene);
      if (cp === 1 && H) wreck = wreckFx(H.scene);
      if (G.CitySound) G.CitySound.start(cp === 3 ? 1.2 : 1);
      if (G.Combat) G.Combat.peaceful = true;
      if (G.Huida) G.Huida.prepareCp(cp, player, kit);
    },
    // al cargar el capítulo (antes de la pantalla negra): lo que hay para usar en el mapa
    setup(ch, player) { addSeats(ch, player); },
    begin(ch, player, cp) {
      // desde un punto de control (ya preparado): a la huida
      if (cp && cpPrepared === cp && ch === 'prologo' && player) {
        pl = player; step = 'p2'; cpPrepared = 0;
        quiet(true);
        if (G.Huida) G.Huida.resume(cp, player, kit);
        return;
      }
      this.clear();
      if (ch !== 'prologo' || !player) return;
      pl = player; lastCp = 0;
      step = 'call'; waitT = 1.6;
      quiet(true);
    },
    clear() {
      step = null; scene = null; waitT = 0; board = null; road = null; runner = null; grabT = 0; shotT = 0;
      hideObj();
      quiet(false);
      dropKey(keyAlem); dropKey(keyJav); keyAlem = keyJav = null; keyJavT = 0;
      propKey = dropProp(propKey); propCar = dropProp(propCar);
      clearDoors(); clearWreck(); shot = null;
      if (G.Huida) G.Huida.clear();
      if (G.Daze && G.Daze.hold) G.Daze.hold(0);
      document.body.classList.remove('st-qte', 'driving');
      if (G.Drive && G.Drive.active) G.Drive.stop(true);
      if (G.CitySound) G.CitySound.stop();
      if (G.Input && G.Input.locks && G.Input.locks.all) G.Input.locks = baseLocks;
      baseLocks = null;
      // (Javier vuelve a estar entero: la próxima vez que se juegue el prólogo, sin sangre)
      if (G.Player && G.Player.STORY && G.Player.STORY.javier && G.Player.STORY.javier.opts.meshVar) {
        delete G.Player.STORY.javier.opts.meshVar;
        if (pl && pl.charId === 'javier' && pl.rebuildModel) pl.rebuildModel();
      }
      if (pl) { pl.hidden = false; pl.auto = null; pl.storyPose = null; pl.storySafe = false; pl.limp = 0; pl.noFace = false; }
      pl = null;
    },
    update(dt, player) {
      if (!step || !player) return;
      if (boxT > 0) { boxT -= dt; if (boxT <= 0 && box && box.classList.contains('done')) hideObj(); }
      stepDoors(dt);
      // (la estación de 2020: a pie no se sale fuera; el portón del garaje solo se cruza con el patrullero)
      if (G.World.layout === 'comisaria_2020' && !player.hidden && !(G.Drive && G.Drive.active)) {
        if (player.pos.x > 59.62 && player.pos.z < 15) player.pos.x = 59.62;
        if (player.pos.z > 61.62) player.pos.z = 61.62;
      }
      stepWreck(dt);
      stepShot(dt);
      if (G.CitySound) G.CitySound.update(dt);
      if (keyJav && (keyJavT -= dt) <= 0) { dropKey(keyJav); keyJav = null; }
      // el coche volcado aparta a todos (menos a Javier mientras sale de debajo)
      if (wreck && wreck.box) {
        if (step !== 'wake' && step !== 'crawl') pushOutWreck(player.pos, 0.3);
        if (runner && runner.alive) pushOutWreck(runner.pos, 0.3);
        const a = npc('alem'); if (a && !a.off) pushOutWreck(a.pos, 0.3);
      }
      // ---- por la calle (también mientras hablan): las heridas, la espera, el choque ----
      if (step === 'road' && road) {
        if (G.Wounds) G.Wounds.step(2.5);
        const D = G.Drive, c = D && D.car;
        if (c) {
          if (D.speed < 1) road.idle += dt; else road.idle = 0;
          if (road.idle > 22 && !scene) { road.idle = 0; play([['alem', NUDGE[road.nudge++ % NUDGE.length]]]); }
          // las charlas, una detrás de otra (con su silencio entre medias)
          if (!scene && road.talk < ROAD.length) { road.gap -= dt; if (road.gap <= 0) play(ROAD[road.talk++], () => { road.gap = 6 + Math.random() * 4; }); }
          // dicho todo y unos cuantos cientos de metros después: el cruce del choque
          if (!road.armed && road.talk >= ROAD.length && !scene && c.z > 420) {
            road.armed = true;
            const nc = G.Road.nextCross(c.z, 75);
            play(PRE_CRASH);
            D.armCrash(nc.z, () => {
              const V = G.Humans && G.Humans.Voice;
              if (V) { V.clear(); V.say(spk('alem'), '¡JAVIER, CUIDADO!', { prio: 4, force: true }); }
              scene = null;
            }, () => onCrash());
          }
        }
      }
      faceAlem(dt, player);
      // la huida: las frases van a la vez que todo lo demás (se corre mientras se habla)
      if (step === 'p2') { if (scene) stepScene(dt, player); if (G.Huida) G.Huida.update(dt, player); return; }
      // (mientras se despierta y habla con Alem: se van armando los cuerpos de la huida)
      if (G.Huida && !G.Huida.prepared && (step === 'wake' || step === 'crawl0' || step === 'crawl' || step === 'standing' || step === 'calling2' || step === 'ending')) G.Huida.prepStep(6);
      if (scene) { stepScene(dt, player); return; }
      if (waitT > 0) { waitT -= dt; return; }
      const alem = npc('alem');
      if (step === 'call') {
        // (aquí irá la cinemática: Javier en su despacho, suena el teléfono)
        step = 'calling';
        play(CALL, () => { quiet(false); setObj('Ve a la oficina del jefe'); step = 'go'; });
      } else if (step === 'go') {
        if (inRect(player.pos, OFFICE)) {
          objDone(); quiet(true); step = 'talk';
          play(TALK, () => { step = 'pa'; waitT = 1.0; }, spk('jefe'));
        }
      } else if (step === 'pa') {
        step = 'announce';
        play(PA, () => play(AFTER, () => {
          const j = npc('jefe'); if (j) j.pose = 'desk';
          quiet(false); setObj('Ve al garaje'); step = 'garage';
        }));
      } else if (step === 'garage') {
        // al entrar en el garaje: a negro y la cinemática
        if (inRect(player.pos, GARAGE)) {
          objDone(); quiet(true); lockAll(true);
          if (player.sitting) player.standUp();
          if (G.fadeTo) G.fadeTo(1, 0.7);
          step = 'cine'; waitT = 0.85;
        }
      } else if (step === 'cine') {
        step = 'cineplay';
        // (sin video: en el garaje, con la pantalla a negro, Javier dice su frase y la pantalla se aclara.
        // Los dos ya donde los deja la escena, Alem con las llaves en la mano)
        const a = AFTER_CINE;
        player.pos.x = a.jav.x; player.pos.z = a.jav.z; player.facing = a.jav.face; player.vel.x = player.vel.z = 0;
        if (G.Camera && G.Camera.yaw != null) G.Camera.yaw = a.jav.face;
        if (alem) { alem.place(a.alem.x, a.alem.z, a.alem.face, 'offer'); dropKey(keyAlem); keyAlem = handKey(alem.model); }
        if (G.fadeTo) G.fadeTo(0, 1.1);
        play([[CINE.who, CINE.text]], () => {
          step = 'keys0'; waitT = 1.0;
        });
      } else if (step === 'keys0') {
        lockAll(false);
        step = 'keys';
        play(KEYS, () => {
          quiet(false);
          setObj('Coge las llaves');
          // las llaves, en la mano tendida de Alem: con el botón de interactuar
          propKey = addProp({ x: AFTER_CINE.alem.x, z: AFTER_CINE.alem.z, label: 'Coger las llaves', reach: 1.9, off: () => step !== 'keys',
            use: (p) => { Story.takeKeys(p); return null; } });
        }, spk('alem'));
      } else if (step === 'keys1') {
        // la mano de Javier llega a las llaves: pasan a la suya (un momento; luego al bolsillo)
        dropKey(keyAlem); keyAlem = null;
        dropKey(keyJav); keyJav = handKey(player.model); keyJavT = 1.6;
        if (G.Audio) G.Audio.play('pickup');
        if (alem) alem.pose = null;
        step = 'keys2'; waitT = 0.7;
      } else if (step === 'keys2') {
        if (alem) alem.pose = 'talk';
        quiet(true); step = 'drive';
        play(DRIVE, () => {
          if (alem) alem.pose = null;
          quiet(false); setObj('Sube al patrullero'); step = 'board';
          propCar = addProp({ x: CAR_AT.x, z: CAR_AT.z, fx: CAR_AT.x + 2.6, fz: CAR_AT.z, label: 'Subir al patrullero', reach: 3.4, off: () => step !== 'board',
            use: (p) => { Story.boardCar(p); return null; } });
        }, spk('alem'));
      } else if (step === 'boarding') {
        // los dos, cada uno a su puerta; al llegar (o si alguno se atasca), las abren y se meten
        const b = board;
        b.t += dt;
        const ok = (player.auto && player.auto.done) && (!alem || (alem.walk && alem.walk.done));
        if (b.phase === 0 && (ok || b.t > 9)) {
          for (const k of ['jav', 'alem']) {
            const D = DOORS[k];
            if (k === 'jav') { player.auto = null; player.pos.x = D.x; player.pos.z = D.z; player.facing = D.face; }
            else if (alem) { alem.walk = null; alem.pos.x = D.x; alem.pos.z = D.z; alem.facing = D.face; }
          }
          if (doors) { doors.jav.to = 1; doors.alem.to = 1; }
          if (G.Audio) { G.Audio.play('doorOpen', { x: DOORS.jav.x, z: DOORS.jav.z, lv: 0, vol: 0.7 }); G.Audio.play('doorOpen', { x: DOORS.alem.x, z: DOORS.alem.z, lv: 0, vol: 0.6 }); }
          b.phase = 1; b.t = 0;
        } else if (b.phase === 1 && b.t > 0.55) {
          // se meten: ya no se les ve (Javier, sentado al volante: quieto y sin que nada lo empuje fuera)
          player.hidden = true;
          player.sitting = { x: DOORS.jav.seat.x, z: DOORS.jav.seat.z, face: Math.PI / 2, t: 0, k: 1 };
          document.body.classList.add('driving');          // (dentro del coche: fuera el HUD de siempre)
          // la cámara, fija desde fuera del coche (si no, seguía a Javier metido en el asiento y se quedaba trabada dentro)
          camShot([[0, { x: 48.4, y: 1.6, z: 13.6 }, { x: DOORS.jav.seat.x, y: 1.0, z: 10.4 }]]);
          if (alem) { alem.place(DOORS.alem.seat.x, DOORS.alem.seat.z, Math.PI / 2, null); alem.hide(); }
          b.phase = 2; b.t = 0;
        } else if (b.phase === 2 && b.t > 0.35) {
          if (doors) { doors.jav.to = 0; doors.alem.to = 0; }
          b.phase = 3; b.t = 0;
        } else if (b.phase === 3 && b.t > 0.42) {
          if (G.Audio) { G.Audio.play('doorClose', { x: DOORS.jav.x, z: DOORS.jav.z, lv: 0 }); G.Audio.play('doorClose', { x: DOORS.alem.x, z: DOORS.alem.z, lv: 0, vol: 0.8 }); }
          step = 'incar'; waitT = 1.2; quiet(true);
        }
      } else if (step === 'incar') {
        step = 'talkcar';
        play(CAR, () => { step = 'ignite'; waitT = 0.4; });
      } else if (step === 'ignite') {
        // arranca: el patrullero aparcado se cambia por el que se conduce; a sacarlo por el portón
        clearDoors();
        endShot();
        const H = host();
        if (G.Drive && H) {
          G.Drive.garage({ scene: H.scene, camera: H.camera, x: CAR_AT.x, z: CAR_AT.z, h: Math.PI / 2, onExit: () => {
            objDone(); G.Drive.frozen = true;
            if (H.fadeTo) H.fadeTo(1, 1.1);
            step = 'exiting'; waitT = 1.25;
          } });
          setObj('Saca el patrullero del garaje');
          G.Drive.hint(G.Input && G.Input.isTouch ? 'Acelera y gira con el volante: sal por el portón' : 'W / S: acelerar y frenar · A / D: girar · sal por el portón', 7);
        }
        quiet(false);
        step = 'drivegarage';
      } else if (step === 'exiting') {
        toRoad(player);
      } else if (step === 'blackout') {
        // detrás del negro (y del pitido): el cruce, Javier herido, las luces del coche volcado
        buildWreck(player);
        step = 'wake'; waitT = 2.4;
      } else if (step === 'wake') {
        // se va aclarando, borroso; Javier, todavía en el suelo
        const H = host();
        if (H && H.fadeTo) H.fadeTo(0, 3.2);
        if (G.Daze) { G.Daze.start(1); if (G.Daze.hold) G.Daze.hold(0.6); }      // (y así sigue, desfasado, hasta el agarre)
        quiet(true);
        step = 'crawl0'; waitT = 1.6;
        play(WAKE);
      } else if (step === 'crawl0') {
        // sale a rastras
        if (wreck && wreck.crawlTo) player.auto = { pts: [wreck.crawlTo], i: 0, face: Math.atan2(wreck.out.x, wreck.out.z), done: false };
        step = 'crawl';
      } else if (step === 'crawl') {
        if (!player.auto || player.auto.done || (shot && shot.t > 9)) {
          player.auto = null;
          // y se levanta, con la mano en la cabeza
          player.setStance('stand');
          player.storyPose = 'hurt';
          if (G.Daze) G.Daze.start(0.6);
          step = 'standing'; waitT = 1.6;
        }
      } else if (step === 'standing') {
        // la cámara vuelve a ir detrás de él; ya se puede mover (despacio: está herido)
        player.facing = Math.PI / 2 * 0.85;
        endShot();
        if (G.Camera) { G.Camera.yaw = player.facing; G.Camera.pitch = 0.12; }
        lockAll(false);
        step = 'calling2';
        play(UP, () => { step = 'runner0'; waitT = 0.6; });
      } else if (step === 'runner0') {
        runner = spawnRunner(player);
        step = 'runner'; grabT = 0;
        play([['jav', '¿Señor? ¡Alto! ¡Policía! ¡Quieto ahí!']]);
      } else if (step === 'runner') {
        grabT += dt;
        if (!runner || !runner.alive) { step = 'after'; waitT = 0.8; return; }
        // si se traba por el camino, más cerca
        if (grabT > 14) { const p = behindSpot(player); runner.pos.x = p.x; runner.pos.z = p.z; grabT = 8; }
        const d = Math.hypot(runner.pos.x - player.pos.x, runner.pos.z - player.pos.z);
        if (d < 2.3 && G.Combat && G.Combat.startStruggle) {
          // se le echa encima: el agarre (más largo que el normal: no se lo quita de encima él solo)
          qte(true);
          if (G.Daze && G.Daze.hold) G.Daze.hold(0);
          player.storyPose = null;
          G.Combat.startStruggle(player, runner, false);
          const st = player.struggle;
          // el agarre no se gana: por mucho que pulses, no se suelta (solo cuando Alem le dispara)
          if (st) { st.dur = 1e9; st.need = 14; st.n = 5; st.hold = true; }
          if (G.Music && G.Music.hold) G.Music.hold(12);
          const H = host();
          if (H && H.toast) H.toast(G.Input && G.Input.isTouch ? '¡Pulsa Atacar sin parar!' : '¡Pulsa Atacar sin parar (clic)!', 'bad');
          step = 'grab'; grabT = 0;
        }
      } else if (step === 'grab') {
        grabT += dt;
        const st = player.struggle;
        if (st) {
          // el corredor empuja (el anillo se vacía si no pulsas); por mucho que pulses, no se suelta
          st.n = Math.max(0, Math.min(st.need - 0.6, st.n - dt * 1.9));
        }
        // cuando Javier está a punto de no poder más (o ya lleva un rato), Alem
        if (grabT > 2.2 && ((st && st.n < 0.7) || grabT > 7.5)) {
          const a = npc('alem');
          if (a && runner) {
            // aparece rodeando el coche, ya apuntando: de lado a los dos (que la bala no pase por Javier), a unos
            // 3,5 m del corredor y del lado del coche volcado
            const vx = runner.pos.x - player.pos.x, vz = runner.pos.z - player.pos.z, vl = Math.hypot(vx, vz) || 1;
            const nx = -vz / vl, nz = vx / vl, b = wreck && wreck.box;
            const c1 = { x: runner.pos.x + nx * 3.5, z: runner.pos.z + nz * 3.5 }, c2 = { x: runner.pos.x - nx * 3.5, z: runner.pos.z - nz * 3.5 };
            const near = (q) => (b ? Math.hypot(q.x - b.x, q.z - b.z) : 0);
            const at = near(c1) < near(c2) ? c1 : c2;
            pushOutWreck(at, 0.35);
            a.place(at.x, at.z, Math.atan2(runner.pos.x - at.x, runner.pos.z - at.z), null);
            // (ya apuntando: las mismas animaciones que Javier con la pistola)
            if (a.setGun) { a.setGun(true); a.aimOn = true; a.gAim = 1; } else G.Models.setWeapon(a.model, 'pistola');
          }
          step = 'aim'; shotT = 0.55;
        }
      } else if (step === 'aim') {
        const a = npc('alem');
        if (a && runner) a.facing = Math.atan2(runner.pos.x - a.pos.x, runner.pos.z - a.pos.z);
        shotT -= dt;
        if (shotT <= 0) {
          alemShoots(player);
          qte(false); lockAll(true);
          step = 'after'; waitT = 1.3;
        }
      } else if (step === 'after') {
        // Alem baja la pistola y va hacia Javier (cojeando)
        const a = npc('alem');
        player.storyPose = 'stomach';          // (dolorido: las manos en el estómago)
        if (G.Daze && G.Daze.hold) G.Daze.hold(0);
        if (a) {
          a.pose = null;
          if (a.setGun) a.setGun(false);         // (baja la pistola y la guarda mientras va hacia Javier)
          const tx = player.pos.x + Math.sin(player.facing) * 1.3, tz = player.pos.z + Math.cos(player.facing) * 1.3;
          a.walkTo([[tx, tz]], Math.atan2(player.pos.x - tx, player.pos.z - tz));
        }
        step = 'ending';
        play(ENDING, () => {
          // la segunda parte: el revólver y la huida
          step = 'p2';
          if (G.Huida) G.Huida.start(player, kit);
        });
      }
    },
    // (pruebas: saltar a un paso del capítulo, como el choque)
    jump(st, player) { if (player) pl = player; step = st; waitT = 0; scene = null; },
    // coger las llaves de la mano de Alem: la mano de Javier va hasta ellas y se quedan en la suya un momento
    takeKeys(p) {
      if (step !== 'keys' || p.busy()) return;
      let at = { x: AFTER_CINE.alem.x, y: 1.25, z: AFTER_CINE.alem.z };
      if (keyAlem) { const v = new THREE.Vector3(); keyAlem.getWorldPosition(v); at = { x: v.x, y: v.y, z: v.z }; }
      // (un paso hacia las llaves si quedan lejos: la mano tiene que llegar)
      const far = Math.hypot(at.x - p.pos.x, at.z - p.pos.z) - 0.55;
      p.action = { kind: 'pickupHi', t: 0, dur: 0.55, impact: 0.45, face: Math.atan2(at.x - p.pos.x, at.z - p.pos.z), item: at, done: false,
        step: far > 0.05 ? { len: Math.min(1.0, far), done: 0 } : null };
      step = 'keys1'; waitT = 0.28;          // (cuando la mano llega: ver update)
      objDone();
      propKey = dropProp(propKey);
    },
    // subir al patrullero: cada uno a su puerta (Javier, al volante: por delante del coche si está al otro lado)
    boardCar(p) {
      if (step !== 'board') return;
      const alem = npc('alem');
      objDone(); quiet(true); lockAll(true);
      propCar = dropProp(propCar);
      if (p.sitting) p.standUp();
      const D = DOORS.jav, front = CAR_AT.x + 4.6 / 2 + 0.8, rear = CAR_AT.x - 4.6 / 2 - 0.5;
      const pts = [];
      if (p.pos.z > CAR_AT.z) {
        // (al otro lado: rodea el coche; por detrás si está más cerca de la cola (entre el patrullero y el coche
        // del taller), si no por delante, entre el morro y el portón)
        const x = p.pos.x < CAR_AT.x ? rear : front;
        pts.push({ x, z: Math.max(p.pos.z, CAR_AT.z + HALF_W + 0.6) });
        pts.push({ x, z: D.z });
      }
      pts.push({ x: D.x, z: D.z });
      p.auto = { pts, i: 0, face: D.face, done: false };
      if (alem) alem.walkTo([[DOORS.alem.x, DOORS.alem.z]], DOORS.alem.face);
      if (!doors) doors = makeDoors(sceneOf(p));
      board = { t: 0, phase: 0 };
      step = 'boarding';
    }
  };
  G.Story = Story;
})(window.Game = window.Game || {});
