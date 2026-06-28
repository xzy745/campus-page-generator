// 前端逻辑：登录 → AI 生成 → 历史记录，全部对接后端数据库。
const $ = (id) => document.getElementById(id);

// ─── DOM 引用 ──────────────────────────────────
const promptEl      = $("prompt");
const btnGenerate   = $("generate");
const btnLabel      = $("btn-label");
const btnSpin       = $("btn-spin");
const preview       = $("preview");
const placeholder   = $("placeholder");
const codeEl        = $("code");
const statusEl      = $("status");
const historyList   = $("history-list");

// 登录相关
const btnLoginUI    = $("btn-login-ui");
const userLabel     = $("user-label");
const btnLogoutUI   = $("btn-logout-ui");
const authModal     = $("auth-modal");
const authTitle     = $("auth-title");
const authUsername  = $("auth-username");
const authPassword  = $("auth-password");
const authMsg       = $("auth-msg");
const btnAuthAction = $("btn-auth-action");
const btnAuthSwitch = $("btn-auth-switch");
const btnAuthClose  = $("btn-auth-close");

let currentUser = null;       // { id, username, createdAt }
let authMode = "login";       // "login" | "register"
let currentHtml = "";

// ─── 导航守卫（iframe 沙盒内）──────────────────
const NAV_GUARD = `<script>
document.addEventListener('click', function(e){
  var a = e.target && e.target.closest && e.target.closest('a[href]');
  if(!a) return;
  var href = a.getAttribute('href') || '';
  // 放行：页内锚点 / hash 路由（多页切换）/ javascript: —— 交给生成页自己的脚本处理
  if(href === '' || href.charAt(0) === '#' || /^javascript:/i.test(href)) return;
  // 拦截：跳转到外部站点或别的文档（srcdoc 里没有真实 URL，跳走只会白屏）
  e.preventDefault();
}, true);
</scr`+`ipt>`;

function withNavGuard(html) {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, NAV_GUARD + "</body>");
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, NAV_GUARD + "</html>");
  return html + NAV_GUARD;
}

// ─── 结构选择 Inspector（注入 iframe 内运行）──────
// 跑在沙盒内：hover 高亮 + 中文名称浮标 + 点击锁定选中，通过 postMessage 把节点信息回传父页。
// 用 postMessage 而非跨域读 DOM —— 无需 allow-same-origin，安全隔离不变。对新旧生成页都生效
// （新页带 data-node-name 更友好；旧页按标签名映射中文名兜底）。
const INSPECTOR = `<script>
(function(){
  if (window.__inspectorLoaded) return; window.__inspectorLoaded = true;
  var NAMES = {HEADER:'顶部导航栏',NAV:'导航菜单',FOOTER:'页脚',SECTION:'区块',ARTICLE:'内容卡片',
    H1:'主标题',H2:'标题',H3:'小标题',H4:'小标题',P:'描述文字',BUTTON:'按钮',A:'链接',IMG:'图片',
    FIGURE:'图片',FORM:'表单',INPUT:'输入框',UL:'列表',OL:'列表',LI:'列表项',VIDEO:'视频'};
  var SEL = '[data-editable],header,nav,footer,section,article,figure,form,h1,h2,h3,button,a,img,ul';
  var on=false, sel=null;
  function mk(){ var d=document.createElement('div'); d.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border-radius:6px;box-sizing:border-box;transition:left .07s,top .07s,width .07s,height .07s;display:none'; return d; }
  var hov=mk(), selBox=mk(), label=document.createElement('div');
  hov.style.border='1.5px dashed rgba(129,140,248,.95)'; hov.style.background='rgba(99,102,241,.12)';
  selBox.style.border='2px solid rgba(52,227,212,.95)'; selBox.style.background='rgba(52,227,212,.10)';
  label.style.cssText='position:fixed;z-index:2147483647;pointer-events:none;font:600 12px/1.4 system-ui,sans-serif;color:#fff;background:#4f46e5;padding:2px 8px;border-radius:6px;white-space:nowrap;display:none;box-shadow:0 4px 14px rgba(0,0,0,.45)';
  function add(){ [hov,selBox,label].forEach(function(e){ if(!e.parentNode) document.body.appendChild(e); }); }
  function nameOf(el){ return el.getAttribute('data-node-name') || NAMES[el.tagName] || el.tagName.toLowerCase(); }
  function typeOf(el){ return el.getAttribute('data-node-type') || el.tagName.toLowerCase(); }
  function pathOf(el){ var p=[], n=el, i=0; while(n && n!==document.body && i<12){ if(n.matches && n.matches(SEL)) p.unshift({name:nameOf(n), id:n.getAttribute('data-node-id')||''}); n=n.parentElement; i++; } p.unshift({name:'页面', id:''}); if(p.length>6) p=[p[0]].concat(p.slice(-5)); return p; }
  function box(el,b){ var r=el.getBoundingClientRect(); b.style.display='block'; b.style.left=r.left+'px'; b.style.top=r.top+'px'; b.style.width=r.width+'px'; b.style.height=r.height+'px'; return r; }
  function showLabel(el,r){ label.textContent=nameOf(el); label.style.display='block'; var ly=r.top-26; label.style.left=Math.max(2,r.left)+'px'; label.style.top=(ly<4?r.top+6:ly)+'px'; }
  function target(x,y){ var e=document.elementFromPoint(x,y); return e ? e.closest(SEL) : null; }
  document.addEventListener('mousemove', function(ev){ if(!on) return; var t=target(ev.clientX,ev.clientY); if(!t||t===sel){ hov.style.display='none'; label.style.display='none'; return; } var r=box(t,hov); showLabel(t,r); }, true);
  document.addEventListener('mouseleave', function(){ hov.style.display='none'; label.style.display='none'; }, true);
  function selectEl(t){ sel=t; box(t,selBox); hov.style.display='none'; label.style.display='none'; var html=t.outerHTML||''; window.parent.postMessage({__ins:'select',name:nameOf(t),tag:t.tagName.toLowerCase(),type:typeOf(t),path:pathOf(t),text:(t.innerText||'').trim().slice(0,160),html:html.slice(0,6000),id:t.getAttribute('data-node-id')||''},'*'); }
  document.addEventListener('click', function(ev){ if(!on) return; ev.preventDefault(); ev.stopPropagation(); var t=target(ev.clientX,ev.clientY); if(!t){ deselect(); return; } selectEl(t); }, true);
  function deselect(){ sel=null; selBox.style.display='none'; window.parent.postMessage({__ins:'deselect'},'*'); }
  function reposition(){ if(sel) box(sel,selBox); if(on){ hov.style.display='none'; label.style.display='none'; } }
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  window.addEventListener('message', function(ev){ var d=ev.data||{}; if(d.__insCmd==='on'){ on=true; add(); document.documentElement.style.cursor='crosshair'; } else if(d.__insCmd==='off'){ on=false; hov.style.display='none'; label.style.display='none'; selBox.style.display='none'; sel=null; document.documentElement.style.cursor=''; } else if(d.__insCmd==='deselect'){ deselect(); } else if(d.__insCmd==='selectId'){ add(); var n=document.querySelector('[data-node-id="'+String(d.id).replace(/["\\\\]/g,'')+'"]'); if(n) selectEl(n); } });
})();
</scr`+`ipt>`;

// srcdoc 注入：导航守卫 + 结构选择 inspector
function prepareSrcdoc(html) {
  var out = withNavGuard(html);
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, INSPECTOR + "</body>");
  if (/<\/html>/i.test(out)) return out.replace(/<\/html>/i, INSPECTOR + "</html>");
  return out + INSPECTOR;
}

// ─── 示例按钮 ──────────────────────────────────
const EXAMPLES = [
  "生成一个摄影师个人作品集网页，极简黑白风格",
  "做一个 SaaS 产品落地页，深色科技感，含定价表",
  "一个咖啡馆官网，温暖复古风，含菜单和门店地址",
];
EXAMPLES.forEach((ex) => {
  const b = document.createElement("button");
  b.className = "chip";
  b.innerHTML = '<span class="text-indigo-400">✦</span>' + esc(ex);
  b.title = ex;
  b.onclick = () => { promptEl.value = ex; promptEl.focus(); };
  $("examples").appendChild(b);
});

// ─── 快捷标签：点一下把题材 / 配色 / 风格加进描述框 ──
const QUICK_TAGS = [
  { g: "题材", items: ["科技 SaaS", "校园教育", "餐饮咖啡", "摄影作品集", "电商零售", "医疗健康", "旅游民宿", "游戏娱乐", "金融商务"] },
  { g: "配色", items: ["深色电影级", "极简黑白", "暖色复古", "清新自然", "高级灰金", "赛博霓虹", "明亮糖果色"] },
  { g: "风格", items: ["极简留白", "玻璃拟态", "杂志编辑风", "科技未来感", "卡通插画", "像素复古"] },
];
function appendToPrompt(text) {
  const cur = promptEl.value.replace(/[，,。\s]+$/, "");
  promptEl.value = cur ? cur + "，" + text : text;
  promptEl.focus();
}
(function () {
  const box = $("quick-tags");
  if (!box) return;
  QUICK_TAGS.forEach((grp) => {
    const row = document.createElement("div");
    row.className = "flex flex-wrap items-center gap-1.5";
    const lab = document.createElement("span");
    lab.className = "mono text-[10px] text-zinc-600 shrink-0 mr-0.5";
    lab.textContent = grp.g;
    row.appendChild(lab);
    grp.items.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = t;
      b.onclick = () => appendToPrompt(t);
      row.appendChild(b);
    });
    box.appendChild(row);
  });
})();

// ─── 02 页面板块：勾选 / 自定义 ────────────────
(function () {
  const blocks = $("blocks");
  if (!blocks) return;
  function bindToggle(chip, removable) {
    chip.addEventListener("click", (e) => {
      if (removable && e.target.classList.contains("bx")) { e.stopPropagation(); chip.remove(); return; }
      const on = chip.classList.toggle("on");
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  blocks.querySelectorAll(".block-chip").forEach((c) => bindToggle(c, false));

  const input = $("block-input"), add = $("block-add");
  function addBlock() {
    const v = input.value.trim();
    if (!v) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "block-chip on";
    chip.dataset.block = v;
    chip.setAttribute("aria-pressed", "true");
    chip.innerHTML = esc(v) + ' <span class="bx" aria-hidden="true">✕</span>';
    bindToggle(chip, true);
    blocks.appendChild(chip);
    input.value = "";
    input.focus();
  }
  add.addEventListener("click", addBlock);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addBlock(); } });
})();

function gatherOptions() {
  const multipage = $("opt-multipage").checked;
  const blocks = Array.from(document.querySelectorAll("#blocks .block-chip.on")).map((c) => c.dataset.block);
  return { multipage, blocks };
}

// 把板块 / 结构拼成「生成参数」附在用户描述后面
function buildPrompt(raw, o) {
  // 已经用「一键优化」整合成标准话术（含【页面结构】）的，本身就是完整提示词，直接用，不再重复追加
  if (/【页面结构】/.test(raw)) return raw;
  const lines = [];
  if (o.blocks.length) lines.push("【需要的板块】" + o.blocks.join("、"));
  lines.push("【结构】" + (o.multipage
    ? "多页网站：含顶部导航，把上述板块合理拆分到多个页面，可无刷新切换"
    : "单页长滚动：上述板块在一页内按顺序纵向排布"));
  return raw + "\n\n———\n生成参数：\n" + lines.join("\n");
}

// ─── 提示词一键优化：标准话术模板 ──────────────
// 把「描述框文字 + 已点进去的题材/配色/风格 + 勾选板块 + 单/多页」整合成一段
// 简短专业、能被很好识别并生成完整网页的结构化提示词。纯前端、即时、免调用。
const TAG_CATEGORY = (() => {
  const map = {};
  QUICK_TAGS.forEach((grp) => grp.items.forEach((t) => { map[t] = grp.g; }));
  return map;
})();

// 还原「原始素材」：没优化过就是原文；已优化过则从结构化文本里取回 主题 + 视觉风格，
// 以便反复点击优化时不丢已选的题材/配色/风格（幂等）。
function recoverSource(text) {
  if (!/【网页主题】/.test(text)) return text;
  const grab = (label) => {
    const m = text.match(new RegExp("【" + label + "】([^\\n]*)"));
    return m ? m[1].trim() : "";
  };
  return [grab("网页主题"), grab("视觉风格")].filter(Boolean).join("，");
}

function optimizePrompt() {
  const source = recoverSource(promptEl.value.trim());
  const o = gatherOptions();

  // 从文本里识别已点进去的题材 / 配色 / 风格，归类并从主题里摘除
  const found = { 题材: [], 配色: [], 风格: [] };
  let theme = source;
  Object.keys(TAG_CATEGORY).forEach((t) => {
    if (theme.includes(t)) { found[TAG_CATEGORY[t]].push(t); theme = theme.split(t).join(""); }
  });
  theme = theme.replace(/[，,、。\s]+/g, "，").replace(/^，+|，+$/g, "").trim();

  // 组装标准话术
  const themeLine = [theme, ...found["题材"]].filter(Boolean).join("，") || "一个现代风格的官网";
  const visual = [...found["配色"], ...found["风格"]].join(" · ");
  const structure = o.multipage
    ? "多页网站，含顶部导航，把板块合理拆分到多个页面，可无刷新切换"
    : "单页长滚动，所有板块在一页内自上而下排布";

  const lines = ["【网页主题】" + themeLine];
  if (visual) lines.push("【视觉风格】" + visual);
  lines.push("【页面结构】" + structure);
  if (o.blocks.length) lines.push("【必备板块】" + o.blocks.join("、"));
  lines.push("【交付要求】响应式适配移动端、单文件 HTML、排版精致、含适度交互动效");

  promptEl.value = lines.join("\n");
  promptEl.focus();
  showToast("已按标准话术优化提示词 ✨", true);
}

// ─── 健康检查 ──────────────────────────────────
fetch("/api/health")
  .then((r) => r.json())
  .then((d) => {
    if (d.keyConfigured) {
      statusEl.textContent = d.model + " · 就绪";
      statusEl.className = "text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400";
    } else {
      statusEl.textContent = "未配置密钥";
      statusEl.className = "text-xs px-3 py-1 rounded-full bg-amber-500/15 text-amber-400";
    }
  })
  .catch(() => {
    statusEl.textContent = "后端离线";
    statusEl.className = "text-xs px-3 py-1 rounded-full bg-red-500/15 text-red-400";
  });

// ─── Toast ─────────────────────────────────────
function showToast(msg, ok) {
  const t = document.createElement("div");
  t.textContent = msg;
  t.className = "fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border text-sm shadow-lg " +
    (ok ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-amber-500/15 border-amber-500/30 text-amber-300");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ─── 登录 / 注册 UI ────────────────────────────
function updateAuthUI() {
  if (currentUser) {
    btnLoginUI.classList.add("hidden");
    userLabel.classList.remove("hidden");
    userLabel.textContent = currentUser.username;
    btnLogoutUI.classList.remove("hidden");
  } else {
    btnLoginUI.classList.remove("hidden");
    userLabel.classList.add("hidden");
    btnLogoutUI.classList.add("hidden");
  }
}

function setAuthMode(mode) {
  authMode = mode;
  authTitle.textContent = mode === "login" ? "登录" : "注册";
  btnAuthAction.textContent = mode === "login" ? "登录" : "注册";
  btnAuthSwitch.textContent = mode === "login" ? "去注册" : "去登录";
  authMsg.textContent = "";
  authMsg.className = "text-xs h-5 mb-4";
}

btnLoginUI.onclick = () => { setAuthMode("login"); authModal.classList.remove("hidden"); };
btnLogoutUI.onclick = () => { currentUser = null; updateAuthUI(); showToast("已退出登录", true); };
btnAuthClose.onclick = () => authModal.classList.add("hidden");
btnAuthSwitch.onclick = () => setAuthMode(authMode === "login" ? "register" : "login");

btnAuthAction.onclick = async () => {
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) {
    authMsg.textContent = "用户名和密码不能为空";
    authMsg.className = "text-xs h-5 mb-4 text-red-400";
    return;
  }

  const url = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (data.ok) {
      if (authMode === "login") {
        currentUser = data.user;
        updateAuthUI();
        authModal.classList.add("hidden");
        authUsername.value = "";
        authPassword.value = "";
        showToast("登录成功，欢迎 " + data.user.username, true);
      } else {
        showToast("注册成功，请登录", true);
        setAuthMode("login");
        authPassword.value = "";
      }
    } else {
      authMsg.textContent = data.error;
      authMsg.className = "text-xs h-5 mb-4 text-red-400";
    }
  } catch (err) {
    authMsg.textContent = "网络错误，请检查后端服务";
    authMsg.className = "text-xs h-5 mb-4 text-red-400";
  }
};

// 回车快捷提交
authPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnAuthAction.click();
});

// ─── 生成历史 ──────────────────────────────────
async function loadHistory() {
  try {
    const resp = await fetch("/api/records?limit=50");
    const data = await resp.json();
    if (!data.records || data.records.length === 0) {
      historyList.innerHTML = '<p class="text-zinc-700 text-center py-6">暂无生成记录</p>';
      return;
    }
    historyList.innerHTML = data.records.map((r) => `
      <div class="history-item px-3 py-2 rounded-xl hover:bg-zinc-800/50 transition flex justify-between items-center group" data-id="${r.id}">
        <div class="truncate flex-1 cursor-pointer">
          <span class="text-zinc-300">${esc(r.prompt.slice(0, 28))}${r.prompt.length > 28 ? '…' : ''}</span>
          <span class="text-zinc-600 ml-2">${r.html_size}B</span>
        </div>
        <span class="text-zinc-700 text-[10px] shrink-0 mx-2 hidden group-hover:inline">${r.created_at}</span>
        <button class="del-btn text-zinc-700 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition text-xs" data-id="${r.id}" title="删除">✕</button>
      </div>
    `).join("");

    // 点击历史项正文 → 载入预览
    historyList.querySelectorAll(".history-item").forEach((el) => {
      el.querySelector("div.cursor-pointer").addEventListener("click", async () => {
        const id = el.dataset.id;
        try {
          const resp = await fetch("/api/records/" + id);
          const record = await resp.json();
          if (record.html) {
            currentHtml = record.html;
            preview.srcdoc = prepareSrcdoc(currentHtml); resetInspect();
            codeEl.textContent = currentHtml;
            placeholder.classList.add("hidden");
            codeEl.classList.add("hidden");
            promptEl.value = record.prompt;
            showToast("已载入历史记录 #" + id, true);
          }
        } catch (_) {}
      });
    });

    // 删除按钮（含确认弹窗 — L8）
    historyList.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!confirm("确定要删除这条生成记录吗？此操作不可撤销。")) return;
        try {
          const resp = await fetch("/api/records/" + id, { method: "DELETE" });
          const data = await resp.json();
          if (data.ok) {
            showToast("已删除记录 #" + id, true);
            loadHistory();
          }
        } catch (_) { showToast("删除失败", false); }
      });
    });
  } catch (_) {
    historyList.innerHTML = '<p class="text-zinc-700 text-center py-6">加载失败</p>';
  }
}

$("btn-refresh-history").onclick = loadHistory;

// ─── AI 生成 ───────────────────────────────────
function setLoading(on) {
  btnGenerate.disabled = on;
  btnSpin.classList.toggle("hidden", !on);
  btnLabel.textContent = on ? "生成中…" : "生成网页";
  $("skeleton").classList.toggle("hidden", !on);
  if (on) $("placeholder").classList.add("hidden");
}

function showError(msg) {
  placeholder.classList.remove("hidden");
  placeholder.classList.remove("text-zinc-600");
  placeholder.classList.add("text-red-400", "px-6", "text-center");
  placeholder.textContent = "⚠ " + msg;
}

async function generate() {
  const raw = promptEl.value.trim();
  if (!raw) { promptEl.focus(); return; }

  const options = gatherOptions();
  const prompt = buildPrompt(raw, options);

  setLoading(true);
  placeholder.classList.add("hidden");
  codeEl.classList.add("hidden");

  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, options }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "生成失败");

    currentHtml = data.html;
    preview.srcdoc = prepareSrcdoc(currentHtml); resetInspect();
    codeEl.textContent = currentHtml;
    if (data.truncated) showToast("⚠ 内容达到长度上限被截断，可减少页面数后重试", false);
    else if (options.multipage) showToast("多页网站已生成 · 点顶部导航切换页面", true);

    // 生成成功后自动刷新历史
    setTimeout(loadHistory, 500);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

btnGenerate.onclick = generate;
$("optimize").onclick = optimizePrompt;
promptEl.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generate();
});

// 查看源码 / 预览 切换
$("view-code").onclick = () => {
  if (!currentHtml) return;
  codeEl.classList.toggle("hidden");
};

// 下载 HTML
$("download").onclick = () => {
  if (!currentHtml) return;
  const blob = new Blob([currentHtml], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "generated-page.html";
  a.click();
  URL.revokeObjectURL(a.href);
};

// ─── 工具函数 ──────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
}

// ─── 全局键盘（L1 无障碍）───────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!authModal.classList.contains("hidden")) {
      authModal.classList.add("hidden");
    }
  }
});

// ─── 生成选项折叠 ──────────────────────────────
(function () {
  const t = $("opt-toggle"), body = $("opt-body"), caret = $("opt-caret");
  if (!t || !body) return;
  t.addEventListener("click", () => {
    const collapsed = body.classList.toggle("hidden");
    t.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (caret) caret.style.transform = collapsed ? "rotate(-90deg)" : "";
  });
})();

// ─── 可拖拽伸缩：左栏宽度 + 历史区高度 ──────────
(function () {
  const root = document.documentElement;
  const panel = $("left-panel");
  if (!panel) return;
  const px = (v) => (e) => (e.touches ? e.touches[0][v] : e[v]);
  const clientY = px("clientY"), clientX = px("clientX");

  // 通用拖拽工厂
  function makeDrag(handle, bodyClass, onMove) {
    if (!handle) return;
    let dragging = false;
    const move = (e) => { if (dragging) onMove(e); };
    const stop = () => {
      dragging = false; handle.classList.remove("dragging");
      document.body.classList.remove(bodyClass);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
    };
    const start = (e) => {
      dragging = true; handle.classList.add("dragging");
      document.body.classList.add(bodyClass);
      window.addEventListener("mousemove", move);
      window.addEventListener("touchmove", move, { passive: true });
      window.addEventListener("mouseup", stop, { once: true });
      window.addEventListener("touchend", stop, { once: true });
      e.preventDefault();
    };
    handle.addEventListener("mousedown", start);
    handle.addEventListener("touchstart", start, { passive: false });
  }

  // 历史区高度：上下拖
  const vSplit = $("v-splitter");
  function setHist(h) {
    h = Math.max(90, Math.min(panel.clientHeight - 170, h));
    root.style.setProperty("--hist-h", h + "px");
  }
  makeDrag(vSplit, "resizing-y", (e) => setHist(panel.getBoundingClientRect().bottom - clientY(e)));
  if (vSplit) vSplit.addEventListener("keydown", (e) => {
    const cur = parseInt(getComputedStyle(root).getPropertyValue("--hist-h")) || 240;
    if (e.key === "ArrowUp") { setHist(cur + 24); e.preventDefault(); }
    if (e.key === "ArrowDown") { setHist(cur - 24); e.preventDefault(); }
  });

  // 左栏宽度：左右拖
  const hSplit = $("h-splitter");
  function setWidth(w) {
    w = Math.max(300, Math.min(680, w));
    root.style.setProperty("--left-w", w + "px");
  }
  makeDrag(hSplit, "resizing-x", (e) => setWidth(clientX(e) - panel.getBoundingClientRect().left));
  if (hSplit) hSplit.addEventListener("keydown", (e) => {
    const cur = parseInt(getComputedStyle(root).getPropertyValue("--left-w")) || 400;
    if (e.key === "ArrowRight") { setWidth(cur + 24); e.preventDefault(); }
    if (e.key === "ArrowLeft") { setWidth(cur - 24); e.preventDefault(); }
  });
})();

// ─── 结构选择（Inspect 模式）+ 局部编辑 / 撤销重做 父页逻辑 ──────────
(function () {
  const btnInspect = $("btn-inspect");
  const panel = $("inspect-panel");
  if (!btnInspect || !panel) return;
  const editInput = $("ins-edit-input"), applyBtn = $("ins-apply"), applyLbl = $("ins-apply-lbl"),
        applySpin = $("ins-apply-spin"), editWrap = $("ins-edit-wrap"), noEdit = $("ins-noedit"),
        undoBtn = $("ins-undo"), redoBtn = $("ins-redo");

  let inspectOn = false;
  let selectedHtml = "";
  let curId = "", curName = "", curType = "";
  let pendingReselect = null;
  let editUndo = [], editRedo = [], busy = false;

  function sendCmd(cmd) { try { preview.contentWindow.postMessage({ __insCmd: cmd }, "*"); } catch (_) {} }
  function sendSelectId(id) { try { preview.contentWindow.postMessage({ __insCmd: "selectId", id: id }, "*"); } catch (_) {} }

  function setBtn(on) {
    btnInspect.classList.toggle("on", on);
    btnInspect.setAttribute("aria-pressed", on ? "true" : "false");
    btnInspect.querySelector(".lbl").textContent = on ? "退出选择" : "选择结构";
  }
  function hidePanel() { panel.classList.add("hidden"); }
  function updateUndoUI() { undoBtn.disabled = !editUndo.length; redoBtn.disabled = !editRedo.length; }

  // 新页面（生成 / 载入历史）后重置：清空选择与编辑历史
  window.resetInspect = function () {
    inspectOn = false; setBtn(false); hidePanel();
    editUndo = []; editRedo = []; updateUndoUI();
  };

  function setInspect(on) { inspectOn = on; setBtn(on); sendCmd(on ? "on" : "off"); if (!on) hidePanel(); }

  btnInspect.onclick = function () {
    if (!currentHtml) { showToast("先生成一个网页，再选择结构", false); return; }
    setInspect(!inspectOn);
  };
  $("ins-close").onclick = function () { hidePanel(); sendCmd("deselect"); };

  $("ins-copy").onclick = function () {
    if (!selectedHtml) return;
    const done = () => showToast("已复制该结构的 HTML 📋", true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(selectedHtml).then(done).catch(() => {});
    } else {
      const ta = document.createElement("textarea"); ta.value = selectedHtml;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (_) {} ta.remove();
    }
  };

  // 快捷指令 chip：点一下填入并直接应用
  panel.querySelectorAll(".ins-chip").forEach(function (c) {
    c.addEventListener("click", function () { editInput.value = c.getAttribute("data-q") || ""; applyEdit(); });
  });

  function setBusy(on) {
    busy = on; applyBtn.disabled = on; applySpin.classList.toggle("hidden", !on);
    applyLbl.textContent = on ? "AI 改写中…" : "应用修改";
  }

  // 重渲染并在加载后重新选中同一节点（保持 currentHtml 纯净，注入只发生在 srcdoc）
  function rerender(reselectId) {
    preview.srcdoc = prepareSrcdoc(currentHtml);
    codeEl.textContent = currentHtml;
    pendingReselect = reselectId || null;
  }

  async function applyEdit() {
    if (busy) return;
    if (!curId) { showToast("该结构没有可编辑标识，请重启服务后重新生成页面再编辑", false); return; }
    const instruction = editInput.value.trim();
    if (!instruction) { editInput.focus(); return; }
    setBusy(true);
    try {
      const resp = await fetch("/api/edit-node", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: curId, nodeName: curName, nodeType: curType, html: selectedHtml, instruction }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "编辑失败");

      // 在「干净的 currentHtml」里按 data-node-id 定位并替换该节点
      const doc = new DOMParser().parseFromString(currentHtml, "text/html");
      const sel = '[data-node-id="' + curId.replace(/["\\]/g, "") + '"]';
      const node = doc.querySelector(sel);
      if (!node) throw new Error("源码里找不到该结构（id=" + curId + "）");
      const tmp = doc.createElement("div"); tmp.innerHTML = data.html;
      const repl = tmp.firstElementChild;
      if (!repl) throw new Error("AI 返回的内容无效");
      node.replaceWith(repl);

      editUndo.push(currentHtml); if (editUndo.length > 40) editUndo.shift();
      editRedo = []; updateUndoUI();
      currentHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
      editInput.value = "";
      rerender(curId);
      showToast("已更新「" + (curName || "结构") + "」✨", true);
      setTimeout(loadHistory, 300);
    } catch (err) {
      showToast(err.message || "编辑失败", false);
    } finally { setBusy(false); }
  }
  applyBtn.onclick = applyEdit;
  editInput.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); applyEdit(); }
  });

  function undo() { if (!editUndo.length) return; editRedo.push(currentHtml); currentHtml = editUndo.pop(); updateUndoUI(); rerender(curId); showToast("已撤销", true); }
  function redo() { if (!editRedo.length) return; editUndo.push(currentHtml); currentHtml = editRedo.pop(); updateUndoUI(); rerender(curId); showToast("已重做", true); }
  undoBtn.onclick = undo; redoBtn.onclick = redo;
  document.addEventListener("keydown", function (e) {
    if (!inspectOn || e.target === editInput) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  });

  // —— 区块操作：上移 / 下移 / 复制 / 删除（纯前端在干净源码上改，复用撤销栈）——
  function withDoc() { return new DOMParser().parseFromString(currentHtml, "text/html"); }
  function findNode(doc, id) { return doc.querySelector('[data-node-id="' + id.replace(/["\\]/g, "") + '"]'); }
  function commit(doc, reselectId) {
    editUndo.push(currentHtml); if (editUndo.length > 40) editUndo.shift();
    editRedo = []; updateUndoUI();
    currentHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    rerender(reselectId); setTimeout(loadHistory, 300);
  }
  function moveNode(dir) {
    if (!curId) return; const doc = withDoc(), n = findNode(doc, curId);
    if (!n) { showToast("源码里找不到该结构", false); return; }
    const sib = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
    if (!sib) { showToast(dir < 0 ? "已经在最上面了" : "已经在最下面了", false); return; }
    if (dir < 0) n.parentNode.insertBefore(n, sib); else n.parentNode.insertBefore(sib, n);
    commit(doc, curId); showToast(dir < 0 ? "已上移 ↑" : "已下移 ↓", true);
  }
  function duplicateNode() {
    if (!curId) return; const doc = withDoc(), n = findNode(doc, curId);
    if (!n) { showToast("源码里找不到该结构", false); return; }
    const clone = n.cloneNode(true);
    const sfx = "-c" + Date.now().toString(36).slice(-4);
    [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("[data-node-id]"))).forEach(function (e) {
      const v = e.getAttribute("data-node-id"); if (v) e.setAttribute("data-node-id", v + sfx);   // 重新分配 id，避免重复
    });
    n.parentNode.insertBefore(clone, n.nextSibling);
    commit(doc, curId + sfx); showToast("已复制一份结构 ⧉", true);
  }
  function deleteNode() {
    if (!curId) return;
    if (!confirm("确定删除「" + (curName || "该结构") + "」吗？可用撤销（Ctrl+Z）恢复。")) return;
    const doc = withDoc(), n = findNode(doc, curId);
    if (!n) { showToast("源码里找不到该结构", false); return; }
    n.remove(); commit(doc, null); hidePanel(); sendCmd("deselect"); showToast("已删除该结构 🗑", true);
  }
  $("ins-up").onclick = function () { moveNode(-1); };
  $("ins-down").onclick = function () { moveNode(1); };
  $("ins-dup").onclick = duplicateNode;
  $("ins-del").onclick = deleteNode;

  // —— 面包屑：点父级名称快速选中父结构 ——
  $("ins-path").addEventListener("click", function (e) {
    const b = e.target.closest(".ins-crumb"); if (!b) return;
    const pid = b.getAttribute("data-pid"); if (pid) sendSelectId(pid);
  });
  function renderPath(path) {
    $("ins-path").innerHTML = (path || []).map(function (seg) {
      const name = typeof seg === "string" ? seg : (seg.name || "");
      const id = typeof seg === "string" ? "" : (seg.id || "");
      return id ? '<button type="button" class="ins-crumb" data-pid="' + esc(id) + '">' + esc(name) + "</button>"
                : "<span>" + esc(name) + "</span>";
    }).join('<span class="ins-sep"> › </span>');
  }

  // iframe 重新加载后：若仍在选择模式则重开，并按需重新选中刚编辑的节点
  preview.addEventListener("load", function () {
    if (!inspectOn) return;
    sendCmd("on");
    if (pendingReselect) { const id = pendingReselect; pendingReselect = null; setTimeout(function () { sendSelectId(id); }, 30); }
  });

  window.addEventListener("message", function (ev) {
    const d = ev.data || {};
    if (d.__ins === "select") {
      selectedHtml = d.html || "";
      curId = d.id || ""; curName = d.name || "结构"; curType = d.type || "";
      $("ins-name").textContent = curName;
      $("ins-tag").textContent = "<" + (d.tag || "") + ">";
      renderPath(d.path);
      $("ins-text").textContent = d.text ? "“" + d.text + "”" : "（该结构无文字内容）";
      // 有 data-node-id 才能局部编辑；否则提示重生成
      const editable = !!curId;
      editWrap.classList.toggle("hidden", !editable);
      noEdit.classList.toggle("hidden", editable);
      if (editable) editInput.value = "";
      panel.classList.remove("hidden");
    } else if (d.__ins === "deselect") {
      hidePanel();
    }
  });
})();

// ─── 初始化 ────────────────────────────────────
updateAuthUI();
loadHistory();
