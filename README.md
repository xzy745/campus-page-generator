# campus-page-generator 校园专业页面生成器

读取专业数据（`data/majors.json`）与网页母版（`src/template.html`），用 Node.js 脚本**批量生成 53 个专业的静态介绍页**及一个分门类的总览首页，输出到 `dist/`。

页面采用 **Tailwind CSS（CDN）** + 高级滚动动画（渐显、悬浮、玻璃拟态、渐变流光），每个专业根据自身主题色自动着色。

## 目录结构

```
campus-page-generator/
├── src/
│   ├── template.html        # 核心网页母版（Tailwind + 动画，含 {{token}} 占位符）
│   └── assets/
│       └── hero-bg.jpg      # 英雄区底图（当前为占位图，请替换为 Midjourney 成品）
├── data/
│   └── majors.json          # 53 个专业的全量 JSON 数据中心
├── dist/                    # 自动生成的静态网页（运行脚本后产生，可直接部署）
├── generator.js             # Node.js 自动化批量生成脚本
├── package.json             # 项目配置
└── README.md                # 项目文档
```

## 快速开始

> 需要 Node.js ≥ 14（仅用内置模块，无需 `npm install`）。

```bash
cd campus-page-generator
node generator.js        # 或 npm run build
```

构建完成后，用浏览器打开 `dist/index.html` 即可预览。

| 命令 | 说明 |
| --- | --- |
| `npm run build` | 生成全部页面到 `dist/` |
| `npm run preview` | 构建后用默认浏览器打开首页（跨平台） |

## 工作原理

1. 读取 `data/majors.json`，取出 `majors` 数组与学校元信息。
2. 读取 `src/template.html`，对每个专业做 `{{token}}` 占位符替换。
3. 数组字段（课程 / 能力 / 就业）由 `generator.js` 渲染成卡片 HTML 片段后注入。
4. 复制 `src/assets/` 到 `dist/assets/`，并额外生成按学科门类分组的 `index.html` 总览页。

## 数据格式（`data/majors.json`）

```jsonc
{
  "school": "示范大学",
  "year": 2026,
  "majors": [
    {
      "id": 1,
      "slug": "computer-science",        // 生成文件名 computer-science.html
      "name": "计算机科学与技术",
      "en": "Computer Science and Technology",
      "category": "工学",                 // 用于首页分组
      "degree": "工学学士",
      "duration": "四年",
      "tagline": "用代码定义未来世界",
      "color": "#3b82f6",                 // 该专业主题色
      "description": "……",
      "courses": ["数据结构", "操作系统", "..."],
      "careers": ["软件工程师", "..."],
      "skills":  ["编程能力", "..."]
    }
    // … 共 53 个
  ]
}
```

新增专业：在 `majors` 数组里追加一条记录，重新运行 `node generator.js` 即可。

## 模板占位符（`src/template.html`）

| 占位符 | 含义 |
| --- | --- |
| `{{school}}` `{{year}}` | 学校与年份 |
| `{{name}}` `{{en}}` `{{tagline}}` | 中文名 / 英文名 / 标语 |
| `{{category}}` `{{degree}}` `{{duration}}` | 门类 / 学位 / 学制 |
| `{{color}}` | 主题色（用于按钮、辉光、渐变） |
| `{{description}}` | 专业简介 |
| `{{coursesHTML}}` `{{skillsHTML}}` `{{careersHTML}}` | 由脚本渲染的卡片片段 |

## 关于 hero-bg.jpg

仓库内自带的是一张深色**占位图**，仅保证页面不出现裂图。请用你在 Midjourney 生成的高级黑白底图覆盖 `src/assets/hero-bg.jpg`（保持同名），再次构建即可生效。

## 部署

`dist/` 为纯静态文件，可直接托管到 GitHub Pages / Vercel / Netlify 等任意静态空间。

---
© 2026 · 由 campus-page-generator 自动生成
