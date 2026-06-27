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
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
    <link href="https://fonts.loli.net/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;700;900&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root { --theme: ${major.themeColor}; --color-primary: ${major.themeColor}; }
      :focus-visible { outline: 2.5px solid var(--theme); outline-offset: 3px; border-radius: 4px; }
      .skip-link { position: absolute; top: -100px; left: 16px; background: var(--theme); color: #fff; padding: .5rem 1rem; border-radius: 0 0 8px 8px; z-index: 9999; font-size: .85rem; font-weight: 600; transition: top .2s ease; text-decoration: none; }
      .skip-link:focus { top: 0; }
      #cursor-glow { position: fixed; top: 0; left: 0; width: 360px; height: 360px; margin-left: -180px; margin-top: -180px; border-radius: 50%; background: radial-gradient(circle, ${major.themeColor}33, transparent 60%); pointer-events: none; z-index: 9999; opacity: 0; will-change: transform; }
      @media (prefers-reduced-motion: reduce) { #cursor-glow { display: none; } }
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
  </script>`;

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
              <img class="tilt-img" src="assets/majors/${m.name}.jpg" alt="${m.name}专业主题图" width="900" height="1200" ${i < 4 ? 'fetchpriority="high"' : 'loading="lazy"'} onerror="this.style.display='none'">
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
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
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
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    html { scroll-behavior: smooth; touch-action: manipulation; }
    body { font-family: 'Inter','Noto Sans SC','PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',system-ui,sans-serif; }
    /* ── 触控交互（L2）───────────────────── */
    a, button, [role="button"], input, select, textarea, .tilt-card { cursor: pointer; }
    button:disabled, a[aria-disabled="true"] { cursor: not-allowed; opacity: 0.45; }
    button, [role="button"] { min-height: 44px; min-width: 44px; }
    /* 标题字体：Playfair Display（衬线） — 与正文 Inter（无衬线）形成性格对比 */
    .page-title, .section-title, .tilt-name, h1, h2, h3 { font-family: 'Playfair Display','Noto Serif SC','Georgia','Songti SC',serif; }
    /* 等宽字体：JetBrains Mono — 用于标签/代码/数字 */
    .eyebrow, .tilt-dept, .tilt-cta, .how-num { font-family: 'JetBrains Mono','Cascadia Code','SF Mono','Fira Code',monospace; }

    .page-title { font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight:800; letter-spacing:normal; text-shadow: 0 2px 50px rgba(99,102,241,.3); }

    .grid3d { display:grid; gap:clamp(1rem, 2.5vw, 1.5rem); grid-template-columns:repeat(1,1fr); }
    @media(min-width:640px){ .grid3d{ grid-template-columns:repeat(2,1fr); } }
    @media(min-width:1024px){ .grid3d{ grid-template-columns:repeat(3,1fr); } }
    @media(min-width:1280px){ .grid3d{ grid-template-columns:repeat(4,1fr); } }

    .tilt-card { display:block; perspective:900px; aspect-ratio:3/4; }
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
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior:auto; }
      .tilt-inner, .tilt-glow { transition:none !important; }
    }

    /* 轨道英雄：群星环绕 */
    .orbit-hero { position:relative; min-height:100vh; display:grid; place-items:center; overflow:hidden; padding:6rem 1rem; }
    /* 背景氛围光由 .hero-ambient 层承载（支持鼠标视差） */
    .orbit-field { position:absolute; inset:0; pointer-events:none; perspective:900px; }
    /* 轨道环线：让公转看起来是"设计过的"而非随机漂浮 */
    .orbit-ring { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      border:1px solid rgba(255,255,255,.06); border-radius:50%; pointer-events:none; }
    .orbit-core { position:relative; z-index:300; text-align:center; max-width:640px; }
    .orbit-card { position:absolute; left:50%; top:50%; width:clamp(118px,13vw,184px); aspect-ratio:3/4;
      border-radius:1rem; overflow:hidden; pointer-events:auto; text-decoration:none;
      border:1px solid rgba(255,255,255,.12); box-shadow:0 24px 60px -22px rgba(0,0,0,.85); will-change:transform,opacity;
      transition: border-color .35s ease, box-shadow .35s ease; }
    /* 悬浮：边框提亮 + 光晕扩散 + 图片去灰度露出本色 */
    .orbit-card:hover {
      border-color: rgba(255,255,255,.5) !important;
      box-shadow: 0 0 55px rgba(99,102,241,.45), 0 32px 80px -18px rgba(0,0,0,.95) !important;
    }
    .orbit-card img { width:100%; height:100%; object-fit:cover; display:block;
      filter:grayscale(.9) contrast(1.05) brightness(.92);
      transition: filter .4s ease; }
    .orbit-card:hover img {
      filter: grayscale(.2) contrast(1.1) brightness(1.08) !important;
    }
    /* 悬浮时减弱靛蓝色罩，让原图色彩透出来 */
    .orbit-card::after { content:''; position:absolute; inset:0; z-index:1; pointer-events:none;
      background:#4338ca; mix-blend-mode:color; opacity:.5;
      transition: opacity .4s ease; }
    .orbit-card:hover::after { opacity: .15 !important; }
    .orbit-card .label { position:absolute; inset:auto 0 0 0; z-index:2; padding:.6rem .7rem; font-size:.78rem; font-weight:700;
      background:linear-gradient(to top, rgba(10,10,10,.92), transparent); }
    .orbit-card:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

    /* GSAP 鼠标跟随光效 —— gsap.quickTo 驱动，避免 layout thrashing */
    #cursor-glow {
      position: fixed; top: 0; left: 0; width: 420px; height: 420px;
      margin-left: -210px; margin-top: -210px; /* 居中补偿，避免与 GSAP x/y 冲突 */
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,.13), transparent 60%);
      pointer-events: none; z-index: 9999; opacity: 0;
      will-change: transform;
    }
    /* 英雄氛围光：鼠标视差层 */
    .hero-ambient {
      position: absolute; inset: 0; z-index: 0; pointer-events: none;
      background: radial-gradient(58% 48% at 50% 44%, rgba(99,102,241,.20), transparent 70%);
      will-change: transform;
    }
    @media (prefers-reduced-motion: reduce) {
      #cursor-glow, .hero-ambient { display: none; }
    }
  </style>
</head>
<body class="bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-white selection:text-black">
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
    <div class="hero-ambient" id="hero-ambient" aria-hidden="true"></div>
    <div class="orbit-field" id="orbit" aria-hidden="true">
      <div class="orbit-ring" data-r="1"></div>
      <div class="orbit-ring" data-r="0.62"></div>
    </div>
    <div class="orbit-core">
      <p class="eyebrow mb-5">AI Webpage Generator · 对话即渲染</p>
      <h1 class="page-title font-extrabold tracking-normal mb-6 text-white">一句话，<br class="sm:hidden" />生成一个完整网页</h1>
      <p class="text-zinc-300 font-normal max-w-xl mx-auto leading-relaxed mb-9">用自然语言描述你想要的页面，DeepSeek 实时生成带完整交互的成品，沙盒里立刻预览。环绕的这些，都是它生成的示例 —— 点开看看。</p>
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
      var path = location.pathname.replace(/\/+$/, '') || '/';
      document.querySelectorAll('header a[href]').forEach(function(a){
        var href = a.getAttribute('href');
        if (href === path || (path !== '/' && href !== '/' && path.includes(href.replace(/\/$/,'')))) {
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

      // 1) 光标光效跟随 —— quickTo 是 GSAP 官方推荐的高频更新方案
      var glow = document.getElementById('cursor-glow');
      if (glow) {
        var xTo = gsap.quickTo(glow, "x", { duration: 0.55, ease: "power3.out" });
        var yTo = gsap.quickTo(glow, "y", { duration: 0.55, ease: "power3.out" });
        var opacityTo = gsap.quickTo(glow, "opacity", { duration: 0.3 });

        document.addEventListener('mousemove', function(e){
          xTo(e.clientX);
          yTo(e.clientY);
          opacityTo(1);
        });
        document.addEventListener('mouseleave', function(){
          opacityTo(0);
        });
      }

      // 2) 英雄区鼠标视差 —— 氛围光随鼠标微偏移，制造纵深感
      var ambient = document.getElementById('hero-ambient');
      if (ambient) {
        var axTo = gsap.quickTo(ambient, "x", { duration: 0.8, ease: "power2.out" });
        var ayTo = gsap.quickTo(ambient, "y", { duration: 0.8, ease: "power2.out" });

        document.addEventListener('mousemove', function(e){
          // 把鼠标在视口中的相对位置映射为小幅偏移 (≈±18px)
          var mx = (e.clientX / window.innerWidth  - 0.5) * 36;
          var my = (e.clientY / window.innerHeight - 0.5) * 36;
          axTo(mx);
          ayTo(my);
        });
      }
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
        RX = Math.min(w * 0.34, 430); RY = Math.min(h * 0.30, 240);
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
      function frame(now){
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
      if (!window.gsap) return;                 // CDN 兜底：GSAP 没加载到就静默跳过，页面照常可用
      gsap.registerPlugin(ScrollTrigger);

      var mm = gsap.matchMedia();

      // 仅在用户「未要求减少动画」时运行完整动效；reduce 分支不做任何事 → 元素保持自然可见
      mm.add('(prefers-reduced-motion: no-preference)', function(){
        // 1) 入场时间线：导航下滑 → 轨道场淡入放大 → 标题区逐项上浮
        var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('header', { yPercent: -100, autoAlpha: 0, duration: 0.7 })
          .from('.orbit-field', { autoAlpha: 0, scale: 0.92, duration: 1.1, ease: 'power2.out' }, '-=0.3')
          .from('.orbit-core > *', { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.15 }, '-=0.8');

        // 2) 主标题渐变光的呼吸高光：克制地循环强调（yoyo + sine 缓动）
        gsap.to('.page-title', {
          textShadow: '0 2px 70px rgba(99,102,241,.6)',
          duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut'
        });

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
</body>
</html>`;
    fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf-8');
    // 3.2 生成示例画廊独立页 examples.html（含卡片画廊 + 三步工作流）
    const examplesHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <style>
    :root {
      --accent: #6366f1;
      --bg: #09090b;
      --surface: #0a0a0a;
      --text-dim: #a1a1aa;
    }
    html { scroll-behavior: smooth; touch-action: manipulation; }
    body { font-family: 'Inter','Noto Sans SC','PingFang SC','HarmonyOS Sans SC','Microsoft YaHei',system-ui,sans-serif; }
    /* ── 触控交互（L2）───────────────────── */
    a, button, [role="button"], input, select, textarea, .tilt-card { cursor: pointer; }
    button:disabled, a[aria-disabled="true"] { cursor: not-allowed; opacity: 0.45; }
    button, [role="button"] { min-height: 44px; min-width: 44px; }
    /* 标题字体：Playfair Display（衬线） — 与正文 Inter（无衬线）形成性格对比 */
    .page-title, .section-title, .tilt-name, h1, h2, h3 { font-family: 'Playfair Display','Noto Serif SC','Georgia','Songti SC',serif; }
    /* 等宽字体：JetBrains Mono — 用于标签/代码/数字 */
    .eyebrow, .tilt-dept, .tilt-cta, .how-num { font-family: 'JetBrains Mono','Cascadia Code','SF Mono','Fira Code',monospace; }

    .page-title { font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight:800; letter-spacing:normal; text-shadow: 0 2px 50px rgba(99,102,241,.3); }

    .grid3d { display:grid; gap:clamp(1rem, 2.5vw, 1.5rem); grid-template-columns:repeat(1,1fr); }
    @media(min-width:640px){ .grid3d{ grid-template-columns:repeat(2,1fr); } }
    @media(min-width:1024px){ .grid3d{ grid-template-columns:repeat(3,1fr); } }
    @media(min-width:1280px){ .grid3d{ grid-template-columns:repeat(4,1fr); } }

    .tilt-card { display:block; perspective:900px; aspect-ratio:3/4; }
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

    @media (prefers-reduced-motion: reduce) {
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

  <!-- 工作流：三步说明 -->
  <section id="how" class="section-wrap" style="padding-top:0">
    <p class="eyebrow">How it works · 工作流</p>
    <h2 class="section-title">三步，从一句话到一个网页</h2>
    <p class="section-sub">不需要写代码，也不需要选模板。把想法说清楚，剩下的交给模型。</p>
    <div class="how-grid">
      <div class="how-step"><div class="how-num">01</div><h3>描述</h3><p>用一句中文说清你想要的页面：风格、板块、内容——越具体，生成得越准。</p></div>
      <div class="how-step"><div class="how-num">02</div><h3>生成</h3><p>DeepSeek 按规则产出单文件 HTML，自带 Tailwind 样式与原生 JS 交互，绝不只是静态页。</p></div>
      <div class="how-step"><div class="how-num">03</div><h3>预览 · 下载</h3><p>结果在沙盒 iframe 里实时渲染，满意就一键下载，纯静态文件直接可部署。</p></div>
    </div>
    <div class="mt-10"><a href="/studio/" class="hero-cta hero-cta-primary">⚡ 现在就试一句</a></div>
  </section>

  <footer class="border-t border-zinc-900 py-10 text-center text-zinc-600 text-sm">
    <p class="mb-2">用一句话生成网页 · <a href="/studio/" class="text-zinc-400 hover:text-indigo-400 transition">打开 Studio</a> · <a href="/skills/" class="text-zinc-400 hover:text-indigo-400 transition">互动演示</a></p>
    © 2026 · 由 campus-page-generator 自动生成
  </footer>

  <!-- 导航高亮 + 回顶（L9） -->
  <script>
    (function(){
      var path = location.pathname.replace(/\/+$/, '') || '/';
      document.querySelectorAll('header a[href]').forEach(function(a){
        var href = a.getAttribute('href');
        if (href === path || (path !== '/' && href !== '/' && path.includes(href.replace(/\/$/,'')))) {
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
      if (!window.gsap) return;
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

        gsap.from('.how-step', {
          y: 40, autoAlpha: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out',
          scrollTrigger: { trigger: '#how', start: 'top 80%' }
        });

        gsap.from('footer', {
          y: 30, autoAlpha: 0, duration: 0.8,
          scrollTrigger: { trigger: 'footer', start: 'top 92%' }
        });
      });
    })();
  </script>
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
