# luna-site

[![CI](https://github.com/labuno/luna-site/actions/workflows/ci.yml/badge.svg)](https://github.com/labuno/luna-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**面向博客、小说与项目的文件优先静态站点引擎 —— 程序开源、内容私有、发布可复现。**

luna-site 是 [LunaFoundry](https://github.com/labuno) 的站点引擎：它从**独立的私有内容仓库**
渲染出一个快速、带全文搜索的静态网站。内容始终是 Git 中的 Markdown / YAML / 媒体文件，
本仓库只保存站点代码；两者不共享 Git 历史，每次部署都绑定到明确的内容 commit，可复现、可回滚。

[English README](./README.md)

![首页](docs/assets/demo-home.webp)

| 带目录的博客文章 | 小说章节阅读页 |
| --- | --- |
| ![文章](docs/assets/demo-article.webp) | ![阅读](docs/assets/demo-reader.webp) |

*截图使用 [`examples/`](./examples) 内置的虚构演示内容（`npm run dev:demo`）。*

## 功能

- **博客 / 小说 / 项目**：文章列表支持栏目与标签过滤，小说支持分卷与章节，项目以卡片呈现。
- **无后端全文搜索**：构建期生成 [Pagefind](https://pagefind.app) 索引，`⌘/Ctrl + K` 直达搜索页。
- **阅读体验**：暗色/亮色主题、中文优先排版（无衬线标题 + 衬线正文）、章节页可调字号、本章目录。
- **草稿安全**：`draft: true` 不会进入页面、RSS、Sitemap 与搜索索引，构建后由 CI 断言。
- **SEO 与订阅**：canonical、Open Graph、JSON-LD（BlogPosting / Book）、RSS、Sitemap、robots.txt。
- **可复现发布**：部署绑定内容 commit SHA，任意历史版本可重发。
- **Hosting 无关**：`dist/` 是纯静态文件，默认发布到 GitHub Pages，也可原样托管到任意静态主机或 Nginx。

## 工作原理

```text
luna-ore（私有）                            luna-site（本仓库，公开）
content/blog/**  novels/**  projects/**          Astro 页面、组件、Schema
media/**                                         scripts/、tests/、workflows
        │                                                    ▲
        │ push main                                          │ workflow_dispatch(content_ref=<SHA>)
        ▼                                                    │
  notify-site.yml ───────────────────────────────────────────┘
                              （只做触发）
                                       │
                                       ▼
                     deploy-pages.yml：checkout site + content@<SHA>
                                       │
              content:sync → validate → astro check → build
                                       │
                        pagefind --site dist → dist/pagefind/
                                       │
                   check:dist（断链 / 草稿 / 索引断言）→ GitHub Pages
```

内容仓库与本仓库不共享 Git 历史；只有本仓库的 workflows（通过两个 Fine-grained PAT）能读取它。

## 快速开始

要求 Node ≥ 22.12（CI 固定 24）。

```bash
npm install
npm run dev:demo        # 用内置演示内容运行站点，无需任何 Secret
```

只开发站点引擎时不需要更多东西。要用真实内容预览，把内容仓库保持在同级目录 `luna-ore`
（或用 `CONTENT_SOURCE_DIR` 指向它）：

```bash
npm run content:sync -- ../luna-ore
npm run dev
```

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（使用现有 `content/` 工作区） |
| `npm run dev:demo` | 同步 `examples/` 并启动开发服务器 |
| `npm run content:sync -- <dir>` | 把内容仓库同步到工作区（每次先清空陈旧文件） |
| `npm run content:demo` | 用 `examples/` 覆盖工作区内容 |
| `npm run validate:content` | 校验 Schema、slug、章节号、媒体与草稿清单 |
| `npm run check` | `astro check` 类型与 Schema 检查 |
| `npm run build` | `astro build` + Pagefind 索引 |
| `npm run check:dist` | 构建产物断言：断链、锚点、草稿、RSS/Sitemap/索引 |
| `npm run test` | `node:test` 单元测试与工作流约束测试 |
| `npm run build:demo` | 完整流程：Demo 内容校验 + 构建 + dist 断言 |

> 未检出同级 `luna-ore` 时（公开 CI、或只克隆了本仓库的贡献者），涉及内容仓库的测试会自动跳过。

## 内容模型

内容位于内容仓库，构建时同步进（已被 gitignore 的）`content/` 与 `public/media/` 工作区：

- `content/blog/<year>/*.md` —— 博客文章
- `content/novels/<slug>/novel.yaml` 与 `content/novels/<slug>/<volume-dir>/*.md` —— 小说与章节
- `content/projects/*.yaml` —— 项目条目
- `media/**` —— 媒体文件，正文中以 `/media/...` 引用

完整字段参考与校验规则见 [docs/CONTENT-SCHEMA.md](./docs/CONTENT-SCHEMA.md)。

## 配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `SITE_URL` | `https://labuno.github.io` | canonical 与 RSS / Sitemap 的站点源 |
| `BASE_PATH` | `/luna-site/` | 部署子路径；自定义域名时用 `/` |
| `CONTENT_SOURCE_DIR` | `../luna-ore` | `content:sync` 的默认来源目录 |

站点身份（名称、标题、描述、作者、语言）在 [`src/site.config.ts`](./src/site.config.ts)。

## 部署

push 到 `main` 即触发 [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml)：按
`content_ref`（默认 `main`；内容仓库的触发工作流会传入精确 SHA）checkout 私有内容仓库 →
同步与校验 → 类型检查 → Astro 构建 → Pagefind 索引 → 产物断言 → 发布到 GitHub Pages。

仓库创建、Variables/Secrets 配置与回滚命令见 [docs/GITHUB-CLI.md](./docs/GITHUB-CLI.md)。

任意静态主机均可托管，构建是唯一要求：

```bash
npm ci
npm run content:sync -- /srv/luna-ore
npm run validate:content && npm run build && npm run check:dist
rsync -az --delete dist/ deploy@host:/srv/www/site/
```

## 目录结构

```text
luna-site/
├── .github/workflows/     # ci.yml（Demo 内容）+ deploy-pages.yml（私有内容）
├── docs/                  # 设计基线、运维指南、内容 Schema、截图
├── examples/              # 虚构演示内容（随本仓库分发）
├── content/               # gitignore 构建工作区（由 content:sync 注入）
├── public/media/          # gitignore 媒体工作区
├── scripts/               # 内容流水线与仓库初始化工具
├── src/
│   ├── components/ layouts/ pages/ scripts/ styles/ utils/
│   ├── lib/               # 纯逻辑，node:test 直接测试
│   ├── content.config.ts  # 内容 Schema（blog / novels / chapters / projects）
│   └── site.config.ts
└── tests/                 # node:test 测试与工作流约束
```

## 参与开发

欢迎提 Issue 与 PR。提交前请运行：

```bash
npm run test
npm run build:demo     # 校验 + 构建 + dist 断言
```

`ci.yml` 只使用 `examples/`、不引用任何 Secret，因此 fork 可以直接跑通全部测试。
请勿提交正式内容：`content/` 与 `public/media/` 是构建工作区，已被 gitignore。

## 许可

- 站点引擎代码：[MIT](./LICENSE)
- `examples/` 内置演示内容：虚构，随 MIT 许可分发
- 正式内容存于独立私有仓库，**不**受本许可覆盖 —— 见 [NOTICE.md](./NOTICE.md)

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/CONTENT-SCHEMA.md](./docs/CONTENT-SCHEMA.md) | 内容字段与校验规则 |
| [docs/GITHUB-CLI.md](./docs/GITHUB-CLI.md) | 建仓、Variables/Secrets、发布与回滚 |
| [docs/DESIGN-V1.md](./docs/DESIGN-V1.md) | 设计基线 V1.0 |
| [docs/MULTI-ACCOUNT.md](./docs/MULTI-ACCOUNT.md) | 多 GitHub 账号的维护者机器配置 |

## 已知说明

- Astro 7 的 Markdown 管线不再内置 unified，使用 remark 插件需显式依赖
  `@astrojs/markdown-remark`（已加入 dependencies）。
- Pages actions 有意固定在（configure-pages v5 / upload-pages-artifact v4 / deploy-pages v4），
  升级前应先在 CI 验证。
- Pagefind 对 `zh-cn` 不做词干还原（stemming），中文搜索按分词匹配，属预期行为。
