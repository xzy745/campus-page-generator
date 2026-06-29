/* ============================================================
   ink-ripple.js —— 鼠标跟随「水墨涟漪」（Three.js WebGL 波纹模拟）
   ------------------------------------------------------------
   做法：高度场水波模拟（Hugo-Elias 经典算法）跑在两张浮点纹理上
   做乒乓；鼠标移动处往高度场里滴一滴「墨」，波纹自行扩散、衰减、
   反射。渲染层把高度梯度染成本站的青/蓝两色发光墨线，叠加在深色
   蓝图栅格之上、正文之下（z-index:-1）。
   容错：不支持 WebGL / 浮点纹理 / Three.js 未加载 → 安静跳过，
   绝不影响页面内容（画布本身透明）。
   ============================================================ */
(function () {
  'use strict';
  if (window.__inkRippleLoaded) return;
  window.__inkRippleLoaded = true;

  var THREE = window.THREE;
  if (!THREE) { console.warn('[ink-ripple] Three.js 未加载，水墨涟漪降级'); return; }

  // WebGL 探针
  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  var COARSE = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  if (COARSE) DPR = Math.min(DPR, 1.25);

  // ───── 画布：固定全屏、置于栅格之上正文之下、不挡点击 ─────
  var canvas = document.createElement('canvas');
  canvas.id = 'ink-ripple';
  canvas.setAttribute('aria-hidden', 'true');
  var st = canvas.style;
  st.position = 'fixed'; st.inset = '0'; st.width = '100%'; st.height = '100%';
  st.zIndex = '-1'; st.pointerEvents = 'none'; st.opacity = '0';
  st.transition = 'opacity 1.2s ease';
  document.body.appendChild(canvas);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, premultipliedAlpha: false });
  } catch (e) { canvas.remove(); return; }
  renderer.setClearColor(0x000000, 0);

  // 浮点纹理：高度场需要负值与精度，UnsignedByte 不够 → 用半浮点
  var FloatTexType = THREE.HalfFloatType;
  if (!renderer.extensions.get('OES_texture_half_float')) {
    if (renderer.capabilities.isWebGL2) { FloatTexType = THREE.HalfFloatType; }
    else { FloatTexType = THREE.FloatType; }
  }

  // ───── 模拟分辨率（与显示无关，固定网格保证手感一致）─────
  var SIM_H = COARSE ? 180 : 256;
  var simW = SIM_H, simH = SIM_H;

  function makeRT(w, h) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: FloatTexType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false, stencilBuffer: false
    });
  }
  var rtA = makeRT(simW, simH);
  var rtB = makeRT(simW, simH);

  var scene = new THREE.Scene();
  var camera = new THREE.Camera();
  var quad = new THREE.PlaneGeometry(2, 2);

  // ── 模拟着色器：波动方程 + 鼠标滴墨 ──
  var simMat = new THREE.ShaderMaterial({
    uniforms: {
      uState:   { value: null },
      uTexel:   { value: new THREE.Vector2(1 / simW, 1 / simH) },
      uMouse:   { value: new THREE.Vector2(-1, -1) },
      uForce:   { value: 0 },
      uRadius:  { value: 0.045 },
      uAspect:  { value: simW / simH },
      uDamping: { value: 0.974 }
    },
    vertexShader:
      'varying vec2 vUv;' +
      'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:
      'precision highp float;' +
      'varying vec2 vUv;' +
      'uniform sampler2D uState; uniform vec2 uTexel; uniform vec2 uMouse;' +
      'uniform float uForce; uniform float uRadius; uniform float uAspect; uniform float uDamping;' +
      'void main(){' +
      '  vec4 s = texture2D(uState, vUv);' +
      '  float curr = s.r; float prev = s.g;' +
      '  float l = texture2D(uState, vUv + vec2(-uTexel.x, 0.0)).r;' +
      '  float r = texture2D(uState, vUv + vec2( uTexel.x, 0.0)).r;' +
      '  float u = texture2D(uState, vUv + vec2(0.0,  uTexel.y)).r;' +
      '  float d = texture2D(uState, vUv + vec2(0.0, -uTexel.y)).r;' +
      '  float nh = (l + r + u + d) * 0.5 - prev;' +
      '  nh *= uDamping;' +
      '  if (uMouse.x >= 0.0 && uForce != 0.0) {' +
      '    vec2 diff = vUv - uMouse; diff.x *= uAspect;' +
      '    float dist = length(diff);' +
      '    nh += uForce * smoothstep(uRadius, 0.0, dist);' +
      '  }' +
      '  gl_FragColor = vec4(nh, curr, 0.0, 1.0);' +
      '}'
  });

  // ── 渲染着色器：高度场 → 水墨发光墨线 ──
  var rndMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false,
    uniforms: {
      uState: { value: null },
      uTexel: { value: new THREE.Vector2(1 / simW, 1 / simH) },
      uInkA:  { value: new THREE.Color(0x5b8cff) },  // 蓝
      uInkB:  { value: new THREE.Color(0x34e3d4) },  // 青
      uGain:  { value: 1.25 }
    },
    vertexShader:
      'varying vec2 vUv;' +
      'void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:
      'precision highp float;' +
      'varying vec2 vUv;' +
      'uniform sampler2D uState; uniform vec2 uTexel; uniform vec3 uInkA; uniform vec3 uInkB; uniform float uGain;' +
      'void main(){' +
      '  float h = texture2D(uState, vUv).r;' +
      '  float l = texture2D(uState, vUv + vec2(-uTexel.x, 0.0)).r;' +
      '  float r = texture2D(uState, vUv + vec2( uTexel.x, 0.0)).r;' +
      '  float u = texture2D(uState, vUv + vec2(0.0,  uTexel.y)).r;' +
      '  float d = texture2D(uState, vUv + vec2(0.0, -uTexel.y)).r;' +
      '  vec2 grad = vec2(r - l, u - d);' +
      '  float edge = length(grad);' +          // 波纹环（墨线）
      '  float amp = abs(h);' +                  // 墨色浓淡
      '  float t = clamp(h * 5.0 + 0.5, 0.0, 1.0);' +
      '  vec3 ink = mix(uInkB, uInkA, t);' +
      '  float intensity = clamp(edge * 7.0 + amp * 1.1, 0.0, 1.2);' +
      '  intensity = pow(intensity, 0.9) * uGain;' +
      '  vec3 col = ink * intensity;' +
      '  col += uInkB * pow(clamp(edge * 9.0, 0.0, 1.0), 2.0) * 0.45;' +  // 墨线高光
      '  gl_FragColor = vec4(col, clamp(intensity, 0.0, 1.0));' +
      '}'
  });

  var mesh = new THREE.Mesh(quad, simMat);
  scene.add(mesh);

  // ───── 尺寸 ─────
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(DPR);
    renderer.setSize(w, h, false);
    // 模拟网格按视口宽高比拉伸，保证涟漪是圆的
    var aspect = w / h;
    simW = aspect >= 1 ? Math.round(SIM_H * aspect) : SIM_H;
    simH = aspect >= 1 ? SIM_H : Math.round(SIM_H / aspect);
    simW = Math.min(simW, 420); simH = Math.min(simH, 420);
    rtA.setSize(simW, simH); rtB.setSize(simW, simH);
    simMat.uniforms.uTexel.value.set(1 / simW, 1 / simH);
    simMat.uniforms.uAspect.value = simW / simH;
    rndMat.uniforms.uTexel.value.set(1 / simW, 1 / simH);
  }
  resize();
  window.addEventListener('resize', resize);

  // ───── 输入：鼠标 / 触摸 → 滴墨 ─────
  var mouse = new THREE.Vector2(-1, -1);
  var moveForce = 0;       // 主动移动产生的拖尾力（快速衰减）
  var lastX = 0, lastY = 0, hasLast = false;
  var lastMoveAt = -1e9;   // 上次鼠标移动时刻（ms）
  var HOLD_MS = 1100;      // 鼠标暂停后，涟漪继续「停滞」的时长——到点才开始自然消散
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function setFromClient(cx, cy) {
    var ux = cx / window.innerWidth;
    var uy = 1.0 - cy / window.innerHeight;   // 翻转 Y
    if (hasLast) {
      var dx = cx - lastX, dy = cy - lastY;
      var speed = Math.sqrt(dx * dx + dy * dy);
      moveForce = Math.min(0.018 + speed * 0.0009, 0.09);
    } else {
      moveForce = 0.02;
    }
    lastX = cx; lastY = cy; hasLast = true;
    mouse.set(ux, uy);
    lastMoveAt = now();
    reveal();
  }
  window.addEventListener('mousemove', function (e) { setFromClient(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener('mousedown', function (e) { setFromClient(e.clientX, e.clientY); moveForce = 0.11; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches[0]) setFromClient(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  var revealed = false;
  function reveal() { if (!revealed) { revealed = true; canvas.style.opacity = '1'; } }

  // ───── 渲染循环 ─────
  function step() {
    var t = now();
    var sinceMove = t - lastMoveAt;
    var active = mouse.x >= 0;

    // 注入力 = 主动移动的拖尾 ＋ 暂停后的「停滞」轻柔维持
    // 鼠标一停，给一个随停滞窗口缓缓减弱、并轻微脉动的维持力，让水面在原地继续荡漾，
    // 直到 HOLD_MS 用尽才撤掉注入点、交给阻尼自然消散。
    var inject = moveForce;
    if (active && sinceMove > 70) {
      var holdT = 1 - sinceMove / HOLD_MS;            // 1 → 0
      if (holdT > 0) {
        var sustain = 0.011 * holdT * (0.65 + 0.35 * Math.sin(t * 0.006));
        if (sustain > inject) inject = sustain;
      }
    }

    // 乒乓一步水波模拟
    simMat.uniforms.uState.value = rtA.texture;
    simMat.uniforms.uMouse.value.copy(mouse);
    simMat.uniforms.uForce.value = inject;
    mesh.material = simMat;
    renderer.setRenderTarget(rtB);
    renderer.render(scene, camera);

    // 交换缓冲
    var tmp = rtA; rtA = rtB; rtB = tmp;

    moveForce *= 0.86;

    // 停滞窗口结束 → 撤掉注入点，波纹靠阻尼缓缓淡出
    if (active && sinceMove >= HOLD_MS) { mouse.set(-1, -1); hasLast = false; }

    // 完全空闲时，偶尔自发一滴「墨」（单帧），让背景始终有微动（不抢眼）
    if (!active && Math.random() < 0.016) {
      mouse.set(Math.random(), Math.random());
      moveForce = 0.05;          // 不更新 lastMoveAt：本滴不进入停滞窗口，注入一帧后即撤点
      reveal();
    }

    // 上屏
    rndMat.uniforms.uState.value = rtA.texture;
    mesh.material = rndMat;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  var running = true;
  function loop() {
    if (running) step();
    requestAnimationFrame(loop);
  }
  // 标签页隐藏时暂停，省电
  document.addEventListener('visibilitychange', function () { running = !document.hidden; });
  requestAnimationFrame(loop);
})();
