(function (G) {
  'use strict';

  // Suplementos: cada personaje tiene sus propias mejoras (su «árbol»), que se compran con los suplementos (las
  // pastillas) que se consiguen en la carrera. Son complementos pequeños, nunca algo que rompa el juego. Lo
  // aprendido dura toda la carrera (como las mejoras de las armas) y se guarda con ella (G.Run).
  //
  // Cada rama tiene uno o varios niveles; cada nivel cuesta lo suyo y da el valor total de la rama hasta ahí
  // (val: el total con ese nivel, no lo que suma). key: dónde se aplica en el juego (ver bonus()):
  //   vit      menos daño recibido (más vitalidad), en tanto por uno
  //   heal     vendarse más rápido
  //   bandage  vida de más que cura cada venda
  //   reload   recargar más rápido (tanto por uno menos de tiempo)
  //   aim      apuntar más rápido (sube antes la mira)
  //   recoil   menos retroceso
  //   melee    más daño cuerpo a cuerpo
  //   dodge    esquiva más larga
  //   exec     remates más rápidos
  //   stealth  cuesta más verte agachada o en la hierba
  //   impulse  impulso: tras matar en carrera, el siguiente golpe es un remate (1 = sí)
  //   minaSave probabilidad de no gastar clavos al fabricar una mina
  //   humoSave probabilidad de no gastar trapo al fabricar una bomba de humo
  //   molSave  probabilidad de no gastar trapo al fabricar una molotov
  //   smoke    la nube de humo aturde más tiempo
  //   listenR  escuchar: metros de más de alcance
  //   listenSpd escuchar: caminar agachada más rápido (lo que se suma a 0,6)
  //   flame    el lanzallamas quema más
  const IC = {
    heal: '<path d="M9 4 H15 V9 H20 V15 H15 V20 H9 V15 H4 V9 H9 Z"/>',
    vit: '<path d="M12 20 Q4 14 4 9 Q4 5 8 5 Q11 5 12 8 Q13 5 16 5 Q20 5 20 9 Q20 14 12 20 Z"/>',
    reload: '<path d="M8 6 L8 18 M12 6 L12 18 M16 6 L16 18 M7 6 Q8 3 9 6 M11 6 Q12 3 13 6 M15 6 Q16 3 17 6"/>',
    aim: '<circle cx="12" cy="12" r="6"/><path d="M12 3 V8 M12 16 V21 M3 12 H8 M16 12 H21"/>',
    recoil: '<path d="M4 10 H16 L18 8 H20 V12 H11 L9 17 H6 L7 12 H4 Z M20 4 L22 2 M20 16 L22 18"/>',
    melee: '<path d="M7 12 Q7 7 11 7 H16 Q18 7 18 9 V13 Q18 17 14 17 H10 Q7 17 7 14 Z M11 7 V11 M14 7 V11"/>',
    dodge: '<circle cx="14" cy="5" r="2"/><path d="M13 8 L10 13 L14 16 L13 21 M10 13 L6 16 M13 9 L17 12 M3 9 H7 M2 13 H6"/>',
    exec: '<path d="M5 19 L15 9 M13 7 L17 3 L21 7 L17 11 Z M8 12 L12 16"/>',
    stealth: '<path d="M4 16 Q8 10 12 10 Q16 10 20 16 M9 18 L9 21 M15 18 L15 21 M12 18 L12 22"/><circle cx="12" cy="6" r="2"/>',
    impulse: '<circle cx="9" cy="5" r="2"/><path d="M8 8 L6 13 L10 16 L9 21 M6 13 L3 16 M8 9 L12 11"/><path d="M15 10 L21 10 L19 8 M21 10 L19 12 M14 15 L20 15"/>',
    mina: '<path d="M5 15 Q5 10 12 10 Q19 10 19 15 Z M4 17 H20 M12 10 V6 M10 5 L14 5"/>',
    humo: '<path d="M6 17 Q3 17 3 14 Q3 11 6 11 Q6 7 10 7 Q13 5 16 8 Q20 8 20 12 Q22 14 20 17 Z"/>',
    molotov: '<path d="M10 9 H14 L15 12 V20 H9 V12 Z M11 9 V6 H13 V9 M12 4 Q14 2 13 1"/>',
    bandage: '<path d="M5 9 L15 19 M9 5 L19 15 M5 9 Q3 7 5 5 Q7 3 9 5 M15 19 Q17 21 19 19 Q21 17 19 15"/>',
    ear: '<path d="M8 17 Q6 15 7 11 Q8 6 12 6 Q16 6 17 10 Q17 13 15 14 Q13 15 13 17 Q13 20 11 20 Q9 20 8 18"/><path d="M19 7 Q21 10 19 13"/>',
    step: '<path d="M8 4 Q11 4 11 8 Q11 12 9 13 Q7 13 6 10 Q6 4 8 4 Z M15 11 Q18 11 18 15 Q18 19 16 20 Q14 20 13 17 Q13 11 15 11 Z"/>',
    flame: '<path d="M12 21 Q6 19 6 14 Q6 9 11 4 Q11 9 14 10 Q16 7 16 7 Q19 11 18 15 Q17 20 12 21 Z"/>'
  };

  // valores pequeños: cada mejora se nota, pero ninguna cambia el juego por sí sola
  const lv = (cost, val, txt) => ({ cost, val, txt });
  const TREES = {
    diarco: { name: 'Instinto de pelea', branches: [
      { id: 'd_heal', key: 'heal', ic: 'heal', name: 'Curación rápida', desc: 'Te vendas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al vendarte'), lv(60, 0.2, '+20 % de velocidad al vendarte')] },
      { id: 'd_reload', key: 'reload', ic: 'reload', name: 'Recarga rápida', desc: 'Recargas las armas de fuego más rápido.', levels: [lv(35, 0.08, '−8 % de tiempo de recarga'), lv(60, 0.15, '−15 % de tiempo de recarga')] },
      { id: 'd_aim', key: 'aim', ic: 'aim', name: 'Apuntado rápido', desc: 'La mira llega antes al apuntar.', levels: [lv(35, 0.15, '+15 % de velocidad al apuntar'), lv(60, 0.3, '+30 % de velocidad al apuntar')] },
      { id: 'd_impulse', key: 'impulse', ic: 'impulse', name: 'Impulso', desc: 'Si matas a un enemigo con un ataque en carrera, el siguiente infectado que golpees (en los 6 s siguientes) recibe un remate directo. No se acumula.', levels: [lv(70, 1, 'Remate directo tras matar en carrera')] },
      { id: 'd_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(40, 0.05, '+5 % de vitalidad'), lv(70, 0.1, '+10 % de vitalidad')] },
      { id: 'd_mina', key: 'minaSave', ic: 'mina', name: 'Minas baratas', desc: 'Al fabricar una mina, a veces no gastas los clavos.', levels: [lv(45, 0.5, 'La mitad de las veces no gasta clavos')] }
    ] },
    vera: { name: 'Tácticas de campo', branches: [
      { id: 'v_ear', key: 'listenR', ic: 'ear', name: 'Oído fino', desc: 'Escuchar llega más lejos.', levels: [lv(35, 6, '+6 m de alcance al escuchar'), lv(60, 12, '+12 m de alcance al escuchar')] },
      { id: 'v_step', key: 'listenSpd', ic: 'step', name: 'Paso sigiloso', desc: 'Escuchando caminas agachada un poco más rápido.', levels: [lv(35, 0.12, '+12 % de velocidad escuchando'), lv(55, 0.24, '+24 % de velocidad escuchando')] },
      { id: 'v_recoil', key: 'recoil', ic: 'recoil', name: 'Pulso firme', desc: 'Las armas retroceden menos al disparar.', levels: [lv(40, 0.1, '−10 % de retroceso'), lv(65, 0.2, '−20 % de retroceso')] },
      { id: 'v_reload', key: 'reload', ic: 'reload', name: 'Recarga rápida', desc: 'Recargas las armas de fuego más rápido.', levels: [lv(35, 0.08, '−8 % de tiempo de recarga'), lv(60, 0.15, '−15 % de tiempo de recarga')] },
      { id: 'v_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(40, 0.05, '+5 % de vitalidad'), lv(70, 0.1, '+10 % de vitalidad')] },
      { id: 'v_band', key: 'bandage', ic: 'bandage', name: 'Botiquín', desc: 'Cada venda te cura un poco más.', levels: [lv(35, 5, '+5 de vida por venda'), lv(60, 10, '+10 de vida por venda')] }
    ] },
    tomas: { name: 'Oficio de mecánico', branches: [
      { id: 't_humo', key: 'humoSave', ic: 'humo', name: 'Manos de mecánico', desc: 'Al fabricar una bomba de humo, a veces no gastas el trapo.', levels: [lv(40, 0.33, '1 de cada 3 no gasta trapo')] },
      { id: 't_smoke', key: 'smoke', ic: 'humo', name: 'Humo denso', desc: 'Tus bombas de humo aturden más tiempo.', levels: [lv(35, 0.2, '+20 % de aturdimiento'), lv(60, 0.4, '+40 % de aturdimiento')] },
      { id: 't_melee', key: 'melee', ic: 'melee', name: 'Golpe duro', desc: 'Más daño cuerpo a cuerpo.', levels: [lv(35, 0.08, '+8 % de daño cuerpo a cuerpo'), lv(60, 0.15, '+15 % de daño cuerpo a cuerpo')] },
      { id: 't_reload', key: 'reload', ic: 'reload', name: 'Recarga rápida', desc: 'Recargas las armas de fuego más rápido.', levels: [lv(35, 0.08, '−8 % de tiempo de recarga'), lv(60, 0.15, '−15 % de tiempo de recarga')] },
      { id: 't_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(40, 0.06, '+6 % de vitalidad'), lv(70, 0.12, '+12 % de vitalidad')] },
      { id: 't_heal', key: 'heal', ic: 'heal', name: 'Curación rápida', desc: 'Te vendas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al vendarte'), lv(60, 0.2, '+20 % de velocidad al vendarte')] }
    ] },
    booster: { name: 'Treinta años de oficio', branches: [
      { id: 'b_melee', key: 'melee', ic: 'melee', name: 'Puño pesado', desc: 'Más daño cuerpo a cuerpo.', levels: [lv(35, 0.08, '+8 % de daño cuerpo a cuerpo'), lv(60, 0.15, '+15 % de daño cuerpo a cuerpo')] },
      { id: 'b_exec', key: 'exec', ic: 'exec', name: 'Remate seco', desc: 'Rematas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al rematar'), lv(60, 0.2, '+20 % de velocidad al rematar')] },
      { id: 'b_mol', key: 'molSave', ic: 'molotov', name: 'Molotov casera', desc: 'Al fabricar una molotov, a veces no gastas el trapo.', levels: [lv(45, 0.33, '1 de cada 3 no gasta trapo')] },
      { id: 'b_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(40, 0.06, '+6 % de vitalidad'), lv(70, 0.12, '+12 % de vitalidad')] },
      { id: 'b_heal', key: 'heal', ic: 'heal', name: 'Curación rápida', desc: 'Te vendas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al vendarte'), lv(60, 0.2, '+20 % de velocidad al vendarte')] }
    ] },
    // Eira: un poco de todos (más caro: ya parte de muy arriba)
    eira: { name: 'Rastro de ceniza', branches: [
      { id: 'e_ear', key: 'listenR', ic: 'ear', name: 'Rastreadora', desc: 'Escuchar llega más lejos.', levels: [lv(45, 6, '+6 m de alcance al escuchar'), lv(75, 12, '+12 m de alcance al escuchar')] },
      { id: 'e_stealth', key: 'stealth', ic: 'stealth', name: 'Sin rastro', desc: 'Cuesta todavía más verte agachada o en la hierba.', levels: [lv(45, 0.08, '−8 % de distancia a la que te ven'), lv(75, 0.15, '−15 % de distancia a la que te ven')] },
      { id: 'e_impulse', key: 'impulse', ic: 'impulse', name: 'Impulso', desc: 'Si matas a un enemigo con un ataque en carrera, el siguiente infectado que golpees (en los 6 s siguientes) recibe un remate directo. No se acumula.', levels: [lv(85, 1, 'Remate directo tras matar en carrera')] },
      { id: 'e_exec', key: 'exec', ic: 'exec', name: 'Sin piedad', desc: 'Rematas más rápido.', levels: [lv(45, 0.1, '+10 % de velocidad al rematar'), lv(75, 0.2, '+20 % de velocidad al rematar')] },
      { id: 'e_reload', key: 'reload', ic: 'reload', name: 'Recarga rápida', desc: 'Recargas las armas de fuego más rápido.', levels: [lv(45, 0.08, '−8 % de tiempo de recarga'), lv(75, 0.15, '−15 % de tiempo de recarga')] },
      { id: 'e_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(50, 0.05, '+5 % de vitalidad'), lv(85, 0.1, '+10 % de vitalidad')] }
    ] },
    // Grimes: lo agresivo y lo que hace falta para seguir en pie
    grimes: { name: 'Lo que queda de él', branches: [
      { id: 'g_melee', key: 'melee', ic: 'melee', name: 'Hachazo', desc: 'Más daño cuerpo a cuerpo.', levels: [lv(40, 0.08, '+8 % de daño cuerpo a cuerpo'), lv(65, 0.15, '+15 % de daño cuerpo a cuerpo')] },
      { id: 'g_exec', key: 'exec', ic: 'exec', name: 'Sin remordimiento', desc: 'Rematas más rápido.', levels: [lv(40, 0.1, '+10 % de velocidad al rematar'), lv(65, 0.2, '+20 % de velocidad al rematar')] },
      { id: 'g_impulse', key: 'impulse', ic: 'impulse', name: 'Impulso', desc: 'Si matas a un enemigo con un ataque en carrera, el siguiente infectado que golpees (en los 6 s siguientes) recibe un remate directo. No se acumula.', levels: [lv(80, 1, 'Remate directo tras matar en carrera')] },
      { id: 'g_vit', key: 'vit', ic: 'vit', name: 'Piel curtida', desc: 'Aguantas un poco más cada golpe: ya te hicieron cosas peores.', levels: [lv(45, 0.06, '+6 % de vitalidad'), lv(75, 0.12, '+12 % de vitalidad')] },
      { id: 'g_band', key: 'bandage', ic: 'bandage', name: 'Cicatrizar', desc: 'Cada venda te cura un poco más.', levels: [lv(35, 5, '+5 de vida por venda'), lv(60, 10, '+10 de vida por venda')] },
      { id: 'g_heal', key: 'heal', ic: 'heal', name: 'Curación rápida', desc: 'Te vendas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al vendarte'), lv(60, 0.2, '+20 % de velocidad al vendarte')] }
    ] },
    paula: { name: 'Vieja escuela', branches: [
      { id: 'p_flame', key: 'flame', ic: 'flame', name: 'Llama viva', desc: 'El lanzallamas quema un poco más.', levels: [lv(40, 0.08, '+8 % de daño del fuego'), lv(65, 0.15, '+15 % de daño del fuego')] },
      { id: 'p_stealth', key: 'stealth', ic: 'stealth', name: 'Sombra vieja', desc: 'Cuesta más verte agachada o en la hierba.', levels: [lv(35, 0.08, '−8 % de distancia a la que te ven'), lv(60, 0.15, '−15 % de distancia a la que te ven')] },
      { id: 'p_vit', key: 'vit', ic: 'vit', name: 'Vitalidad', desc: 'Aguantas un poco más cada golpe.', levels: [lv(40, 0.06, '+6 % de vitalidad'), lv(70, 0.12, '+12 % de vitalidad')] },
      { id: 'p_heal', key: 'heal', ic: 'heal', name: 'Curación rápida', desc: 'Te vendas más rápido.', levels: [lv(35, 0.1, '+10 % de velocidad al vendarte'), lv(60, 0.2, '+20 % de velocidad al vendarte')] },
      { id: 'p_mol', key: 'molSave', ic: 'molotov', name: 'Molotov casera', desc: 'Al fabricar una molotov, a veces no gastas el trapo.', levels: [lv(45, 0.33, '1 de cada 3 no gasta trapo')] }
    ] }
  };

  const tree = (charId) => TREES[charId] || TREES.vera;
  // nivel aprendido de una rama (0: nada)
  const level = (id) => (G.Run && G.Run.skillLevel ? G.Run.skillLevel(id) : 0);
  // lo que da una clave para un personaje (0 si no tiene nada)
  function bonus(player, key) {
    if (!player) return 0;
    const T = TREES[player.charId];
    if (!T) return 0;
    let v = 0;
    for (const b of T.branches) { if (b.key !== key) continue; const n = level(b.id); if (n > 0) v += b.levels[Math.min(n, b.levels.length) - 1].val; }
    return v;
  }
  // por qué no se puede aprender el siguiente nivel de una rama (null si se puede)
  function whyNot(b) {
    const n = level(b.id);
    if (n >= b.levels.length) return 'Ya está completa';
    if (!G.Run || !G.Run.st) return 'Sin carrera';
    if (!G.Run.free && G.Run.suplementos < b.levels[n].cost) return 'Te faltan suplementos';
    return null;
  }
  function learn(b) {
    const no = whyNot(b);
    if (no) return { msg: no, fail: true };
    const n = level(b.id);
    G.Run.learnSkill(b.id, G.Run.free ? 0 : b.levels[n].cost);
    return { msg: b.name + (b.levels.length > 1 ? ' (nivel ' + (n + 1) + ')' : '') + ': aprendida' };
  }

  G.Skills = { TREES, IC, tree, level, bonus, whyNot, learn };
})(window.Game = window.Game || {});
