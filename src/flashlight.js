// La linterna (como en The Last of Us Parte II, imitada): enganchada a la correa del pecho, apunta adonde mira la
// cámara (al centro de la pantalla) y pinta en las paredes un círculo de luz fría con anillos: un punto central muy
// brillante, un anillo algo más oscuro, otro más claro, el disco grande con el borde del reflector y un halo tenue
// alrededor. Proyecta sombras de lo que tiene delante.
//
// Cómo funciona: three.js r128 ilumina el MeshLambertMaterial por vértice (una pared grande son dos triángulos: un
// foco normal ni se vería), y su SpotLight no admite dibujo. Así que la linterna no es una luz de three.js: se
// inyecta en el sombreador de TODOS los MeshLambertMaterial (onBeforeCompile del prototipo, y G.Flash.patch para los
// que traen el suyo) un cálculo por píxel: la luz, el dibujo de los anillos (según el ángulo al eje), la caída con
// la distancia y la sombra. La sombra sale de un mapa de profundidad propio (se pinta la escena desde la linterna
// cada fotograma, solo en calidad media o más). Los valores van en uniformes compartidos por todos los materiales
// (arrays que three.js no copia), así que se actualizan una vez por fotograma para todos.
(function (G) {
  'use strict';

  // ---- ajustes ----
  const OUTER = 15 * Math.PI / 180;    // medio ángulo del disco principal (los anillos y el borde están dentro)
  const RANGE = 22;                    // alcance (m)
  const COLOR = [0.84, 0.93, 1.06];    // blanco frío, algo azulado
  const POWER = 2.7;
  const SHADOW = { baja: 0, media: 512, alta: 512, muy: 1024 };

  // ---- uniformes compartidos (por referencia: Float32Array no se clona) ----
  // uFlA (mat4, columna a columna): [pos, encendida] [dir, -] [color, alcance] [ángulo, sombra, texel, sesgo]
  // uFlB: [donde da la luz (centro del círculo), rebote] [derecha del haz, modo faro] [alto/ancho del faro, -, -, -]
  // (modo faro: los faros del patrullero, G.Flash.external: un haz ancho y bajo, sin anillos, que llega lejos)
  const A = new Float32Array(16), VP = new Float32Array(16), B = new Float32Array(16);
  const U = { uFlA: { value: A }, uFlVP: { value: VP }, uFlB: { value: B }, uFlMap: { value: null } };

  const VERT_PARS = 'varying vec3 vFlW;\nvarying vec3 vFlN;\n';
  const VERT_MAIN = [
    '#include <fog_vertex>',
    '{',
    '  vec4 flW = vec4( transformed, 1.0 );',
    '  #ifdef USE_INSTANCING',
    '    flW = instanceMatrix * flW;',
    '  #endif',
    '  vFlW = ( modelMatrix * flW ).xyz;',
    '  vFlN = inverseTransformDirection( transformedNormal, viewMatrix );',
    '}'
  ].join('\n');
  const FRAG_PARS = [
    'uniform mat4 uFlA;',
    'uniform mat4 uFlVP;',
    'uniform mat4 uFlB;',
    'uniform sampler2D uFlMap;',
    'varying vec3 vFlW;',
    'varying vec3 vFlN;',
    // el dibujo del haz (r: 0 en el centro, 1 en el borde del disco)
    'float flPattern( float r ) {',
    '  float body = 1.0 - smoothstep( 0.86, 1.0, r );',
    '  float core = exp( - r * r / 0.0121 ) * 1.15;',
    '  float g1 = ( r - 0.24 ) / 0.07, g2 = ( r - 0.43 ) / 0.06, g3 = ( r - 0.6 ) / 0.08, g4 = ( r - 0.9 ) / 0.045;',
    '  float rings = ( 1.0 - 0.34 * exp( - g1 * g1 ) ) * ( 1.0 + 0.18 * exp( - g2 * g2 ) ) * ( 1.0 - 0.13 * exp( - g3 * g3 ) );',
    '  float grain = 1.0 + 0.045 * sin( r * 57.0 );',
    '  float rim = 0.24 * exp( - g4 * g4 );',
    '  float halo = 0.15 * ( 1.0 - smoothstep( 1.0, 1.7, r ) );',
    '  return body * ( 0.72 * rings * grain + rim ) + core + halo;',
    '}',
    // los faros: un óvalo ancho y bajo, liso, más fuerte en el centro y con un halo suave
    'float flHead( float r ) {',
    '  return ( 1.0 - smoothstep( 0.45, 1.0, r ) ) * 0.85 + exp( - r * r / 0.05 ) * 0.35 + 0.12 * ( 1.0 - smoothstep( 1.0, 1.6, r ) );',
    '}',
    // sombra: el mapa de profundidad desde la linterna (3 x 3 muestras para que el borde no sea de sierra)
    'float flShadow( vec3 wp, vec3 n ) {',
    '  vec4 sc = uFlVP * vec4( wp + n * 0.05, 1.0 );',
    '  if ( sc.w <= 0.0 ) return 1.0;',
    '  vec3 p = sc.xyz / sc.w * 0.5 + 0.5;',
    '  if ( p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0 ) return 1.0;',
    '  float tx = uFlA[ 3 ][ 2 ], bias = uFlA[ 3 ][ 3 ], s = 0.0;',
    '  for ( int i = -1; i <= 1; i ++ ) for ( int j = -1; j <= 1; j ++ ) {',
    '    float d = unpackRGBAToDepth( texture2D( uFlMap, p.xy + vec2( float( i ), float( j ) ) * tx ) );',
    '    s += step( p.z - bias, d );',
    '  }',
    '  return s / 9.0;',
    '}',
    'vec3 flashLight( vec3 base ) {',
    '  if ( uFlA[ 0 ][ 3 ] < 0.5 ) return vec3( 0.0 );',
    '  vec3 lp = vec3( uFlA[ 0 ][ 0 ], uFlA[ 0 ][ 1 ], uFlA[ 0 ][ 2 ] );',
    '  vec3 ld = vec3( uFlA[ 1 ][ 0 ], uFlA[ 1 ][ 1 ], uFlA[ 1 ][ 2 ] );',
    '  vec3 Lv = lp - vFlW;',
    '  float d = length( Lv );',
    '  float range = uFlA[ 2 ][ 3 ];',
    '  if ( d > range ) return vec3( 0.0 );',
    '  vec3 L = Lv / max( d, 1e-4 );',
    '  float head = uFlB[ 1 ][ 3 ];',
    '  float r;',
    '  if ( head > 0.5 ) {',
    '    vec3 rt = vec3( uFlB[ 1 ][ 0 ], uFlB[ 1 ][ 1 ], uFlB[ 1 ][ 2 ] );',
    '    vec3 up = cross( rt, ld );',
    '    float fw = dot( - L, ld );',
    '    if ( fw <= 0.02 ) return vec3( 0.0 );',
    '    float tn = tan( uFlA[ 3 ][ 0 ] );',
    '    r = length( vec2( dot( - L, rt ) / fw / tn, dot( - L, up ) / fw / ( tn * uFlB[ 2 ][ 0 ] ) ) );',
    '    if ( r > 1.6 ) return vec3( 0.0 );',
    '  } else {',
    '    r = acos( clamp( dot( - L, ld ), - 1.0, 1.0 ) ) / uFlA[ 3 ][ 0 ];',
    '    if ( r > 1.7 ) return vec3( 0.0 );',
    '  }',
    '  vec3 N = normalize( vFlN );',
    '  #ifdef DOUBLE_SIDED',
    '    N *= gl_FrontFacing ? 1.0 : -1.0;',
    '  #endif',
    '  float nl = max( dot( N, L ), 0.0 );',
    '  if ( nl <= 0.0 ) return vec3( 0.0 );',
    '  float x = d / range;',
    '  float att = ( 1.0 - x * x );',
    '  att = att * att / ( 1.0 + ( head > 0.5 ? 0.004 : 0.02 ) * d * d );',
    '  float sh = uFlA[ 3 ][ 1 ] > 0.5 ? flShadow( vFlW, N ) : 1.0;',
    '  return base * vec3( uFlA[ 2 ][ 0 ], uFlA[ 2 ][ 1 ], uFlA[ 2 ][ 2 ] ) * ( nl * att * ( head > 0.5 ? flHead( r ) : flPattern( r ) ) * sh );',
    '}',
    // el rebote: lo que ilumina la linterna aclara un poco lo de alrededor (sin dibujo ni sombra)
    'vec3 flashBounce( vec3 base ) {',
    '  if ( uFlA[ 0 ][ 3 ] < 0.5 ) return vec3( 0.0 );',
    '  vec3 hp = vec3( uFlB[ 0 ][ 0 ], uFlB[ 0 ][ 1 ], uFlB[ 0 ][ 2 ] );',
    '  float k = 1.0 - smoothstep( 0.0, 4.5, distance( vFlW, hp ) );',
    '  return base * vec3( uFlA[ 2 ][ 0 ], uFlA[ 2 ][ 1 ], uFlA[ 2 ][ 2 ] ) * ( uFlB[ 0 ][ 3 ] * k * k );',
    '}'
  ].join('\n');

  // mete la linterna en un sombreador Lambert (lo usan también los materiales con su propio onBeforeCompile)
  function patch(sh) {
    // (solo Lambert: los demás no tienen la normal en el vértice ni la luz en el píxel)
    if (!sh || sh.vertexShader.indexOf('vFlW') >= 0 || sh.vertexShader.indexOf('#define LAMBERT') < 0) return;
    if (sh.vertexShader.indexOf('#include <fog_vertex>') < 0 || sh.fragmentShader.indexOf('#include <envmap_fragment>') < 0) return;
    sh.uniforms.uFlA = U.uFlA; sh.uniforms.uFlVP = U.uFlVP; sh.uniforms.uFlB = U.uFlB; sh.uniforms.uFlMap = U.uFlMap;
    sh.vertexShader = VERT_PARS + sh.vertexShader.replace('#include <fog_vertex>', VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + FRAG_PARS)
      // la niebla solo se come en parte la luz de la linterna (se compensa antes de que se aplique): en la oscuridad
      // (la niebla negra de la estación) la linterna deja ver algo más lejos
      .replace('#include <envmap_fragment>', [
        'vec3 flAdd = flashLight( diffuseColor.rgb ) + flashBounce( diffuseColor.rgb );',
        '#if defined( USE_FOG ) && ! defined( FOG_EXP2 )',
        '  float flF = smoothstep( fogNear, fogFar, fogDepth );',
        '  flAdd *= ( 1.0 - 0.6 * flF ) / max( 1.0 - flF, 0.08 );',
        '#endif',
        'outgoingLight += flAdd;',
        '#include <envmap_fragment>'].join('\n'));
  }
  THREE.MeshLambertMaterial.prototype.onBeforeCompile = function (sh) { patch(sh); };

  // ---- estado ----
  let on = false, scene = null, model = null, lens = null, glow = null;
  let rt = null, rtSize = 0, depthMat = null, scam = null;
  const pos = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, 1), want = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), cdir = new THREE.Vector3();
  let sway = 0, warm = 0, flick = 0, scanT = 0;
  // ext: otra luz que usa este mismo sistema (los faros del patrullero): { pos, dir, right, range, outer, vert, power,
  // color, bounce }. Mientras está puesta, la linterna no se usa
  let ext = null;
  const noShadow = [], mVP = new THREE.Matrix4(), ccol = new THREE.Color();

  // el aparato: cuerpo negro, cabeza más ancha, el cristal (que se enciende) y un brillo pequeño delante
  function build() {
    model = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1c1d1f });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10), dark);
    body.rotation.x = Math.PI / 2; body.position.z = -0.03; model.add(body);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.035, 12), dark);
    head.rotation.x = Math.PI / 2; head.position.z = 0.035; model.add(head);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.06), new THREE.MeshLambertMaterial({ color: 0x2e2a24 }));
    clip.position.set(0, -0.022, -0.02); model.add(clip);
    lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 14), new THREE.MeshBasicMaterial({ color: 0x222830 }));
    lens.position.z = 0.0531; lens.material.toneMapped = false; model.add(lens);
    // brillo del foco (un círculo difuminado que mira siempre a la cámara)
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(235,245,255,1)'); gr.addColorStop(0.25, 'rgba(190,215,255,0.55)'); gr.addColorStop(1, 'rgba(160,190,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.material.toneMapped = false;
    glow.scale.set(0.11, 0.11, 1); glow.position.z = 0.07; glow.visible = false;
    model.add(glow);
    model.visible = false;
    scene.add(model);
  }

  function ensureRT(size) {
    if (rt && rtSize === size) return;
    if (rt) rt.dispose();
    rtSize = size;
    rt = size ? new THREE.WebGLRenderTarget(size, size, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat }) : null;
    U.uFlMap.value = rt ? rt.texture : null;
  }

  // adónde mira la cámara: avanza por el rayo del centro de la pantalla hasta una pared, el suelo o el techo
  function aimPoint(camera, player) {
    const W = G.World, lv = player.lv || 0;
    camera.getWorldDirection(cdir);
    const o = camera.position;
    let px = o.x, pz = o.z, t = 0.4;
    const base = W.groundY(player.pos.x, player.pos.z, lv);
    const indoor = W.isIndoor(Math.floor(player.pos.x), Math.floor(player.pos.z), lv);
    for (; t < RANGE; t += 0.35) {
      const x = o.x + cdir.x * t, y = o.y + cdir.y * t, z = o.z + cdir.z * t;
      if (t > 1.2 && !W.hasClearLine(px, pz, x, z, lv)) break;
      if (y < W.groundY(x, z, lv)) break;
      if (indoor && y > base + 2.85) break;
      px = x; pz = z;
    }
    return want.set(o.x + cdir.x * t, o.y + cdir.y * t, o.z + cdir.z * t);
  }

  const Flash = {
    patch,
    get on() { return on; },
    // el haz de la linterna del jugador (para que los humanos la noten): de dónde sale, hacia dónde va, su medio
    // ángulo y su alcance. null si está apagada (o son los faros del patrullero)
    beam() { return on && !ext && A[3] > 0 ? { p: pos, d: dir, ang: OUTER, range: RANGE } : null; },
    init(sceneRef) {
      scene = sceneRef;
      build();
      depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true });
      scam = new THREE.PerspectiveCamera(2 * OUTER * 1.75 * 180 / Math.PI, 1, 0.2, RANGE);
    },
    set(v) {
      v = !!v;
      if (v === on) return on;
      on = v;
      if (on) warm = 0;
      if (G.Audio) G.Audio.play('flashClick', { on });
      document.body.classList.toggle('flash-on', on);
      return on;
    },
    toggle() { return this.set(!on); },
    // los faros del patrullero (G.Drive): la misma luz por píxel, con su sombra, pero con forma de faro
    external(e) { ext = e || null; if (!ext) B[7] = 0; },
    get ext() { return ext; },
    // cada fotograma, después de la cámara: dónde está, hacia dónde apunta y los uniformes
    update(dt, player, camera, active) {
      if (!model) return;
      if (ext) {
        model.visible = false; glow.visible = false;
        A[3] = ext.on === false ? 0 : 1; A[13] = 0;
        const P = ext.pos, D = ext.dir, Rr = ext.right, I = ext.power || 3;
        A[0] = P.x; A[1] = P.y; A[2] = P.z; A[4] = D.x; A[5] = D.y; A[6] = D.z;
        const C = ext.color || [1.0, 0.95, 0.82];
        A[8] = C[0] * I; A[9] = C[1] * I; A[10] = C[2] * I; A[11] = ext.range || 40; A[12] = ext.outer || 0.6;
        // el rebote, un poco por delante (en la calzada)
        const bd = Math.min(8, (ext.range || 40) * 0.2);
        B[0] = P.x + D.x * bd; B[1] = P.y - 0.6; B[2] = P.z + D.z * bd; B[3] = ext.bounce != null ? ext.bounce : 0.05;
        B[4] = Rr.x; B[5] = Rr.y; B[6] = Rr.z; B[7] = 1; B[8] = ext.vert || 0.4;
        pos.set(P.x, P.y, P.z);
        return;
      }
      B[7] = 0;
      const h = player && player.model;
      const show = on && active !== false && h && !player.dead && h.root.visible;
      A[3] = show ? 1 : 0;
      A[13] = 0;               // (la sombra, solo si este fotograma se pinta su mapa: ver render)
      model.visible = !!show; glow.visible = !!show;
      if (!show) return;
      // en la correa del pecho, a la izquierda (la base: el hueso del pecho; si no, a la altura del pecho)
      const f = player.facing;
      if (h.chest) h.chest.getWorldPosition(tmp); else tmp.set(player.pos.x, (player.y || 0) + 1.35, player.pos.z);
      const fx = Math.sin(f), fz = Math.cos(f), lx = Math.cos(f), lz = -Math.sin(f);
      pos.set(tmp.x + fx * 0.15 + lx * 0.1, tmp.y + 0.06, tmp.z + fz * 0.15 + lz * 0.1);
      // apunta al centro de la pantalla, con un poco de retraso y el vaivén del paso
      aimPoint(camera, player);
      tmp2.subVectors(want, pos);
      if (tmp2.lengthSq() < 0.01) tmp2.set(fx, 0, fz);
      tmp2.normalize();
      const k = 1 - Math.exp(-dt * 15);
      dir.lerp(tmp2, k).normalize();
      sway += dt * (2.2 + (player.speedNow || 0) * 1.5);
      const sw = Math.min(1, (player.speedNow || 0) / 4) * 0.012;
      tmp2.set(dir.x + Math.sin(sway) * sw, dir.y + Math.sin(sway * 2) * sw * 0.6, dir.z + Math.cos(sway) * sw).normalize();
      // al encenderla, un parpadeo corto
      warm = Math.min(1, warm + dt * 5);
      flick = warm < 1 ? (Math.random() < 0.5 ? 0.35 : 1) : 1;
      const I = POWER * flick;
      A[0] = pos.x; A[1] = pos.y; A[2] = pos.z;
      A[4] = tmp2.x; A[5] = tmp2.y; A[6] = tmp2.z;
      A[8] = COLOR[0] * I; A[9] = COLOR[1] * I; A[10] = COLOR[2] * I; A[11] = RANGE;
      A[12] = OUTER;
      // el rebote, centrado donde da la luz (más fuerte cuanto más cerca)
      const hd = Math.max(0.5, want.distanceTo(pos));
      B[0] = want.x - tmp2.x * 0.3; B[1] = want.y - tmp2.y * 0.3; B[2] = want.z - tmp2.z * 0.3;
      B[3] = 0.07 * Math.min(1, 6 / (hd * hd * 0.25 + 1));
      // el aparato y su cristal encendido
      model.position.copy(pos);
      model.lookAt(tmp.set(pos.x + tmp2.x, pos.y + tmp2.y, pos.z + tmp2.z));
      lens.material.color.setRGB(0.85 * flick, 0.92 * flick, 1.0 * flick);
      // el brillo del foco solo se ve si la linterna mira hacia la cámara
      camera.getWorldDirection(cdir);
      const face = Math.max(0, -(cdir.x * tmp2.x + cdir.y * tmp2.y + cdir.z * tmp2.z));
      glow.material.opacity = 0.8 * flick * face; glow.visible = face > 0.05;
    },
    // el mapa de sombras de la linterna (antes de pintar la escena)
    render(renderer, sceneRef, player) {
      if (!model || !A[3]) return;
      // (sombras de la linterna en calidad media o más, y si las sombras no están apagadas en Opciones)
      const q = G.Quality ? G.Quality.cur : null, key = G.Quality ? G.Quality.active : '';
      const size = q && q.shadows ? (SHADOW[key] != null ? SHADOW[key] : 512) : 0;
      ensureRT(size);
      A[13] = rt ? 1 : 0;
      if (!rt) return;
      A[14] = 1 / size; A[15] = 0.0009;
      // (los faros: la cámara de la sombra, ancha y baja como el haz, y hasta donde llega)
      const wantFov = ext ? Math.min(150, 2 * Math.atan(Math.tan(ext.outer || 0.6) * (ext.vert || 0.4) * 1.35) * 180 / Math.PI) : 2 * OUTER * 1.75 * 180 / Math.PI;
      const wantAsp = ext ? 2.2 : 1, wantFar = ext ? (ext.range || 40) : RANGE;
      if (scam.fov !== wantFov || scam.aspect !== wantAsp || scam.far !== wantFar) { scam.fov = wantFov; scam.aspect = wantAsp; scam.far = wantFar; }
      if (ext) { A[15] = 0.0016; }
      scam.position.copy(pos);
      scam.lookAt(tmp.set(pos.x + A[4], pos.y + A[5], pos.z + A[6]));
      scam.updateMatrixWorld(true);
      scam.updateProjectionMatrix();
      mVP.multiplyMatrices(scam.projectionMatrix, scam.matrixWorldInverse);
      VP.set(mVP.elements);
      // lo que no hace sombra: el propio personaje (la luz sale de su pecho), el aparato y las partículas
      const hide = [];
      const hideIt = (o) => { if (o && o.visible) { o.visible = false; hide.push(o); } };
      // (con los faros u otra luz de fuera, el personaje sí hace sombra)
      if (!ext) hideIt(player && player.model && player.model.root);
      hideIt(model);
      // (las partículas, los iconos y los brillos: se buscan cada medio segundo, no en cada fotograma)
      if (--scanT <= 0) { scanT = 30; noShadow.length = 0; sceneRef.traverse((o) => { if (o.isPoints || o.isSprite || (o.userData && o.userData.noFlashShadow)) noShadow.push(o); }); }
      for (const o of noShadow) hideIt(o);
      const bg = sceneRef.background, ov = sceneRef.overrideMaterial, au = renderer.shadowMap.autoUpdate, nu = renderer.shadowMap.needsUpdate;
      const cc = renderer.getClearColor(ccol), ca = renderer.getClearAlpha();
      sceneRef.background = null; sceneRef.overrideMaterial = depthMat;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, true, false);
      renderer.render(sceneRef, scam);
      renderer.setRenderTarget(null);
      renderer.setClearColor(cc, ca);
      sceneRef.background = bg; sceneRef.overrideMaterial = ov;
      renderer.shadowMap.autoUpdate = au; renderer.shadowMap.needsUpdate = nu;
      for (const o of hide) o.visible = true;
    }
  };

  G.Flash = Flash;
})(window.Game = window.Game || {});
