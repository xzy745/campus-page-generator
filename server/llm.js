/**
 * DeepSeek 调用封装。
 * DeepSeek 是 OpenAI 兼容接口，所以这里用原生 fetch 直接打 /chat/completions，
 * 不额外引入 SDK，保持轻量。Node >= 18 自带 fetch。
 */

const { SYSTEM_PROMPT } = require("./systemPrompt");

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
 * @param {string} prompt 用户的自然语言需求
 * @returns {Promise<{html: string, truncated: boolean}>}
 */
async function generatePage(prompt) {
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
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
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

module.exports = { generatePage, stripCodeFence };
