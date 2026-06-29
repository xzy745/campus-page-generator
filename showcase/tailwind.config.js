/** Tailwind 配置：只为 /skills/（网页拆解）这一页生成用到的工具类。
 *  生成命令见 package.json 的 build:skills-css 脚本。 */
module.exports = {
  content: ['./showcase/index.html', './showcase/skills.js'],
  theme: { extend: {} },
  plugins: [],
};
