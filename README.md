# luna-site

LunaFoundry 的网站程序仓库（Public）。Astro + Pagefind 静态站点，内容来自私有仓库
`lunafoundry/luna-ore`，构建时注入并部署到 GitHub Pages（后续可无痛迁移到 VPS/Nginx）。

- 内容唯一事实源：Markdown / YAML / 媒体文件 + Git
- 程序公开、内容私有：真实内容不进入本仓库的 Git 历史
- 每次发布绑定明确的 `content` commit SHA，可复现、可回滚
- Hosting Agnostic：除 `deploy-pages.yml` 外，业务代码不依赖 GitHub Pages 专有能力

## 架构

```text
lunafoundry/luna-ore (Private)                lunafoundry/luna-site (Public)
content/blog/*.md  novels/**  projects/*.yaml       Astro 页面 / 组件 / Schema
media/**                                            scripts/ + Pagefind + CI
        │                                                   ▲
        │ push main                                         │ workflow_dispatch(content_ref=SHA)
        ▼                                                   │
  notify-site.yml ──────────────────────────────────────────┘
                        （仅触发，不做构建）
                                    │
                                    ▼
                    deploy-pages.yml：checkout site + content@SHA
                                    │
                    content:sync → validate → astro check → build
                                    │
                              astro build → dist/
                                    │
                    pagefind --site dist → dist/pagefind/
                                    │
                    check:dist（断链 / 草稿泄漏 / 索引断言）
                                    │
                              GitHub Pages
```

## 目录结构

```text
luna-site/
├── .github/workflows/
│   ├── ci.yml                 # PR/CI：仅用 examples 的 Demo 内容，无需任何 Secret
│   └── deploy-pages.yml       # main 部署：checkout 私有内容 @ 指定 SHA
├── examples/                  # Demo 内容（虚构，随 MIT 分发）
│   ├── content/{blog,novels,projects}/
│   └── media/
├── content/                   # 构建工作区：由私有仓库注入（.gitignore，禁止提交）
├── public/media/              # 构建工作区：媒体注入点（.gitignore，禁止提交）
├── scripts/
│   ├── sync-content.mjs       # 同步私有内容 → 工作区
│   ├── validate-content.mjs   # 校验 Schema/slug/章节号/媒体/草稿清单
│   └── check-links.mjs        # dist 断言：断链、anchor、草稿泄漏、索引
├── src/
│   ├── lib/                   # 纯逻辑（可被 node:test 直接测试）
│   ├── components/ layouts/ pages/ scripts/ styles/ utils/
│   ├── content.config.ts      # Content Schema（blog / novels / chapters / projects）
│   └── site.config.ts
└── tests/                     # node:test 单元与工作流测试
```

## 本地开发

要求 Node ≥ 22.12（CI 固定 24）。

```bash
npm install

# 只用 Demo 内容（外部贡献者/无私有仓库权限时）
npm run dev:demo

# 使用真实私有内容（两个仓库保持同级目录）
git clone git@github.com:lunafoundry/luna-site.git
git clone git@github.com:lunafoundry/luna-ore.git
cd luna-site
npm run content:sync -- ../luna-ore
npm run dev
```

常用命令：

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器（使用 `content/` 工作区现有内容） |
| `npm run content:sync -- ../luna-ore` | 把私有内容同步到工作区（每次先清空） |
| `npm run content:demo` | 用 `examples/` 覆盖工作区内容 |
| `npm run validate:content` | 内容校验：必填字段、slug/章节唯一、媒体存在、草稿清单 |
| `npm run check` | `astro check` 类型与 Schema 检查 |
| `npm run build` | `astro build` + `pagefind --site dist` |
| `npm run test` | node:test 单元测试（含工作流约束测试） |
| `npm run check:dist` | 构建后断言：断链、锚点、草稿泄漏、Pagefind/Sitemap/RSS |
| `npm run build:demo` | 内容校验 + 构建 + dist 断言的完整流程（Demo 内容） |

## 内容 Schema

### Blog（`content/blog/<year>/<file>.md`）

```yaml
title: "标题"
slug: "stable-url-slug"     # URL 使用该字段，文件改名不影响链接
description: "摘要（列表、搜索、SEO）"
date: 2026-09-20
updated: 2026-09-20          # 可选
section: "AI"                # 一级栏目
category: "Agent"            # 二级分类
tags: ["Runtime", "MCP"]     # 横向标签
cover: "/media/blog/agent-runtime/cover.webp"   # 可选
featured: false
draft: false                 # true 不生成页面/RSS/Sitemap/搜索索引
```

### Novel（`content/novels/<slug>/novel.yaml`）

`title` `slug` `author` `status`(serializing|completed|paused) `description` `genres[]` `tags[]`
`cover?` `created` `updated` `featured`

### Chapter（`content/novels/<slug>/<volume-dir>/<NNN>.md`）

`title` `novel`(小说 slug) `slug` `volume` `chapter`(正整数) `published` `tags[]` `draft`

### Project（`content/projects/<name>.yaml`）

`title` `description` `url?` `repo?` `status`(idea|building|active|archived) `tags[]` `featured`

校验规则：必填字段缺失、slug 重复、同一小说章节号或章节 slug 重复、`novel` 引用不存在、
分类/标签 slug 冲突、`cover` 与正文内 `/media/...` 引用缺失 → 校验失败，构建中止。

## 分类、标签与 URL

- 展示名称与 URL slug 解耦：URL 一律使用 slug（中文保留字符、英文小写连字符）。
- 重命名展示名而保持旧链接：在 `src/lib/taxonomy-overrides.mjs` 中加一条
  `'old-slug': '新展示名'`。
- `/tags/{slug}/` 聚合博客、小说、章节与项目的标签；`/categories/{slug}/` 聚合二级分类；
  博客列表支持 `?section=` 与 `?tags=a,b`（AND 组合，客户端即时过滤，URL 可分享）；
  小说书架支持 `?genre=`。

## 设计文档

- [`docs/DESIGN-V1.md`](./docs/DESIGN-V1.md)：设计基线 V1.0 的 Markdown 版本
  （与 `LunaFoundry_双仓库网站系统设计与开发交付文档_V1.0.docx` 内容一致，由
  `docs/tools/docx-to-markdown.py` 转换，原件为签署版）。
- [`docs/GITHUB-CLI.md`](./docs/GITHUB-CLI.md)：建仓、配置 Variables/Secrets、发布与回滚命令。

## 部署到 GitHub Pages（第一阶段）

首次创建仓库、配置 Variables/Secrets、首次发布与日常发布的完整命令见
[`docs/GITHUB-CLI.md`](./docs/GITHUB-CLI.md)。也可以直接运行两个幂等脚本：

```bash
./scripts/bootstrap-github.sh    # 创建两个仓库、写入 Variables、推送、开启 Pages(Actions)
./scripts/configure-secrets.sh   # 交互式写入两个最小权限 PAT 并触发首次部署
```

这里是要点：

1. `luna-site` 为 Public，`content` 为 Private。
2. `luna-site` Variables：`CONTENT_REPOSITORY`、`SITE_URL`、`BASE_PATH`。
   `luna-site` Secret：`CONTENT_REPO_TOKEN`（Fine-grained，content: Contents Read）。
3. `content` Variables：`SITE_REPOSITORY`；Secret：`SITE_WORKFLOW_TOKEN`
   （Fine-grained，luna-site: Actions Write）。
4. Pages Source 选择 **GitHub Actions**，`deploy-pages.yml` 使用 `github-pages` environment。
5. 默认地址 `https://lunafoundry.github.io/luna-site/`（`BASE_PATH=/luna-site/`）。

发布链路：`content` push → `notify-site.yml`（只触发，传递 `GITHUB_SHA`）→
`deploy-pages.yml` checkout `content@SHA` → sync → validate → build → check:dist → Pages。

回滚与重发（不需要改内容）：

```bash
# 重发某个内容版本
gh workflow run deploy-pages.yml --repo lunafoundry/luna-site \
  -f content_ref=<CONTENT_SHA> -f reason=manual-redeploy

# 重发某个站点代码版本
gh workflow run deploy-pages.yml --repo lunafoundry/luna-site --ref <SITE_SHA>

gh run list --repo lunafoundry/luna-site --limit 10
gh run view <RUN_ID> --repo lunafoundry/luna-site --log-failed
```

## Base Path 与自定义域名

所有站内链接、媒体 URL、RSS、Sitemap、canonical 都通过 `sitePath()` 生成；Markdown 中的
`/media/...`、`/blog/...` 由 `src/lib/remark-base-path.mjs` 在构建期按 `BASE_PATH` 重写。

- GitHub Pages 项目站点：`SITE_URL=https://lunafoundry.github.io`、`BASE_PATH=/luna-site/`
- 绑定自定义域名：`SITE_URL=https://你的域名`、`BASE_PATH=/`
- 内容文件与 URL 结构都不需要修改。

## 安全与版权

- `content/` 与 `public/media/` 是构建工作区，已在 `.gitignore` 中排除；
  `deploy-pages.yml` 构建后会执行 `git status --porcelain` 断言，防止私有内容被提交。
- 两个 PAT 都是 Fine-grained 最小权限；token 不进入代码、日志或前端变量。
- `examples/` 内容为虚构示例，随 MIT 分发；正式内容版权归 LunaFoundry 所有，不随代码许可授权。
- 依赖锁定：提交 `package-lock.json`，CI 使用 `npm ci`。

## 迁移到 VPS / Nginx（第二阶段）

只需要替换部署环节，内容、页面、搜索、URL 全部不变：

```bash
npm ci
npm run content:sync -- /srv/lunafoundry/luna-ore
npm run validate:content && npm run build && npm run check:dist
# dist/ 可直接由 Nginx 托管
rsync -az --delete dist/ deploy@vps:/srv/www/lunafoundry/
```

- 保持同一个域名与 URL 结构，历史链接不变；
- Pagefind 是静态索引，Nginx 直接服务即可；
- 如需 CDN，把 `dist/` 作为源站内容上传/回源即可；
- 增加 Dockerfile 或 rsync 脚本时，不需要改动 `src/`、`content/` 或 Schema。

## 测试与 CI

```bash
npm run test          # 46+ 条断言：路径/base、remark 重写、同步、校验、dist 断言、工作流约束
npm run build:demo    # Demo 内容的端到端构建与断言
```

`ci.yml` 在 PR 上只使用 `examples/`，不引用任何 Secret，外部贡献者可以直接运行。

## 已知说明

- Astro 7 默认 Markdown 处理器不再内置 unified 管线，使用 remark 插件需显式依赖
  `@astrojs/markdown-remark`（已加入 `dependencies`）。
- `configure-pages` / `upload-pages-artifact` / `deploy-pages` 当前按设计文档使用
  v5 / v4 / v4；官方已有更新 major（v6 / v5 / v5），升级前应先在 CI 验证。
- Pagefind 对 `zh-cn` 不做词干还原（stemming），中文搜索按分词匹配，属预期行为。
