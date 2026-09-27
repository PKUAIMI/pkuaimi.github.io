# AIMI Lab · Peking University

北京大学医学部医学技术研究院智能医学影像实验室网站。

**网站：<https://pkuaimi.github.io/>**

从 `pkuaimi.com` 全站迁移，保留学术网站的信息结构，并采用克制的白底、深灰文字、酒红强调色与清晰的内容层级重新设计。英文为默认版本，中文版本位于 `/zh/`，可通过页头切换。保留中英文内容、成员照片、研究配图、论文和外部链接，图片已下载到仓库。仅使用 `pkuaimi.github.io`，不配置自定义域名。

## 本地预览

安装 Node.js 22 或更高版本后：

```sh
npm run dev
```

打开 <http://127.0.0.1:4173/>。没有第三方构建依赖，不需要运行 `npm install`。

修改内容后，在另一个终端运行 `npm run build`，然后刷新浏览器。停止预览按 `Ctrl+C`。如端口被占用，可使用 `PORT=4174 npm run dev`。

## 修改内容

| 要修改的内容 | 文件 |
| --- | --- |
| 网站名称、机构、邮箱、联系地址、GitHub 链接 | `site.config.json` |
| 新闻顺序和图片 | `content/news.json` |
| 新闻中英文标题和正文 | `content/news.locales.json` |
| 成员分组、照片、个人主页链接 | `content/people.json` |
| 成员中英文姓名 | `content/people.locales.json` |
| 论文、年份、作者和链接 | `content/publications.json` |
| 研究项目顺序和图片 | `content/research.json` |
| 研究项目中英文标题和说明 | `content/research.locales.json` |
| 首页 About Lab、四个成员详情页中英文正文 | `content/pages.locales.json` |
| 导航、按钮、首页介绍、中文机构与地址等界面文字 | `content/ui.json` |
| 排版、颜色、手机适配 | `public/styles.css` |
| 导航、搜索、列表筛选 | `public/site.js` |
| 首页布局、页面模板及构建规则 | `scripts/build.mjs` |

字段说明见 [内容编辑指南](content/README.md)。JSON 中的 HTML 可以使用 `<p>`、`<a>`、`<strong>`、`<ul>` 等基本标签；修改时注意正确转义双引号。

新图片放到 `public/assets/`，在内容中使用 `/assets/文件名.jpg`。旧站媒体的原图与轻量显示图映射保存在 `content/media-map.json` 和 `content/media-display-map.json`；新增本地图片不需要维护旧站映射。`media-provenance.json` 保存原图来源、尺寸和校验值。

### 添加新闻

复制 `content/news.json` 中一条记录，修改 `id`（须唯一）、`title`、`bodyHtml` 和 `images`，放到数组开头。随后在 `content/news.locales.json` 用同一个 `id` 添加 `en` 和 `zh`，每种语言都填写 `title` 和 `bodyHtml`。页面及搜索索引使用本地化文件中的正文，导入文件中的 `text` 仅是原始记录。日期仅填写有依据的日期；原站部分新闻没有明确发布日期，因此页面保留原顺序，不推测日期。

### 添加成员或个人主页

在 `people.json` 中新增记录，`image` 可以直接填写本地 `/assets/...` 路径，没有个人主页时 `profilePath` 为 `null`。新增详情页时，在 `pages.json` 添加完整页面记录，设置唯一的 `id`、`slug`、`path`、`title`、`html`、`text`；再把成员的 `profilePath` 指向该路径。同时在 `people.locales.json` 添加该成员两种语言的 `name`；有详情页时，在 `pages.locales.json` 用页面 `id` 添加两种语言的 `title` 和 `html`。现有四个个人页的简洁地址映射位于构建脚本中的 `profiles`。

### 添加论文

在 `publications.json` 中增加一条：`citation` 为可检索的完整引文，`html` 为显示正文，`year` 为年份，`section` 使用现有分组。`id` 保持唯一。论文按数据文件顺序展示，并支持年份和关键词筛选。

### 中英文版本

英文使用 `/`、`/news/` 等原有地址；中文使用 `/zh/`、`/zh/news/` 等对应地址。页头切换保留当前页面及新闻、研究项目的定位锚点；导航与搜索结果始终停留在当前语言。直接打开网站根地址默认显示英文。无需浏览器存储或自动重定向。

`*.locales.json` 按内容 `id` 存放 `en` / `zh` 对象；每种语言都必须填写，缺少时构建或检查会报错。新增研究项目也需同步添加 `research.locales.json` 条目。论文正式题名、作者与期刊名称在两个版本中均保留原文，便于检索与引用。英文机构与地址以 `site.config.json` 为准，中文在 `content/ui.json` 的 `zh` 对象中维护。

## 构建、检查和发布

```sh
npm run build
npm run check
git add .
git commit -m "Update lab website"
git push origin main
```

仓库原有 GitHub Pages 设置是 **Deploy from a branch → main → / (root)**，本项目沿用该方式。构建结果同时输出到 `dist/` 和仓库根目录；`dist/` 仅用于本地预览与检查，不提交。提交根目录的 HTML、CSS、JavaScript 和图片后，GitHub Pages 自动发布。

**不要直接修改根目录的生成文件**，下次构建会覆盖它们。修改上表的源文件，然后构建。`generated-files.json` 记录生成文件范围，构建不会清理其他源文件。`.nojekyll` 让 Pages 直接发布静态文件。仓库的工作流会检查构建、内部链接、图片和源文件与生成结果的一致性。

## 迁移范围与记录

- 10 个公开内容页，包含全部 4 个成员个人主页。
- 24 条新闻、20 位成员、21 条论文、4 个研究项目。
- 55 个原始图片；较大的图片另有旧站已有的轻量显示版本。
- 原站路径（包括中文路径和数字形式的成员地址）在新域名下仍能打开，页面指向新的规范地址。
- 原 WordPress 管理后台、登录框和评论提交组件不属于静态站功能。

[迁移清单](content/migration-inventory.json)记录覆盖情况及原站已有的内容差异，例如李萌入组日期的中英文表述不一致、不同页面的联系地址不同。迁移保留这些原文，等待实验室核对，不擅自改写事实。

[migration/source/](migration/source/) 保存此次迁移的公开原始导出，用于追溯和核对。`scripts/import_site.py` 可从这些导出重新提取内容；**正常更新网站不需要重新导入，重新导入会覆盖人工编辑的内容文件**。

## 视觉与交互约定

- 单层导航与统一系统字体；普通内页不重复显示全站侧栏，个人主页保留成员导航。
- 首页开头参考 LME 的学术实验室布局，以左对齐欢迎语、实验室全称、机构归属和团队合影介绍实验室；科研图与新闻图完整展示，不拉伸或裁掉图中文字。
- 新闻图片放在等高容器中，多图优先同排；小屏空间不足时换行。新闻锚点高亮不改变内容宽度。
- 菜单在 900px 及以下折叠，CSS 与 JavaScript 断点必须同步。支持键盘焦点、减少动画及无 JavaScript 导航回退。
- 构建自动按 CSS / JavaScript 内容生成资源版本号，避免改版后继续使用旧缓存。

## 网站功能

- 响应式首页、新闻、成员、研究、论文和联系方式页面。
- 全站中英文切换，英文默认；每种语言都有独立搜索索引、新闻搜索及论文关键词与年份筛选。
- 键盘可操作的导航、移动菜单、搜索弹窗和跳转到正文链接。
- 独立页面、规范地址、网站地图、404 页面及分享元数据。
- 全部站内图片本地托管，构建和访问不依赖旧站、远程字体或外部脚本。
