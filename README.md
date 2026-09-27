# AIMI Lab · Peking University

北京大学医学部医学技术研究院智能医学影像实验室网站。

**网站：<https://pkuaimi.github.io/>**

从 `pkuaimi.com` 全站迁移，参考 FAU LME 的深蓝、白底、直角布局和学术信息层次重新设计。保留中英文正文、成员照片、研究配图、论文和外部链接，图片已下载到仓库。仅使用 `pkuaimi.github.io`，不配置自定义域名。

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
| 新闻及中英文正文 | `content/news.json` |
| 成员分组、姓名、照片、个人主页链接 | `content/people.json` |
| 论文、年份、作者和链接 | `content/publications.json` |
| 研究项目标题、说明和图片 | `content/research.json` |
| 首页 About Lab 原文、四个成员详情页正文 | `content/pages.json` 中对应页面的 `html` |
| 排版、颜色、手机适配 | `public/styles.css` |
| 导航、搜索、列表筛选 | `public/site.js` |
| 首页布局、页面模板及构建规则 | `scripts/build.mjs` |

字段说明见 [内容编辑指南](content/README.md)。JSON 中的 HTML 可以使用 `<p>`、`<a>`、`<strong>`、`<ul>` 等基本标签；修改时注意正确转义双引号。

新图片放到 `public/assets/`，在内容中使用 `/assets/文件名.jpg`。旧站媒体的原图与轻量显示图映射保存在 `content/media-map.json` 和 `content/media-display-map.json`；新增本地图片不需要维护旧站映射。`media-provenance.json` 保存原图来源、尺寸和校验值。

### 添加新闻

复制 `content/news.json` 中一条记录，修改 `id`（须唯一）、`title`、`bodyHtml` 和 `images`，放到数组开头。构建时根据正文自动生成搜索内容，导入文件中的 `text` 是原始文本记录。日期仅填写有依据的日期；原站部分新闻没有明确发布日期，因此页面保留原顺序，不推测日期。

### 添加成员或个人主页

在 `people.json` 中新增记录，`image` 可以直接填写本地 `/assets/...` 路径，没有个人主页时 `profilePath` 为 `null`。新增详情页时，在 `pages.json` 添加完整页面记录，设置唯一的 `id`、`slug`、`path`、`title`、`html`、`text`；再把成员的 `profilePath` 指向该路径。现有四个个人页的简洁地址映射位于构建脚本中的 `profiles`。

### 添加论文

在 `publications.json` 中增加一条：`citation` 为可检索的完整引文，`html` 为显示正文，`year` 为年份，`section` 使用现有分组。`id` 保持唯一。论文按数据文件顺序展示，并支持年份和关键词筛选。

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

## 网站功能

- 响应式首页、新闻、成员、研究、论文和联系方式页面。
- 中英文关键词站内搜索、新闻搜索、论文关键词与年份筛选。
- 键盘可操作的导航、移动菜单、搜索弹窗和跳转到正文链接。
- 独立页面、规范地址、网站地图、404 页面及分享元数据。
- 全部站内图片本地托管，构建和访问不依赖旧站、远程字体或外部脚本。
