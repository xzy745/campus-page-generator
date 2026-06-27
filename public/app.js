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
  if(href.charAt(0) === '#'){
    e.preventDefault();
    try { var el = href.length > 1 && document.querySelector(href); if(el) el.scrollIntoView({behavior:'smooth'}); } catch(_){}
  } else {
    e.preventDefault();
  }
}, true);
</scr`+`ipt>`;

function withNavGuard(html) {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, NAV_GUARD + "</body>");
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, NAV_GUARD + "</html>");
  return html + NAV_GUARD;
}

// ─── 示例按钮 ──────────────────────────────────
const EXAMPLES = [
  "生成一个摄影师个人作品集网页，极简黑白风格",
  "做一个 SaaS 产品落地页，深色科技感，含定价表",
  "一个咖啡馆官网，温暖复古风，含菜单和门店地址",
];
EXAMPLES.forEach((ex) => {
  const b = document.createElement("button");
  b.className = "text-left text-zinc-500 hover:text-indigo-400 transition";
  b.textContent = "› " + ex;
  b.onclick = () => { promptEl.value = ex; promptEl.focus(); };
  $("examples").appendChild(b);
});

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
            preview.srcdoc = withNavGuard(currentHtml);
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
  const prompt = promptEl.value.trim();
  if (!prompt) { promptEl.focus(); return; }

  setLoading(true);
  placeholder.classList.add("hidden");
  codeEl.classList.add("hidden");

  try {
    const resp = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "生成失败");

    currentHtml = data.html;
    preview.srcdoc = withNavGuard(currentHtml);
    codeEl.textContent = currentHtml;
    if (data.truncated) showToast("⚠ 内容达到长度上限被截断", false);

    // 生成成功后自动刷新历史
    setTimeout(loadHistory, 500);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

btnGenerate.onclick = generate;
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

// ─── 初始化 ────────────────────────────────────
updateAuthUI();
loadHistory();
