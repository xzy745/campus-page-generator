/*!
 * slice-transition.js — 五等分切片页面转场特效（剪辑风 · 质感版）
 * 零依赖结构；动画由 GSAP 驱动（缺失时可自动按需加载）。
 * 容错：GSAP 加载失败 / 用户「减少动画」/ 无 DOM 时，都会直接完成、不卡死页面。
 *
 * 作者：徐致远 · MIT License
 *
 * —— 快速用法 ——
 *   <script src="slice-transition.js"></script>
 *   <script>
 *     // 1) 入场揭幕（页面加载时）：切片盖屏 → 标题逐条升起 → 切片错位滑出露出页面
 *     SliceTransition.intro({ image: 'assets/hero-bg.jpg', text: '对话即渲染' });
 *   </script>
 *
 *   // 2) 页面间跳转转场：点链接 → 切片合拢盖屏 → 再跳转；目标页用 intro() 揭幕
 *   document.querySelectorAll('a[data-slice]').forEach(function (a) {
 *     a.addEventListener('click', function (e) {
 *       e.preventDefault();
 *       SliceTransition.leave(a.href, { image: 'assets/hero-bg.jpg', text: '加载中' });
 *     });
 *   });
 */
(function (global) {
  'use strict';

  var GSAP_CDN = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js';
  var STYLE_ID = 'slice-transition-style';

  var DEFAULTS = {
    slices: 5,            // 切片数（≥2）
    text: '',             // 封面大标题（留空则不显示）
    image: '',            // 封面背景图（留空则纯色背景）
    accent: '#6366f1',    // 主题色（切缝辉光 / 光罩 / 文字辉光）
    bg: '#09090b',        // 底色
    zIndex: 99999,
    grain: true,          // 胶片颗粒噪点
    autoGSAP: true,       // GSAP 缺失时自动从 CDN 加载
    onDone: null          // 动画结束回调（intro 揭幕完 / leave 即将跳转前）
  };

  function assign(a, b) { for (var k in b) if (b[k] !== undefined) a[k] = b[k]; return a; }

  function prefersReduced() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  // #6366f1 / #63f → "99,102,241"
  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    var h = hex.replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = `
.st-root{position:fixed;inset:0;overflow:hidden;}
.st-slices{position:absolute;inset:0;display:flex;z-index:1;}
.st-slice{flex:1 1 0;height:100%;overflow:hidden;position:relative;will-change:transform;}
.st-slice + .st-slice::before{content:"";position:absolute;top:0;left:0;width:1px;height:100%;z-index:4;
  background:linear-gradient(180deg,transparent,rgba(var(--st-accent-rgb),.5),transparent);}
.st-inner{position:absolute;top:0;left:0;height:100%;display:flex;align-items:center;justify-content:center;}
.st-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;
  filter:brightness(.46) saturate(.92) contrast(1.05);will-change:transform;}
.st-tint{position:absolute;inset:0;z-index:1;
  background:radial-gradient(70% 55% at 50% 42%,rgba(var(--st-accent-rgb),.34),transparent 72%),
            linear-gradient(180deg,rgba(9,9,11,.55),rgba(9,9,11,.84));}
.st-word{position:relative;z-index:2;display:inline-block;white-space:nowrap;will-change:transform;
  font-family:'Playfair Display','Noto Serif SC',Georgia,serif;font-weight:800;
  font-size:clamp(2.2rem,8vw,4.6rem);color:#fff;letter-spacing:.02em;
  text-shadow:0 4px 40px rgba(var(--st-accent-rgb),.45);}
.st-grain{position:absolute;inset:0;z-index:6;pointer-events:none;opacity:.16;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}`;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // 构建切片遮罩层；每条切片内放等大的背景图+标题，按列偏移对齐 → 拼成连续整图
  function build(opt) {
    injectStyle();
    var root = document.createElement('div');
    root.className = 'st-root';
    root.setAttribute('aria-hidden', 'true');
    root.style.zIndex = opt.zIndex;
    root.style.background = opt.bg;
    root.style.setProperty('--st-accent-rgb', hexToRgb(opt.accent) || '99,102,241');

    var wrap = document.createElement('div');
    wrap.className = 'st-slices';
    var n = Math.max(2, opt.slices | 0);

    for (var i = 0; i < n; i++) {
      var slice = document.createElement('div');
      slice.className = 'st-slice';
      var inner = document.createElement('div');
      inner.className = 'st-inner';
      inner.style.width = (n * 100) + '%';   // = 满屏宽
      inner.style.left = (-i * 100) + '%';   // 按切片宽偏移 → 各列对齐
      if (opt.image) {
        var img = document.createElement('img');
        img.className = 'st-img';
        img.src = opt.image;
        img.alt = '';
        inner.appendChild(img);
      }
      var tint = document.createElement('div');
      tint.className = 'st-tint';
      inner.appendChild(tint);
      if (opt.text) {
        var word = document.createElement('span');
        word.className = 'st-word';
        word.textContent = opt.text;
        inner.appendChild(word);
      }
      slice.appendChild(inner);
      wrap.appendChild(slice);
    }
    root.appendChild(wrap);
    if (opt.grain) {
      var g = document.createElement('div');
      g.className = 'st-grain';
      root.appendChild(g);
    }
    document.body.appendChild(root);
    return root;
  }

  // 确保 GSAP 可用：已存在直接用；否则按需加载；失败则回调 null
  function ensureGSAP(opt, cb) {
    if (global.gsap) return cb(global.gsap);
    if (!opt.autoGSAP) return cb(null);
    var s = document.createElement('script');
    s.src = GSAP_CDN;
    s.onload = function () { cb(global.gsap || null); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  function remove(root) { if (root && root.parentNode) root.parentNode.removeChild(root); }

  // —— 入场揭幕 ——
  function intro(userOpt) {
    var opt = assign(assign({}, DEFAULTS), userOpt || {});
    ready(function () {
      var root = build(opt);
      function finish() { remove(root); if (typeof opt.onDone === 'function') opt.onDone(); }
      if (prefersReduced()) return finish();
      ensureGSAP(opt, function (gsap) {
        if (!gsap) return finish();
        var slices = root.querySelectorAll('.st-slice');
        var words = root.querySelectorAll('.st-word');
        var imgs = root.querySelectorAll('.st-img');
        var tl = gsap.timeline({ onComplete: finish });
        if (words.length) gsap.set(words, { yPercent: 120 });
        if (imgs.length) gsap.set(imgs, { scale: 1.14, transformOrigin: '50% 50%' });
        tl.from(slices, { autoAlpha: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06 });
        if (imgs.length) tl.to(imgs, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0); // 缓慢推近
        if (words.length) tl.to(words, { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.1 }, '-=1.2');
        tl.to({}, { duration: 0.3 }); // 停顿成形
        tl.to(slices, {
          yPercent: function (i) { return i % 2 === 0 ? -108 : 108; },
          scale: 1.06, duration: 0.85, ease: 'expo.inOut', stagger: 0.09
        });
      });
    });
  }

  // —— 离场盖屏（用于页面跳转）：盖满后跳转 url（或调 onDone）——
  function leave(url, userOpt) {
    var opt = assign(assign({}, DEFAULTS), userOpt || {});
    var root = build(opt);
    function go() {
      if (url) global.location.href = url;
      else { remove(root); if (typeof opt.onDone === 'function') opt.onDone(); }
    }
    if (prefersReduced()) return go();
    ensureGSAP(opt, function (gsap) {
      if (!gsap) return go();
      var slices = root.querySelectorAll('.st-slice');
      var words = root.querySelectorAll('.st-word');
      gsap.set(slices, { yPercent: function (i) { return i % 2 === 0 ? -108 : 108; }, scale: 1 });
      if (words.length) gsap.set(words, { yPercent: 120 });
      var tl = gsap.timeline({ onComplete: go });
      tl.to(slices, { yPercent: 0, duration: 0.7, ease: 'expo.inOut', stagger: 0.07 });
      if (words.length) tl.to(words, { yPercent: 0, duration: 0.5, ease: 'expo.out', stagger: 0.08 }, '-=0.3');
      tl.to({}, { duration: 0.15 });
    });
  }

  global.SliceTransition = { intro: intro, leave: leave, build: build, defaults: DEFAULTS, version: '1.0.0' };

})(typeof window !== 'undefined' ? window : this);
