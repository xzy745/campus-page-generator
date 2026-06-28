/*!
 * fluid-bg.js — 全局 WebGL 流体背景（鼠标搅动发光流体）。
 * 任意页面 <script src="/fluid-bg.js" defer></script> 即可。
 * 加 data-auto="1" 则开启“自动游走”模式：无需动鼠标，背景自己持续泛起流体。
 *   例：<script src="/fluid-bg.js" data-auto="1" defer></script>
 * 自建固定全屏画布作为背景，把页面内容抬到其上；流体只在“背景露出”的区域可见。
 * 容错：减少动画 / 不支持 WebGL / CDN 失败 → 安静跳过，不影响页面。
 * 依赖 webgl-fluid（cloydlau，Pavel 流体模拟 ESM 移植），按需从 CDN 加载。
 */
(function () {
  if (window.__fluidBgLoaded) return;
  window.__fluidBgLoaded = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return;
  } catch (e) { return; }

  // 是否开启自动游走（任一 fluid-bg 脚本带 data-auto 即开启）
  var AUTO = !!document.querySelector('script[src*="fluid-bg.js"][data-auto]');

  function start() {
    if (document.getElementById('global-fluid')) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'global-fluid';
    canvas.setAttribute('aria-hidden', 'true');
    var s = canvas.style;
    s.position = 'fixed'; s.top = '0'; s.left = '0';
    s.width = '100%'; s.height = '100%';
    s.zIndex = '0'; s.pointerEvents = 'auto'; s.display = 'block';
    document.body.insertBefore(canvas, document.body.firstChild);

    // 把页面其它内容抬到流体之上（静态 → 相对定位 z-index:1），让流体作为背景层
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === canvas) return;
      var cs = window.getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      if (!el.style.zIndex && (cs.zIndex === 'auto' || cs.zIndex === '0')) el.style.zIndex = '1';
    });

    var sc = document.createElement('script');
    sc.src = '/webgl-fluid.js';   // 本地托管，避免 cdn.jsdelivr.net 在国内被墙导致流体背景加载失败
    sc.onload = function () {
      if (typeof WebGLFluid !== 'function') return;
      try {
        WebGLFluid(canvas, {
          TRIGGER: 'hover', IMMEDIATE: true, AUTO: false,
          // 降低模拟/染色分辨率，大幅减少每帧 GPU 片元工作量（观感几乎不变，滚动更顺）
          SIM_RESOLUTION: 96, DYE_RESOLUTION: 512,
          DENSITY_DISSIPATION: 2.1, VELOCITY_DISSIPATION: 0.5, PRESSURE: 0.8, PRESSURE_ITERATIONS: 16,
          CURL: 22, SPLAT_RADIUS: 0.22, SPLAT_FORCE: 6000, SHADING: true,
          COLORFUL: false, SPLAT_COLOR: { r: 0.05, g: 0.08, b: 0.26 },  // 暗靛蓝，淡
          TRANSPARENT: true, BACK_COLOR: { r: 0.035, g: 0.035, b: 0.043 },
          BLOOM: false, SUNRAYS: false   // 关闭辉光额外 pass，进一步减负
        });
        // 库在 init 后用 setTimeout 挂载 mousemove 监听，稍等再启动自动游走
        if (AUTO) setTimeout(function () { autoWander(canvas); }, 350);
      } catch (e) { /* 初始化异常：安静跳过 */ }
    };
    sc.onerror = function () { /* CDN 失败：安静跳过 */ };
    document.head.appendChild(sc);
  }

  // 自动游走：用合成 mousemove（强制写入 offsetX/offsetY）驱动一个平滑移动的虚拟指针，
  // 直接 dispatch 到画布（绕过命中测试），让背景无需真鼠标也持续泛起流体。
  function autoWander(canvas) {
    var W = window.innerWidth, H = window.innerHeight, t0 = performance.now();
    window.addEventListener('resize', function () { W = window.innerWidth; H = window.innerHeight; });

    function fire(x, y) {
      var ev = new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true, view: window });
      try {
        Object.defineProperty(ev, 'offsetX', { value: x });
        Object.defineProperty(ev, 'offsetY', { value: y });
      } catch (e) { /* 个别浏览器不可覆盖：退化为角落，仍不报错 */ }
      canvas.dispatchEvent(ev);
    }

    var frameCount = 0;
    function tick(now) {
      // 隔帧注入一次（减半合成开销，轨迹仍平滑连续）
      if ((frameCount++ & 1) === 0) {
        var t = (now - t0) / 1000;
        // 两组不同频率的正余弦叠加 → 平滑、不重复的游走轨迹（Lissajous）
        var x = (0.5 + 0.36 * Math.sin(t * 0.27) + 0.12 * Math.sin(t * 0.61 + 1.3)) * W;
        var y = (0.5 + 0.30 * Math.cos(t * 0.33) + 0.10 * Math.cos(t * 0.71 + 0.7)) * H;
        fire(x, y);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
