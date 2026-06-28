const fs = require('fs');
const path = require('path');

try {
    // 1. 同步加载核心依赖资源
    const majorsPath = path.join(__dirname, 'data', 'majors.json');
    const templatesDir = path.join(__dirname, 'src', 'templates');
    const assetsDir = path.join(__dirname, 'src', 'assets');
    const distDir = path.join(__dirname, 'dist');

    if (!fs.existsSync(majorsPath)) {
        throw new Error('❌ 未能找到 data/majors.json，请确认目录框架！');
    }

    const majorsData = JSON.parse(fs.readFileSync(majorsPath, 'utf-8'));

    // 1.1 六套门类设计原型：code 前两位是国家学科门类码 → 不同的设计语言
    //     （遵循 frontend-design「结构编码意义」：风格差异来自学科本身，而非随机）
    const ARCHETYPES = ['editorial', 'finance', 'science', 'terminal', 'life', 'gallery'];
    const ARCHETYPE_BY_CAT = {
        '01': 'editorial', '03': 'editorial', '04': 'editorial', '05': 'editorial', '06': 'editorial', // 人文社科
        '02': 'finance',   '12': 'finance',                                                            // 经管
        '07': 'science',                                                                                // 理学
        '08': 'terminal',                                                                               // 工学
        '09': 'life',      '10': 'life',                                                                // 农林 / 医学
        '13': 'gallery'                                                                                 // 艺术
    };
    function archetypeFor(code) {
        const cat = String(code).trim().slice(0, 2);
        return ARCHETYPE_BY_CAT[cat] || 'editorial';
    }

    // 预加载全部原型模板
    const templates = {};
    ARCHETYPES.forEach((a) => {
        const p = path.join(templatesDir, a + '.html');
        if (!fs.existsSync(p)) throw new Error('❌ 缺少原型模板: src/templates/' + a + '.html');
        templates[a] = fs.readFileSync(p, 'utf-8');
    });

    // 2. 初始化编译发布目录（先清空，避免历史产物残留）
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    // 2.1 复制静态底图资源到 dist/assets（不复制则模板底图全部裂图！）
    fs.cpSync(assetsDir, path.join(distDir, 'assets'), { recursive: true });
    // 2.2 复制全局流体背景脚本到 dist（被示例页/详情页以 /fluid-bg.js 引入）
    fs.copyFileSync(path.join(__dirname, 'effects', 'fluid-bg.js'), path.join(distDir, 'fluid-bg.js'));
    // 2.3 复制本地 GSAP（不再依赖 cdn.jsdelivr.net——国内常被墙导致动效全挂）
    fs.copyFileSync(path.join(__dirname, 'vendor', 'gsap.min.js'), path.join(distDir, 'gsap.min.js'));
    fs.copyFileSync(path.join(__dirname, 'vendor', 'ScrollTrigger.min.js'), path.join(distDir, 'ScrollTrigger.min.js'));
    fs.copyFileSync(path.join(__dirname, 'vendor', 'webgl-fluid.js'), path.join(distDir, 'webgl-fluid.js'));

    console.log('\x1b[36m%s\x1b[0m', '🚀 [Campus Generator] 开始读取数据中心，启动批量自动化编译流程...');

    let successCount = 0;

    // 3. 核心流水线处理
    const archetypeCount = {};
    majorsData.forEach((major) => {
        const archetype = archetypeFor(major.code);
        archetypeCount[archetype] = (archetypeCount[archetype] || 0) + 1;
        let renderedHtml = templates[archetype];

        // 全量正则强替换占位符
        renderedHtml = renderedHtml.replace(/\$\{majorName\}/g, major.name);
        renderedHtml = renderedHtml.replace(/\$\{themeColor\}/g, major.themeColor);
        renderedHtml = renderedHtml.replace(/\$\{department\}/g, major.department);
        renderedHtml = renderedHtml.replace(/\$\{majorCode\}/g, major.code);
        renderedHtml = renderedHtml.replace(/\$\{heroType\}/g, major.heroType);
        // 英雄底图：优先用本专业自己的图，没有则回退到 geometric/organic 共享底图
        var heroImage = fs.existsSync(path.join(assetsDir, 'majors', major.name + '.jpg'))
          ? 'assets/majors/' + major.name + '.jpg'
          : 'assets/' + major.heroType + '-bg.jpg';
        renderedHtml = renderedHtml.replace(/\$\{heroImage\}/g, heroImage);

        // 修复原型模板中的旧链接：index.html → examples.html
        renderedHtml = renderedHtml.replace(/href="index\.html"/g, 'href="examples.html"');

        // ── 统一注入：GSAP + 字体 + 焦点环 + 光标光效（跨 6 套原型）──
        const SHARED_HEAD = `
    <script>
      (function(){ try {
        var n = window.matchMedia.bind(window);
        function f(q,m){ return { matches:m, media:q, onchange:null, addListener:function(){}, removeListener:function(){}, addEventListener:function(){}, removeEventListener:function(){}, dispatchEvent:function(){return false;} }; }
        window.matchMedia = function(q){ if (typeof q==='string'){ if (/prefers-reduced-motion\\s*:\\s*reduce/i.test(q)) return f(q,false); if (/prefers-reduced-motion\\s*:\\s*no-preference/i.test(q)) return f(q,true); } return n(q); };
      } catch(e){} })();
    </script>
    <script src="/gsap.min.js"></script>
    <link href="https://fonts.loli.net/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700;900&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root { --theme: ${major.themeColor}; --color-primary: ${major.themeColor}; }
      :focus-visible { outline: 2.5px solid var(--theme); outline-offset: 3px; border-radius: 4px; }
      .skip-link { position: absolute; top: -100px; left: 16px; background: var(--theme); color: #fff; padding: .5rem 1rem; border-radius: 0 0 8px 8px; z-index: 9999; font-size: .85rem; font-weight: 600; transition: top .2s ease; text-decoration: none; }
      .skip-link:focus { top: 0; }
      #cursor-glow { position: fixed; top: 0; left: 0; width: 360px; height: 360px; margin-left: -180px; margin-top: -180px; border-radius: 50%; background: radial-gradient(circle, ${major.themeColor}33, transparent 60%); pointer-events: none; z-index: 9999; opacity: 0; will-change: transform; }
      @media (prefers-reduced-motion: reduce) and (min-width: 999999px) { #cursor-glow { display: none; } }
    </style>`;
        const SHARED_BODY_TOP = `
  <a href="#main-content" class="skip-link">跳到主要内容</a>
  <div id="cursor-glow" aria-hidden="true"></div>`;
        const SHARED_BODY_END = `
  <!-- GSAP 光标跟随 -->
  <script>
    (function(){
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || !window.gsap) return;
      var glow = document.getElementById('cursor-glow');
      if (!glow) return;
      var gxTo = gsap.quickTo(glow, "x", { duration: 0.5, ease: "power3.out" });
      var gyTo = gsap.quickTo(glow, "y", { duration: 0.5, ease: "power3.out" });
      var goTo = gsap.quickTo(glow, "opacity", { duration: 0.25 });
      document.addEventListener('mousemove', function(e){ gxTo(e.clientX); gyTo(e.clientY); goTo(1); });
      document.addEventListener('mouseleave', function(){ goTo(0); });
    })();
  </script>
  <!-- 全局流体背景 -->
  <script src="/fluid-bg.js" defer></script>`;

        // 注入到 </head> 之前
        renderedHtml = renderedHtml.replace('</head>', SHARED_HEAD + '\n</head>');
        // 注入到 <body ...> 之后（匹配带属性的 body 标签）
        renderedHtml = renderedHtml.replace(/(<body[^>]*>)/, '$1' + SHARED_BODY_TOP);
        // 注入到 </body> 之前
        renderedHtml = renderedHtml.replace('</body>', SHARED_BODY_END + '\n</body>');
        // 添加 main-content id 到第一个主内容区
        renderedHtml = renderedHtml.replace(/<section /, '<section id="main-content" ');

        // 写入静态发布包
        const targetFileName = `${major.name}.html`;
        fs.writeFileSync(path.join(distDir, targetFileName), renderedHtml, 'utf-8');
        successCount++;
    });

    // 3.1 生成总览首页 index.html（悬浮 3D 倾斜卡片 + 专属图 + 缺图优雅降级）
    const cards = majorsData.map((m, i) => `
        <article class="tilt-card" data-color="${m.themeColor}">
          <a class="tilt-link" href="${m.name}.html" aria-label="${m.name}（${m.department}）">
            <div class="tilt-inner">
              <div class="tilt-fallback" aria-hidden="true" style="background:linear-gradient(145deg, ${m.themeColor}, #0a0a0a)"></div>
              <img class="tilt-img" src="assets/majors/${m.name}.jpg" alt="${m.name}专业主题图" width="900" height="1200" decoding="async" ${i < 4 ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="this.style.display='none'">
              <div class="tilt-shade" aria-hidden="true"></div>
              <div class="tilt-glow" aria-hidden="true"></div>
              <div class="tilt-content">
                <p class="tilt-dept">${m.department} · ${m.code}</p>
                <h2 class="tilt-name">${m.name}</h2>
                <p class="tilt-cta" style="color:${m.themeColor}">${m.heroType} · 进入 →</p>
              </div>
            </div>
          </a>
        </article>`).join('');

    // 轨道英雄只用「有图」的专业，保证环绕的都是电影级真图（避免色块混入）
    const orbitSrc = majorsData.filter((m) => fs.existsSync(path.join(assetsDir, 'majors', m.name + '.jpg')));
    const orbitPool = JSON.stringify((orbitSrc.length >= 4 ? orbitSrc : majorsData).map((m) => ({ name: m.name, dept: m.department, color: m.themeColor })));

    const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- 中和「减少动画」误报：部分 Edge 版本在系统动画开启时仍报告 prefers-reduced-motion:reduce，
       会让本站全部动效被跳过。这里让站点脚本一律按「未要求减少动画」处理（reduce→false、no-preference→true）。 -->
  <script>
    (function(){
      try {
        document.documentElement.classList.add('js-anim');  // 标记 JS 可用：CSS 据此预隐藏将由 JS 揭示的元素，避免 FOUC
        var native = window.matchMedia.bind(window);
        function fake(q, m){ return { matches:m, media:q, onchange:null,
          addListener:function(){}, removeListener:function(){},
          addEventListener:function(){}, removeEventListener:function(){}, dispatchEvent:function(){return false;} }; }
        window.matchMedia = function(q){
          if (typeof q === 'string') {
            if (/prefers-reduced-motion\\s*:\\s*reduce/i.test(q)) return fake(q, false);
            if (/prefers-reduced-motion\\s*:\\s*no-preference/i.test(q)) return fake(q, true);
          }
          return native(q);
        };
      } catch (e) {}
    })();
  </script>
  <title>对话即渲染 · AI 网页生成器</title>
  <meta name="description" content="用一句话生成一个完整、带交互的网页：DeepSeek 实时生成单文件 HTML，沙盒里即刻预览。下方为生成示例画廊，点击任意一张可进入查看完整交互效果。" />
  <meta property="og:title" content="对话即渲染 · AI 网页生成器" />
  <meta property="og:description" content="用自然语言描述需求，AI 实时生成带完整交互的网页。点开示例画廊看生成效果。" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="assets/majors/哲学类.jpg" />
  <link rel="preconnect" href="https://fonts.loli.net" />
  <link rel="preconnect" href="https://gstatic.loli.net" crossorigin />
  <link href="https://fonts.loli.net/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700;900&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- GSAP 动画引擎 + ScrollTrigger（滚动联动）：CDN 引入，零构建依赖 -->
  <script src="/gsap.min.js"></script>
  <script src="/ScrollTrigger.min.js"></script>
  <style>
    :root {
      /* ── 语义色彩 Token（UI/UX Pro Max L4）──────── */
      --color-primary:       #6366f1;   /* indigo-500 主色 */
      --color-primary-hover: #818cf8;   /* indigo-400 悬浮 */
      --color-primary-dim:   #4338ca;   /* indigo-700 深色变体 */
      --color-surface:       #0a0a0a;   /* 卡片/面板表面 */
      --color-surface-elevated: #111118;/* 悬浮层 */
      --color-bg:            #09090b;   /* 页面背景 */
      --color-text:          #fafafa;   /* 主文字 zinc-50 */
      --color-text-dim:      #a1a1aa;   /* 次要文字 zinc-400 */
      --color-text-muted:    #71717a;   /* 禁用/占位 zinc-500 */
      --color-border:        rgba(255,255,255,.08);  /* 默认边框 */
      --color-border-hover:  rgba(255,255,255,.18);  /* 悬浮边框 */
      --color-error:         #f87171;   /* red-400 错误 */
      --color-success:       #4ade80;   /* green-400 成功 */
      /* 兼容旧变量 */
      --accent: var(--color-primary);
      --bg: var(--color-bg);
      --surface: var(--color-surface);
      --text-dim: var(--color-text-dim);
      /* ── Z-Index 标尺（L5）────────────────── */
      --z-base:     0;
      --z-dropdown: 100;
      --z-sticky:   200;
      --z-overlay:  400;
      --z-modal:    500;
      --z-toast:    600;
      --z-tooltip:  700;
    }
    /* ── 统一焦点环（L1 无障碍）──────────────── */
    :focus-visible {
      outline: 2.5px solid var(--color-primary);
      outline-offset: 3px;
      border-radius: 4px;
    }
    /* ── 跳过链接（L1）──────────────────── */
    .skip-link {
      position: absolute; top: -100px; left: 16px;
      background: var(--color-primary); color: #fff;
      padding: .5rem 1rem; border-radius: 0 0 8px 8px;
      z-index: var(--z-tooltip); font-size: .85rem; font-weight: 600;
      transition: top .2s ease;
    }
    .skip-link:focus { top: 0; }
    /* ── 减少动画（L1）──────────────────── */
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    html { scroll-behavior: smooth; touch-action: manipulation; }
    /* ── 跨页转场（原生 View Transitions）：点导航平滑切换，旧浏览器自动退化为普通跳转 ── */
    @view-transition { navigation: auto; }
    /* 真·翻页：新页静止铺在下层，旧页像书页一样绕左缘掀起翻走、露出新页（不压扁整屏） */
    ::view-transition { perspective: 2200px; }
    ::view-transition-new(root) { animation: pg-reveal .95s ease both; z-index: 1; }
    ::view-transition-old(root) { animation: pg-turn .95s cubic-bezier(.36,0,.2,1) both; transform-origin: left center; z-index: 2; backface-visibility: hidden; box-shadow: 0 0 80px rgba(0,0,0,.55); }
    @keyframes pg-turn { to { transform: rotateY(135deg); opacity: .96; filter: brightness(.45); } }
    @keyframes pg-reveal { from { filter: brightness(.72); transform: scale(.992); } to { filter: brightness(1); transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
    }
    body { font-family: 'Inter','Noto Sans SC','PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',system-ui,sans-serif; }
    /* ── 触控交互（L2）───────────────────── */
    a, button, [role="button"], input, select, textarea, .tilt-card { cursor: pointer; }
    button:disabled, a[aria-disabled="true"] { cursor: not-allowed; opacity: 0.45; }
    button, [role="button"] { min-height: 44px; min-width: 44px; }
    /* 标题字体：Playfair Display（衬线） — 与正文 Inter（无衬线）形成性格对比 */
    .page-title, .section-title, .tilt-name, h1, h2, h3 { font-family: 'Playfair Display','Noto Serif SC','Georgia','Songti SC',serif; }
    /* 等宽字体：JetBrains Mono — 用于标签/代码/数字 */
    .eyebrow, .tilt-dept, .tilt-cta, .how-num { font-family: 'JetBrains Mono','Cascadia Code','SF Mono','Fira Code',monospace; }

    /* 青色标题（静态渐变）；动效由下方打字机承担 */
    .page-title { font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight:800; letter-spacing:normal; position:relative; }
    /* 呼吸高光：单独的模糊光晕层，只动 opacity（走合成层），不再每帧重绘文字，避免开场/常驻卡顿 */
    .page-title::before {
      content:''; position:absolute; left:50%; top:50%; z-index:-1; pointer-events:none;
      width:78%; height:64%; transform:translate(-50%,-50%);
      background: radial-gradient(closest-side, rgba(99,102,241,.5), transparent 72%);
      filter: blur(28px); opacity:.4; will-change: opacity;
      animation: titleGlow 4.8s ease-in-out infinite;
    }
    @keyframes titleGlow { 0%,100% { opacity:.32; } 50% { opacity:.78; } }
    /* 第一行＝整体水容器（青描边空轮廓）：注水动画由 JS 驱动（底部变速右流 → 涨满 → 停留 → 清空 → 循环）*/
    .page-title .l1fill { display:inline-block;
      -webkit-text-fill-color: transparent; -webkit-text-stroke: 1.4px rgba(125,211,252,.5);
      background-repeat: no-repeat; background-position: center; background-size: 100% 100%;
      background-image: linear-gradient(0deg, #22d3ee 0%, #5fe6f5 100%);   /* 默认实心可见，水动画由 JS 每帧接管；JS 不跑时标题照常可读 */
      -webkit-background-clip: text; background-clip: text; }
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      .page-title .l1fill { background-image: linear-gradient(0deg, #22d3ee 0%, #5fe6f5 100%) !important; background-size: 100% 100% !important; }
    }
    /* 第二行轮播词：纯青字 + 模糊渐变切换；字号略小，与第一行更平衡 */
    .page-title .roll { display:inline-block; vertical-align:bottom; white-space:nowrap; font-size:.78em;
      color:#22d3ee; -webkit-text-fill-color:#22d3ee; will-change:opacity,filter,transform; }

    .grid3d { display:grid; gap:clamp(1rem, 2.5vw, 1.5rem); grid-template-columns:repeat(1,1fr); }
    @media(min-width:640px){ .grid3d{ grid-template-columns:repeat(2,1fr); } }
    @media(min-width:1024px){ .grid3d{ grid-template-columns:repeat(3,1fr); } }
    @media(min-width:1280px){ .grid3d{ grid-template-columns:repeat(4,1fr); } }

    .tilt-card { display:block; perspective:900px; aspect-ratio:3/4; }
    /* JS 可用时预隐藏卡片，等 ScrollTrigger 揭示——避免 GSAP 接管前先闪出再被藏起来（FOUC）。
       若 JS/GSAP 未运行则无 .js-anim，卡片照常显示，绝不会空白。 */
    html.js-anim .tilt-card { visibility: hidden; }
    .tilt-link { display:block; width:100%; height:100%; text-decoration:none; border-radius:1.25rem; }
    .tilt-link:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .tilt-inner {
      position:relative; width:100%; height:100%; border-radius:1.25rem; overflow:hidden;
      transform-style:preserve-3d; will-change:transform;
      transition: box-shadow .4s ease;
      border:1px solid rgba(255,255,255,.08); background:var(--surface);
    }
    .tilt-fallback, .tilt-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .tilt-fallback { z-index:0; }
    .tilt-img { z-index:1; transition: transform .5s cubic-bezier(.16,1,.3,1); }
    .tilt-card:hover .tilt-img { transform: scale(1.12); }
    .tilt-shade { position:absolute; inset:0; z-index:2;
      background:linear-gradient(to top, rgba(10,10,10,.96) 0%, rgba(10,10,10,.3) 45%, transparent 72%); }
    .tilt-glow { position:absolute; inset:0; z-index:3; opacity:0; transition:opacity .3s;
      background:radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.28), transparent 42%); }
    .tilt-card:hover .tilt-glow, .tilt-card:focus-within .tilt-glow { opacity:1; }
    .tilt-content { position:absolute; left:0; right:0; bottom:0; z-index:4; padding:1.3rem; transform:translateZ(35px); }
    .tilt-dept { font-size:.68rem; letter-spacing:.05em; color:var(--text-dim); margin-bottom:.3rem; }
    .tilt-name { font-size:1.5rem; font-weight:700; letter-spacing:normal; line-height:1.15; }
    .tilt-cta { font-size:.68rem; text-transform:uppercase; letter-spacing:.18em; margin-top:.6rem; }
    .btn-link:focus-visible { outline:2px solid #fff; outline-offset:3px; }

    /* —— 设计系统：统一的眉标 / 标题 / 区块节奏（参考 frontend-design：结构编码意义、克制留白）—— */
    .eyebrow { font-size:.72rem; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); }
    .section-wrap { max-width:80rem; margin:0 auto; padding:7rem 1.5rem; }
    .section-title { font-size:clamp(1.9rem,4vw,3rem); font-weight:700; letter-spacing:normal; line-height:1.15; margin:.9rem 0 1rem; }
    .section-sub { color:var(--text-dim); font-weight:400; max-width:46rem; line-height:1.75; }

    /* 英雄 CTA：把"赌注"花在一处（主按钮强调，幽灵按钮克制） */
    .hero-cta { display:inline-flex; align-items:center; gap:.5rem; padding:.85rem 1.6rem; border-radius:9999px;
      font-weight:700; font-size:.9rem; letter-spacing:.01em; text-decoration:none;
      transition:transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, background .25s ease, border-color .25s ease; }
    .hero-cta-primary { background:var(--accent); color:#fff; }
    .hero-cta-primary:hover { transform:translateY(-2px); box-shadow:0 18px 42px -12px var(--accent); background:#7c7ff5; }
    .hero-cta-ghost { border:1px solid rgba(255,255,255,.18); color:#e4e4e7; }
    .hero-cta-ghost:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.45); }
    .hero-cta:focus-visible { outline:2px solid #fff; outline-offset:3px; }

    /* 工作流三步 */
    .how-grid { display:grid; gap:1.25rem; grid-template-columns:1fr; margin-top:3rem; }
    @media(min-width:768px){ .how-grid{ grid-template-columns:repeat(3,1fr); } }
    .how-step { position:relative; padding:2rem; border:1px solid rgba(255,255,255,.08); border-radius:1.25rem;
      background:rgba(255,255,255,.02); overflow:hidden; transition:border-color .3s ease, transform .3s ease; }
    .how-step:hover { border-color:rgba(99,102,241,.4); transform:translateY(-3px); }
    .how-num { font-size:3.4rem; font-weight:900; line-height:1; color:rgba(255,255,255,.07); }
    .how-step h3 { font-size:1.18rem; font-weight:700; margin:.5rem 0 .5rem; }
    .how-step p { font-size:.9rem; color:var(--text-dim); font-weight:300; line-height:1.65; }

    /* 尊重「减少动画」偏好：关闭 3D 倾斜与平滑滚动 */
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      html { scroll-behavior:auto; }
      .tilt-inner, .tilt-glow { transition:none !important; }
    }

    /* 轨道英雄：群星环绕 */
    .orbit-hero { position:relative; min-height:100vh; display:grid; place-items:center; overflow:hidden; padding:6rem 1rem; perspective:1300px; }
    /* 背景氛围光由 .hero-ambient 层承载（支持鼠标视差） */
    .orbit-field { position:absolute; inset:0; pointer-events:none; perspective:900px; }
    /* 轨道环线：让公转看起来是"设计过的"而非随机漂浮 */
    .orbit-ring { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%);
      border:1px solid rgba(255,255,255,.06); border-radius:50%; pointer-events:none; }
    .orbit-core { position:relative; top:-4vh; z-index:300; text-align:center; max-width:640px; }
    /* 中心暗化幕：把中央标题/按钮与背后漂浮卡片分离，避免视觉打架 */
    .orbit-core::before { content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:140%; height:155%; z-index:-1; pointer-events:none;
      background:radial-gradient(closest-side, rgba(9,9,11,.88), rgba(9,9,11,.62) 50%, transparent 78%); }
    .orbit-card { position:absolute; left:50%; top:46%; width:clamp(118px,13vw,184px); aspect-ratio:3/4;
      border-radius:1rem; overflow:hidden; pointer-events:auto; text-decoration:none;
      border:1px solid rgba(255,255,255,.12); box-shadow:0 24px 60px -22px rgba(0,0,0,.85); will-change:transform,opacity;
      transition: border-color .35s ease, box-shadow .35s ease; }
    /* 悬浮：边框提亮 + 光晕扩散 + 图片去灰度露出本色 */
    .orbit-card:hover {
      border-color: rgba(255,255,255,.5) !important;
      box-shadow: 0 0 55px rgba(99,102,241,.45), 0 32px 80px -18px rgba(0,0,0,.95) !important;
    }
    .orbit-card img { width:100%; height:100%; object-fit:cover; display:block;
      filter:grayscale(.35) saturate(.95) contrast(1.03) brightness(.92);   /* 静止：略压暗去饱和，融入深色场景 */
      transition: filter .4s ease; }
    .orbit-card:hover img {
      filter: grayscale(0) saturate(1.12) contrast(1.08) brightness(1.06) !important;   /* 悬浮：恢复鲜艳本色并提亮 */
    }
    /* 靛蓝色罩：用 color 混合把卡片温和统一到品牌靛蓝（保留明暗细节）；悬浮时减弱露出本色 */
    .orbit-card::after { content:''; position:absolute; inset:0; z-index:1; pointer-events:none;
      background:#4338ca;
      mix-blend-mode:color; opacity:.22;
      transition: opacity .4s ease; }
    .orbit-card:hover::after { opacity: .06 !important; }
    .orbit-card .label { position:absolute; inset:auto 0 0 0; z-index:2; padding:.6rem .7rem; font-size:.78rem; font-weight:700;
      background:linear-gradient(to top, rgba(10,10,10,.92), transparent); }
    .orbit-card:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

    /* WebGL 流体背景画布：鼠标搅动发光流体（深色品牌色），浮在卡片之下 */
    #fluid { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; display: block; }
    /* 让中央核心区把鼠标事件透传给流体画布，仅按钮/链接保留可点 */
    .orbit-core { pointer-events: none; }
    .orbit-core a, .orbit-core button { pointer-events: auto; }
    /* 英雄氛围光：鼠标视差层 */
    .hero-ambient {
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      background: radial-gradient(50% 44% at 50% 36%, rgba(99,102,241,.16), transparent 72%);
      will-change: transform;
    }
    /* 星点纵深层已移除：背景回纯净深色 */
    /* ── 开场动画层（intro / 五等分切片转场 · 质感版）──── */
    #intro { position:fixed; inset:0; z-index:9999; background:#09090b; overflow:hidden;
      /* 纯 CSS 兜底：即便所有 JS 都不执行，开场遮罩 6s 后也自动淡出，绝不盖死页面 */
      animation: introFailsafe 0s linear 6s forwards; }
    @keyframes introFailsafe { to { opacity:0; visibility:hidden; pointer-events:none; } }
    #intro .intro-slices { position:absolute; inset:0; display:flex; z-index:1; }
    /* 初始 visibility:hidden —— 与 GSAP .from(autoAlpha:0) 起始态对齐，防止 GSAP 接管前先闪出静态成品图（FOUC）。
       GSAP 淡入时会自动置为 visible；若 GSAP 未加载，killIntro 会把整个 #intro display:none，不影响页面。 */
    #intro .slice { flex:1 1 0; height:100%; overflow:hidden; position:relative; will-change:transform; visibility:hidden; }
    /* 切缝辉光线，强调“五等分” */
    #intro .slice + .slice::before { content:''; position:absolute; top:0; left:0; width:1px; height:100%; z-index:4;
      background:linear-gradient(180deg, transparent, rgba(99,102,241,.5), transparent); }
    /* 每条切片内放一份等大的背景图+标题，按列偏移对齐 → 拼成连续整图（% 相对切片宽，免 vw/滚动条误差） */
    #intro .slice-inner { position:absolute; top:0; left:0; width:500%; height:100%;
      display:flex; align-items:center; justify-content:center; }
    #intro .slice:nth-child(2) .slice-inner { left:-100%; }
    #intro .slice:nth-child(3) .slice-inner { left:-200%; }
    #intro .slice:nth-child(4) .slice-inner { left:-300%; }
    #intro .slice:nth-child(5) .slice-inner { left:-400%; }
    #intro .slice-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;
      filter:brightness(.46) saturate(.92) contrast(1.05); will-change:transform; }
    #intro .slice-tint { position:absolute; inset:0; z-index:1;
      background:radial-gradient(70% 55% at 50% 42%, rgba(79,70,229,.34), transparent 72%),
                 linear-gradient(180deg, rgba(9,9,11,.55), rgba(9,9,11,.84)); }
    #intro .slice-word { position:relative; z-index:2; display:inline-block; white-space:nowrap; will-change:transform;
      font-family:'Playfair Display','Noto Serif SC',serif; font-weight:800;
      font-size:clamp(2.4rem,8vw,4.6rem); color:#fff; letter-spacing:.02em;
      text-shadow:0 4px 40px rgba(99,102,241,.45); }
    /* 胶片颗粒噪点：盖在切片之上、整层之内 */
    /* 跳过提示：底部居中，开场 1.2s 后淡入，提示可按 O 终止开场 */
    #intro .intro-skip-hint { position:absolute; left:50%; bottom:6%; transform:translateX(-50%); z-index:8; pointer-events:none;
      font-family:'JetBrains Mono','SF Mono',monospace; font-size:.72rem; letter-spacing:.16em; color:rgba(255,255,255,.55);
      white-space:nowrap; opacity:0; animation:introHintIn .6s ease 1.2s forwards; }
    #intro .intro-skip-hint kbd { display:inline-block; padding:.06rem .42rem; margin:0 .18rem; border-radius:.32rem;
      border:1px solid rgba(255,255,255,.32); background:rgba(255,255,255,.07); color:#fff; font-weight:700; font-size:.78rem; }
    @keyframes introHintIn { to { opacity:1; } }
    #intro .intro-grain { position:absolute; inset:0; z-index:6; pointer-events:none; opacity:.16; mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      #intro { display: none; }
      #fluid, .hero-ambient { display: none; }
    }
  </style>
  <!-- JS 被禁用时直接隐藏开场层，避免盖死页面 -->
  <noscript><style>#intro{display:none!important}</style></noscript>
</head>
<body class="bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-white selection:text-black">
  <!-- 开场动画层：五等分切片转场（剪辑风 · 质感版）→ 揭幕露出主页 -->
  <div id="intro" aria-hidden="true">
    <div class="intro-slices" aria-hidden="true">
      <div class="slice"><div class="slice-inner"><img class="slice-img" src="assets/hero-bg.jpg" alt="" /><div class="slice-tint"></div><span class="slice-word">对话即渲染</span></div></div>
      <div class="slice"><div class="slice-inner"><img class="slice-img" src="assets/hero-bg.jpg" alt="" /><div class="slice-tint"></div><span class="slice-word">对话即渲染</span></div></div>
      <div class="slice"><div class="slice-inner"><img class="slice-img" src="assets/hero-bg.jpg" alt="" /><div class="slice-tint"></div><span class="slice-word">对话即渲染</span></div></div>
      <div class="slice"><div class="slice-inner"><img class="slice-img" src="assets/hero-bg.jpg" alt="" /><div class="slice-tint"></div><span class="slice-word">对话即渲染</span></div></div>
      <div class="slice"><div class="slice-inner"><img class="slice-img" src="assets/hero-bg.jpg" alt="" /><div class="slice-tint"></div><span class="slice-word">对话即渲染</span></div></div>
    </div>
    <div class="intro-grain" aria-hidden="true"></div>
    <div class="intro-skip-hint" aria-hidden="true">按 <kbd>O</kbd> 跳过开场</div>
  </div>
  <a href="#main-content" class="skip-link">跳到主要内容</a>
  <div id="cursor-glow" aria-hidden="true"></div>
  <!-- 顶部导航 -->
  <header class="fixed top-0 inset-x-0 z-[400] bg-zinc-950/70 backdrop-blur border-b border-zinc-900">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
      <a href="/" class="text-sm font-bold tracking-normal shrink-0">对话即渲染 <span class="text-indigo-400">·</span> 生成器</a>
      <!-- 汉堡按钮（移动端） -->
      <button id="hamburger" class="md:hidden flex flex-col gap-1 p-2 z-50" aria-label="菜单" aria-expanded="false">
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
      </button>
      <nav id="main-nav" aria-label="站点功能导航" class="hidden md:flex items-center gap-3 text-xs">
        <a href="examples.html" class="btn-link px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-100 font-bold transition whitespace-nowrap">示例画廊</a>
        <a href="/skills/" class="btn-link px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-100 font-bold transition whitespace-nowrap">🧩 互动演示</a>
        <a href="/studio/" class="btn-link px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition whitespace-nowrap">⚡ 开始生成</a>
      </nav>
    </div>
    <!-- 移动端下拉菜单 -->
    <nav id="mobile-nav" class="hidden md:hidden flex-col gap-2 px-6 pb-4 bg-zinc-950/95 border-b border-zinc-900 text-xs" aria-label="移动端导航">
      <a href="examples.html" class="block px-4 py-3 rounded-xl hover:bg-zinc-800 transition font-bold">示例画廊</a>
      <a href="/skills/" class="block px-4 py-3 rounded-xl hover:bg-zinc-800 transition font-bold">🧩 互动演示</a>
      <a href="/studio/" class="block px-4 py-3 rounded-xl bg-indigo-500 text-white font-bold transition">⚡ 开始生成</a>
    </nav>
  </header>

  <!-- 轨道英雄：群星环绕主题 -->
  <section id="main-content" class="orbit-hero">
    <canvas id="fluid" aria-hidden="true"></canvas>
    <div class="hero-ambient" id="hero-ambient" aria-hidden="true"></div>
    <div class="orbit-field" id="orbit" aria-hidden="true">
      <div class="orbit-ring" data-r="1"></div>
      <div class="orbit-ring" data-r="0.62"></div>
    </div>
    <div class="orbit-core">
      <p class="eyebrow mb-5">AI Webpage Generator · 对话即渲染</p>
      <h1 class="page-title font-extrabold tracking-normal mb-10 text-white"><span id="line1" class="l1fill">所见即所得</span><br /><span class="roll" id="roll"></span></h1>
      <div class="flex flex-wrap items-center justify-center gap-4">
        <a href="/studio/" class="hero-cta hero-cta-primary">⚡ 打开 Studio 开始生成</a>
        <a href="examples.html" class="hero-cta hero-cta-ghost">看生成示例 →</a>
      </div>
    </div>
  </section>

  <footer class="border-t border-zinc-900 py-10 text-center text-zinc-600 text-sm">
    <p class="mb-2">用一句话生成网页 · <a href="/studio/" class="text-zinc-400 hover:text-indigo-400 transition">打开 Studio</a> · <a href="/skills/" class="text-zinc-400 hover:text-indigo-400 transition">互动演示</a></p>
    © 2026 · 由 campus-page-generator 自动生成
  </footer>

  <!-- 汉堡菜单 + 导航高亮 + 回顶（L9） -->
  <script>
    (function(){
      // 汉堡菜单切换
      var hamburger = document.getElementById('hamburger');
      var mobileNav = document.getElementById('mobile-nav');
      if (hamburger && mobileNav) {
        hamburger.addEventListener('click', function(){
          var open = mobileNav.classList.toggle('hidden');
          hamburger.setAttribute('aria-expanded', !open);
          // 动画：三条线变 X
          var lines = hamburger.querySelectorAll('span');
          if (!open) {
            lines[0].style.transform = 'translateY(3px) rotate(45deg)';
            lines[1].style.opacity = '0';
            lines[2].style.transform = 'translateY(-3px) rotate(-45deg)';
          } else {
            lines[0].style.transform = '';
            lines[1].style.opacity = '';
            lines[2].style.transform = '';
          }
        });
      }
      // 当前页高亮
      var path = location.pathname.replace(/\\/+$/, '') || '/';
      document.querySelectorAll('header a[href]').forEach(function(a){
        var href = a.getAttribute('href');
        if (href === path || (path !== '/' && href !== '/' && path.includes(href.replace(/\\/$/,'')))) {
          a.classList.add('!border-indigo-400', '!text-indigo-300');
        }
      });
      // 回顶按钮
      var topBtn = document.createElement('button');
      topBtn.innerHTML = '↑';
      topBtn.setAttribute('aria-label', '回到顶部');
      topBtn.className = 'fixed bottom-6 right-6 z-[300] w-11 h-11 rounded-full bg-indigo-500/80 hover:bg-indigo-400 text-white font-bold text-lg opacity-0 pointer-events-none transition-all duration-300 backdrop-blur';
      document.body.appendChild(topBtn);
      window.addEventListener('scroll', function(){
        var show = window.scrollY > 600;
        topBtn.style.opacity = show ? '1' : '0';
        topBtn.style.pointerEvents = show ? 'auto' : 'none';
      }, { passive: true });
      topBtn.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
    })();
  </script>

  <!-- GSAP 鼠标跟随：quickTo 驱动，零 layout thrashing，丝滑跟手 -->
  <script>
    (function(){
      if (!window.gsap) return;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;

      // 1) 鼠标驱动的渲染改由下方 WebGL 流体背景承担，此处不再生成涟漪

      // 2) 英雄区多层鼠标视差 —— 不同深度的层以不同幅度/方向偏移，制造立体纵深
      var ambient = document.getElementById('hero-ambient');
      var stars   = document.getElementById('bg-stars');
      var field   = document.getElementById('orbit');
      var axTo = ambient && gsap.quickTo(ambient, "x", { duration: 0.8, ease: "power2.out" });
      var ayTo = ambient && gsap.quickTo(ambient, "y", { duration: 0.8, ease: "power2.out" });
      var sxTo = stars   && gsap.quickTo(stars,   "x", { duration: 1.0, ease: "power2.out" });
      var syTo = stars   && gsap.quickTo(stars,   "y", { duration: 1.0, ease: "power2.out" });
      // 轨道卡片群轻微 3D 倾斜（perspective 在 .orbit-hero 上）—— 鼠标移动时整片随之转动，立体感最强
      var fryTo = field && gsap.quickTo(field, "rotationY", { duration: 0.9, ease: "power2.out" });
      var frxTo = field && gsap.quickTo(field, "rotationX", { duration: 0.9, ease: "power2.out" });

      document.addEventListener('mousemove', function(e){
        var nx = e.clientX / window.innerWidth  - 0.5;   // -0.5 ~ 0.5
        var ny = e.clientY / window.innerHeight - 0.5;
        if (axTo)  { axTo(nx * 30);   ayTo(ny * 30); }    // 氛围光：中等幅度，正向
        if (sxTo)  { sxTo(nx * -16);  syTo(ny * -16); }   // 星点层：反向、小幅（远景）
        if (fryTo) { fryTo(nx * 6);   frxTo(ny * -6); }   // 轨道层：±6° 倾斜（近景）
      });
    })();
  </script>

  <!-- WebGL 流体背景：cloydlau/webgl-fluid（Pavel 流体模拟 ESM 移植）—— 深色品牌色，鼠标搅动发光流体 -->
  <script>
    (function(){
      // 不在页面一加载就启动：开场动画期间同时跑 WebGL 流体会抢 GPU/主线程，导致开场卡顿。
      // 故封装为 window.heroFluidStart，由开场动画结束（或按 O 跳过）后再调用，且只初始化一次。
      var started = false;
      window.heroFluidStart = function(){
        if (started) return; started = true;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var canvas = document.getElementById('fluid');
        if (reduce || !canvas) return;
        try {
          if (!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))) return;
        } catch (e) { return; }
        var s = document.createElement('script');
        s.src = '/webgl-fluid.js';   // 本地托管，避免 jsdelivr 在国内被墙导致流体加载慢/失败
        s.onload = function(){
          if (typeof WebGLFluid !== 'function') return;
          try {
            WebGLFluid(canvas, {
              TRIGGER: 'hover', IMMEDIATE: true, AUTO: false,
              DENSITY_DISSIPATION: 1.9, VELOCITY_DISSIPATION: 0.4, PRESSURE: 0.8,
              CURL: 26, SPLAT_RADIUS: 0.22, SPLAT_FORCE: 6000, SHADING: true,
              COLORFUL: false, SPLAT_COLOR: { r: 0.05, g: 0.08, b: 0.26 },  // 调暗：更透更淡
              TRANSPARENT: true, BACK_COLOR: { r: 0.035, g: 0.035, b: 0.043 },
              BLOOM: true, BLOOM_INTENSITY: 0.3, SUNRAYS: false             // 辉光减弱
            });
          } catch (e) {}
        };
        s.onerror = function(){};
        document.head.appendChild(s);
      };
    })();
  </script>

  <!-- 轨道英雄动画：公转 + 3D 悬浮倾斜 + 平滑过渡 -->
  <script>
    (function(){
      var POOL = ${orbitPool};
      var field = document.getElementById('orbit');
      if (!field || !POOL || POOL.length === 0) return;
      var SLOTS = Math.min(5, POOL.length);
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var RX, RY;
      function sizeRadii(){
        var w = field.clientWidth, h = field.clientHeight;
        RX = Math.min(w * 0.38, 480); RY = Math.min(h * 0.32, 270);
        var rings = field.querySelectorAll('.orbit-ring');
        for (var r = 0; r < rings.length; r++){
          var k = parseFloat(rings[r].getAttribute('data-r')) || 1;
          rings[r].style.width = (2 * RX * k) + 'px';
          rings[r].style.height = (2 * RY * k) + 'px';
        }
      }
      sizeRadii();
      // debounce resize：减少高频重算（L3 性能）
      var resizeTimer;
      window.addEventListener('resize', function(){
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(sizeRadii, 150);
      });

      var shown = {};
      function pick(){ var m, t = 0; do { m = POOL[Math.floor(Math.random() * POOL.length)]; t++; } while (shown[m.name] && t < 30); return m; }
      function setMajor(c, m){
        if (c.major) delete shown[c.major.name];
        c.major = m; shown[m.name] = 1;
        c.img.src = 'assets/majors/' + encodeURIComponent(m.name) + '.jpg';
        c.img.alt = m.name; c.label.textContent = m.name;
        c.el.href = m.name + '.html'; c.el.setAttribute('aria-label', m.name);
      }

      // 全局鼠标坐标（供 3D 倾斜用）
      var mx = 0, my = 0;
      document.addEventListener('mousemove', function(e){ mx = e.clientX; my = e.clientY; });

      var cards = [];
      for (var i = 0; i < SLOTS; i++){
        var el = document.createElement('a');
        el.className = 'orbit-card';
        var img = document.createElement('img');
        img.decoding = 'async';
        img.loading = 'lazy';
        var label = document.createElement('span');
        label.className = 'label';
        el.appendChild(img); el.appendChild(label);
        field.appendChild(el);
        // let 块作用域——修复经典闭包陷阱：之前 var c 导致全部监听器指向最后一张卡
        let c = { el: el, img: img, label: label, angle: i * (Math.PI * 2 / SLOTS) + 0.6, major: null, swapped: false,
                  hovered: false, curScale: 1, curRX: 0, curRY: 0, curLift: 0 };
        el.addEventListener('mouseenter', function(){ c.hovered = true; });
        el.addEventListener('mouseleave', function(){ c.hovered = false; });
        setMajor(c, pick());
        cards.push(c);
      }

      POOL.forEach(function(m){ var im = new Image(); im.src = 'assets/majors/' + encodeURIComponent(m.name) + '.jpg'; });

      var SPEED = 0.00016, last = performance.now();
      var introEl = document.getElementById('intro');
      function frame(now){
        // 开场遮罩仍盖屏时，轨道在背后不可见——跳过每帧 transform 计算，把主线程让给开场动画，避免开场卡顿
        if (introEl && introEl.style.display !== 'none') { last = now; requestAnimationFrame(frame); return; }
        var dt = now - last; last = now;
        for (var k = 0; k < cards.length; k++){
          var c = cards[k];
          if (!reduce) c.angle += dt * SPEED;
          var a = c.angle, depth = Math.sin(a);
          var f = (depth + 1) / 2;
          var x = Math.cos(a) * RX, y = depth * RY;

          // 基础缩放（随轨道深度变化） + 悬浮加成
          var baseScale = 0.45 + f * 0.65;
          var targetScale = c.hovered ? baseScale + 0.35 : baseScale;
          // 平滑插值缩放 —— lerp 系数 0.12，每帧趋近目标值，产生弹性"弹出来"的手感
          c.curScale += (targetScale - c.curScale) * 0.12;

          // 3D 倾斜：悬浮时卡片微微朝向鼠标
          var targetRX = 0, targetRY = 0, targetLift = 0;
          if (c.hovered && !reduce) {
            var rect = c.el.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            targetRY = ((mx - cx) / rect.width)  * 16;   // 左右倾
            targetRX = ((cy - my) / rect.height) * -16;   // 上下倾（取反：鼠标在上→卡片仰头）
            targetLift = -10;                              // 微微抬升
          }
          // 倾斜与抬升也做平滑衰减
          c.curRX += (targetRX - c.curRX) * 0.10;
          c.curRY += (targetRY - c.curRY) * 0.10;
          c.curLift += (targetLift - c.curLift) * 0.08;

          var op = Math.max(0, Math.min(1, (depth + 0.55) / 1.25));
          // 组装完整 3D transform：居中 → 轨道位移 → 抬升 → 缩放 → 倾斜
          c.el.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + (y + c.curLift).toFixed(1) + 'px) scale(' + c.curScale.toFixed(3) + ') rotateX(' + c.curRX.toFixed(2) + 'deg) rotateY(' + c.curRY.toFixed(2) + 'deg)';
          c.el.style.opacity = op.toFixed(3);
          c.el.style.zIndex = c.hovered ? 500 + k : Math.round(f * 100);
          c.el.style.pointerEvents = op < 0.15 ? 'none' : 'auto';
          if (op <= 0.01 && !c.swapped){ setMajor(c, pick()); c.swapped = true; }
          else if (op > 0.5){ c.swapped = false; }
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })();
  </script>


  <!-- GSAP 主页动效：入场时间线 + 滚动联动。遵循官方 skills 最佳实践：
       gsap.matchMedia 处理「减少动画」偏好；ScrollTrigger 只挂顶层 tween；用 transform 别名而非 layout 属性。 -->
  <script>
    (function(){
      var introEl = document.getElementById('intro');
      var heroTl = null, skipped = false;

      // 把仍隐藏（GSAP from 起始态）的内容强制设回可见
      function revealAll(){
        ['header', '.orbit-hero', '.orbit-field', '.orbit-core', '.page-title', 'main', 'section', 'footer'].forEach(function(sel){
          document.querySelectorAll(sel).forEach(function(el){
            var cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
              el.style.visibility = 'visible'; el.style.opacity = '1';
            }
          });
        });
      }
      // 移除开场层，并在此刻才启动 WebGL 流体（避开开场期间的 GPU 争用）
      function killIntro(){ if (introEl) introEl.style.display = 'none'; if (window.heroFluidStart) window.heroFluidStart(); }
      // 立即终止开场动画 → 把时间线快进到末态（主页已揭幕）并收尾
      function skipIntro(){
        if (skipped) return; skipped = true;
        if (heroTl) { heroTl.progress(1); heroTl.kill(); }   // 快进到最终设计稿状态
        killIntro(); revealAll();
      }
      // 按 O 键跳过开场，直达主页（忽略组合键，避免误触快捷键）
      document.addEventListener('keydown', function(e){
        if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); skipIntro(); }
      });

      // 兜底看门狗：无论后续任何报错/卡顿，5.5s 后强制揭幕——移除开场层并把仍隐藏的内容设回可见，保证页面一定能看到
      setTimeout(function(){ killIntro(); revealAll(); }, 5500);

      if (!window.gsap) { killIntro(); revealAll(); return; }   // CDN 兜底：GSAP 没加载到就移除开场层，页面照常可用
      gsap.registerPlugin(ScrollTrigger);

      var mm = gsap.matchMedia();

      // 用户要求「减少动画」：跳过开场动画，直接显示页面
      mm.add('(prefers-reduced-motion: reduce)', function(){ killIntro(); });

      // 仅在用户「未要求减少动画」时运行完整动效
      mm.add('(prefers-reduced-motion: no-preference)', function(){
        // 预解码开场大图：在 GSAP 加载间隙就把切片图解好码，避免淡入瞬间首次解码造成卡顿
        document.querySelectorAll('#intro .slice-img').forEach(function(im){ if (im.decode) { im.decode().catch(function(){}); } });
        // 0) 把开场词与主标题拆成单字 span —— 为逐字动画做准备（保留 <br> 等原有节点）
        function splitChars(el){
          if (!el || el.querySelector('.char')) return;
          var built = '';
          el.childNodes.forEach(function(node){
            if (node.nodeType === 3) {
              built += node.textContent.split('').map(function(ch){
                return ch.trim() === '' ? ch : '<span class="char" style="display:inline-block;will-change:transform">' + ch + '</span>';
              }).join('');
            } else {
              built += node.outerHTML || '';
            }
          });
          el.innerHTML = built;
        }
        // 标题改用打字机效果（见下方脚本），不再拆字

        // 1) 主时间线：多语问候轮播 → 竖幕错落揭幕 → 再依次呈现导航 / 标题
        //    hero 各段用 .from（immediateRender）→ 一开始即处于隐藏态，揭幕时不会先闪出成品再回退
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTl = tl;   // 暴露给 skipIntro（按 O 键）以便快进到末态

        // —— 开场：切片逐条浮现 + 背景图缓慢推近（电影呼吸感）+ 标题被五等分逐条遮罩升起 ——
        gsap.set('#intro .slice-word', { yPercent: 120 });
        gsap.set('#intro .slice-img', { scale: 1.14, transformOrigin: '50% 50%' });
        tl.from('#intro .slice', { autoAlpha: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06 });
        tl.to('#intro .slice-img', { scale: 1, duration: 1.6, ease: 'power2.out' }, 0);            // 缓慢推近
        tl.to('#intro .slice-word', { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.1 }, '-=1.2');
        tl.to({}, { duration: 0.3 });   // 停顿让画面成形

        // —— 转场：五等分切片「奇上偶下」错位滑出 + 轻微缩放抽离（剪辑切片转场，expo 缓动）——
        tl.to('#intro .slice', {
          yPercent: function(i){ return i % 2 === 0 ? -108 : 108; },
          scale: 1.06,
          duration: 0.85, ease: 'expo.inOut', stagger: 0.09
        });
        tl.call(killIntro);   // 开场结束：移除开场层并启动流体背景

        // —— hero 入场（与切片滑出重叠，画面被切开的同时主页升起）——
        tl.from('header', { yPercent: -100, autoAlpha: 0, duration: 0.7 }, '-=0.6')
          .from('.orbit-field', { autoAlpha: 0, scale: 0.92, duration: 1.1, ease: 'power2.out' }, '-=0.3')
          .from('.orbit-core > :not(.page-title)', { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.15 }, '-=0.8')
          .from('.page-title', { y: 18, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, '-=0.5');

        // 2) 主标题呼吸高光改用纯 CSS（.page-title::before 的 opacity 动画，走合成层，不再每帧重绘文字）

        // 3) 滚动视差：下滚时标题区随滚动上移并淡出，制造纵深（scrub 跟手，ease 必须 none）
        gsap.to('.orbit-core', {
          yPercent: -16, autoAlpha: 0.2, ease: 'none',
          scrollTrigger: { trigger: '.orbit-hero', start: 'top top', end: 'bottom top', scrub: true }
        });

        // 4) 页脚进入视口时上浮淡入
        gsap.from('footer', {
          y: 30, autoAlpha: 0, duration: 0.8,
          scrollTrigger: { trigger: 'footer', start: 'top 92%' }
        });
      });
    })();
  </script>

  <!-- 标题：第一行注水动画 + 第二行模糊渐变轮播 -->
  <script>
    (function(){
      // ── 第一行注水：底部从左往右变速流 → 流到底涨满 → 停留(轻晃) → 清空 → 停顿 → 循环 ──
      var l1 = document.getElementById('line1');
      var l1reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (l1 && !l1reduce) {
        var st = 'wait', t = 0, L = 0, last = performance.now();
        (function frame(now){
          var dt = now - last; last = now; t += dt;
          if (st === 'wait')       { if (t > 3300) { st = 'fill'; t = 0; } }                              // 等开场揭幕
          else if (st === 'fill')  { L += (0.013 + 0.009 * Math.sin(t / 240) + 0.006 * Math.sin(t / 90)) * dt; if (L >= 100) { L = 100; st = 'hold'; t = 0; } }  // 左侧持续注水·有机变速
          else if (st === 'hold')  { if (t > 2600) { st = 'drain'; t = 0; } }                             // 停留
          else if (st === 'drain') { L -= 0.05 * dt; if (L <= 0) { L = 0; st = 'pause'; t = 0; } }        // 排空
          else if (st === 'pause') { if (t > 900) { st = 'fill'; t = 0; } }                               // 停顿后重来
          var active = (st === 'fill' || st === 'hold');
          var ratio = L / 100;
          var slosh = active ? (Math.sin(t / 300) * 2.4 + Math.sin(t / 120) * 0.9) : 0;   // 水面晃动（多频）
          var tilt = -(15 * (1 - ratio)) - slosh;                            // 左高右低：空时倾斜大（从左倒入），满时归平
          var Ld = Math.max(0, Math.min(100, L));
          var top = Math.min(100, Ld + 2.5);                                 // 水面柔和过渡
          l1.style.backgroundImage = 'linear-gradient(' + tilt.toFixed(2) + 'deg, #5fe6f5 0%, #22d3ee ' + (Ld * 0.55).toFixed(1) + '%, #0e9bb8 ' + Ld.toFixed(1) + '%, transparent ' + top.toFixed(1) + '%)';
          requestAnimationFrame(frame);
        })(last);
      }

      var roll = document.getElementById('roll');
      if (!roll) return;
      var words = ['一个想法', '一句话', '渲染出你心中的想象'];
      roll.textContent = words[0];
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;
      var i = 0;
      setInterval(function(){
        roll.style.transition = 'opacity .38s ease, filter .38s ease, transform .38s ease';
        roll.style.opacity = '0';
        roll.style.filter = 'blur(10px)';
        roll.style.transform = 'scale(1.08)';
        setTimeout(function(){
          i = (i + 1) % words.length;
          roll.textContent = words[i];
          roll.style.transition = 'none';
          roll.style.opacity = '0';
          roll.style.filter = 'blur(10px)';
          roll.style.transform = 'scale(0.94)';
          void roll.offsetWidth;          // 强制重排，让浮现过渡生效
          roll.style.transition = 'opacity .45s ease, filter .45s ease, transform .45s cubic-bezier(.16,1,.3,1)';
          roll.style.opacity = '1';
          roll.style.filter = 'blur(0)';
          roll.style.transform = 'scale(1)';
        }, 380);
      }, 2700);
    })();
  </script>
</body>
</html>`;
    fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf-8');
    // 3.2 生成示例画廊独立页 examples.html（含卡片画廊 + 三步工作流）
    const examplesHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- 中和「减少动画」误报：部分 Edge 版本在系统动画开启时仍报告 prefers-reduced-motion:reduce，
       会让本站全部动效被跳过。这里让站点脚本一律按「未要求减少动画」处理（reduce→false、no-preference→true）。 -->
  <script>
    (function(){
      try {
        document.documentElement.classList.add('js-anim');  // 标记 JS 可用：CSS 据此预隐藏将由 JS 揭示的元素，避免 FOUC
        var native = window.matchMedia.bind(window);
        function fake(q, m){ return { matches:m, media:q, onchange:null,
          addListener:function(){}, removeListener:function(){},
          addEventListener:function(){}, removeEventListener:function(){}, dispatchEvent:function(){return false;} }; }
        window.matchMedia = function(q){
          if (typeof q === 'string') {
            if (/prefers-reduced-motion\\s*:\\s*reduce/i.test(q)) return fake(q, false);
            if (/prefers-reduced-motion\\s*:\\s*no-preference/i.test(q)) return fake(q, true);
          }
          return native(q);
        };
      } catch (e) {}
    })();
  </script>
  <title>示例画廊 · AI 网页生成器</title>
  <meta name="description" content="浏览「对话即渲染」生成的全部示例页面——53 个专业，6 种设计原型，轮播、选项卡、手风琴等交互全部内置。" />
  <meta property="og:title" content="示例画廊 · AI 网页生成器" />
  <meta property="og:description" content="浏览全部 AI 生成的示例页面，每张卡片背后都是一个完整的交互网页。" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="assets/majors/哲学类.jpg" />
  <link rel="preconnect" href="https://fonts.loli.net" />
  <link rel="preconnect" href="https://gstatic.loli.net" crossorigin />
  <link href="https://fonts.loli.net/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700;900&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="/gsap.min.js"></script>
  <script src="/ScrollTrigger.min.js"></script>
  <style>
    :root {
      --accent: #6366f1;
      --bg: #09090b;
      --surface: #0a0a0a;
      --text-dim: #a1a1aa;
    }
    html { scroll-behavior: smooth; touch-action: manipulation; }
    /* ── 跨页转场（原生 View Transitions）：点导航平滑切换，旧浏览器自动退化为普通跳转 ── */
    @view-transition { navigation: auto; }
    /* 真·翻页：新页静止铺在下层，旧页像书页一样绕左缘掀起翻走、露出新页（不压扁整屏） */
    ::view-transition { perspective: 2200px; }
    ::view-transition-new(root) { animation: pg-reveal .95s ease both; z-index: 1; }
    ::view-transition-old(root) { animation: pg-turn .95s cubic-bezier(.36,0,.2,1) both; transform-origin: left center; z-index: 2; backface-visibility: hidden; box-shadow: 0 0 80px rgba(0,0,0,.55); }
    @keyframes pg-turn { to { transform: rotateY(135deg); opacity: .96; filter: brightness(.45); } }
    @keyframes pg-reveal { from { filter: brightness(.72); transform: scale(.992); } to { filter: brightness(1); transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
    }
    body { font-family: 'Inter','Noto Sans SC','PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',system-ui,sans-serif; }
    /* ── 触控交互（L2）───────────────────── */
    a, button, [role="button"], input, select, textarea, .tilt-card { cursor: pointer; }
    button:disabled, a[aria-disabled="true"] { cursor: not-allowed; opacity: 0.45; }
    button, [role="button"] { min-height: 44px; min-width: 44px; }
    /* 标题字体：Playfair Display（衬线） — 与正文 Inter（无衬线）形成性格对比 */
    .page-title, .section-title, .tilt-name, h1, h2, h3 { font-family: 'Playfair Display','Noto Serif SC','Georgia','Songti SC',serif; }
    /* 等宽字体：JetBrains Mono — 用于标签/代码/数字 */
    .eyebrow, .tilt-dept, .tilt-cta, .how-num { font-family: 'JetBrains Mono','Cascadia Code','SF Mono','Fira Code',monospace; }

    /* 青色标题（静态渐变）；动效由下方打字机承担 */
    .page-title { font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight:800; letter-spacing:normal; position:relative; }
    /* 呼吸高光：单独的模糊光晕层，只动 opacity（走合成层），不再每帧重绘文字，避免开场/常驻卡顿 */
    .page-title::before {
      content:''; position:absolute; left:50%; top:50%; z-index:-1; pointer-events:none;
      width:78%; height:64%; transform:translate(-50%,-50%);
      background: radial-gradient(closest-side, rgba(99,102,241,.5), transparent 72%);
      filter: blur(28px); opacity:.4; will-change: opacity;
      animation: titleGlow 4.8s ease-in-out infinite;
    }
    @keyframes titleGlow { 0%,100% { opacity:.32; } 50% { opacity:.78; } }
    /* 第一行＝整体水容器（青描边空轮廓）：注水动画由 JS 驱动（底部变速右流 → 涨满 → 停留 → 清空 → 循环）*/
    .page-title .l1fill { display:inline-block;
      -webkit-text-fill-color: transparent; -webkit-text-stroke: 1.4px rgba(125,211,252,.5);
      background-repeat: no-repeat; background-position: center; background-size: 100% 100%;
      background-image: linear-gradient(0deg, #22d3ee 0%, #5fe6f5 100%);   /* 默认实心可见，水动画由 JS 每帧接管；JS 不跑时标题照常可读 */
      -webkit-background-clip: text; background-clip: text; }
    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      .page-title .l1fill { background-image: linear-gradient(0deg, #22d3ee 0%, #5fe6f5 100%) !important; background-size: 100% 100% !important; }
    }
    /* 第二行轮播词：纯青字 + 模糊渐变切换；字号略小，与第一行更平衡 */
    .page-title .roll { display:inline-block; vertical-align:bottom; white-space:nowrap; font-size:.78em;
      color:#22d3ee; -webkit-text-fill-color:#22d3ee; will-change:opacity,filter,transform; }

    .grid3d { display:grid; gap:clamp(1rem, 2.5vw, 1.5rem); grid-template-columns:repeat(1,1fr); }
    @media(min-width:640px){ .grid3d{ grid-template-columns:repeat(2,1fr); } }
    @media(min-width:1024px){ .grid3d{ grid-template-columns:repeat(3,1fr); } }
    @media(min-width:1280px){ .grid3d{ grid-template-columns:repeat(4,1fr); } }

    .tilt-card { display:block; perspective:900px; aspect-ratio:3/4; }
    /* JS 可用时预隐藏卡片，等 ScrollTrigger 揭示——避免 GSAP 接管前先闪出再被藏起来（FOUC）。
       若 JS/GSAP 未运行则无 .js-anim，卡片照常显示，绝不会空白。 */
    html.js-anim .tilt-card { visibility: hidden; }
    .tilt-link { display:block; width:100%; height:100%; text-decoration:none; border-radius:1.25rem; }
    .tilt-link:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    .tilt-inner {
      position:relative; width:100%; height:100%; border-radius:1.25rem; overflow:hidden;
      transform-style:preserve-3d; will-change:transform;
      transition: box-shadow .4s ease;
      border:1px solid rgba(255,255,255,.08); background:var(--surface);
    }
    .tilt-fallback, .tilt-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .tilt-fallback { z-index:0; }
    .tilt-img { z-index:1; transition: transform .5s cubic-bezier(.16,1,.3,1); }
    .tilt-card:hover .tilt-img { transform: scale(1.12); }
    .tilt-shade { position:absolute; inset:0; z-index:2;
      background:linear-gradient(to top, rgba(10,10,10,.96) 0%, rgba(10,10,10,.3) 45%, transparent 72%); }
    .tilt-glow { position:absolute; inset:0; z-index:3; opacity:0; transition:opacity .3s;
      background:radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.28), transparent 42%); }
    .tilt-card:hover .tilt-glow, .tilt-card:focus-within .tilt-glow { opacity:1; }
    .tilt-content { position:absolute; left:0; right:0; bottom:0; z-index:4; padding:1.3rem; transform:translateZ(35px); }
    .tilt-dept { font-size:.68rem; letter-spacing:.05em; color:var(--text-dim); margin-bottom:.3rem; }
    .tilt-name { font-size:1.5rem; font-weight:700; letter-spacing:normal; line-height:1.15; }
    .tilt-cta { font-size:.68rem; text-transform:uppercase; letter-spacing:.18em; margin-top:.6rem; }
    .btn-link:focus-visible { outline:2px solid #fff; outline-offset:3px; }

    .eyebrow { font-size:.72rem; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); }
    .section-wrap { max-width:80rem; margin:0 auto; padding:7rem 1.5rem; }
    .section-title { font-size:clamp(1.9rem,4vw,3rem); font-weight:700; letter-spacing:normal; line-height:1.15; margin:.9rem 0 1rem; }
    .section-sub { color:var(--text-dim); font-weight:400; max-width:46rem; line-height:1.75; }

    .hero-cta { display:inline-flex; align-items:center; gap:.5rem; padding:.85rem 1.6rem; border-radius:9999px;
      font-weight:700; font-size:.9rem; letter-spacing:.01em; text-decoration:none;
      transition:transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, background .25s ease, border-color .25s ease; }
    .hero-cta-primary { background:var(--accent); color:#fff; }
    .hero-cta-primary:hover { transform:translateY(-2px); box-shadow:0 18px 42px -12px var(--accent); background:#7c7ff5; }
    .hero-cta:focus-visible { outline:2px solid #fff; outline-offset:3px; }

    .how-grid { display:grid; gap:1.25rem; grid-template-columns:1fr; margin-top:3rem; }
    @media(min-width:768px){ .how-grid{ grid-template-columns:repeat(3,1fr); } }
    .how-step { position:relative; padding:2rem; border:1px solid rgba(255,255,255,.08); border-radius:1.25rem;
      background:rgba(255,255,255,.02); overflow:hidden; transition:border-color .3s ease, transform .3s ease; }
    .how-step:hover { border-color:rgba(99,102,241,.4); transform:translateY(-3px); }
    .how-num { font-size:3.4rem; font-weight:900; line-height:1; color:rgba(255,255,255,.07); }
    .how-step h3 { font-size:1.18rem; font-weight:700; margin:.5rem 0 .5rem; }
    .how-step p { font-size:.9rem; color:var(--text-dim); font-weight:300; line-height:1.65; }

    @media (prefers-reduced-motion: reduce) and (min-width: 999999px) {
      html { scroll-behavior:auto; }
      .tilt-inner, .tilt-glow { transition:none !important; }
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-white selection:text-black">
  <a href="#main-content" class="skip-link">跳到主要内容</a>
  <!-- 顶部导航 -->
  <header class="fixed top-0 inset-x-0 z-[400] bg-zinc-950/70 backdrop-blur border-b border-zinc-900">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
      <a href="/" class="text-sm font-bold tracking-normal shrink-0">对话即渲染 <span class="text-indigo-400">·</span> 生成器</a>
      <button id="hamburger" class="md:hidden flex flex-col gap-1 p-2 z-50" aria-label="菜单" aria-expanded="false">
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
        <span class="block w-5 h-0.5 bg-zinc-300 transition-all origin-center"></span>
      </button>
      <nav id="main-nav" aria-label="站点功能导航" class="hidden md:flex items-center gap-3 text-xs">
        <a href="/" class="btn-link px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-100 font-bold transition whitespace-nowrap">← 首页</a>
        <a href="/skills/" class="btn-link px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-100 font-bold transition whitespace-nowrap">🧩 互动演示</a>
        <a href="/studio/" class="btn-link px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition whitespace-nowrap">⚡ 开始生成</a>
      </nav>
    </div>
    <nav id="mobile-nav" class="hidden md:hidden flex-col gap-2 px-6 pb-4 bg-zinc-950/95 border-b border-zinc-900 text-xs" aria-label="移动端导航">
      <a href="/" class="block px-4 py-3 rounded-xl hover:bg-zinc-800 transition font-bold">← 首页</a>
      <a href="/skills/" class="block px-4 py-3 rounded-xl hover:bg-zinc-800 transition font-bold">🧩 互动演示</a>
      <a href="/studio/" class="block px-4 py-3 rounded-xl bg-indigo-500 text-white font-bold transition">⚡ 开始生成</a>
    </nav>
  </header>

  <!-- 面包屑导航（L9） -->
  <nav aria-label="面包屑" class="max-w-7xl mx-auto px-6 pt-20 pb-0 text-xs text-zinc-600">
    <a href="/" class="hover:text-zinc-400 transition">首页</a>
    <span class="mx-2">/</span>
    <span class="text-zinc-400">示例画廊</span>
  </nav>

  <!-- 搜索框 -->
  <div class="max-w-7xl mx-auto px-6 pt-4">
    <div class="relative max-w-md">
      <input id="search-input" type="search" placeholder="搜索 53 个专业…" aria-label="搜索专业"
        class="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition placeholder:text-zinc-600">
      <span id="search-count" class="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-600 pointer-events-none"></span>
    </div>
  </div>

  <!-- 示例画廊 -->
  <section id="main-content" class="section-wrap" style="padding-top:2rem">
    <p class="eyebrow">Examples · 示例画廊</p>
    <h2 class="section-title">点开任意一张，看完整的生成效果</h2>
    <p class="section-sub">下面每个页面都是一个 AI 生成的示例成品——轮播、选项卡、手风琴、表单校验、留言板等交互全部内置。点击卡片进去亲手玩一玩，就知道生成器能产出什么质感的页面。</p>
    <div class="grid3d mt-12" id="cards-grid">${cards}</div>
    <p id="no-results" class="hidden text-center text-zinc-600 py-12">没有匹配的专业，试试其他关键词</p>
  </section>


  <!-- 导航高亮 + 回顶（L9） -->
  <script>
    (function(){
      var path = location.pathname.replace(/\\/+$/, '') || '/';
      document.querySelectorAll('header a[href]').forEach(function(a){
        var href = a.getAttribute('href');
        if (href === path || (path !== '/' && href !== '/' && path.includes(href.replace(/\\/$/,'')))) {
          a.classList.add('!border-indigo-400', '!text-indigo-300');
        }
      });
      var topBtn = document.createElement('button');
      topBtn.innerHTML = '↑';
      topBtn.setAttribute('aria-label', '回到顶部');
      topBtn.className = 'fixed bottom-6 right-6 z-[300] w-11 h-11 rounded-full bg-indigo-500/80 hover:bg-indigo-400 text-white font-bold text-lg opacity-0 pointer-events-none transition-all duration-300 backdrop-blur';
      document.body.appendChild(topBtn);
      window.addEventListener('scroll', function(){
        var show = window.scrollY > 600;
        topBtn.style.opacity = show ? '1' : '0';
        topBtn.style.pointerEvents = show ? 'auto' : 'none';
      }, { passive: true });
      topBtn.addEventListener('click', function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); });
    })();
  </script>

  <!-- 搜索过滤 -->
  <script>
    (function(){
      var input = document.getElementById('search-input');
      var count = document.getElementById('search-count');
      var noRes = document.getElementById('no-results');
      if (!input) return;

      input.addEventListener('input', function(){
        var q = input.value.trim().toLowerCase();
        var visible = 0;
        var total = 0;
        document.querySelectorAll('#cards-grid .tilt-card').forEach(function(card){
          var text = (card.textContent || '').toLowerCase();
          var match = !q || text.includes(q);
          card.style.display = match ? '' : 'none';
          if (match) visible++;
          total++;
        });
        count.textContent = q ? visible + '/' + total : '';
        if (noRes) noRes.classList.toggle('hidden', visible > 0 || !q);
      });
    })();
  </script>

  <!-- 3D 倾斜卡片鼠标交互 —— GSAP quickTo 驱动，远优于原生 mousemove + string transform -->
  <script>
    (function(){
      if (!window.gsap) return;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) return;

      document.querySelectorAll('.tilt-card').forEach(function(card){
        var inner = card.querySelector('.tilt-inner');
        var glow  = card.querySelector('.tilt-glow');
        var color = card.getAttribute('data-color') || '#ffffff';
        if (!inner) return;

        // 每个卡片独立一组 quickTo（官方推荐：高频更新零 GC 压力）
        var rxTo = gsap.quickTo(inner, "rotationX", { duration: 0.45, ease: "back.out(1.2)" });
        var ryTo = gsap.quickTo(inner, "rotationY", { duration: 0.45, ease: "back.out(1.2)" });
        var scTo = gsap.quickTo(inner, "scale",     { duration: 0.45, ease: "back.out(1.2)" });
        var yTo  = gsap.quickTo(inner, "y",          { duration: 0.55, ease: "back.out(1.2)" });

        card.addEventListener('mousemove', function(e){
          var r  = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top)  / r.height;
          rxTo((0.5 - py) * 22);   // ±22° 上下倾斜（加大幅度）
          ryTo((px - 0.5) * 22);   // ±22° 左右倾斜
          scTo(1.06);              // 微微放大
          yTo(-6);                 // 抬升 6px
          inner.style.boxShadow = '0 40px 80px -20px ' + color + ', 0 0 60px -10px ' + color;
          if (glow) { glow.style.setProperty('--mx', (px*100)+'%'); glow.style.setProperty('--my', (py*100)+'%'); }
        });

        card.addEventListener('mouseleave', function(){
          rxTo(0);
          ryTo(0);
          scTo(1);
          yTo(0);
          inner.style.boxShadow = '';
        });
      });
    })();
  </script>

  <!-- GSAP 滚动动效 -->
  <script>
    (function(){
      // 兜底：去掉 .js-anim 后 CSS 不再隐藏卡片（GSAP/ScrollTrigger 缺失时卡片照常显示，绝不空白）
      function showCards(){ document.documentElement.classList.remove('js-anim'); }
      if (!window.gsap || !window.ScrollTrigger) { showCards(); return; }
      gsap.registerPlugin(ScrollTrigger);

      var mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', function(){
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('header', { yPercent: -100, autoAlpha: 0, duration: 0.7 });

        gsap.set('.tilt-card', { autoAlpha: 0, y: 40 });
        ScrollTrigger.batch('.tilt-card', {
          start: 'top 88%',
          onEnter: function(els){ gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out', overwrite: true }); }
        });
        ScrollTrigger.refresh();
        // 末位兜底：6s 后强制揭示任何仍隐藏的卡片，防止 ScrollTrigger 异常导致卡片永久不出现
        setTimeout(function(){
          gsap.to('.tilt-card', { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.02, overwrite: 'auto' });
        }, 6000);
      });
    })();
  </script>
  <!-- 全局流体背景（自动游走版：无需动鼠标，背景自己泛起流体） -->
  <script src="/fluid-bg.js" data-auto="1" defer></script>
</body>
</html>`;
    fs.writeFileSync(path.join(distDir, 'examples.html'), examplesHtml, 'utf-8');
    console.log('\x1b[36m%s\x1b[0m', '📄 示例画廊独立页已生成: dist/examples.html');

    console.log('\x1b[32m%s\x1b[0m', `\n🎉 [Success] 自动化编译流水线执行成功！`);
    console.log(`📊 共计编译并输出 ${successCount} 个静态页面至 ./dist/ 目录（另含 1 个总览首页 + 1 个示例画廊页）。`);
    console.log(`🎨 设计原型分布: ` + ARCHETYPES.map((a) => `${a}×${archetypeCount[a] || 0}`).join('  '));

} catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `💥 [Fatal Error] 编译中断: ${error.message}`);
}
