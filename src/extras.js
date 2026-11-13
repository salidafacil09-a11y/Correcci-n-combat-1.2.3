// Extras: lo que se compra con los «puntos de desafiante». Cada logro y cada desafío da puntos según su dificultad
// (la primera vez que lo consigues: ver G.Run.dareEarned) y se gastan aquí, en Extras (del menú de inicio o del de
// pausa), que es el único sitio donde se ve cuántos tienes. La lista: nombre, precio y, antes de comprar, una
// vista previa en 3D (el personaje girando despacio).
(function (G) {
  'use strict';
  const KEY = 'ceniza.extras';            // { spent, owned: { id: fecha } }
  const TRECE_KEY = 'ceniza.trece';       // la Trece se escapó de su celda del capitolio: Eira aparece en Extras
  const treceSeen = () => { try { return !!localStorage.getItem(TRECE_KEY); } catch (e) { return false; } };
  const GRIMES_KEY = 'ceniza.grimes';     // Grimes terminó la venganza de la Trece: aparece en Extras
  const grimesSeen = () => { try { return !!localStorage.getItem(GRIMES_KEY); } catch (e) { return false; } };

  const ITEMS = [
    { id: 'skin_diarco', kind: 'skin', char: 'diarco', price: 180, name: "Di' Arco: aspecto secundario",
      desc: "Otro aspecto para Di' Arco, con las mismas animaciones y ventajas. Se ve en la ficha del personaje, al jugar con ella y cuando te acompaña." },
    // (solo aparece cuando Eira ya se puede comprar)
    { id: 'skin_eira', kind: 'skin', char: 'eira', price: 220, name: '13: aspecto secundario', hidden: () => !treceSeen(),
      desc: 'Otro aspecto para 13, con las mismas animaciones y ventajas. Se ve en la ficha del personaje, al jugar con ella y cuando te acompaña.' },
    // Eira Trece: solo aparece después de que la Trece se escape de su celda en la Red del Capitolio (ver rescue.js)
    { id: 'char_eira', kind: 'char', char: 'eira', price: 900, name: '13', hidden: () => !treceSeen(),
      desc: 'Del grupo original de «los supervivientes». Los Escorpiones arrasaron su asentamiento; desde entonces los caza uno a uno. Todos la llaman «Trece», amigos y enemigos; solo Grimes la llama por su nombre: Eira. Oye como Vera, se mueve como Di\' Arco, golpea como Booster y se esconde mejor que nadie. Solo ella sabe fabricar la rompepandora: una lata con polvo reactivo y clavos que revienta al chocar.' },
    // Grimes: solo aparece después de vengar a la Trece (ver Run.winBoss)
    { id: 'char_grimes', kind: 'char', char: 'grimes', price: 1100, name: 'Grimes', hidden: () => !grimesSeen(),
      desc: 'Antiguo líder de los Supervivientes. Conoció el precio de liderar cuando su grupo fue derrotado y los Escorpiones lo torturaron y lo esclavizaron. Frío, implacable y experimentado. Empieza con su revólver al máximo, un subfusil y su hacha, que no se rompe. Esquiva, aguanta, su revólver pega más y encuentra más balas de revólver que nadie; cualquier escopeta que coja, al máximo.' }
  ];

  function load() {
    try { const r = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; return { spent: +r.spent || 0, owned: r.owned || {} }; }
    catch (e) { return { spent: 0, owned: {} }; }
  }
  function save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* sin almacenamiento */ } }

  // ---------- vista previa (un renderizador aparte, pequeño, solo mientras se mira) ----------
  let P = null;
  function ensure() {
    if (P) return P;
    const cv = document.createElement('canvas');
    cv.className = 'xp-cv';
    let r;
    try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return null; }
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0x7d848c, 0x15110e, 0.6));
    const key = new THREE.DirectionalLight(0xffe0bf, 1.15); key.position.set(-1.6, 2.6, 2.4); sc.add(key);
    const rim = new THREE.DirectionalLight(0x86b0d4, 0.9); rim.position.set(1.8, 2.2, -2.6); sc.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.7 }));
    floor.rotation.x = -Math.PI / 2; sc.add(floor);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
    cam.position.set(0, 1.2, 4.0); cam.lookAt(0, 0.92, 0);
    P = { cv, r, sc, cam, models: {}, cur: null, raf: 0, last: 0, t: 0, pose: {} };
    return P;
  }
  function model(item) {
    if (P.models[item.id]) return P.models[item.id];
    let h = null;
    if (item.kind === 'skin' || item.kind === 'char') {
      const C = G.Player.CHARS[item.char];
      const opts = G.Player.skinOpts ? G.Player.skinOpts(item.char) : C.opts;
      h = G.Models.createHumanoid(opts);
      if (G.Models.setBackpack) G.Models.setBackpack(h, !(C.perks && C.perks.packless));
      h.female = !!C.opts.female;
      if (C.scale) h.root.scale.setScalar(C.scale);
    }
    if (h) P.sc.add(h.root);
    P.models[item.id] = h;
    return h;
  }
  function frame(now) {
    if (!P || !P.cur) return;
    P.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - (P.last || now)) / 1000)); P.last = now; P.t += dt;
    const host = P.cv.parentNode;
    if (!host) return;
    const w = Math.max(60, host.clientWidth | 0), hh = Math.max(60, host.clientHeight | 0);
    if (P.w !== w || P.h !== hh) { P.w = w; P.h = hh; P.r.setSize(w, hh, false); P.cam.aspect = w / hh; P.cam.updateProjectionMatrix(); }
    const h = P.cur, t = P.t, sin = Math.sin;
    h.root.rotation.y = -0.5 + t * 0.55;            // gira despacio (se ve por todos lados)
    Object.assign(P.pose, {
      phase: 0, amt: 0, run: false, crouch: 0, prone: 0, rel: 0, hop: 0, cat: 'none', two: false, aim: false, dt, time: t,
      action: null, t: 0, climb: null, dodge: null, dodgeRel: 0, gun: null, pitch: 0, guard: 0, speed: 0, female: h.female,
      turn: 0, acc: 0, breath: 0.15, breathT: t * 1.6, look: { yaw: sin(t * 0.35) * 0.2, pitch: 0.04 + sin(t * 0.21) * 0.04, w: 1 },
      alert: 0, fidget: null, blow: null, struggle: null, cover: null, draw: null
    });
    G.Models.posePlayer(h, P.pose);
    P.r.render(P.sc, P.cam);
  }

  const Extras = {
    ITEMS,
    // puntos: los ganados (logros y desafíos) menos lo gastado
    get earned() { return G.Run && G.Run.dareEarned ? G.Run.dareEarned() : 0; },
    get spent() { return load().spent; },
    get points() { return Math.max(0, this.earned - this.spent); },
    owns(id) { return !!load().owned[id]; },
    // ¿se ve en la lista? (Eira, solo después de su huida)
    visible(id) { const it = this.item(id); return !!it && (!it.hidden || !it.hidden() || this.owns(id)); },
    get treceSeen() { return treceSeen(); },
    get grimesSeen() { return grimesSeen(); },
    markGrimes() { try { if (!grimesSeen()) { localStorage.setItem(GRIMES_KEY, String(Date.now())); return true; } } catch (e) { /* sin almacenamiento */ } return false; },
    markTrece() { try { if (!treceSeen()) { localStorage.setItem(TRECE_KEY, String(Date.now())); return true; } } catch (e) { /* sin almacenamiento */ } return false; },
    item(id) { return ITEMS.find((x) => x.id === id) || null; },
    // comprar: { ok, msg }
    buy(id) {
      const it = this.item(id);
      if (!it || !this.visible(id)) return { ok: false, msg: 'No existe' };
      const r = load();
      if (r.owned[id]) return { ok: false, msg: 'Ya lo tienes' };
      const pts = Math.max(0, this.earned - r.spent);
      if (pts < it.price) return { ok: false, msg: 'Te faltan ' + (it.price - pts) + ' puntos de desafiante' };
      r.spent += it.price; r.owned[id] = Date.now();
      save(r);
      // un aspecto recién comprado se pone solo
      if (it.kind === 'skin' && G.Player && G.Player.setSkin) G.Player.setSkin(it.char, true, G.Settings && G.Settings.player);
      if (it.kind === 'char' && G.Menus && G.Menus.refreshChars) G.Menus.refreshChars();
      if (G.Audio) G.Audio.play('pickup');
      return { ok: true, msg: it.name + ': comprado' };
    },
    // la vista previa dentro de host (un elemento del panel); hide la quita y deja de dibujar
    show(host, id) {
      const it = this.item(id);
      if (!host || !it || !ensure()) return false;
      if (P.cv.parentNode !== host) host.appendChild(P.cv);
      for (const k in P.models) if (P.models[k]) P.models[k].root.visible = k === id;
      P.cur = model(it);
      if (!P.cur) return false;
      P.cur.root.visible = true;
      if (!P.raf) { P.last = 0; P.raf = requestAnimationFrame(frame); }
      return true;
    },
    hide() {
      if (!P) return;
      if (P.raf) cancelAnimationFrame(P.raf);
      P.raf = 0; P.cur = null;
      if (P.cv.parentNode) P.cv.parentNode.removeChild(P.cv);
    }
  };
  G.Extras = Extras;
})(window.Game = window.Game || {});
