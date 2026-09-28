# AIMI Lab · Peking University

北京大学医学部医学技术研究院智能医学影像实验室网站：**[pkuaimi.github.io](https://pkuaimi.github.io/)**。

英文为默认版本，中文位于 `/zh/`。日常维护只需修改 `content/` 中的内容和 `public/assets/` 中的图片，不需要修改页面模板。每条新闻、成员、研究和个人页的英文与中文放在同一条记录中。

## 开始维护

安装 Node.js 22.12 或更高版本，在仓库目录运行 `npm install`（自动化环境使用 `npm ci`）。首页交互由 Vite + TypeScript 构建，使用 GSAP / ScrollTrigger 与 Lenis，内容页面继续由静态模板生成。

```sh
npm install

# 查看新增内容的命令
npm run new -- --help

# 新增新闻草稿，然后在提示的文件中填写中英文内容
npm run new -- news welcome-new-students

# 检查内容格式与图片路径
npm run validate:content

# 启动本地预览
npm run dev
```

预览地址为 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。保存修改后自动重新构建并刷新；内容有误时保留上一次正常预览，终端显示具体错误。草稿里的 `TODO` 需要全部填写后才能构建。

完整操作与可复制示例见 **[日常维护指南](docs/MAINTENANCE.md)**；字段速查见 [内容说明](content/README.md)；修改页面结构时阅读 [代码结构说明](docs/ARCHITECTURE.md)。

## 常用文件

| 要修改的内容 | 源文件 |
| --- | --- |
| 新闻中英文标题、正文、配图与顺序 | `content/news.json` |
| 成员姓名、照片、分组与个人页链接 | `content/people.json` |
| 成员分组名称与显示顺序 | `content/groups.json` |
| 研究项目中英文介绍与配图 | `content/research.json` |
| 论文引文、年份与分组 | `content/publications.json` |
| 首页 About、个人页正文、页面地址与旧地址 | `content/pages.json` |
| 首页合影、图库、新闻与论文展示数量 | `content/home.json` |
| 导航、按钮、首页欢迎语、机构名称与地址等中英文文字 | `content/ui.json` |
| 网站域名、公共邮箱、GitHub 与仓库链接 | `site.config.json` |
| 图片文件 | `public/assets/` |
| 颜色、排版与手机适配 | `public/styles.css` |

## 检查和发布

```sh
npm run verify
git add -u
# 新图片及新源文件需另外明确添加，勿提交无关原始素材。
git commit -m "Update lab website"
git push origin main
```

`verify` 会运行测试、重新构建并检查页面。通过后，同时提交源文件和生成结果。GitHub Pages 沿用 **Deploy from a branch → main → / (root)**，推送后自动发布。

根目录的 HTML、`styles.css`、`site.js`、`assets/`、`zh/` 等是生成结果，请编辑上表中的源文件。`dist/` 用于本地预览，不提交；`generated-files.json` 由构建维护。网站只使用 `pkuaimi.github.io`，不配置 `CNAME`。

## 全屏滚动首页

首页章节依次为 `#home`、`#updates`、`#research`、`#about`、`#contact`。章节导航支持直接链接和前进后退，滚动时同步地址；切换语言保留章节。手机、低资源设备及减少动态效果模式使用原生滚动。内页保持普通阅读方式。

排版维护在 `public/home.css`，滚动逻辑在 `src/browser/home-scroll.ts`。具体集成、降级和验收方法见 [滚动交互说明](docs/SCROLLING.md)。构建仍输出纯静态文件，沿用 GitHub Pages 的 `main /` 发布方式。

## 迁移记录

原站 [pkuaimi.com](https://pkuaimi.com/) 的公开内容、图片和旧页面地址均已迁移。原始导出保存在 [`migration/source/`](migration/source/)，已知原文差异记录在 [`content/migration-inventory.json`](content/migration-inventory.json)。

`scripts/import_site.py` 仅将重新提取的数据写入 `migration/imported/`，用于人工比较，不覆盖日常维护的 `content/`。正常更新网站不需要重新导入。
