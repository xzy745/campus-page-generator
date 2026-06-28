/**
 * 轻后端代理 —— 对话即渲染系统的服务端。
 * 职责：托管前端静态页 + /api/generate（AI 生成）+ /api/auth/*（用户认证）+ /api/records（生成历史）
 */
require("dotenv").config();
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const { generatePage, editNode } = require("./llm");
const { saveGeneration, listGenerations, getGeneration, countGenerations, deleteGeneration } = require("./store");
const { register, login } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

app.use(express.json({ limit: "1mb" }));

// ─── 健康检查 ──────────────────────────────────
app.get("/api/health", (req, res) => {
  const { countGenerations } = require("./store");
  const { usersDb } = require("./db");
  const userCount = usersDb.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  res.json({
    ok: true,
    model: MODEL,
    keyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    db: {
      users: userCount,
      generations: countGenerations(),
    },
  });
});

// ─── 认证 API（数据库 1：用户）────────────────
app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body || {};
  const result = register(username, password);
  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: result.error });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const result = login(username, password);
  if (result.ok) {
    res.json({ ok: true, user: result.user });
  } else {
    res.status(401).json({ ok: false, error: result.error });
  }
});

// ─── AI 生成 API（数据库 2：生成记录）───────────
app.post("/api/generate", async (req, res) => {
  const prompt = (req.body?.prompt || "").trim();
  const options = req.body?.options || {};
  if (!prompt) {
    return res.status(400).json({ error: "请提供 prompt（你想生成什么网页）。" });
  }

  try {
    const { html, truncated } = await generatePage(prompt, options);

    await saveGeneration({
      prompt,
      html,
      model: MODEL,
      createdAt: new Date().toISOString(),
    });

    res.json({ html, truncated });
  } catch (err) {
    console.error("❌ /api/generate 失败:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── 局部结构编辑 API（只重写选中节点，不重写整页）──
app.post("/api/edit-node", async (req, res) => {
  const { nodeId, nodeName, nodeType, html, instruction } = req.body || {};
  if (!html || !instruction || !(instruction + "").trim()) {
    return res.status(400).json({ error: "请提供选中结构的 html 和修改要求 instruction。" });
  }
  try {
    const newHtml = await editNode({ nodeId, nodeName, nodeType, html, instruction: (instruction + "").trim() });
    res.json({ html: newHtml });
  } catch (err) {
    console.error("❌ /api/edit-node 失败:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── 生成记录查询 API ──────────────────────────
app.get("/api/records", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ records: listGenerations(limit), total: countGenerations() });
});

app.get("/api/records/:id", (req, res) => {
  const record = getGeneration(parseInt(req.params.id));
  if (record) {
    res.json(record);
  } else {
    res.status(404).json({ error: "记录不存在" });
  }
});

app.delete("/api/records/:id", (req, res) => {
  const deleted = deleteGeneration(parseInt(req.params.id));
  if (deleted) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: "记录不存在" });
  }
});

// ─── 静态托管 ──────────────────────────────────
//   /         → 校园专业总览（generator.js 构建出的 dist，含 3D 卡片）
//   /studio/  → 对话即渲染 AI Studio（public）
app.use("/studio", express.static(path.join(__dirname, "..", "public")));
app.use("/skills", express.static(path.join(__dirname, "..", "showcase")));
app.use("/", express.static(path.join(__dirname, "..", "dist")));

function openBrowser(url) {
  if (process.env.OPEN_BROWSER === "0" || process.env.OPEN_BROWSER === "false") {
    return;
  }

  const isWindows = process.platform === "win32";
  const command = isWindows ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = isWindows ? ["/c", "start", "", url] : [url];
  const opener = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });

  opener.on("error", () => {
    console.log(`   浏览器未能自动打开，请手动访问: ${url}`);
  });
  opener.unref();
}

function startServer(port, remainingRetries = 10) {
  const server = app.listen(port, () => {
    const actualPort = server.address().port;
    const keyOk = Boolean(process.env.DEEPSEEK_API_KEY);
    const distReady = require("fs").existsSync(path.join(__dirname, "..", "dist", "index.html"));
    const localUrl = `http://localhost:${actualPort}/`;

    console.log(`\n🚀 统一服务已启动: ${localUrl}`);
    console.log(`   校园专业总览(3D卡片): ${localUrl}  ${distReady ? "" : "⚠ dist 未构建，先跑 npm run build:static"}`);
    console.log(`   AI 对话即渲染 Studio: http://localhost:${actualPort}/studio/`);
    console.log(`   网页能力规格书(6项能力演示): http://localhost:${actualPort}/skills/`);
    console.log(`   模型: ${MODEL} ｜ 密钥: ${keyOk ? "已配置 ✓" : "⚠ 未配置（请在 .env 写 DEEPSEEK_API_KEY）"}`);
    console.log(`   📦 数据库: data/users.db + data/generations.db\n`);
    openBrowser(localUrl);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && remainingRetries > 0) {
      const nextPort = port + 1;
      console.log(`端口 ${port} 已被占用，正在尝试 ${nextPort}...`);
      startServer(nextPort, remainingRetries - 1);
      return;
    }

    console.error("服务启动失败:", err.message);
    process.exit(1);
  });
}

startServer(PORT);
