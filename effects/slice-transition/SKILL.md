---
name: slice-transition
description: 给网页添加「五等分切片」剪辑风转场特效（入场揭幕 或 页面间跳转转场）。当用户要求为页面加开场动画/preloader/loading 揭幕、或做页面跳转过渡/转场效果时使用。基于本目录的 slice-transition.js（零依赖、GSAP 驱动、自带容错）。
---

# Slice Transition 切片转场特效

把本目录的 `slice-transition.js` 集成到目标页面，提供两种效果：
- **入场揭幕** `SliceTransition.intro(options)` —— 页面加载时切片盖屏 → 标题逐条升起 → 切片错位滑出露出页面。
- **页面跳转转场** `SliceTransition.leave(url, options)` —— 点链接时切片合拢盖屏 → 跳转；目标页用 `intro()` 揭幕。

## 何时使用
用户提到：开场动画 / 入场动画 / preloader / 加载揭幕 / 页面转场 / 跳转过渡 / 切片(剪辑)转场，或「把首页那个转场加到 X 页面」。

## 集成步骤

1. **确认资源路径**：算出目标 HTML 到本目录 `slice-transition.js` 的相对路径（或让用户把该文件复制到项目静态目录后引用）。

2. **引入脚本**（放在 `</body>` 前）：
   ```html
   <script src="<相对路径>/slice-transition.js"></script>
   ```

3. **按需求调用**：
   - 入场揭幕：
     ```html
     <script>
       SliceTransition.intro({ image: 'assets/hero-bg.jpg', text: '<标题>' });
     </script>
     ```
   - 跳转转场（对需要转场的链接）：
     ```html
     <script>
       document.querySelectorAll('a[data-slice]').forEach(function (a) {
         a.addEventListener('click', function (e) {
           e.preventDefault();
           SliceTransition.leave(a.href, { image: 'assets/hero-bg.jpg', text: '加载中' });
         });
       });
     </script>
     ```
     并给需要转场的 `<a>` 加上 `data-slice` 属性。

4. **加 JS 禁用兜底**（写进目标页 `<head>`，防止脚本不执行时遮罩盖死页面）：
   ```html
   <noscript><style>.st-root{display:none!important}</style></noscript>
   ```

5. **字体（可选）**：标题建议 `Playfair Display` / `Noto Serif SC`，未引入会回退到 `Georgia/serif`。

## 配置项（传给 intro / leave 的 options）

| 参数 | 默认 | 说明 |
|------|------|------|
| `slices` | `5` | 切片数（≥2），越多剪辑感越强 |
| `text` | `''` | 封面大标题，留空不显示 |
| `image` | `''` | 封面背景图路径，留空为纯色 |
| `accent` | `'#6366f1'` | 主题色（切缝辉光 / 光罩 / 文字辉光） |
| `bg` | `'#09090b'` | 底色 |
| `zIndex` | `99999` | 遮罩层级 |
| `grain` | `true` | 胶片颗粒噪点 |
| `autoGSAP` | `true` | GSAP 缺失时自动从 CDN 加载 |
| `onDone` | `null` | 结束回调（intro 揭幕完 / leave 跳转前） |

## 注意
- **不要重复造轮子**：直接复用 `slice-transition.js`，不要把动画代码内联重写进页面。
- **容错已内建**：GSAP 加载失败 / 用户开启「减少动画」/ 无 DOM 时都会安全完成，不要再叠加判断。
- 若项目用构建产物（如本仓库的 `dist/` 由 `generator.js` 生成），改动要落到**源文件/模板**，再重新构建，而不是直接改产物。
- 集成后如能运行，建议启动本地服务让用户在浏览器里验证效果。

## 参考
- 用法 / 演示见同目录 `README.md` 与 `demo.html`。
