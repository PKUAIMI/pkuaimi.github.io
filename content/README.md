# 内容文件速查

日常新增步骤和完整示例见 [维护指南](../docs/MAINTENANCE.md)。这些文件均为 UTF-8 JSON：数组中的一项就是一条内容，英文 `en` 与中文 `zh` 在同一项内维护。

## 可编辑内容

| 文件 | 每条记录的主要字段 |
| --- | --- |
| `news.json` | `id`、`images`、`en/zh.title`、`en/zh.bodyHtml`；可选 `date`、`dateKind` |
| `people.json` | `id`、`group`、`image`、`profilePath`、`en/zh.name` |
| `groups.json` | `id`、`en`、`zh`；数组顺序决定成员分组顺序 |
| `research.json` | `id`、`images`、`en/zh.title`、`en/zh.descriptionHtml` |
| `publications.json` | `id`、`year`、`section`、`html` |
| `pages.json` | `id`、`type`、`path`、`aliases`；首页和正文页另有 `en/zh.title`、`en/zh.html` |
| `home.json` | `hero`、`gallery`、`newsLimit`、`publicationLimit` |
| `ui.json` | `en`、`zh` 两组界面文字、机构名称与地址，键名一一对应 |
| `templates/` | 新增命令使用的 JSON 草稿模板，含待替换的 `TODO` |

公共网址、邮箱、GitHub 与仓库链接在根目录的 `site.config.json`；中英文显示文字在本目录的 `ui.json` 中维护。

### 通用约定

- `id` 是稳定标识。修改标题、姓名或顺序时保留原 `id`，避免已有链接失效。
- 新闻、成员、研究与正文页的 `en` / `zh` 都要填写。正式论文引文只写一份，在两种语言中共用。
- `html`、`bodyHtml`、`descriptionHtml` 支持 `<p>`、`<h2>`、`<h3>`、`<a>`、`<strong>`、`<ul>` 等 HTML。JSON 字符串里的双引号写作 `\"`。
- 图片先放进 `public/assets/`，再填写 `/assets/文件名.jpg`。新闻可以没有图；研究项目至少一张图，第一张用于首页。
- 列表顺序由数组顺序决定，不按 `id` 或日期自动排序。成员先按 `groups.json` 分组，再按 `people.json` 中的顺序排列。
- 不维护手写的搜索文本。论文的 `citation`、`links` 和各页面搜索索引均从正文自动生成。

### 页面与个人主页

`type` 可为 `home`、`news`、`people`、`research`、`publications`、`contact`、`profile` 或 `page`。前六种对应现有首页与栏目，`profile` 用于成员个人页，`page` 用于普通正文页。

`path` 是英文规范地址，例如 `/people/jane-doe/`。中文地址自动生成 `/zh/people/jane-doe/`，不要再添加一条中文页面记录。`aliases` 保存需要继续支持的旧英文地址，没有时填 `[]`。成员的 `profilePath` 指向规范 `path`；没有个人页时填 `null`。

首页 `type: "home"` 条目的 `en.html` / `zh.html` 就是 About 正文，会完整呈现。首页其他文案在 `ui.json`，图片和展示数量在 `home.json`。

### 日期与论文

新闻日期可写 `YYYY-MM-DD` 或 `YYYY-MM`，不知道时省略 `date`。`dateKind: "event"` 表示活动日期，`"published"` 表示有明确依据的发布日期。原站导入的日期属于活动日期，不应当作发布日期，也不要根据图片上传时间推测。

论文 `year` 使用数字，例如 `2026`；`section` 只用 `AIMI` 或 `Publications Before AIMI`。作者、题名、期刊及链接都在 `html` 中编辑，搜索文本和链接列表自动提取。

## 归档和来源记录

以下文件用于保留旧站素材与迁移依据，普通新增内容无需修改：

| 文件 | 用途 |
| --- | --- |
| `media-map.json` | 旧站图片地址到本站原图的映射 |
| `media-display-map.json` | 旧站图片地址到较小显示图的映射 |
| `media-manifest.json` | 迁移素材清单 |
| `media-provenance.json` | 原图来源、尺寸与校验信息 |
| `migration-inventory.json` | 原页面覆盖情况与待核对的内容差异 |

[`migration/source/`](../migration/source/) 保留原始公开导出。重新运行导入工具只会生成 `migration/imported/` 下的比较材料，不会覆盖本目录。

编辑后运行 `npm run validate:content`；发布前运行 `npm run verify`。错误会指出文件、条目 `id` 和需要修改的字段。
