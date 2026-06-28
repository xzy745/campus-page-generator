/**
 * DeepSeek 调用封装。
 * DeepSeek 是 OpenAI 兼容接口，所以这里用原生 fetch 直接打 /chat/completions，
 * 不额外引入 SDK，保持轻量。Node >= 18 自带 fetch。
 */

const { buildSystemPrompt } = require("./systemPrompt");

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/** 剥掉 LLM 常带的 Markdown 代码围栏，只留纯 HTML */
function stripCodeFence(text) {
  let t = text.trim();
  // ```html ... ```  或  ``` ... ```
  const fence = t.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  // 兜底：从第一个 <!doctype/<html 截到最后一个 </html>
  const start = t.search(/<!doctype html|<html/i);
  const end = t.toLowerCase().lastIndexOf("</html>");
  if (start !== -1 && end !== -1) t = t.slice(start, end + "</html>".length);
  return t.trim();
}

/**
 * 调用 DeepSeek 生成网页 HTML。
 * @param {string} prompt 用户的自然语言需求（已含结构/话题/配色等生成参数）
 * @param {{multipage?: boolean, pages?: string[]}} [options] 生成选项，影响系统提示与输出长度
 * @returns {Promise<{html: string, truncated: boolean}>}
 */
async function generatePage(prompt, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const err = new Error("缺少 DEEPSEEK_API_KEY，请在 .env 中配置后端密钥。");
    err.status = 500;
    throw err;
  }

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(options) },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      // 多页网站内容更多，给到模型上限，尽量避免被截断
      max_tokens: 8192,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    const err = new Error(`DeepSeek 接口错误 ${resp.status}: ${detail.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error("DeepSeek 返回为空。");
    err.status = 502;
    throw err;
  }

  // finish_reason === 'length' 说明输出达到 max_tokens 上限被截断，页面可能不完整
  const truncated = data?.choices?.[0]?.finish_reason === "length";
  if (truncated) console.warn("⚠ 本次生成达到长度上限，内容可能被截断。");

  return { html: stripCodeFence(content), truncated };
}

/** 只剥 Markdown 代码围栏（用于局部 HTML 片段，不做整文档截取） */
function stripFence(text) {
  let t = (text || "").trim();
  const m = t.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  if (m) t = m[1].trim();
  return t;
}

/**
 * 局部编辑：只重写「选中节点」这一块 HTML，不重写整页。
 * @param {{nodeId?:string,nodeName?:string,nodeType?:string,html:string,instruction:string}} p
 * @returns {Promise<string>} 该节点改写后的新 HTML 片段
 */
async function editNode(p) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const err = new Error("缺少 DEEPSEEK_API_KEY，请在 .env 中配置后端密钥。");
    err.status = 500;
    throw err;
  }
  const nodeId = p.nodeId || "";
  const sys = `你正在编辑一个网页中的「局部 HTML 结构」。严格遵守：
1. 只返回这一个节点改写后的新 HTML 片段，绝不返回整页，不要 <html>/<head>/<body>。
2. 必须保留属性 data-node-id="${nodeId}" 与 data-editable="true"；保留并可按需更新 data-node-type、data-node-name（中文名）。
3. 根标签类型尽量与原节点一致，不破坏外层布局。
4. 不要生成 <script> 标签。
5. 用 Tailwind 类，沿用原页面的配色与视觉风格，中文文案自然。
6. 直接输出 HTML 源码本身，不要任何解释，不要 Markdown 代码围栏。`;
  const user = `当前选中节点：
- nodeId: ${nodeId}
- nodeName: ${p.nodeName || ""}
- nodeType: ${p.nodeType || ""}
- 当前 HTML：
${p.html}

用户要求：
${p.instruction}

请只返回这个节点改写后的新 HTML 片段。`;

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      temperature: 0.6,
      max_tokens: 4096,
      stream: false,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    const err = new Error(`DeepSeek 接口错误 ${resp.status}: ${detail.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) { const err = new Error("DeepSeek 返回为空。"); err.status = 502; throw err; }
  return stripFence(content);
}

module.exports = { generatePage, stripCodeFence, editNode };
