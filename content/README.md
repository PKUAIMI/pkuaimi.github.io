# AIMI 网站内容

本站内容于 2026-09-28 从 <https://pkuaimi.com/> 的公开 WordPress API 和网站地图迁移。所有内容文件采用 UTF-8；可以直接用代码编辑器维护。

| 文件 | 内容 | 常用字段 |
| --- | --- | --- |
| `pages.json` | 10 个原站页面的完整正文，包括首页、联系页和 4 个成员个人主页 | `title`、`path`、`html`、`images` |
| `news.json` | 24 条新闻，顺序与原站一致 | `title`、`bodyHtml`、`images`、`date`（可选） |
| `people.json` | 20 位成员，保留原分组 | `name`、`group`、`image`、`profilePath`（可选） |
| `publications.json` | 21 条实验室论文记录 | `year`、`section`、`citation`、`html`、`links` |
| `research.json` | 4 个研究项目 | `title`、`descriptionHtml`、`images` |
| `media-manifest.json` | 从原站正文提取的 55 个媒体源文件 | `url`、`aliases`、`sourcePages` |
| `media-map.json` | 原媒体地址到本地文件地址的映射 | 由素材归档步骤生成 |
| `migration-inventory.json` | 页面覆盖清单及需要确认的原站内容差异 | `pages`、`editorialNotes` |

`html`、`bodyHtml`、`descriptionHtml` 保留中文、英文、链接与加粗等基本格式，已移除原页面构建器的布局、脚本、统计代码、后台登录和空社交链接。原站内链已转换为本站路径；原来指向外部论文、学术主页和新闻的链接仍然指向外部页面。新增图片可以放在 `public/assets/` 后，直接将内容中的图片路径设为 `/assets/文件名`。

新闻中的 `date` 仅记录原文明确出现的活动日期，**不是新闻发布日期**。`2026-09` 表示原文仅精确到月。没有明确日期的新闻不填写该字段，不要用图片上传日期或页面更新时间代替。

原站有几处文字差异，例如李萌入组新闻的中文日期为 2026 年 4 月 1 日、英文日期为 2025 年 4 月 1 日。迁移保留原文，详情见 `migration-inventory.json`。确认正确内容后，可直接在相应内容文件中修订。

`migration/source/` 保存原始公开导出，`scripts/import_site.py` 可从该导出重建上述迁移数据；加 `--fetch` 可重新读取旧站。**重新导入会覆盖上述内容文件中的本地修改**，日常更新只需编辑内容文件并重新构建网站，无需重新导入。原始导出用于追溯，日常无需编辑。
