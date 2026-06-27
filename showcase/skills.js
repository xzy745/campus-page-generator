/* ============================================================
   专业招新互动页 · 10 个原生 JS 功能（全部手写，可逐行讲解）
   作者：徐致远
   说明：每个功能用注释标了序号，对应页面里的 "JS ①~⑩" 徽标。
   ============================================================ */

// 小工具：按 id 取元素
const $ = (id) => document.getElementById(id);


/* ---------- ⑦ 鼠标跟随光效 ----------
   原理：GSAP quickTo 驱动高频更新，x/y 是 transform 别名，零 layout thrashing。
   对比旧版 left/top（触发布局重算），性能大幅提升。 */
const glow = $("cursor-glow");
if (glow && window.gsap) {
  const gxTo = gsap.quickTo(glow, "x", { duration: 0.5, ease: "power3.out" });
  const gyTo = gsap.quickTo(glow, "y", { duration: 0.5, ease: "power3.out" });
  const goTo = gsap.quickTo(glow, "opacity", { duration: 0.25 });
  document.addEventListener("mousemove", (e) => {
    gxTo(e.clientX);
    gyTo(e.clientY);
    goTo(1);
  });
  document.addEventListener("mouseleave", () => goTo(0));
}


/* ---------- ① 轮播图 ----------
   原理：一条横向轨道装着 N 张图，改 transform: translateX 来切换；
   配自动播放 + 左右按钮 + 圆点指示。 */
(function carousel() {
  const track = $("carousel");
  const slides = track.children;             // 所有幻灯片
  const total = slides.length;
  const dotsBox = $("dots");
  let index = 0;                             // 当前第几张

  // 生成底部圆点
  for (let i = 0; i < total; i++) {
    const d = document.createElement("button");
    d.className = "w-2.5 h-2.5 rounded-full bg-white/40 transition";
    d.addEventListener("click", () => go(i));
    dotsBox.appendChild(d);
  }

  function go(i) {
    index = (i + total) % total;            // 取模实现循环
    track.style.transform = "translateX(" + -index * 100 + "%)";
    [...dotsBox.children].forEach((d, k) =>
      d.classList.toggle("bg-white", k === index)
    );
  }

  $("next").addEventListener("click", () => go(index + 1));
  $("prev").addEventListener("click", () => go(index - 1));

  let timer = setInterval(() => go(index + 1), 4000);   // 自动播放
  // 鼠标移上去暂停，移开继续
  track.parentElement.addEventListener("mouseenter", () => clearInterval(timer));
  track.parentElement.addEventListener("mouseleave", () => {
    timer = setInterval(() => go(index + 1), 4000);
  });

  go(0);
})();


/* ---------- ② 弹出窗口（通用 modal） ----------
   暴露一个 openModal()，供"报名成功""登录成功"等场景复用。 */
function openModal(title, text, icon) {
  $("modal-title").textContent = title;
  $("modal-text").textContent = text;
  $("modal-icon").textContent = icon || "🎉";
  $("modal").classList.remove("hidden");
}
function closeModal() {
  $("modal").classList.add("hidden");
}
$("modal-close").addEventListener("click", closeModal);
$("modal-mask").addEventListener("click", closeModal);   // 点遮罩也关闭


/* ---------- ③ 本地存储实现登录 ----------
   原理：用 localStorage 当"数据库"。
   - 用户表存在 localStorage 的 "users"（一个 {用户名:密码} 对象）
   - 当前登录态存在 "currentUser"
   注意：明文存密码仅为教学演示，真实项目要加密。 */
function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "{}");
}
function setLoginState() {
  const cur = localStorage.getItem("currentUser");
  if (cur) {
    $("login-state").textContent = "已登录：" + cur;
    $("login-state").className = "text-emerald-400";
    $("btn-login").classList.add("hidden");
    $("btn-register").classList.add("hidden");
    $("btn-logout").classList.remove("hidden");
  } else {
    $("login-state").textContent = "未登录";
    $("login-state").className = "text-zinc-400";
    $("btn-login").classList.remove("hidden");
    $("btn-register").classList.remove("hidden");
    $("btn-logout").classList.add("hidden");
  }
}
function loginMsg(text, ok) {
  const el = $("login-msg");
  el.textContent = text;
  el.className = "text-xs mt-4 h-4 " + (ok ? "text-emerald-400" : "text-red-400");
}

$("btn-register").addEventListener("click", () => {
  const u = $("username").value.trim();
  const p = $("password").value;
  if (!u || !p) return loginMsg("用户名和密码不能为空", false);
  const users = getUsers();
  if (users[u]) return loginMsg("该用户名已存在", false);
  users[u] = p;
  localStorage.setItem("users", JSON.stringify(users));
  loginMsg("注册成功，请登录", true);
});

$("btn-login").addEventListener("click", () => {
  const u = $("username").value.trim();
  const p = $("password").value;
  const users = getUsers();
  if (users[u] && users[u] === p) {
    localStorage.setItem("currentUser", u);
    setLoginState();
    openModal("登录成功", "欢迎你，" + u + "！", "👋");
  } else {
    loginMsg("用户名或密码错误", false);
  }
});

$("btn-logout").addEventListener("click", () => {
  localStorage.removeItem("currentUser");
  setLoginState();
  loginMsg("已退出登录", true);
});

setLoginState();   // 页面加载时恢复登录态


/* ---------- ⑥ 切换选项卡 ----------
   原理：点按钮 → 高亮当前按钮 + 显示对应面板、隐藏其它。 */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const i = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => {
      const on = b === btn;
      b.classList.toggle("border-indigo-500", on);
      b.classList.toggle("text-white", on);
      b.classList.toggle("border-transparent", !on);
      b.classList.toggle("text-zinc-500", !on);
    });
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("hidden", p.dataset.panel !== i)
    );
  });
});


/* ---------- ⑩ 正则表达式验证 ----------
   原理：用正则（regex）规定输入必须符合的格式，不符合就提示"不符合"。
   这里校验手机号：必须 11 位、以 1 开头、第二位是 3-9。
   正则 /^1[3-9]\d{9}$/ 含义：
     ^      开头
     1      第一位是 1
     [3-9]  第二位是 3 到 9
     \d{9}  再跟 9 个数字
     $      结尾（保证总长正好 11 位） */
const PHONE_RE = /^1[3-9]\d{9}$/;

function checkPhone() {
  const val = $("su-phone").value.trim();
  const hint = $("phone-hint");
  if (val === "") {
    hint.textContent = "请输入 11 位手机号";
    hint.className = "text-xs h-4 mb-3 text-zinc-500";
    return false;
  }
  if (PHONE_RE.test(val)) {                       // 符合正则
    hint.textContent = "✓ 格式符合";
    hint.className = "text-xs h-4 mb-3 text-emerald-400";
    return true;
  } else {                                        // 不符合
    hint.textContent = "✗ 手机号格式不符合（须 11 位、以 1 开头）";
    hint.className = "text-xs h-4 mb-3 text-red-400";
    return false;
  }
}
$("su-phone").addEventListener("input", checkPhone);   // 边输入边实时校验


/* ---------- ⑤ 动态表格操作 ----------
   原理：报名时往 <tbody> 动态插入一行，每行带"删除"按钮；
   数据同时存 localStorage，刷新后还原。 */
function getRoster() {
  return JSON.parse(localStorage.getItem("roster") || "[]");
}
function saveRoster(list) {
  localStorage.setItem("roster", JSON.stringify(list));
}
function renderRoster() {
  const list = getRoster();
  const body = $("roster-body");
  body.innerHTML = "";
  if (list.length === 0) {
    body.innerHTML =
      '<tr><td colspan="4" class="text-center text-zinc-600 px-4 py-8">还没有人报名，去上面报一个吧</td></tr>';
    return;
  }
  list.forEach((row, i) => {
    const tr = document.createElement("tr");
    tr.className = "border-t border-zinc-800";
    tr.innerHTML =
      '<td class="px-4 py-3">' + row.name + "</td>" +
      '<td class="px-4 py-3">' + row.major + "</td>" +
      '<td class="px-4 py-3 text-zinc-500">' + row.time + "</td>" +
      '<td class="px-4 py-3"><button class="text-red-400 hover:text-red-300 text-xs" data-i="' + i + '">删除</button></td>';
    body.appendChild(tr);
  });
  // 给每个删除按钮绑事件
  body.querySelectorAll("button[data-i]").forEach((b) => {
    b.addEventListener("click", () => {
      const list = getRoster();
      list.splice(Number(b.dataset.i), 1);   // 删掉这一行
      saveRoster(list);
      renderRoster();
    });
  });
}
function addToRoster(name, major) {
  const list = getRoster();
  list.push({ name, major, time: new Date().toLocaleString("zh-CN") });
  saveRoster(list);
  renderRoster();
}
renderRoster();


/* ---------- 报名提交：串起 ⑩ 验证 → ⑤ 入表 → ② 弹窗 ---------- */
$("btn-signup").addEventListener("click", () => {
  const name = $("su-name").value.trim();
  const major = $("su-major").value.trim();
  const msg = $("signup-msg");
  if (!name || !major) {
    msg.textContent = "请填写姓名和意向专业";
    msg.className = "text-xs text-red-400 mt-4 h-4";
    return;
  }
  if (!checkPhone()) {                                     // ⑩ 正则验证：不符合就拦下
    msg.textContent = "手机号格式不符合，请检查";
    msg.className = "text-xs text-red-400 mt-4 h-4";
    return;
  }
  addToRoster(name, major);                                // ⑤ 进表
  msg.textContent = "";
  $("su-name").value = "";
  $("su-major").value = "";
  $("su-phone").value = "";
  checkPhone();                                            // 重置手机号提示
  openModal("报名成功", name + " 已加入 " + major + " 的报名名单！", "🎉");  // ② 弹窗
});


/* ---------- ⑧ 手风琴动画 ----------
   原理：点标题 → 展开/收起对应内容；其它项收起（一次只开一个）。 */
document.querySelectorAll(".accordion-item").forEach((item) => {
  const head = item.querySelector(".accordion-head");
  const body = item.querySelector(".accordion-body");
  const sign = head.querySelector("span");
  head.addEventListener("click", () => {
    const isOpen = body.style.maxHeight && body.style.maxHeight !== "0px";
    // 先全部收起
    document.querySelectorAll(".accordion-body").forEach((b) => (b.style.maxHeight = "0px"));
    document.querySelectorAll(".accordion-head span").forEach((s) => (s.textContent = "+"));
    // 再展开当前（若原来是关的）
    if (!isOpen) {
      body.style.maxHeight = body.scrollHeight + "px";
      sign.textContent = "−";
    }
  });
});


/* ---------- ④ 留言板 ----------
   原理：留言存 localStorage 的 "messages" 数组，刷新后还在；
   支持发布与删除。 */
function getMessages() {
  return JSON.parse(localStorage.getItem("messages") || "[]");
}
function saveMessages(list) {
  localStorage.setItem("messages", JSON.stringify(list));
}
function renderMessages() {
  const list = getMessages();
  const ul = $("msg-list");
  ul.innerHTML = "";
  if (list.length === 0) {
    ul.innerHTML = '<li class="text-zinc-600 text-sm">还没有留言，来抢沙发～</li>';
    return;
  }
  list.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = "bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex justify-between items-start gap-4";
    li.innerHTML =
      '<div><p class="text-sm">' + m.text + '</p><p class="text-xs text-zinc-600 mt-1">' + m.time + "</p></div>" +
      '<button class="text-red-400 hover:text-red-300 text-xs shrink-0" data-i="' + i + '">删除</button>';
    ul.appendChild(li);
  });
  ul.querySelectorAll("button[data-i]").forEach((b) => {
    b.addEventListener("click", () => {
      const list = getMessages();
      list.splice(Number(b.dataset.i), 1);
      saveMessages(list);
      renderMessages();
    });
  });
}
function sendMessage() {
  const input = $("msg-input");
  const text = input.value.trim();
  if (!text) return;
  const list = getMessages();
  list.unshift({ text, time: new Date().toLocaleString("zh-CN") });  // 新留言放最前
  saveMessages(list);
  input.value = "";
  renderMessages();
}
$("msg-send").addEventListener("click", sendMessage);
$("msg-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
renderMessages();


/* ---------- ⑨ 电梯导航定位 ----------
   两件事：
   1) 点右侧圆点 → 平滑滚到对应区块；
   2) 滚动时高亮"当前可见"的那个区块对应的圆点（scroll-spy）。 */
const dots = document.querySelectorAll("#elevator .dot");

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    document.getElementById(dot.dataset.target).scrollIntoView({ behavior: "smooth" });
  });
});

// 用 IntersectionObserver 判断哪个区块进入视口，高亮对应圆点
const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        dots.forEach((d) =>
          d.classList.toggle("active", d.dataset.target === e.target.id)
        );
      }
    });
  },
  { threshold: 0.5 }
);
["home", "login", "majors", "signup", "roster", "faq", "board"].forEach((id) =>
  spy.observe(document.getElementById(id))
);
