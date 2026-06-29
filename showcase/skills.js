/* ============================================================
   网页拆解 —— 6 项能力的可视化演示逻辑
   01~03 原生 JS / 04~06 真正的 Vue 3（本地 vendor，规避国内 CDN）
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 通用：滚动揭示 ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });

  /* ---------- 通用：吸顶导航 scroll-spy（高亮当前所在能力节） ---------- */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('#spec-nav .snav'));
    if (!links.length) return;
    function setActive(id) {
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-sec') === id); });
    }
    var secs = ['s1', 's2', 's3', 's4', 's5', 's6']
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secs.forEach(function (s) { spy.observe(s); });
    // 点击后即时高亮（不等滚动观察）
    links.forEach(function (a) {
      a.addEventListener('click', function () { setActive(a.getAttribute('data-sec')); });
    });
  })();

  /* ---------- 通用：动画增强（进度条 / 导航游标 / 行级联 / 巨号视差） ---------- */
  (function () {
    // 顶部阅读进度条
    var bar = document.createElement('div');
    bar.id = 'read-bar';
    document.body.appendChild(bar);

    // 分节导航：滑动游标——跟随当前高亮的能力节平滑移动
    var navUl = document.querySelector('#spec-nav ul');
    var ink = null, links = [];
    if (navUl) {
      ink = document.createElement('li');
      ink.id = 'snav-ink';
      ink.setAttribute('aria-hidden', 'true');
      navUl.appendChild(ink);
      links = Array.prototype.slice.call(navUl.querySelectorAll('.snav'));
    }
    // 六节配色身份：游标 / 当前序号随所在能力节换色
    var ACC = { s1: '#5b8cff', s2: '#34e3d4', s3: '#ffb454', s4: '#a78bfa', s5: '#4ade80', s6: '#fb7185' };
    function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    function moveInk() {
      if (!ink || !links.length) return;
      var a = navUl.querySelector('.snav.active') || links[0];
      if (!a) { ink.style.opacity = '0'; return; }
      ink.style.opacity = '1';
      ink.style.width = a.offsetWidth + 'px';
      ink.style.height = a.offsetHeight + 'px';
      // 用 offsetLeft/Top（相对定位的 ul），横向滚动时游标随内容一起滚，不会错位
      ink.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
      var col = ACC[a.getAttribute('data-sec')] || '#5b8cff';
      ink.style.background = hexA(col, 0.15);
      ink.style.borderColor = hexA(col, 0.5);
      ink.style.boxShadow = '0 0 16px ' + hexA(col, 0.28);
      links.forEach(function (l) {
        var n = l.querySelector('.n'); if (!n) return;
        n.style.color = l.classList.contains('active') ? (ACC[l.getAttribute('data-sec')] || '') : '';
      });
    }
    // scroll-spy 在别处切换 .active —— 用 MutationObserver 跟随，无需轮询
    if (navUl) {
      var mo = new MutationObserver(moveInk);
      links.forEach(function (a) { mo.observe(a, { attributes: true, attributeFilter: ['class'] }); });
      navUl.addEventListener('click', function () { setTimeout(moveInk, 0); });
    }

    // 巨号 specnum 视差
    var specnums = Array.prototype.slice.call(document.querySelectorAll('.specnum'));
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var h = document.documentElement;
        var st = window.pageYOffset || h.scrollTop || 0;
        var max = h.scrollHeight - h.clientHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? (st / max) : 0) + ')';
        var vh = window.innerHeight;
        for (var i = 0; i < specnums.length; i++) {
          var r = specnums[i].getBoundingClientRect();
          var p = (r.top + r.height / 2 - vh / 2) / vh;   // 距视口中线的归一化位置
          specnums[i].style.transform = 'translateY(' + (p * -16).toFixed(1) + 'px)';
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { moveInk(); onScroll(); });
    window.addEventListener('load', moveInk);
    moveInk(); onScroll();

    // 巨号 specnum 进场扫光：能力节进入视口时，描边巨号亮一下青色再落定
    var spy2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          var n = e.target.querySelector('.specnum');
          if (n) n.classList.add('lit');
          spy2.unobserve(e.target);
        }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('section.spec').forEach(function (s) { spy2.observe(s); });

    // 注：原「交互光斑」柔光层已由 ink-ripple.js 的水墨涟漪取代（鼠标跟随效果更强），此处不再创建。
  })();

  /* ---------- 通用：浮层提示 ---------- */
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ============================================================
     01 · HTML 语义结构 —— 语义标签 ↔ 全 div 切换
     ============================================================ */
  (function () {
    var btn = document.getElementById('sem-toggle');
    var anat = document.getElementById('anat');
    var outline = document.getElementById('outline');
    if (!btn || !anat || !outline) return;

    var tags = { 'header': 't-header', 'nav': 't-nav', 'main': 't-main', 'article': 't-article', 'aside': 't-aside', 'footer': 't-footer' };
    var semantic = true;

    var semanticOutline =
      '<li>页眉 / Banner</li>' +
      '<li>导航 / Navigation</li>' +
      '<li>主内容 / Main<ul>' +
      '<li class="lv2">文章 / Article</li>' +
      '<li class="lv2">补充 / Complementary</li></ul></li>' +
      '<li>页脚 / Footer</li>';

    function render() {
      if (semantic) {
        anat.classList.remove('soup');
        Object.keys(tags).forEach(function (t) {
          var el = document.getElementById(tags[t]);
          if (el) el.textContent = '<' + t + '>';
        });
        outline.classList.remove('dead');
        outline.innerHTML = semanticOutline;
        btn.textContent = '切到「全 div」写法';
      } else {
        anat.classList.add('soup');
        Object.keys(tags).forEach(function (t) {
          var el = document.getElementById(tags[t]);
          if (el) el.textContent = '<div>';
        });
        outline.classList.add('dead');
        outline.innerHTML =
          '<li>⚠ 无可识别的页面结构</li>' +
          '<li style="color:var(--mut)">屏幕阅读器只看到一连串 &lt;div&gt;</li>' +
          '<li style="color:var(--mut)">没有地标、没有大纲、没法快速跳转</li>' +
          '<li style="color:var(--mut)">搜索引擎也更难理解内容层次</li>';
        btn.textContent = '切回「语义标签」写法';
      }
    }
    btn.addEventListener('click', function () { semantic = !semantic; render(); });
    render();
  })();

  /* ============================================================
     02 · CSS 高级视觉 —— 实时调玻璃卡片 + 同步代码
     ============================================================ */
  (function () {
    var card = document.getElementById('glass-card');
    var stage = document.getElementById('glass-stage');
    var rBlur = document.getElementById('r-blur');
    var rGlow = document.getElementById('r-glow');
    var rTilt = document.getElementById('r-tilt');
    var code = document.getElementById('css-code');
    if (!card || !rBlur) return;

    var tiltMax = 0;
    function apply() {
      var blur = +rBlur.value, glow = +rGlow.value, tilt = +rTilt.value;
      tiltMax = tilt;
      card.style.setProperty('--gblur', blur + 'px');
      card.style.setProperty('--gglow', glow + 'px');
      card.style.setProperty('--gglowA', (glow / 80 * 0.7 + 0.15).toFixed(2));
      document.getElementById('v-blur').textContent = blur;
      document.getElementById('v-glow').textContent = glow;
      document.getElementById('v-tilt').textContent = tilt;
      code.innerHTML =
        '.glass-card {\n' +
        '  <span class="p">background</span>: <span class="s">rgba(255,255,255,.07)</span>;\n' +
        '  <span class="p">backdrop-filter</span>: <span class="k">blur(' + blur + 'px)</span>;\n' +
        '  <span class="p">box-shadow</span>: 0 0 <span class="k">' + glow + 'px</span> rgba(91,140,255,.5);\n' +
        '  <span class="p">transform</span>: <span class="k">perspective(700px)</span> rotateX/Y(±' + tilt + '°);\n' +
        '}';
    }
    [rBlur, rGlow, rTilt].forEach(function (r) { r.addEventListener('input', apply); });
    apply();

    // 鼠标移动 → 3D 倾斜（幅度由「倾斜」滑块控制）
    stage.addEventListener('mousemove', function (e) {
      if (!tiltMax) { card.style.setProperty('--grx', '0deg'); card.style.setProperty('--gry', '0deg'); return; }
      var r = stage.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--gry', (nx * tiltMax).toFixed(2) + 'deg');
      card.style.setProperty('--grx', (-ny * tiltMax).toFixed(2) + 'deg');
    });
    stage.addEventListener('mouseleave', function () {
      card.style.setProperty('--grx', '0deg'); card.style.setProperty('--gry', '0deg');
    });
  })();

  /* ============================================================
     03 · JS 交互功能 —— 原生 JS 迷你实验室
        ① 事件 & DOM  ② 表单校验  ③ 定时器 & 动画  ④ 本地存储
     ============================================================ */
  (function () {
    // —— 标签页切换 ——
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.js-tab'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('.js-panel'));
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var k = t.getAttribute('data-jp');
        tabs.forEach(function (x) { var on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
        panels.forEach(function (p) { p.classList.toggle('hidden', p.getAttribute('data-jp') !== k); });
      });
    });

    /* ① 点赞：addEventListener + 动态涟漪节点 + 计数动画 */
    var likeBtn = document.getElementById('like-btn');
    var likeCount = document.getElementById('like-count');
    var likes = 0;
    if (likeBtn) {
      likeBtn.addEventListener('click', function (e) {
        var r = likeBtn.getBoundingClientRect();
        var rip = document.createElement('span');
        rip.className = 'ripple';
        var size = Math.max(r.width, r.height);
        rip.style.width = rip.style.height = size + 'px';
        rip.style.left = (e.clientX - r.left - size / 2) + 'px';
        rip.style.top = (e.clientY - r.top - size / 2) + 'px';
        likeBtn.appendChild(rip);
        setTimeout(function () { rip.remove(); }, 600);
        likes++; likeCount.textContent = likes;
        likeCount.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.16,1,.3,1)' });
        if (likes === 1) toast('收到你的第 1 个赞 👍');
        else if (likes % 10 === 0) toast('已经 ' + likes + ' 个赞了，火力全开！🔥');
      });
    }

    /* ① 拖拽取值：input 事件实时绑定 */
    var range = document.getElementById('drag-range');
    if (range) {
      var dVal = document.getElementById('drag-val'), dBar = document.getElementById('drag-bar');
      range.addEventListener('input', function () { dVal.textContent = range.value; dBar.style.transform = 'scaleX(' + (range.value / 100) + ')'; });
    }

    /* ① 动态建 DOM：createElement / appendChild / remove */
    var chipBox = document.getElementById('chip-box');
    var CHIP_WORDS = ['响应式', '无障碍', '微交互', '玻璃拟态', '暗色模式', '栅格', '语义化', '渐变辉光', '骨架屏', '视差'];
    var chipI = 0;
    function addChip() {
      var word = CHIP_WORDS[chipI % CHIP_WORDS.length]; chipI++;
      var chip = document.createElement('span');
      chip.className = 'chip';
      var label = document.createElement('span'); label.textContent = '# ' + word;
      var x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', '删除 ' + word);
      x.addEventListener('click', function () { chip.remove(); });
      chip.appendChild(label); chip.appendChild(x);
      chipBox.appendChild(chip);
    }
    var chipAdd = document.getElementById('chip-add');
    if (chipAdd && chipBox) { chipAdd.addEventListener('click', addChip); addChip(); addChip(); addChip(); }
    var chipClear = document.getElementById('chip-clear');
    if (chipClear) chipClear.addEventListener('click', function () { if (chipBox) chipBox.innerHTML = ''; });

    /* ① 即时反馈：toast / 复制 */
    var toastBtn = document.getElementById('toast-btn');
    if (toastBtn) toastBtn.addEventListener('click', function () { toast('这就是一条即时反馈提示 ✨'); });
    var copyBtn = document.getElementById('copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      function done() { toast('链接已复制到剪贴板 📋'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () { fb(url); });
      } else { fb(url); }
      function fb(t) { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); } ta.remove(); }
    });

    /* ② 表单校验：正则 + 密码强度 + 联动启用提交 */
    var rules = {
      'f-name':  { test: function (v) { return v.trim().length >= 2; }, ok: '姓名可用', err: '至少 2 个字' },
      'f-phone': { test: function (v) { return /^1[3-9]\d{9}$/.test(v); }, ok: '手机号格式正确', err: '需 1 开头的 11 位号码' },
      'f-email': { test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }, ok: '邮箱格式正确', err: '请输入有效邮箱' }
    };
    var fState = {};
    function msgEl(id) { return document.querySelector('.vmsg[data-for="' + id + '"]'); }
    function refreshSubmit() {
      var btn = document.getElementById('f-submit'); if (!btn) return;
      var pass = Object.keys(rules).every(function (id) { return fState[id]; }) && !!fState['f-pwd'];
      btn.disabled = !pass;
    }
    Object.keys(rules).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('input', function () {
        var v = el.value, m = msgEl(id);
        if (!v) { el.classList.remove('ok', 'err'); if (m) { m.textContent = ''; m.className = 'vmsg'; } fState[id] = false; refreshSubmit(); return; }
        var ok = rules[id].test(v);
        el.classList.toggle('ok', ok); el.classList.toggle('err', !ok);
        if (m) { m.textContent = (ok ? '✓ ' : '✕ ') + (ok ? rules[id].ok : rules[id].err); m.className = 'vmsg ' + (ok ? 'ok' : 'err'); }
        fState[id] = ok; refreshSubmit();
      });
    });
    var pwd = document.getElementById('f-pwd');
    if (pwd) {
      var pbar = document.getElementById('pwd-bar'), pmsg = msgEl('f-pwd');
      pwd.addEventListener('input', function () {
        var v = pwd.value, score = 0;
        if (v.length >= 8) score++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        var pct = [0, 30, 55, 80, 100][score];
        var col = ['', '#fb7185', '#ffb454', '#5b8cff', '#4ade80'][score];
        var label = ['', '弱', '一般', '较强', '很强'][score];
        if (pbar) { pbar.style.transform = 'scaleX(' + (pct / 100) + ')'; pbar.style.background = col || 'var(--blue)'; }
        var ok = score >= 2;
        pwd.classList.toggle('ok', ok); pwd.classList.toggle('err', v.length > 0 && !ok);
        if (pmsg) { pmsg.textContent = v ? '强度：' + label : ''; pmsg.className = 'vmsg ' + (ok ? 'ok' : 'err'); }
        fState['f-pwd'] = ok; refreshSubmit();
      });
    }
    var fSubmit = document.getElementById('f-submit');
    if (fSubmit) fSubmit.addEventListener('click', function () { if (!fSubmit.disabled) toast('校验全部通过，提交成功 ✅'); });

    /* ③ 倒计时（setInterval）/ 实时时钟 / 打字机 */
    var disp = document.getElementById('timer-disp'), tBar = document.getElementById('t-bar');
    if (disp) {
      var TOTAL = 30, left = TOTAL, handle = null;
      function fmt(s) { var m = Math.floor(s / 60), x = s % 60; return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x; }
      function paint() { disp.textContent = fmt(left); if (tBar) tBar.style.transform = 'scaleX(' + (left / TOTAL) + ')'; }
      function tick() { if (left <= 0) { clearInterval(handle); handle = null; toast('倒计时结束 ⏰'); return; } left--; paint(); }
      document.getElementById('t-start').addEventListener('click', function () { if (handle || left <= 0) return; handle = setInterval(tick, 1000); });
      document.getElementById('t-pause').addEventListener('click', function () { clearInterval(handle); handle = null; });
      document.getElementById('t-reset').addEventListener('click', function () { clearInterval(handle); handle = null; left = TOTAL; paint(); });
      paint();
    }
    // 实时时钟 / 打字机：离屏（滚出 03 节）时暂停 setInterval / 递归 setTimeout，省电省 CPU
    var clock = document.getElementById('clock-disp');
    var clockTimer = null;
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function tickClock() { if (!clock) return; var d = new Date(); clock.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); }
    function startClock() { if (clock && !clockTimer) { tickClock(); clockTimer = setInterval(tickClock, 1000); } }
    function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }

    var tw = document.getElementById('tw');
    var TW_PHRASES = ['对话即渲染', '一句话生成网页', '原生 JS · 零依赖', 'HTML / CSS / JS'];
    var twi = 0, twc = 0, twDel = false, twActive = false;
    function twTick() {
      if (!tw || !twActive) return;
      var full = TW_PHRASES[twi];
      tw.textContent = full.slice(0, twc);
      if (!twDel) { twc++; if (twc > full.length) { twDel = true; setTimeout(twTick, 1100); return; } }
      else { twc--; if (twc < 0) { twDel = false; twi = (twi + 1) % TW_PHRASES.length; twc = 0; } }
      setTimeout(twTick, twDel ? 45 : 110);
    }
    function startTw() { if (tw && !twActive) { twActive = true; twTick(); } }
    function stopTw() { twActive = false; }

    startClock(); startTw();
    var sec3 = document.getElementById('s3');
    if (sec3 && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { startClock(); startTw(); }
        else { stopClock(); stopTw(); }
      }, { threshold: 0 }).observe(sec3);
    }

    /* ④ 待办清单（localStorage 持久化：JSON.stringify / parse） */
    var todoList = document.getElementById('todo-list');
    if (todoList) {
      var KEY = 'spec_todos_v1';
      var input = document.getElementById('todo-input'), stat = document.getElementById('todo-stat');
      var todos = [];
      try { todos = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { todos = []; }
      if (!todos.length) todos = [{ t: '试试勾选我（状态会存下来）', d: false }, { t: '刷新页面，这个列表还在', d: false }];
      function save() { try { localStorage.setItem(KEY, JSON.stringify(todos)); } catch (e) {} }
      function render() {
        todoList.innerHTML = '';
        todos.forEach(function (item, i) {
          var li = document.createElement('li');
          li.className = 'todo-item' + (item.d ? ' done' : '');
          var ck = document.createElement('span'); ck.className = 'todo-check'; ck.setAttribute('role', 'checkbox'); ck.setAttribute('aria-checked', item.d ? 'true' : 'false'); ck.tabIndex = 0; ck.textContent = item.d ? '✓' : '';
          function toggle() { item.d = !item.d; save(); render(); }
          ck.addEventListener('click', toggle);
          ck.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
          var span = document.createElement('span'); span.className = 'todo-text'; span.textContent = item.t;
          var del = document.createElement('button'); del.className = 'btn btn-ghost !py-1 !px-2 !text-xs'; del.textContent = '删除'; del.setAttribute('aria-label', '删除：' + item.t);
          del.addEventListener('click', function () { todos.splice(i, 1); save(); render(); });
          li.appendChild(ck); li.appendChild(span); li.appendChild(del);
          todoList.appendChild(li);
        });
        var done = todos.filter(function (x) { return x.d; }).length;
        if (stat) stat.textContent = todos.length + ' 项 · 已完成 ' + done;
      }
      function add() { var v = input.value.trim(); if (!v) return; todos.push({ t: v, d: false }); input.value = ''; save(); render(); }
      document.getElementById('todo-add').addEventListener('click', add);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
      document.getElementById('todo-clear').addEventListener('click', function () { todos = []; save(); render(); });
      render();
    }
  })();

  /* ============================================================
     04~06 · Vue 3 驱动（路由 / 数据渲染 / 搜索筛选）
     ============================================================ */
  if (!window.Vue) { console.warn('Vue 未加载，04~06 演示降级'); return; }
  var createApp = Vue.createApp, ref = Vue.ref, reactive = Vue.reactive,
      computed = Vue.computed, watch = Vue.watch, onMounted = Vue.onMounted, onUnmounted = Vue.onUnmounted;

  /* 数字滚动：监听一个数值源，用 rAF 缓动到新值（用于 05 的统计胶囊 count-up） */
  function tweenedNumber(src) {
    var out = ref(0);
    var nowms = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
    watch(src, function (nv) {
      if (window.__reduceMotion) { out.value = nv | 0; return; }   // 无障碍：不滚动，直接落定
      var from = out.value, to = nv | 0, t0 = nowms(), dur = 620;
      (function frame() {
        var p = Math.min((nowms() - t0) / dur, 1);
        var e = 1 - Math.pow(1 - p, 3);
        out.value = Math.round(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(frame);
      })();
    }, { immediate: true });
    return out;
  }

  /* 共享数据集（取站点里确有配图的专业）。
     字段从「名/类/色」扩到「报考热度 / 就业率 / 学制 / 学科评级 / 一句话」——
     让 05 渲染、06 筛选都能玩出多维度（排序、统计、徽标）。 */
  var MAJORS = [
    { name: '计算机类',     cat: '工学', color: '#5b8cff', heat: 96, employ: 96, years: 4, rating: 'A+', tag: '算法 · 系统 · AI' },
    { name: '电子信息类',   cat: '工学', color: '#38bdf8', heat: 90, employ: 94, years: 4, rating: 'A',  tag: '芯片 · 通信 · 嵌入式' },
    { name: '自动化类',     cat: '工学', color: '#22d3ee', heat: 83, employ: 94, years: 4, rating: 'A',  tag: '控制 · 机器人' },
    { name: '电气类',       cat: '工学', color: '#60a5fa', heat: 80, employ: 95, years: 4, rating: 'A',  tag: '电网 · 新能源' },
    { name: '机械类',       cat: '工学', color: '#f59e0b', heat: 76, employ: 93, years: 4, rating: 'A-', tag: '智造 · 机电' },
    { name: '土木类',       cat: '工学', color: '#fb923c', heat: 64, employ: 90, years: 4, rating: 'B+', tag: '结构 · 基建' },
    { name: '材料类',       cat: '工学', color: '#fbbf24', heat: 66, employ: 89, years: 4, rating: 'B+', tag: '新材料 · 半导体' },
    { name: '能源动力类',   cat: '工学', color: '#facc15', heat: 63, employ: 91, years: 4, rating: 'B+', tag: '储能 · 双碳' },
    { name: '数学类',       cat: '理学', color: '#34e3d4', heat: 78, employ: 88, years: 4, rating: 'A',  tag: '基础学科之王' },
    { name: '物理学类',     cat: '理学', color: '#818cf8', heat: 73, employ: 87, years: 4, rating: 'A',  tag: '探究万物之理' },
    { name: '化学类',       cat: '理学', color: '#2dd4bf', heat: 68, employ: 86, years: 4, rating: 'A-', tag: '材料 · 制药基石' },
    { name: '生物科学类',   cat: '理学', color: '#4ade80', heat: 62, employ: 83, years: 4, rating: 'B+', tag: '生命 · 基因' },
    { name: '大气科学类',   cat: '理学', color: '#5eead4', heat: 54, employ: 85, years: 4, rating: 'B+', tag: '气象 · 气候' },
    { name: '金融学类',     cat: '经管', color: '#fbbf24', heat: 89, employ: 90, years: 4, rating: 'A',  tag: '资本 · 风控' },
    { name: '经济学类',     cat: '经管', color: '#f472b6', heat: 85, employ: 89, years: 4, rating: 'A',  tag: '宏观 · 计量' },
    { name: '工商管理类',   cat: '经管', color: '#fb923c', heat: 80, employ: 88, years: 4, rating: 'A-', tag: '运营 · 战略' },
    { name: '管理科学与工程类', cat: '经管', color: '#f59e0b', heat: 74, employ: 90, years: 4, rating: 'A-', tag: '数据 · 决策' },
    { name: '法学类',       cat: '人文', color: '#a78bfa', heat: 79, employ: 84, years: 4, rating: 'A',  tag: '法律 · 公检法' },
    { name: '新闻传播学类', cat: '人文', color: '#60a5fa', heat: 72, employ: 83, years: 4, rating: 'A-', tag: '媒体 · 内容' },
    { name: '外国语言文学类', cat: '人文', color: '#38bdf8', heat: 70, employ: 85, years: 4, rating: 'A-', tag: '语言 · 跨文化' },
    { name: '中国语言文学类', cat: '人文', color: '#c084fc', heat: 67, employ: 82, years: 4, rating: 'A',  tag: '文学 · 文字' },
    { name: '历史学类',     cat: '人文', color: '#94a3b8', heat: 52, employ: 80, years: 4, rating: 'B+', tag: '考古 · 史学' },
    { name: '哲学类',       cat: '人文', color: '#a1a1aa', heat: 48, employ: 80, years: 4, rating: 'B+', tag: '思辨 · 逻辑' },
    { name: '临床医学类',   cat: '医学', color: '#fb7185', heat: 87, employ: 92, years: 5, rating: 'A+', tag: '救死扶伤 · 5 年制' },
    { name: '护理学类',     cat: '医学', color: '#f87171', heat: 75, employ: 95, years: 4, rating: 'A-', tag: '高需求 · 缺口大' },
    { name: '药学类',       cat: '医学', color: '#fda4af', heat: 70, employ: 90, years: 4, rating: 'A',  tag: '新药 · 制剂' },
    { name: '中医学类',     cat: '医学', color: '#f97316', heat: 66, employ: 87, years: 5, rating: 'A-', tag: '传承 · 5 年制' },
    { name: '基础医学',     cat: '医学', color: '#fb923c', heat: 60, employ: 88, years: 5, rating: 'A',  tag: '医学科研 · 5 年制' },
    { name: '设计学类',     cat: '艺术', color: '#f0abfc', heat: 80, employ: 86, years: 4, rating: 'A',  tag: '视觉 · 交互' },
    { name: '美术学类',     cat: '艺术', color: '#c084fc', heat: 72, employ: 84, years: 4, rating: 'A-', tag: '绘画 · 造型' },
    { name: '音乐与舞蹈学类', cat: '艺术', color: '#e879f9', heat: 68, employ: 82, years: 4, rating: 'A-', tag: '表演 · 创作' },
    { name: '艺术学理论类', cat: '艺术', color: '#d8b4fe', heat: 54, employ: 80, years: 4, rating: 'B+', tag: '美学 · 评论' }
  ];

  /* ---------- 04 Vue 路由（hash 路由，前进/后退可用） ---------- */
  (function () {
    var el = document.getElementById('vue-router');
    if (!el) return;
    var VIEWS = {
      '/home':    { comp: 'HomeView',   title: '首页 · 概览', body: '这是 SPA 的首页视图。注意切换标签时整页没有重新加载——只有这块内容在变，地址栏的 hash 同步更新。' },
      '/courses': { comp: 'CourseView', title: '课程 · 列表', body: '路由把不同 URL 映射到不同组件。/courses 渲染课程视图，常配合数据渲染（见 05）一起用。' },
      '/about':   { comp: 'AboutView',  title: '关于 · 说明', body: '前进 / 后退按钮也能用：因为路由把状态写进了浏览器历史。刷新当前页会停在同一个视图。' }
    };
    createApp({
      setup: function () {
        var routes = [
          { path: '/home', label: '首页' },
          { path: '/courses', label: '课程' },
          { path: '/about', label: '关于' }
        ];
        function parse() {
          var h = location.hash.replace(/^#/, '');
          return VIEWS[h] ? h : '/home';
        }
        var current = ref(parse());
        var alive = ref(0);
        var timer;
        function onHash() { current.value = parse(); }
        onMounted(function () {
          window.addEventListener('hashchange', onHash);
          timer = setInterval(function () { alive.value++; }, 1000);
        });
        onUnmounted(function () {
          window.removeEventListener('hashchange', onHash);
          clearInterval(timer);
        });
        return {
          routes: routes,
          current: current,
          alive: alive,
          view: computed(function () { return VIEWS[current.value]; }),
          url: computed(function () { return location.origin + location.pathname + '#' + current.value; })
        };
      }
    }).mount(el);
  })();

  /* ---------- 05 数据渲染（响应式 v-for，增删即时） ---------- */
  (function () {
    var el = document.getElementById('vue-data');
    if (!el) return;
    createApp({
      setup: function () {
        function clone(m, id) { return { id: id, name: m.name, cat: m.cat, color: m.color, heat: m.heat, employ: m.employ, years: m.years, rating: m.rating, tag: m.tag }; }
        var seed = MAJORS.slice(0, 5).map(function (m, i) { return clone(m, i + 1); });
        var list = reactive(seed);
        var uid = ref(seed.length + 1);
        var pool = MAJORS.slice(5);
        var pi = 0;
        var sortByHeat = ref(false);
        function applySort() {
          if (sortByHeat.value) list.sort(function (a, b) { return b.heat - a.heat; });
          else list.sort(function (a, b) { return a.id - b.id; });
        }
        function toggleSort() { sortByHeat.value = !sortByHeat.value; applySort(); }
        function add() {
          var m = pool[pi % pool.length]; pi++;
          list.push(clone(m, uid.value++));
          applySort();
        }
        function remove(i) { list.splice(i, 1); }
        var avgEmploy = computed(function () {
          if (!list.length) return 0;
          return Math.round(list.reduce(function (s, m) { return s + m.employ; }, 0) / list.length);
        });
        var avgHeat = computed(function () {
          if (!list.length) return 0;
          return Math.round(list.reduce(function (s, m) { return s + m.heat; }, 0) / list.length);
        });
        var count = computed(function () { return list.length; });
        return {
          list: list, add: add, remove: remove, sortByHeat: sortByHeat, toggleSort: toggleSort,
          avgEmploy: avgEmploy, avgHeat: avgHeat,
          displayCount: tweenedNumber(count), displayHeat: tweenedNumber(avgHeat), displayEmploy: tweenedNumber(avgEmploy)
        };
      }
    }).mount(el);
  })();

  /* ---------- 06 搜索筛选（computed 实时过滤） ---------- */
  (function () {
    var el = document.getElementById('vue-filter');
    if (!el) return;
    createApp({
      setup: function () {
        var all = MAJORS;
        var cats = ['全部', '工学', '理学', '经管', '人文', '医学', '艺术'];
        var q = ref('');
        var cat = ref('全部');
        var sort = ref('默认');
        var sorts = ['默认', '热度', '就业率'];
        var filtered = computed(function () {
          var kw = q.value.trim();
          var arr = all.filter(function (m) {
            var okCat = cat.value === '全部' || m.cat === cat.value;
            var okKw = !kw || m.name.indexOf(kw) !== -1 || m.cat.indexOf(kw) !== -1 || (m.tag && m.tag.indexOf(kw) !== -1);
            return okCat && okKw;
          });
          if (sort.value === '热度') arr = arr.slice().sort(function (a, b) { return b.heat - a.heat; });
          else if (sort.value === '就业率') arr = arr.slice().sort(function (a, b) { return b.employ - a.employ; });
          return arr;
        });
        return { all: all, cats: cats, q: q, cat: cat, sort: sort, sorts: sorts, filtered: filtered };
      }
    }).mount(el);
  })();

})();
