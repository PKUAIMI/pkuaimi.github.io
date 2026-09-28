# 首页全屏滚动交互

保留现有中英文静态内容模型，以 Vite + TypeScript 打包 GSAP / ScrollTrigger 和 Lenis 作为首页的渐进增强层。无需把可直接阅读的内容改成客户端 React 渲染。其他页面不加载滚动引擎，域名和 GitHub Pages `main /` 发布方式不变。

## 运行与构建

```sh
npm install
npm run dev
npm run verify
npm run build
```

使用 Node.js 22.12 或更高版本。CI 使用 `npm ci` 和锁文件；验证包含 TypeScript、维护流程与锚点测试、静态构建、全站链接和双语检查。根目录与 `dist/` 同时生成完整静态文件，无需服务器路由、CDN 或 API 密钥。

## 对应源文件

| 内容 | 文件 |
| --- | --- |
| 章节结构与导航 | `src/templates/home.mjs` |
| 首页专属全屏布局 | `public/home.css` |
| 平滑滚动、动画、历史记录和弹窗协调 | `src/browser/home-scroll.ts` |
| 同页链接、章节判断和低资源检测 | `src/browser/story-navigation.mjs` |
| Vite 内存打包，与静态页面一起输出 | `src/browser-assets.mjs` |
| 章节导航与滚动提示翻译 | `content/ui.json` |

## 章节与地址

章节顺序是 `#home` → `#updates`（新闻与论文）→ `#research` → `#about` → `#contact`。两种语言使用相同 id；旧的 `#about` 链接继续有效。章节有导航留白后的最小视口高度；长新闻、较短的电脑屏幕和手机上的文字自然向下延伸，不隐藏内容或引入内嵌滚动条。

点击章节使用 `pushState`，滚动阅读使用 `replaceState`，避免每次划动都增加历史记录。前进、后退与直接访问带 hash 的地址经过同一定位路径。程序滚动期间不把途经章节写回目标地址；已有的细粒度锚点会保留到用户继续滚动。`replaceState` 不触发 `hashchange`，因此模块主动发送 `aimi:sectionchange` 同步语言按钮。只处理同域、同路径、同查询参数的锚点，不拦截内页、另一语言或外部链接。

GitHub Pages 不接收 URL 的 fragment，所有锚点均指向真实 HTML 元素，不使用 hash 路由或 404 重写。禁用 JavaScript 时仍可通过原生锚点浏览全部内容。

## 动画与降级

- 桌面精细指针设备启用 Lenis。`lenis.on('scroll', ScrollTrigger.update)` 同步位置，GSAP ticker 驱动 `lenis.raf(time * 1000)`，并关闭 ticker 的 lag smoothing。一个动画时钟避免两个循环漂移。
- 标题用 Triggered 入场，采用 `play none none reverse`；停止滚动后，动画仍会完成。正文不绑定透明度 scrub。
- 华表云纹和首屏文字以不同幅度的 transform 产生轻微视差，使用 `scrub: true`。足够高的桌面视口短暂 pin 首屏合影；`pinSpacing: false` 不制造额外空白屏。
- 移动布局、粗指针设备和系统的“减少动态效果”使用原生滚动。可检测到的 4 核及以下、4GB 及以下设备，以及省流量模式，也关闭这组动画。检测不到硬件信息时按视口、指针和动态效果偏好判断。
- 系统偏好或视口变化时，GSAP matchMedia 回收样式和 pin，移除 ticker，销毁 Lenis。静态 HTML/CSS 默认可见，即使增强脚本未加载也可阅读。
- 图片预览、搜索弹窗和手机菜单开启时暂停 Lenis，弹窗内部继续原生滚动，关闭后恢复。沿用已有 Esc、焦点恢复和轮播暂停逻辑。
- 不启用可选无限循环，以保留明确的页尾、联系入口和可预测的浏览历史。

## 性能与验收

Vite 输出仅在首页加载，并随公共资源版本更新缓存。当前设置用 transform/opacity，视差元素有限使用 `will-change`；位置缓存通过 ResizeObserver 与 ScrollTrigger refresh 更新，滚动读取合并到一帧。无新增视频、商业参考站图片或远程字体请求。

建议在桌面和手机核对：首屏与长内容可完整阅读；章节导航、直接打开 `/#research` / `/zh/#contact`、前进后退、滚动后语言切换；图片预览和搜索关闭后的滚动；减少动态效果与无 JavaScript 回退。浏览器和设备的实测效果仍应优先于单一跑分，未运行 Lighthouse 时不要声称获得性能分数。

集成依据：[Lenis 官方说明](https://github.com/darkroomengineering/lenis)、[ScrollTrigger 官方文档](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)、[Vite 静态构建](https://vite.dev/guide/build.html)。Lenis 的 MIT 许可随站点发布于 `assets/scroll/lenis-LICENSE.txt`；GSAP 的版权与许可声明保留在 `assets/scroll/gsap-NOTICE.txt`，许可条款见 [GSAP Standard License](https://gsap.com/standard-license/)。
