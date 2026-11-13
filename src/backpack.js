(function (G) {
  'use strict';

  // Mochila (o bolsillos, si aún no la tienes). Se abre con un toque y el personaje se agacha a
  // rebuscar: el mundo NO se pausa. Tres pestañas (L1 / R1 con el mando, o tocando los iconos de arriba):
  //   - Fabricar (la primera): arriba lo que pide la receta elegida; debajo, en círculos, los materiales que
  //     llevas (el aro: cuánto tienes de lo que te cabe; en blanco, lo que gasta la receta); y la cuadrícula de lo
  //     que se puede fabricar (cuántos llevas | cuántos te caben). Tocar uno lo elige (se apagan los materiales
  //     que no usa y se marcan los que usa); mantenerlo pulsado lo fabrica
  //   - Suplementos: las mejoras propias del personaje (src/skills.js), que se compran con suplementos (pastillas)
  //   - Mochila: las armas a mano y las guardadas (toca una y luego otra para cambiarlas, o arrástrala encima)
  //     y los objetos para llevar a la mano
  // La munición no se ve aquí: está en el indicador de combate.

  const CRAFT_MS = 1200;
  const LEARN_MS = 900;          // suplementos: mantener pulsado para aprender una mejora
  let box = null, player = null, selKey = null, onMsg = null;
  let tab = 'craft', craftSel = 'venda', skB = 0, skN = 0;
  let crafting = null;          // { t0, raf }
  let dragFrom = null;
  const el = (id) => document.getElementById(id);
  const W = () => G.Weapons;
  const msg = (m, k) => { if (onMsg) onMsg(m, k); };

  const TXT = {
    venda: 'Recupera 40 de vida en unos segundos. Se lleva en la mano (cruz de armas, arriba, o B): mantén Atacar 2 segundos para vendarte; mientras tanto puedes caminar, pero agachada. Un toque de Atacar sigue siendo un navajazo.',
    venda_d: 'Corta la hemorragia, evita la infección y recupera vida poco a poco (unos 30 puntos en un minuto).',
    alcohol: 'Alcohol para desinfectar. Con 2 botellas y un trapo fabricas una venda.',
    trapo: 'Un trapo limpio. Con 2 botellas de alcohol fabricas una venda.',
    flecha_exp: 'Revienta al clavarse: los infectados cercanos salen volando (los de muy cerca, muertos). Con el arco en la mano, V (o la cruz de armas, arriba) elige flechas normales o explosivas. Receta: 1 flecha + 1 alcohol + 1 trapo.',
    polvo: 'Polvo reactivo: escaso y peligroso. Con clavos haces una mina; con un trapo, una bomba de humo.',
    clavos: 'Un puñado de clavos. Dos, con polvo reactivo, hacen una mina (los clavos hacen de metralla).',
    mina: 'Mina de presión. Con ella en la mano, Atacar la coloca en el suelo. Estalla cuando la pisa un infectado (tú puedes pasar por encima y recogerla): una explosión más grande que las demás que mata a todos los de dentro y aturde a los que quedan justo fuera. Receta: 1 polvo reactivo + 1 clavos. Como mucho llevas 3.',
    humo: 'Bomba de humo. Se lanza como la botella: suelta una nube gris que aturde a los infectados de dentro (sin daño). Si te pilla muy cerca, te deja grogui un momento. Receta: 1 polvo reactivo + 1 trapo.',
    molotov: 'Se lanza como la botella, pero al romperse prende un charco de fuego: los infectados que alcanza arden, se sacuden las llamas unos segundos y van perdiendo vida; el más cercano cae y se revuelca hasta morir. Cuidado: el fuego también te quema.',
    pandora: 'Rompepandora (solo 13): una lata llena de polvo reactivo con clavos atravesados. Se lanza como la botella, pero revienta al chocar con algo o con alguien, como una flecha explosiva: los de muy cerca mueren y los de alrededor salen volando. Cuidado: de cerca también te alcanza. Receta: 1 polvo reactivo + 1 clavos. Como mucho llevas 3.',
    recipe: 'Receta: 2 botellas de alcohol + 1 trapo.'
  };

  // ---------- Fabricación ----------
  // materiales (los círculos de arriba)
  const MATS = [
    { id: 'alcohol', name: 'alcohol', icon: 'alcohol', have: (p) => p.items.alcohol || 0, cap: (p) => W().SUPPLY.alcohol.cap[p.bags ? 1 : 0] },
    { id: 'trapo', name: 'trapo', icon: 'trapo', have: (p) => p.items.trapo || 0, cap: (p) => W().SUPPLY.trapo.cap[p.bags ? 1 : 0] },
    { id: 'polvo', name: 'polvo reactivo', icon: 'polvo', have: (p) => p.items.polvo || 0, cap: (p) => W().SUPPLY.polvo.cap[p.bags ? 1 : 0] },
    { id: 'clavos', name: 'clavos', icon: 'clavos', have: (p) => p.items.clavos || 0, cap: (p) => W().SUPPLY.clavos.cap[p.bags ? 1 : 0] },
    { id: 'flecha', name: 'flecha', icon: 'mun_flecha', have: (p) => p.ammo.flecha || 0, cap: (p) => p.ammoCap('flecha') }
  ];
  // lo que se fabrica (la cuadrícula). mats: cuánto gasta de cada material
  const RECIPES = [
    { id: 'venda', name: 'Venda', icon: 'botiquin', mats: { alcohol: 2, trapo: 1 }, have: (p) => p.items.venda || 0, cap: (p) => W().SUPPLY.venda.cap[p.bags ? 1 : 0],
      desc: 'Recupera 40 de vida en unos segundos. Llévala a la mano (cruz de armas, arriba) y mantén Atacar para vendarte.', done: 'Fabricaste una venda' },
    { id: 'molotov', name: 'Molotov', icon: 'molotov', mats: { alcohol: 1, trapo: 1 }, have: (p) => p.items.molotov || 0, cap: () => G.Player.MOLOTOV_CAP || 3,
      desc: 'Se lanza como la botella; al romperse prende un charco de fuego que quema a los infectados (y a ti, si lo pisas).', done: 'Fabricaste una molotov: lánzala como la botella' },
    { id: 'humo', name: 'Bomba de humo', icon: 'humo', mats: { polvo: 1, trapo: 1 }, have: (p) => p.items.humo || 0, cap: (p) => W().SUPPLY.humo.cap[p.bags ? 1 : 0],
      desc: 'Se lanza como la botella y suelta una nube gris que aturde a los infectados de dentro (sin daño).', done: 'Fabricaste una bomba de humo' },
    { id: 'mina', name: 'Mina', icon: 'mina', mats: { polvo: 1, clavos: 1 }, have: (p) => p.items.mina || 0, cap: (p) => W().SUPPLY.mina.cap[p.bags ? 1 : 0],
      desc: 'Con ella en la mano, Atacar la coloca en el suelo. Estalla cuando la pisa un infectado y mata a todos los de alrededor.', done: 'Fabricaste una mina: póntela en la mano y Atacar la coloca' },
    // (solo Eira: only)
    { id: 'pandora', only: 'eira', name: 'Rompepandora', icon: 'pandora', mats: { polvo: 1, clavos: 1 }, have: (p) => p.items.pandora || 0, cap: (p) => W().SUPPLY.pandora.cap[p.bags ? 1 : 0],
      desc: 'La bomba de clavos de 13: se lanza como la botella y revienta al chocar con algo o con alguien, como una flecha explosiva.', done: 'Fabricaste una rompepandora: lánzala como la botella' },
    { id: 'silenciador', name: 'Silenciador', icon: 'pistola_sil', mats: { alcohol: 1, trapo: 2 }, have: (p) => p.silencers || 0, cap: () => G.Player.SIL_CAP || 3,
      desc: 'Para la pistola: los disparos casi no hacen ruido. Con la pistola en la mano, Accesorio (V o LB) lo pone o lo quita. Aguanta unos 20 tiros.', done: 'Fabricaste un silenciador (sirve para la pistola)' },
    { id: 'flecha_exp', name: 'Flecha explosiva', icon: 'mun_flecha_exp', mats: { flecha: 1, alcohol: 1, trapo: 1 }, have: (p) => p.ammo.flecha_exp || 0, cap: (p) => p.ammoCap('flecha_exp'),
      desc: 'Revienta al clavarse: los infectados de alrededor salen volando. Con el arco en la mano, V (o la cruz de armas) elige flechas normales o explosivas.', done: 'Fabricaste una flecha explosiva' }
  ];
  const recipe = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];
  // las recetas que puede fabricar este personaje (la rompepandora, solo Eira)
  const recipesOf = (p) => RECIPES.filter((r) => !r.only || (p && p.charId === r.only));
  // por qué no se puede fabricar (null si se puede)
  function whyNot(R, p) {
    for (const m of MATS) { const n = R.mats[m.id] || 0; if (n && m.have(p) < n) return 'Te falta ' + (n > 1 ? n + ' ' : '') + m.name + (n > 1 && m.id !== 'polvo' ? (m.id === 'alcohol' ? '' : 's') : ''); }
    if (R.have(p) >= R.cap(p)) return 'No te caben más';
    return null;
  }
  // iconos de las pestañas
  const TAB_IC = {
    craft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 L13 11 M11 9 L15 5 L19 9 L15 13 Z M14 14 L19 19 M5 5 L9 9"/></svg>',
    sup: '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-45 12 12)"><rect x="5" y="9" width="14" height="6" rx="3"/><path d="M12 9 H8 A3 3 0 0 0 8 15 H12 Z" fill="currentColor"/></g></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8 Q7 4 12 4 Q17 4 17 8 L18 20 L6 20 Z M9 12 L15 12 M10 8 Q10 6 12 6 Q14 6 14 8"/></svg>'
  };

  function ensure() {
    if (box) return box;
    box = el('pack');
    if (!box) return null;
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.querySelector('.pk-x').addEventListener('pointerdown', (e) => { e.preventDefault(); close(true); });
    box.addEventListener('click', (e) => {
      const t = e.target.closest('.pk-tab');
      if (t) { setTab(t.dataset.tab); return; }
      const c = e.target.closest('[data-k]');
      if (!c || c.classList.contains('pk-hold') || c.classList.contains('pk-cell')) return;
      tapCard(c.dataset.k);
    });
    // aprender una mejora: mantener pulsado el botón (soltar antes la cancela)
    box.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.sk-learn:not(.off)');
      if (c) { e.preventDefault(); startLearn(c); }
    });
    window.addEventListener('pointerup', stopLearn);
    window.addEventListener('pointercancel', stopLearn);
    // fabricar: tocar una casilla la elige; mantenerla pulsada la fabrica
    box.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.pk-cell');
      if (!c) return;
      e.preventDefault();
      pickRecipe(c.dataset.k.slice(2));
      const R = recipe(craftSel), no = whyNot(R, player);
      if (no) { msg(no, 'warn'); return; }
      startCraft(c, R.id);
    });
    // arrastrar un arma sobre otra la cambia
    box.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.pk-card[data-k^="h"], .pk-card[data-k^="s"]');
      dragFrom = c ? c.dataset.k : null;
    });
    box.addEventListener('pointerup', (e) => {
      if (!dragFrom) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const c = t && t.closest('.pk-card[data-k^="h"], .pk-card[data-k^="s"]');
      if (c && c.dataset.k !== dragFrom) { swap(dragFrom, c.dataset.k); selKey = c.dataset.k; render(); }
      dragFrom = null;
    });
    const stop = () => stopCraft(false);
    box.addEventListener('pointerup', stop);
    box.addEventListener('pointercancel', stop);
    box.addEventListener('pointerleave', stop);
    window.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.code === 'Escape' || e.code === (G.Controls ? G.Controls.key('pack') : 'KeyI')) { e.preventDefault(); close(true); }
    });
    document.addEventListener('pointerlockchange', () => { if (isOpen() && G.Input.pointerLocked) close(false); });
    return box;
  }

  const isOpen = () => !!(box && !box.classList.contains('hidden'));

  function open(p) {
    player = p;
    if (!ensure() || p.dead) return false;
    if (isOpen()) { close(true); return false; }
    if (p.busy()) { msg('Ahora no puedes'); return false; }
    if (G.Loot && G.Loot.isOpen) G.Loot.close(false);
    if (p.stance === 'prone') p.stance = 'crouch';
    p.aiming = false;
    p.action = { kind: 'pack', t: 0, dur: 1e9, impact: 2, face: p.facing, done: false };
    selKey = selKey || 'h1';
    tab = 'craft'; padPrev = []; padX = false; stopLearn();
    box.classList.remove('hidden');
    render();
    if (!G.Input.isTouch && G.Input.pointerLocked && document.exitPointerLock) document.exitPointerLock();
    return true;
  }

  function close(relock) {
    if (!isOpen()) return;
    stopCraft(false);
    box.classList.add('hidden');
    if (player && player.action && player.action.kind === 'pack') player.action = null;
    if (relock && !G.Input.isTouch && G.Input.enabled && G.Input.requestLock) G.Input.requestLock();
  }

  // ---------- Contenido ----------
  function wText(s) {
    const w = W().get(s.id);
    if (W().isGun(w)) return w.gun === 'bow' ? (s.mag ? 1 : 0) + ' | ' + (player.ammo.flecha || 0) : (s.mag || 0) + ' | ' + (player.ammo[w.ammo] || 0);
    return Math.max(0, Math.round(s.cond * w.cond)) + ' golpes';
  }
  function card(k, id, label, txt, extra) {
    const u = id ? G.Icons.white(id) : null;
    return '<button type="button" class="pk-card' + (extra || '') + (selKey === k ? ' sel' : '') + '" data-k="' + k + '">' +
      '<span class="pk-ic">' + (u ? '<img alt="" src="' + u + '">' : '') + '</span>' +
      '<span class="pk-nm">' + label + '</span>' + (txt != null ? '<span class="pk-ct">' + txt + '</span>' : '') + '</button>';
  }

  function setTab(t) {
    if (t === tab || !TAB_IC[t]) return;
    tab = t; stopCraft(); stopLearn();
    if (G.Audio) G.Audio.play('ui');
    render();
  }
  function render() {
    if (!box || !player) return;
    box.querySelector('.pk-tabs').innerHTML = '<span class="pk-sh">L1</span>' +
      ['craft', 'sup', 'bag'].map((t) => '<button type="button" class="pk-tab' + (t === tab ? ' on' : '') + '" data-tab="' + t + '">' + TAB_IC[t] + '</button>').join('') +
      '<span class="pk-sh">R1</span>';
    for (const v of ['craft', 'sup', 'bag']) box.querySelector('.pk-v-' + v).classList.toggle('hidden', v !== tab);
    box.classList.toggle('pk-wide', tab !== 'bag');
    box.classList.toggle('pk-craft', tab === 'craft');     // (fabricar: el panel compacto, que no ocupa toda la altura)
    if (tab === 'craft') renderCraft();
    else if (tab === 'sup') renderSup();
    else if (tab === 'bag') renderBag();
  }
  // ---------- Pestaña Suplementos (las mejoras del personaje: src/skills.js) ----------
  const PILL = '<svg class="sk-pill" viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(-45 10 10)"><rect x="4" y="7" width="12" height="6" rx="3"/><path d="M10 7 H7 A3 3 0 0 0 7 13 H10 Z" fill="currentColor"/></g></svg>';
  const skIcon = (k) => '<svg class="sk-ic" viewBox="0 0 24 24" aria-hidden="true">' + (G.Skills.IC[k] || '') + '</svg>';
  function renderSup() {
    const S = G.Skills, T = S.tree(player.charId), B = T.branches;
    skB = Math.max(0, Math.min(skB, B.length - 1));
    const b = B[skB], n = S.level(b.id);
    skN = Math.max(0, Math.min(skN, b.levels.length - 1));
    const R = G.Run;
    box.querySelector('.sk-tn').textContent = T.name;
    box.querySelector('.sk-money').innerHTML = R && R.free ? 'Modo libre · gratis' : '<b>' + (R ? R.suplementos : 0) + '</b>' + PILL;
    box.querySelector('.sk-row').innerHTML = B.map((x, i) => {
      const k = S.level(x.id), full = k >= x.levels.length;
      return '<button type="button" class="pk-card sk-br' + (i === skB ? ' sel' : '') + (full ? ' full' : (k ? ' some' : '')) + '" data-k="sb:' + i + '">' + skIcon(x.ic) +
        '<span class="sk-pips">' + x.levels.map((q, j) => '<i' + (j < k ? ' class="on"' : '') + '></i>').join('') + '</span></button>';
    }).join('');
    box.querySelector('.sk-chain').innerHTML = b.levels.map((q, j) =>
      (j ? '<span class="sk-link' + (j <= n ? ' on' : '') + '"></span>' : '') +
      '<button type="button" class="pk-card sk-node' + (j < n ? ' got' : (j === n ? ' next' : ' locked')) + (j === skN ? ' sel' : '') + '" data-k="sn:' + j + '">' + skIcon(b.ic) + '<span class="sk-nm">' + b.name + (b.levels.length > 1 ? ' ' + ['I', 'II', 'III'][j] : '') + '</span></button>').join('');
    const L = b.levels[skN], got = skN < n, isNext = skN === n, no = isNext ? S.whyNot(b) : null;
    box.querySelector('.sk-info').innerHTML = '<div class="sk-t"><b>' + b.name + (b.levels.length > 1 ? ' ' + ['I', 'II', 'III'][skN] : '') + '</b>' +
      '<span class="sk-cost">' + (R && R.free ? 'gratis' : L.cost + PILL) + '</span></div><p>' + b.desc + '</p><p class="sk-fx">' + L.txt + '</p>' +
      (got ? '<p class="sk-ok">Aprendida</p>' : (isNext ? (no ? '<p class="pk-no">' + no + '</p>' : '') + '<button type="button" class="pk-btn pk-hold sk-learn' + (no ? ' off' : '') + '" data-k="sl"><i class="pk-fill"></i><span>' + (no ? 'No se puede todavía' : 'Mantén para aprender') + '</span></button>'
        : '<p class="sk-lock">Antes, el nivel anterior</p>'));
    const pad = !!(G.Input && G.Input.padMode);
    box.querySelector('.sk-foot').innerHTML = pad
      ? '<span><i class="pk-bx">&#x2715;</i>Mantén para aprender</span><span><i class="pk-bx o">&#x25CB;</i>Atrás</span>'
      : '<span>Elige una mejora y mantén el botón para aprenderla</span>';
  }
  // ---------- Pestaña Fabricar ----------
  function ring(frac, cost, short) {
    // aro: lo que tienes (gris) y, encima, lo que gasta la receta (blanco; rojo si no te alcanza)
    const f = Math.max(0, Math.min(1, frac)) * 100, c = Math.max(0, Math.min(1, cost)) * 100;
    return '<svg class="pk-ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="19" pathLength="100"/>' +
      '<circle class="have" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="' + f.toFixed(1) + ' 100"/>' +
      (c > 0 ? '<circle class="cost' + (short ? ' short' : '') + '" cx="22" cy="22" r="19" pathLength="100" stroke-dasharray="' + c.toFixed(1) + ' 100"/>' : '') + '</svg>';
  }
  function renderCraft(noGrid) {
    const p = player;
    if (!recipesOf(p).some((r) => r.id === craftSel)) craftSel = 'venda';
    const R = recipe(craftSel);
    const used = MATS.filter((m) => R.mats[m.id]);
    const parts = used.map((m) => '<b>' + (R.mats[m.id] > 1 ? R.mats[m.id] + ' ' : '') + (m.id === 'alcohol' ? (R.mats[m.id] > 1 ? 'botellas de alcohol' : 'botella de alcohol') : m.name + (R.mats[m.id] > 1 && m.id !== 'polvo' ? 's' : '')) + '</b>');
    const rec = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1] : parts[0];
    const no = whyNot(R, p);
    box.querySelector('.pk-cdesc').innerHTML = '<b class="pk-cn">' + R.name + '</b><p>' + R.desc + '</p><p class="pk-rec">La receta lleva ' + rec + '.' +
      (no ? ' <span class="pk-no">' + no + '.</span>' : '') + '</p>';
    box.querySelector('.pk-matrow').innerHTML = MATS.map((m) => {
      const have = m.have(p), cap = Math.max(1, m.cap(p)), n = R.mats[m.id] || 0;
      const u = G.Icons.white(m.icon);
      return '<div class="pk-mat' + (n ? ' use' : ' off') + '"><span class="pk-mc">' + ring(have / cap, n ? Math.min(have, n) / cap : 0, n > have) +
        (u ? '<img alt="" src="' + u + '">' : '') + '</span><span class="pk-mn' + (have ? '' : ' zero') + '">' + have + (n ? '<i>−' + n + '</i>' : '') + '</span></div>';
    }).join('');
    if (!noGrid) box.querySelector('.pk-grid').classList.toggle('pk-g4', recipesOf(p).length > 6);      // (Eira: una receta más, en cuatro columnas)
    if (!noGrid) box.querySelector('.pk-grid').innerHTML = recipesOf(p).map((r) => {
      const have = r.have(p), cap = r.cap(p), u = G.Icons.white(r.icon), can = !whyNot(r, p);
      return '<button type="button" class="pk-card pk-cell' + (r.id === craftSel ? ' sel' : '') + (can ? '' : ' cant') + '" data-k="c:' + r.id + '"><i class="pk-cfill"></i>' +
        '<span class="pk-ic">' + (u ? '<img alt="" src="' + u + '">' : '') + '</span>' +
        '<span class="pk-cc"><b class="' + (have ? '' : 'zero') + '">' + have + '</b><s>' + cap + '</s></span></button>';
    }).join('');
    const pad = !!(G.Input && G.Input.padMode);
    box.querySelector('.pk-foot').innerHTML = pad
      ? '<span><i class="pk-bx">&#x2715;</i>Mantén: fabricar</span><span><i class="pk-bx o">&#x25CB;</i>Cerrar</span>'
      : '<span>Toca para elegir · mantén pulsado para fabricar</span>';
  }
  // elegir una receta sin volver a dibujar la cuadrícula (para no cortar el «mantener pulsado»)
  function pickRecipe(id) {
    if (id === craftSel) return;
    craftSel = id;
    box.querySelectorAll('.pk-cell').forEach((c) => c.classList.toggle('sel', c.dataset.k === 'c:' + id));
    renderCraft(true);         // (descripción y círculos de nuevo; la cuadrícula se queda)
  }
  // ---------- Pestaña Mochila ----------
  function renderBag() {
    const p = player;
    // Di' Arco no usa mochila: en el refugio, el armero hace de mochila (sueltas un arma ahí y coges otra)
    const rack = p.packless && G.Run && G.Run.inRefuge;
    const canStore = (p.backpack && !p.packless) || rack;
    box.querySelector('.pk-title').textContent = rack ? 'Bolsillos y armero del refugio' : (p.backpack && !p.packless ? 'Mochila' : 'Bolsillos');
    const names = ['Cuerpo a cuerpo', 'Arma corta', 'Arma larga', 'Arma larga', 'Arma corta'];
    box.querySelector('.pk-hands').innerHTML = [0, 1, 4, 2, 3].map((i) => {
      const s = p.hands[i];
      return s ? card('h' + i, s.id, W().get(s.id).name, wText(s), (s.broken ? ' broken' : '') + (p.cur === i ? ' cur' : ''))
        : card('h' + i, null, names[i], 'vacío', ' empty');
    }).join('');
    box.querySelector('.pk-stored').innerHTML = canStore
      // todas las guardadas (no hay límite) y un hueco libre para guardar otra
      ? p.stored.map((s, i) => card('s' + i, s.id, W().get(s.id).name, wText(s), s.broken ? ' broken' : '')).join('') + card('s' + p.stored.length, null, rack ? 'Dejar en el armero' : 'Guardar aquí', 'libre', ' empty')
      : '<div class="pk-lock">' + (p.packless ? 'No usa mochila: lleva 2 armas cortas y 2 largas. En el refugio puede cambiarlas en el armero.' : 'Sin mochila no puedes guardar armas') + '</div>';
    box.querySelector('.pk-mats').innerHTML =
      card('m:molotov', 'molotov', 'Molotov', (p.items.molotov || 0) + ' / 3', p.items.molotov ? '' : ' empty') +
      card('m:mina', 'mina', 'Mina', (p.items.mina || 0) + ' / ' + W().SUPPLY.mina.cap[p.bags ? 1 : 0], p.items.mina ? '' : ' empty') +
      card('m:humo', 'humo', 'Bomba de humo', (p.items.humo || 0) + ' / ' + W().SUPPLY.humo.cap[p.bags ? 1 : 0], p.items.humo ? '' : ' empty') +
      (p.charId === 'eira' || p.items.pandora ? card('m:pandora', 'pandora', 'Rompepandora', (p.items.pandora || 0) + ' / ' + W().SUPPLY.pandora.cap[p.bags ? 1 : 0], p.items.pandora ? '' : ' empty') : '') +
      card('m:polvo', 'polvo', 'Polvo reactivo', (p.items.polvo || 0) + ' / ' + W().SUPPLY.polvo.cap[p.bags ? 1 : 0], p.items.polvo ? '' : ' empty') +
      card('m:clavos', 'clavos', 'Clavos', (p.items.clavos || 0) + ' / ' + W().SUPPLY.clavos.cap[p.bags ? 1 : 0], p.items.clavos ? '' : ' empty') +
      card('m:venda', 'botiquin', 'Venda', p.items.venda + ' / ' + W().SUPPLY.venda.cap[p.bags ? 1 : 0]) +
      card('m:alcohol', 'alcohol', 'Alcohol', p.items.alcohol + ' / ' + W().SUPPLY.alcohol.cap[p.bags ? 1 : 0], p.items.alcohol ? '' : ' empty') +
      card('m:trapo', 'trapo', 'Trapo', p.items.trapo + ' / ' + W().SUPPLY.trapo.cap[p.bags ? 1 : 0], p.items.trapo ? '' : ' empty');
    const dv = box.querySelector('.pk-dev');
    if (dv) dv.innerHTML = G.DEV ? W().LIST.filter((w) => w.cat !== 'none').map((w) => card('dev:' + w.id, w.id, w.name, W().isGun(w) ? (w.gun === 'bow' ? 'flechas' : 'balas') : 'cuerpo a cuerpo')).join('') : '';
    describe();
  }

  function describe() {
    const p = player, d = box.querySelector('.pk-desc');
    const k = selKey || '';
    let title = '', text = '', act = '';
    if (k.charAt(0) === 'h' || k.charAt(0) === 's') {
      const i = +k.slice(1), s = k.charAt(0) === 'h' ? p.hands[i] : p.stored[i];
      if (!s) { title = k.charAt(0) === 'h' ? 'Espacio vacío' : 'Hueco en la mochila'; text = k.charAt(0) === 's' ? 'Toca un arma a mano para guardarla en la mochila (caben todas).' : (i === 1 || i === 4 ? 'Aquí va un arma corta (pistola o revólver). Toca una guardada para sacarla.' : 'Aquí va un arma larga. Toca una guardada para sacarla.'); }
      else {
        const w = W().get(s.id);
        title = w.name;
        text = W().isGun(w)
          ? 'Munición: ' + wText(s) + ' (en el arma | de reserva).'
          : 'Le quedan ' + wText(s) + '. Sale sola al golpear (como la navaja); al romperse desaparece y vuelves a la navaja.';
        if ((p.backpack && !p.packless || (p.packless && G.Run && G.Run.inRefuge)) && (k !== 'h0')) text += ' Toca ' + (k.charAt(0) === 's' ? 'un espacio a mano del mismo tipo (corta o larga)' : 'un arma guardada o el hueco de la mochila') + ' para cambiarlas.';
        if (k.charAt(0) === 'h' && i > 0) act = '<button type="button" class="pk-btn" data-k="eq' + i + '">' + (p.cur === i ? 'Guardar en la funda' : 'Equipar') + '</button>';
      }
    } else if (k === 'm:venda' || k === 'm:venda_d') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id];
      if (p.items[id]) act = '<button type="button" class="pk-btn" data-k="use:' + id + '">A la mano</button>';
    } else if (k === 'm:molotov') {
      title = 'Molotov'; text = TXT.molotov + ' Llevas ' + (p.items.molotov || 0) + '. Va aparte de la botella o el ladrillo: puedes llevar las dos cosas.';
      if (p.items.molotov) act = '<button type="button" class="pk-btn" data-k="usem">A la mano</button>';
    } else if (k === 'm:mina' || k === 'm:humo' || k === 'm:pandora') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Llevas ' + (p.items[id] || 0) + '.';
      if (p.items[id]) act = '<button type="button" class="pk-btn" data-k="usex:' + id + '">A la mano</button>';
    } else if (k === 'm:polvo' || k === 'm:clavos') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Tienes ' + p.items.polvo + ' de polvo reactivo, ' + p.items.clavos + ' clavos y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
    } else if (k === 'r:mina' || k === 'r:humo') {
      const id = k.slice(2), mina = id === 'mina';
      const ok = p.items.polvo >= 1 && (mina ? p.items.clavos >= 2 : p.items.trapo >= 1) && p.itemRoom(id) > 0;
      title = 'Fabricar ' + (mina ? 'mina' : 'bomba de humo'); text = TXT[id] + ' Tienes ' + p.items.polvo + ' de polvo reactivo, ' + (mina ? p.items.clavos + ' clavos.' : p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '.' : 's.'));
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:' + id + '"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : (p.itemRoom(id) <= 0 ? 'No caben más' : 'Te faltan materiales')) + '</span></button>';
    } else if (k === 'm:alcohol' || k === 'm:trapo') {
      const id = k.slice(2);
      title = W().nameOf(id); text = TXT[id] + ' Tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
    } else if (k === 'r:flecha_exp') {
      title = 'Fabricar flecha explosiva'; text = TXT.flecha_exp + ' Tienes ' + p.ammo.flecha + ' flechas, ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
      const ok = p.ammo.flecha >= 1 && p.items.alcohol >= 1 && p.items.trapo >= 1;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:flecha_exp"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : 'Te faltan materiales') + '</span></button>';
    } else if (k === 'r:molotov') {
      title = 'Fabricar molotov'; text = TXT.molotov + ' Gasta lo mismo que una venda: 1 alcohol y 1 trapo (tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '). O te curas, o la fabricas.';
      const ok = p.items.alcohol >= 1 && p.items.trapo >= 1 && (p.items.molotov || 0) < 5;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft:molotov"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : 'Te faltan materiales') + '</span></button>';
    } else if (k === 'r:venda') {
      title = 'Fabricar venda'; text = TXT.venda + ' ' + TXT.recipe + ' Tienes ' + p.items.alcohol + ' de alcohol y ' + p.items.trapo + ' trapo' + (p.items.trapo === 1 ? '' : 's') + '.';
      const full = p.itemRoom('venda') <= 0, ok = p.items.alcohol >= 2 && p.items.trapo >= 1 && !full;
      act = '<button type="button" class="pk-btn pk-hold' + (ok ? '' : ' off') + '" data-k="craft"><i class="pk-fill"></i><span>' + (ok ? 'Mantén para fabricar' : (full ? 'No caben más' : 'Te faltan materiales')) + '</span></button>';
    }
    d.innerHTML = '<b>' + title + '</b><p>' + text + '</p><div class="pk-acts">' + act + '</div>';
  }

  // tocar: seleccionar; tocar un arma con otra seleccionada: cambiarlas
  function tapCard(k) {
    const p = player;
    if (k.indexOf('eq') === 0) { const i = +k.slice(2); if (p.hands[i]) { p.cur === i ? p.equip(-1) : p.equip(i); } render(); return; }
    if (k.indexOf('use:') === 0) {
      close(false);
      p.equip(-3);
      msg(p.cur === -3 ? 'Venda en la mano: mantén Atacar para vendarte (puedes caminar agachada)' : 'No tienes vendas', p.cur === -3 ? 'good' : 'warn');
      return;
    }
    if (k.indexOf('usex:') === 0) {
      const id = k.slice(5), slot = id === 'mina' ? -5 : (id === 'pandora' ? -7 : -6);
      close(false);
      p.equip(slot);
      msg(p.cur === slot ? (id === 'mina' ? 'Mina en la mano: Atacar la coloca en el suelo' : (id === 'pandora' ? 'Rompepandora en la mano: mantén Atacar para apuntar y suelta para lanzar' : 'Bomba de humo en la mano: mantén Atacar para apuntar y suelta para lanzar')) : 'No tienes', p.cur === slot ? 'good' : 'warn');
      return;
    }
    if (k === 'usem') {
      close(false);
      p.equip(-4);
      msg(p.cur === -4 ? 'Molotov en la mano: mantén Atacar para apuntar y suelta para lanzar' : 'No tienes molotovs', p.cur === -4 ? 'good' : 'warn');
      return;
    }
    if (k === 'craft' || k.indexOf('craft:') === 0) return;
    // suplementos: elegir rama, elegir nivel, aprender
    if (k.indexOf('sb:') === 0) { skB = +k.slice(3); const b = G.Skills.tree(p.charId).branches[skB]; skN = Math.min(G.Skills.level(b.id), b.levels.length - 1); render(); return; }
    if (k.indexOf('sn:') === 0) { skN = +k.slice(3); render(); return; }
    if (k === 'sl') return;          // (aprender: solo manteniendo pulsado, ver startLearn)
    if (k.indexOf('dev:') === 0) { const m = p.devGive(k.slice(4)); if (m) msg(m); render(); return; }
    const w1 = selKey && (selKey.charAt(0) === 'h' || selKey.charAt(0) === 's');
    const w2 = k.charAt(0) === 'h' || k.charAt(0) === 's';
    if (w1 && w2 && selKey !== k && swap(selKey, k)) { selKey = k; render(); return; }
    selKey = k;
    render();
  }

  // cambia un arma a mano (pistoleras h1/h4 o espalda h2/h3) con una guardada (o la guarda en el hueco libre)
  function swap(a, b) {
    const p = player;
    let h = null, s = null;
    for (const k of [a, b]) { if (/^h[1-4]$/.test(k)) h = +k.slice(1); else if (k.charAt(0) === 's') s = +k.slice(1); }
    if (h == null || s == null || !((p.backpack && !p.packless) || (p.packless && G.Run && G.Run.inRefuge))) return false;
    if (!p.hands[h] && !p.stored[s]) return false;
    const was = p.hands[h];
    if (!p.swapStored(h, s)) { msg(h === 1 || h === 4 ? 'Ahí solo va un arma corta' : 'Ahí solo va un arma larga', 'warn'); return false; }
    msg(p.hands[h] ? 'A mano: ' + W().get(p.hands[h].id).name : (p.packless ? 'Dejaste en el armero: ' : 'Guardaste en la mochila: ') + W().get(was.id).name);
    return true;
  }

  // ---------- Aprender (mantener pulsado, como fabricar) ----------
  // al completarse la pulsación: aprende la mejora elegida
  function learnNow() {
    const b = G.Skills.tree(player.charId).branches[skB];
    if (skN !== G.Skills.level(b.id)) return;
    const r = G.Skills.learn(b);
    msg(r.msg, r.fail ? 'warn' : 'good');
    if (!r.fail) { if (G.Audio) G.Audio.play('pickup'); skN = Math.min(G.Skills.level(b.id), b.levels.length - 1); }
    render();
  }
  let learning = null;
  function startLearn(el) {
    stopLearn();
    const fill = el.querySelector('.pk-fill');
    learning = { t0: performance.now(), fill, el, raf: 0 };
    el.classList.add('hold');
    const step = () => {
      if (!learning) return;
      const k = Math.min(1, (performance.now() - learning.t0) / LEARN_MS);
      if (fill) fill.style.width = (k * 100) + '%';
      if (k >= 1) { learning = null; learnNow(); return; }
      learning.raf = requestAnimationFrame(step);
    };
    learning.raf = requestAnimationFrame(step);
  }
  function stopLearn() {
    if (!learning) return;
    cancelAnimationFrame(learning.raf);
    if (learning.fill) learning.fill.style.width = '0%';
    if (learning.el) learning.el.classList.remove('hold');
    learning = null;
  }

  // ---------- Fabricar (mantener pulsado) ----------
  function startCraft(cell, id) {
    stopCraft();
    const fill = cell.querySelector('.pk-cfill');
    crafting = { t0: performance.now(), fill, cell, id };
    cell.classList.add('hold');
    const step = () => {
      if (!crafting) return;
      const k = Math.min(1, (performance.now() - crafting.t0) / CRAFT_MS);
      if (fill) fill.style.height = (k * 100) + '%';
      if (k >= 1) {
        const R = recipe(crafting.id);
        crafting = null;
        const m = player.craft(R.id);
        msg(m || R.done, m ? 'warn' : 'good');
        if (!m && G.Audio) G.Audio.play('pickup');
        render();
        return;
      }
      crafting.raf = requestAnimationFrame(step);
    };
    crafting.raf = requestAnimationFrame(step);
  }
  function stopCraft() {
    if (!crafting) return;
    cancelAnimationFrame(crafting.raf);
    if (crafting.fill) crafting.fill.style.height = '0%';
    if (crafting.cell) crafting.cell.classList.remove('hold');
    crafting = null;
  }

  // Cada fotograma: se cierra si algo te interrumpe (un golpe) o mueres
  // L1 / R1 del mando: pestaña anterior / siguiente
  let padPrev = [], padX = false;
  function padTabs() {
    const ps = navigator.getGamepads ? navigator.getGamepads() : [];
    let pd = null; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { pd = ps[i]; break; }
    if (!pd) return;
    const now = [4, 5].map((i) => !!(pd.buttons[i] && pd.buttons[i].pressed));
    // ✕ en la pestaña de suplementos: mantenerlo aprende la mejora elegida; soltarlo la cancela
    const xNow = !!(pd.buttons[0] && pd.buttons[0].pressed);
    if (tab === 'sup') {
      if (xNow && !padX) { const el = box && box.querySelector('.sk-learn:not(.off)'); if (el) startLearn(el); }
      if (!xNow && padX) stopLearn();
    }
    padX = xNow;
    const T = ['craft', 'sup', 'bag'], i = T.indexOf(tab);
    if (now[0] && !padPrev[0]) setTab(T[(i + T.length - 1) % T.length]);
    if (now[1] && !padPrev[1]) setTab(T[(i + 1) % T.length]);
    padPrev = now;
  }
  function update(p) {
    player = p;
    if (!isOpen()) return;
    if (p.dead || !p.action || p.action.kind !== 'pack') { close(false); return; }
    padTabs();
  }

  G.Backpack = {
    open, close, update, render,
    get isOpen() { return isOpen(); },
    set onMessage(fn) { onMsg = fn; }
  };
})(window.Game = window.Game || {});
