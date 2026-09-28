# 网站日常维护指南

本指南适用于增加新闻、成员、个人页、研究项目和论文。通常只需编辑 `content/` 和添加图片，无需修改构建脚本。

校徽、北大红、字体与华表云纹的维护方式见 [品牌规范](BRAND.md)。

## 1. 一次更新的基本步骤

1. 使用新增命令生成草稿，或在对应 JSON 数组中修改已有条目。
2. 填写中英文内容，把图片放入 `public/assets/`。
3. 运行 `npm run validate:content`，根据错误中指出的文件和字段修正。
4. 用 `npm run dev` 打开本地预览，查看英文、中文和手机宽度下的效果。
5. 发布前运行 `npm run verify`，再提交并推送。

需要 Node.js 22.12 或更高版本。首次运行 `npm install`，自动化环境使用 `npm ci`。以下命令都在仓库根目录执行。

```sh
npm run new -- --help
```

`slug` 是新增内容的简短标识，例如 `welcome-new-students`。只能用小写英文字母、数字和连接词之间的单个连字符。命令会根据内容类型生成完整 `id`，例如 `news-welcome-new-students`。

新增命令会保留原有记录，为新闻、成员、研究和个人页同时准备 `en` / `zh`，论文则准备一份正式引文。生成的 `TODO` 是待填写标记，不能直接发布。只想查看计划时，在命令末尾加 `--dry-run`，不会写入文件。

## 2. 添加新闻

```sh
npm run new -- news website-languages
```

命令将草稿放到 `content/news.json` 数组开头。打开该文件，找到 `news-website-languages`，填写标题和正文。下面是完整条目示例；只替换新条目，保留数组中的其他新闻。

```json
{
  "id": "news-website-languages",
  "images": [],
  "en": {
    "title": "Our website is now available in English and Chinese",
    "bodyHtml": "<p>The AIMI Lab website is now available in English and Chinese.</p><p>Use the language switch in the header to change languages while staying on the same page.</p>"
  },
  "zh": {
    "title": "实验室网站现已支持中英文切换",
    "bodyHtml": "<p>AIMI 实验室网站现已提供英文和中文版本。</p><p>点击页头的语言按钮，即可在当前页面切换语言。</p>"
  }
}
```

新闻标题只写在 `title` 中，正文不必再重复一个相同标题。正文中的每段用 `<p>...</p>` 包住；需要加粗时使用 `<strong>...</strong>`。

### 无图、一张图和多张图

无图新闻使用空数组：

```json
"images": []
```

一张图：先将图片保存为 `public/assets/lab-seminar-2026.jpg`，再填写：

```json
"images": [
  { "url": "/assets/lab-seminar-2026.jpg" }
]
```

多张图按希望的顺序填写：

```json
"images": [
  { "url": "/assets/lab-seminar-2026-1.jpg" },
  { "url": "/assets/lab-seminar-2026-2.jpg" },
  { "url": "/assets/lab-seminar-2026-3.jpg" }
]
```

图片会采用统一的展示容器，保持原图比例，多图在空间足够时同排，小屏幕自动换行。第一张图同时用作首页新闻预览。只需在 `images` 中添加，不要再把同一张图重复插入 `bodyHtml`。

点击新闻页或研究页中的图片，会在当前页面弹出预览。同一条内容的多张图片可用左右按钮或方向键切换，按 Esc 或点击关闭按钮返回。首页合影也采用相同预览，原图仍可通过预览窗中的入口在新标签页打开；新增图片无需单独配置插件。

### 新闻日期与顺序

新闻按 `news.json` 中的顺序展示，首页取最前面的若干条，不根据日期自动重排。调整顺序时移动整个条目，保留 `id`。

日期是可选字段。有明确活动日期时，可在条目中加入：

```json
"date": "2026-09-28",
"dateKind": "event"
```

只知道月份时写 `"2026-09"`；完全不知道日期时省略。`published` 仅用于有明确依据的发布日期。日期字段用于记录信息，不会改变新闻排序。迁移新闻的活动日期与发布日期不同，不要用图片上传时间补齐日期。

## 3. 添加成员和个人主页

### 成员卡片

```sh
npm run new -- member jane-doe
```

编辑 `content/people.json` 中新增的 `person-jane-doe`：

```json
{
  "id": "person-jane-doe",
  "group": "phd",
  "image": "/assets/jane-doe.jpg",
  "profilePath": null,
  "en": { "name": "Jane Doe" },
  "zh": { "name": "Jane Doe" }
}
```

先把真实照片放到 `public/assets/jane-doe.jpg`。姓名使用本人确认的中英文写法；没有中文姓名时可以保留原名。`profilePath: null` 表示只有成员卡片，没有个人详情页。

可用分组如下：

| `group` | 分组 |
| --- | --- |
| `faculty` | 教师 |
| `postdocs` | 博士后 |
| `assistants` | 科研助理 |
| `phd` | 博士研究生 |
| `masters` | 硕士研究生 |
| `visiting` | 访问研究生 |
| `bachelors` | 本科生 |
| `alumni` | 往届成员 |

毕业或转组时修改 `group`，不用删除成员再新建。分组显示顺序由 `content/groups.json` 决定，同组成员按 `people.json` 中的顺序排列。新增分组时，在 `groups.json` 添加唯一 `id` 及对应 `en`、`zh` 名称，再用于成员的 `group`。

### 关联个人主页

```sh
npm run new -- profile jane-doe --member person-jane-doe
```

这会同时完成两件事：在 `content/pages.json` 新增 `/people/jane-doe/`，并将成员的 `profilePath` 设为该地址。之后编辑新页面的 `en.title`、`en.html`、`zh.title`、`zh.html`，填写个人简介、研究方向和联系方式。

`--member` 后填写已有成员的完整 `id`。命令不会覆盖该成员已经设置的个人主页。中文个人页 `/zh/people/jane-doe/`、成员导航和搜索结果会自动生成，无需再添加中文页面记录。

个人页已经有页面大标题，正文从 `<h2>` 小节开始即可。需要照片时，可在正文中加入：

```json
"html": "<figure><img src=\"/assets/jane-doe.jpg\" alt=\"Jane Doe\"></figure><h2>Biography</h2><p>Write the confirmed biography here.</p>"
```

示例中的姓名、照片和简介都应换为实际内容，并同步填写中文版本。

### 添加 Lab Lives 合照

People 页面底部的相册单独维护在 `content/lab-lives.json`，按数组顺序展示。将照片放入 `public/assets/`，然后复制一条记录并填写中英文说明：

```json
{
  "id": "lab-life-summer-gathering",
  "original": "/assets/summer-gathering.jpg",
  "display": "/assets/summer-gathering-web.jpg",
  "year": 2026,
  "en": {
    "caption": "Summer lab gathering",
    "alt": "Lab members together at a summer gathering"
  },
  "zh": {
    "caption": "夏日相聚",
    "alt": "实验室成员夏日相聚合影"
  }
}
```

`original` 用于点击后的大图预览，`display` 是可选的压缩显示图；只有一份图片时省略 `display` 即可。`caption` 是照片下方的活动说明，`alt` 简洁描述画面内容。`year` 只填写已确认的活动年份，不确定时省略，不要根据上传目录推测。建议 `id` 以 `lab-life-` 开头，并保持已有标识不变。

照片会完整显示，桌面端两列、手机端一列。点击后可以在同一相册的照片间切换，不会混入成员肖像。新增照片无需改模板，也无需改首页轮播配置；维护后运行 `npm run verify`。

## 4. 添加研究项目

```sh
npm run new -- research ct-reconstruction
```

在 `content/research.json` 填写两种语言的 `title` 和 `descriptionHtml`，并替换 `images` 中的图片路径。研究项目至少一张图，第一张用于首页研究卡片；研究详情会显示所有图片。

项目按文件顺序展示，新增命令将项目追加到末尾。需要突出某个项目时，移动完整条目到希望的位置。已有项目的 `id` 不变，这样 `/research/#research-ct-reconstruction` 等链接仍然有效。

研究说明可以明确填写空字符串 `""`，适合只有标题和图的项目；不要保留模板中的 `TODO`。

## 5. 添加论文

```sh
npm run new -- publication paper-2026
```

在 `content/publications.json` 填写四个字段：

- `id`：命令已经生成，发布后保持不变。
- `year`：数字年份，例如 `2026`。
- `section`：实验室期间论文用 `AIMI`，此前论文用 `Publications Before AIMI`。
- `html`：完整作者、题名、期刊或会议、年份，以及需要显示的 DOI、论文或代码链接。

论文正式引文保留原文，在中英文页面共用。**只修改 `html` 即可更新显示内容、搜索文本和链接列表**，无需再维护 `citation` 或 `links`。

例如，现有论文格式如下；新增时替换为新论文信息，不要重复添加已有论文：

```json
{
  "id": "publication-example-2026",
  "year": 2026,
  "section": "AIMI",
  "html": "<p><strong>X. Wu</strong>, J. Liu, H. Yu, A. Maier, Y. Huang. Self-Cascade Latent Schrödinger Bridge for CT Field-of-View Extension. <em>Physics in Medicine and Biology</em>. 2026.</p>"
}
```

链接直接写进引文 HTML，例如 `<a href=\"完整论文网址\">Paper</a>`。使用论文实际地址，填写模板里的 DOI 占位符后再发布。

列表先按 `section` 分组，组内遵循文件顺序。新增命令将论文放在文件开头；首页展示文件开头的若干条论文。

## 6. 修改首页和联系信息

| 修改项 | 编辑位置 |
| --- | --- |
| 首页欢迎语、简短介绍、按钮、栏目标题 | `content/ui.json` 中对应的 `en` / `zh` |
| 中英文实验室名称、机构名称、联系地址与网站简介 | `content/ui.json` 中对应的 `en` / `zh` |
| About 实验室正文 | `content/pages.json` 中 `type: "home"` 条目的 `en.html` / `zh.html` |
| 首页轮播合影与 About 插图 | `content/home.json` |
| 首页新闻、论文显示数量 | `home.json` 的 `newsLimit`、`publicationLimit` |
| 网站域名、公共邮箱、GitHub 与仓库链接 | `site.config.json` |

About 正文会完整呈现，不需要把段落放在特殊位置，也不从其他页面自动抽取。`site.config.json` 只保存公共设置；需要翻译的显示文字统一在 `ui.json` 中维护，避免同时修改多个文件。

`home.json` 的 `hero` 数组控制首页轮播，按数组顺序播放。例如：

```json
"hero": [
  {
    "original": "/assets/lab-group-2026.jpg",
    "display": "/assets/lab-group-2026-web.jpg",
    "width": 1920,
    "height": 1080,
    "altKey": "teamPhotoAlt",
    "captionKey": "heroLabCaption"
  }
]
```

`original` 是点击后打开的原图，`display` 是页面加载的显示图；两者也可以指向同一个文件。`width` 和 `height` 填显示图的实际像素尺寸。更换图片时先把两个文件放进 `public/assets/`。

`altKey` 和 `captionKey` 引用 `ui.json` 中的中英文图片说明。添加照片时向 `hero` 追加完整对象即可；第一张同时用于网页分享预览。两张及以上会显示切换和播放/暂停按钮，每 6 秒切换；手动切换、键盘进入照片或系统设置减少动态效果时停止自动播放。鼠标悬停、大图预览、页面隐藏或滚出屏幕时暂时暂停。只有一张时显示普通图片，无 JavaScript 时仍可横向滚动查看照片。

About 区域的 `gallery` 每项包含 `url`、`altKey`、`captionKey`，可选 `eyebrowKey`（类别）和 `descriptionKey`（简介）。这些文字键引用 `ui.json`；修改时同步填写中英文。当前展示实验室图腾“硅基生命树”，原图为 `public/assets/brand/silicon-based-tree-of-life.png`，保留老师提供的透明背景与原色。`newsLimit` 和 `publicationLimit` 必须是大于零的整数。

## 7. 图片、链接与 JSON 写法

新图片统一放在 `public/assets/`。建议使用容易辨认的小写英文文件名，如 `seminar-2026-09.jpg`；内容中写 `/assets/seminar-2026-09.jpg`，不写 `public/`，也不写电脑上的绝对路径。

大图可以先准备较小的显示版本再上传。新增本地图片不需要修改旧站的 `media-map.json` 等归档映射。更新图片时优先使用新文件名，再修改内容中的路径，便于区分版本。

站内链接使用英文规范地址，例如 `<a href=\"/people/\">Our team</a>`。构建中文版时会自动转换到对应中文地址；外部论文链接和邮箱保持原地址。

JSON 的几个常见规则：

- 字段名和文字使用英文双引号；字符串内部双引号写成 `\"`。
- 同级字段与数组条目之间用逗号隔开，最后一项后不加逗号。
- JSON 中不能写注释。多段正文可以写成一个字符串中的多个 `<p>`。
- 用两个空格缩进，与现有文件保持一致。修改已有条目时，不必重新输入整个文件。

使用 VS Code 打开整个仓库时，内置的本地 JSON Schema 会提供中文字段说明、必填提示和拼写检查。使用其他编辑器也可以通过 `npm run validate:content` 检查；不需要安装额外插件。

## 8. 保持已有链接有效

新闻、成员、研究和论文的 `id` 会用于页面定位链接。发布后修改内容或标题，不要更换 `id`。

页面的 `path` 是规范地址，`aliases` 是保留的旧地址。首页和现有栏目的地址保持不变。个人页确实需要改地址时：

1. 将旧 `path` 加到该页面的 `aliases` 数组，保留已有别名。
2. 填写新 `path`，以 `/` 开头和结尾，例如 `/people/new-name/`。
3. 同步修改对应成员的 `profilePath`，让它指向新规范地址。
4. 运行 `npm run verify`，检查地址冲突和链接。

旧地址会继续打开默认英文页，并声明新的规范地址。中文地址由系统自动生成，不放进 `aliases`。`/zh/`、`/assets/` 等系统目录不能用作新页面地址。

如需额外的普通正文页，可在 `pages.json` 添加 `type: "page"`、唯一 `id`、`path`、`aliases` 以及完整 `en/zh.title`、`en/zh.html`。构建会自动加入两种语言页面、搜索和站点地图；新增页面不会自动增加顶栏导航项，可先从已有正文中添加链接。

## 9. 预览与检查

```sh
npm run dev
```

打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。保存内容、模板或样式后，预览会自动重新构建并刷新。如果内容尚未填完或出现错误，保留上一次正常预览，终端会提示需要修正的位置；修正并保存后继续更新。

按 `Ctrl+C` 停止预览。端口被占用时，可用 `PORT=4174 npm run dev`，然后打开相应地址。也可随时单独运行 `npm run build` 重新生成页面。

建议看一遍英文与中文内容，确认图片清晰、链接正确，再缩窄窗口检查手机排版。语言切换保留当前页面和定位位置，列表筛选与全站搜索也应显示当前语言。

| 命令 | 用途 |
| --- | --- |
| `npm run validate:content` | 快速检查 JSON 字段、双语、图片、地址与关联，不写生成页面 |
| `npm run build` | 根据源文件重新生成网站 |
| `npm run check` | 检查已经生成的页面、链接、图片、语言、搜索和站点地图 |
| `npm run test` | 运行维护工具和内容规则的测试 |
| `npm run verify` | 一次完成测试、构建和页面检查，发布前使用 |

报错会标出文件、条目和字段。例如 `content/news.json [news-website-languages] · zh.bodyHtml` 表示这条新闻的中文正文需要修正；图片不存在时，先检查 `public/assets/` 中的文件名，包括大小写。

未完成的 `TODO`、缺少译文、非法日期、重复地址或图片缺失会阻止构建。修正源文件后重新运行检查即可。

## 10. 发布到 GitHub Pages

确认当前内容已完成后执行：

```sh
npm run verify
git status
git add .
git commit -m "Update lab website"
git push origin main
```

先查看 `git status`，确认本次文件都是希望提交的更新。构建结果同时写入仓库根目录和 `dist/`；根目录的生成文件要和源文件一同提交，`dist/` 已排除，不提交。

GitHub Pages 设置保持 **Deploy from a branch → main → / (root)**。推送后可在仓库的 Actions 页面查看检查和部署结果，再访问 [pkuaimi.github.io](https://pkuaimi.github.io/) 确认新内容。站点仅使用该域名，不添加 `CNAME`。

不要直接修改根目录的 HTML、CSS、JavaScript 或 `assets/`：下一次构建会覆盖它们。公共样式与交互源文件是 `public/styles.css` 和 `public/site.js`；首页分屏排版在 `public/home.css`，滚动交互在 `src/browser/home-scroll.ts`，见 [滚动交互说明](SCROLLING.md)。

## 11. 迁移记录如何处理

`migration/source/` 保存原站公开导出，`content/migration-inventory.json` 记录原站已有的内容差异。确认事实后可直接修改当前内容中的两种语言，不要根据旧站上传日期猜测新闻时间。

日常维护不需要运行导入脚本。需要重新比较原始内容时，`scripts/import_site.py` 只会把结果写入 `migration/imported/`，不会覆盖当前 `content/`。这些导入结果是比较材料，不是直接用于发布的新内容格式。
