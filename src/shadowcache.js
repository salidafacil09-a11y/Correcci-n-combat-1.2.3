// Sombras del sol en dos capas.
// El mapa de sombras dibuja la escena entera otra vez (desde el sol): es casi la mitad del coste de cada fotograma.
// Pero casas, árboles, coches y rocas no se mueven, y el sol avanza muy despacio. Así que:
//  · capa fija: el mundo (los trozos del mapa). Se dibuja solo cuando cambia algo (el sol da un paso, se carga un
//    trozo, se abre una puerta, un árbol cambia de detalle...) y se guarda aparte.
//  · capa móvil: todo lo demás (tú, los infectados, la gente, lo que se lanza). Cada fotograma se copia la capa
//    fija al mapa de sombras (con su profundidad) y encima se dibuja solo lo que se mueve.
// Se ve igual: lo que se mueve sigue proyectando su sombra en cada fotograma.
// Lo fijo es lo que cuelga de un grupo marcado con userData.shStatic (los trozos del mundo).
(function (G) {
  'use strict';

  let R = null, sun = null, ok = false;
  let copyMat = null, copyScene = null, copyCam = null, staticRT = null;
  let dirtyF = true, key = '', tick = 0, frameN = 0, active = false;
  const hid = [];
  const noClear = function () {};
  // para el contador del modo desarrollador
  const stats = { statics: 0, staticRate: 0, draws: 0, on: false, _t: 0, _n: 0 };

  function init(renderer, light) {
    R = renderer; sun = light;
    // copiar la profundidad exige escribirla desde el sombreador (WebGL2, o la extensión en WebGL1)
    ok = !!(R.capabilities.isWebGL2 || R.extensions.get('EXT_frag_depth'));
    if (!ok) return;
    copyMat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null } },
      vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        '#include <packing>',
        'uniform sampler2D tMap;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec4 c = texture2D(tMap, vUv);',
        '  gl_FragColor = c;',
        '  gl_FragDepthEXT = clamp(unpackRGBAToDepth(c), 0.0, 1.0);',
        '}'].join('\n'),
      depthTest: true, depthWrite: true
    });
    copyMat.depthFunc = THREE.AlwaysDepth;
    copyMat.extensions.fragDepth = true;
    copyMat.toneMapped = false;
    copyMat.fog = false;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
    quad.frustumCulled = false;
    copyScene = new THREE.Scene();
    copyScene.add(quad);
    copyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  function blit(tex, rt) {
    copyMat.uniforms.tMap.value = tex;
    R.setRenderTarget(rt);
    R.render(copyScene, copyCam);
  }

  function ensureRT(map) {
    const w = map.width, h = map.height;
    if (staticRT && staticRT.width === w && staticRT.height === h) return;
    if (staticRT) staticRT.dispose();
    staticRT = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false });
    staticRT.texture.generateMipmaps = false;
    dirtyF = true;
  }

  // oculta (para el pase del sol) los hijos de la escena que sean fijos (wantStatic) o los que no lo sean
  function hide(scene, staticOnes) {
    const ch = scene.children;
    for (let i = 0; i < ch.length; i++) {
      const o = ch[i];
      if (!o.visible || o.isLight) continue;
      if (!!(o.userData && o.userData.shStatic) === staticOnes) { o.visible = false; hid.push(o); }
    }
  }
  function restore() { for (let i = 0; i < hid.length; i++) hid[i].visible = true; hid.length = 0; }

  function sunPass(scene, camera, clear) {
    const c = R.clear;
    if (!clear) R.clear = noClear;
    sun.shadow.needsUpdate = true;
    try { R.shadowMap.render([sun], scene, camera); } finally { R.clear = c; }
  }

  // Antes de pintar la escena. true si se encargó de la sombra del sol (y la escena ya tiene las matrices al día).
  // Si algo falla (un móvil que no sabe copiar la profundidad...), se apaga y las sombras van como siempre
  function frame(scene, camera, half) {
    try { return frameIn(scene, camera, half); }
    catch (e) {
      console.warn('ShadowCache: apagado', e && e.message);
      ok = false; restore();
      try { R.setRenderTarget(null); } catch (e2) { /* nada */ }
      off();
      return false;
    }
  }
  // ¿el sombreador de copia compiló? (si no, three.js no lo dice: se comprobaría con una sombra que no está)
  let checked = false;
  function copyOk() {
    if (checked) return true;
    const pr = R.properties && R.properties.get(copyMat).program;
    if (!pr) return true;
    checked = true;
    if (pr.diagnostics && pr.diagnostics.runnable === false) { console.warn('ShadowCache: la copia no compila'); return false; }
    return true;
  }
  // (en el modo desarrollador se puede apagar, para comparar con el contador)
  const KEY = 'ceniza.sombracapas';
  let enabled = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } })();
  function setEnabled(v) { enabled = !!v; try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (e) { /* nada */ } off(); }
  function frameIn(scene, camera, half) {
    frameN++;
    if (!ok || !enabled || !sun.castShadow || !R.shadowMap.enabled) { off(); return false; }
    active = true;
    const sh = sun.shadow;
    sh.autoUpdate = false;                 // (el pase normal de la escena ya no rehace la del sol)
    R.shadowMap.autoUpdate = true;         // (las otras luces con sombra, si las hubiera, siguen como siempre)
    scene.updateMatrixWorld();
    // el sol da un paso, cambia el tamaño o el detalle de la sombra: hay que rehacer la capa fija
    const p = sun.position, t = sun.target.position, cam = sh.camera;
    const k = p.x + ',' + p.y + ',' + p.z + ',' + t.x + ',' + t.z + ',' + sh.mapSize.x + ',' + cam.right + ',' + cam.far;
    if (k !== key) { key = k; dirtyF = true; }
    if (!sh.map || !staticRT || staticRT.width !== sh.map.width) dirtyF = true;
    // (por si algo cambió sin avisar: cada segundo y medio, de todas formas)
    if (++tick >= 90) dirtyF = true;
    const c0 = R.info.render.calls;
    if (dirtyF) {
      // 1) lo fijo, solo
      hide(scene, false);
      try { sunPass(scene, camera, true); } finally { restore(); }
      ensureRT(sh.map);
      blit(sh.map.texture, staticRT);
      if (!copyOk()) throw new Error('copia');
      // 2) lo que se mueve, encima (la profundidad de lo fijo sigue en el mapa de sombras)
      hide(scene, true);
      try { sunPass(scene, camera, false); } finally { restore(); }
      dirtyF = false; tick = 0; stats._n++;
    } else if (!half || (frameN & 1) === 0) {
      // 1) lo fijo, copiado (color y profundidad); 2) lo que se mueve, encima
      blit(staticRT.texture, sh.map);
      hide(scene, true);
      try { sunPass(scene, camera, false); } finally { restore(); }
    }
    R.setRenderTarget(null);
    stats.draws = R.info.render.calls - c0;
    stats.on = true;
    return true;
  }

  // Cuando se pinta otra cosa (menús, refugio, la calle del prólogo): el sol vuelve a lo de siempre
  function off() {
    if (sun) sun.shadow.autoUpdate = true;
    if (active) { active = false; dirtyF = true; }
    stats.on = false;
  }

  // algo fijo cambió (un trozo nuevo, una puerta, una pared derribada, un árbol que cambia de detalle...)
  function dirty() { dirtyF = true; }

  // sombras fijas rehechas por segundo (para el contador)
  function rate(dt) {
    stats._t += dt;
    if (stats._t >= 1) { stats.staticRate = stats._n / stats._t; stats._n = 0; stats._t = 0; }
    return stats;
  }

  G.ShadowCache = { init, frame, off, dirty, rate, stats, get ok() { return ok; }, get enabled() { return enabled; }, setEnabled };
})(window.Game = window.Game || {});
