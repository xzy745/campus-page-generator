# Slice Transition · 五等分切片转场特效

剪辑风的页面转场动画：屏幕被切成 N 条等宽切片，背景大图拼成连续整图、缓慢推近，标题逐条从遮罩后升起，随后切片「奇上偶下」错位滑出露出页面。质感来自 **真实影像 + 胶片颗粒 + 切缝辉光 + expo 自定义缓动**。

零依赖结构，动画由 GSAP 驱动（缺失时自动从 CDN 按需加载）。单文件、即插即用。

## 文件

| 文件 | 作用 |
|------|------|
| `slice-transition.js` | 特效模块本体（自动注入样式与结构，暴露 `SliceTransition`） |
| `demo.html` | 可直接双击打开的演示页 |
| `README.md` | 本说明 |

## 快速开始

```html
<script src="slice-transition.js"></script>
<script>
  // 入场揭幕（页面加载时）
  SliceTransition.intro({ image: 'assets/hero-bg.jpg', text: '对话即渲染' });
</script>
```

> 把 `<script>` 放在 `</body>` 前，或如上直接调用——模块内部已自动等待 DOM 就绪。

## 两种用法

### 1) 入场揭幕 `SliceTransition.intro(options)`
页面加载时盖屏播放，结束后自动移除遮罩。

### 2) 页面跳转转场 `SliceTransition.leave(url, options)`
点击链接时切片合拢盖满屏幕，然后跳转到 `url`；目标页再用 `intro()` 揭幕，形成无缝的「盖屏 → 换页 → 揭幕」转场。

```html
<a href="next.html" data-slice>下一页</a>
<script>
  document.querySelectorAll('a[data-slice]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      SliceTransition.leave(a.href, { image: 'assets/hero-bg.jpg', text: '加载中' });
    });
  });
</script>
```

## 配置项 options

| 参数 | 默认 | 说明 |
|------|------|------|
| `slices` | `5` | 切片数（≥2）。越多剪辑感越强 |
| `text` | `''` | 封面大标题（留空不显示） |
| `image` | `''` | 封面背景图路径（留空为纯色） |
| `accent` | `'#6366f1'` | 主题色：切缝辉光 / 光罩 / 文字辉光 |
| `bg` | `'#09090b'` | 底色 |
| `zIndex` | `99999` | 遮罩层级 |
| `grain` | `true` | 胶片颗粒噪点 |
| `autoGSAP` | `true` | GSAP 缺失时自动从 CDN 加载 |
| `onDone` | `null` | 结束回调（intro 揭幕完 / leave 跳转前） |

## 容错（不会卡死页面）

- **GSAP 加载失败** → 直接移除遮罩 / 直接跳转。
- **用户开启「减少动画」**（`prefers-reduced-motion`）→ 跳过动画，直接完成。
- **JS 被禁用** → 在页面 `<head>` 加一行兜底即可：
  ```html
  <noscript><style>.st-root{display:none!important}</style></noscript>
  ```

## 依赖

- [GSAP 3](https://gsap.com/)（自动按需加载；也可自行先引入以避免运行时再拉取）。
- 标题字体建议 `Playfair Display` / `Noto Serif SC`，未引入会回退到 `Georgia/serif`。

## 看效果

直接双击 `demo.html`。若图片不显示，把 demo 里的 `image` 路径换成一张本地图片即可。

---

MIT License · 作者：徐致远
