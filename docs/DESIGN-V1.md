# LunaFoundry 双仓库内容网站系统设计与开发交付文档

`Astro + Pagefind + Markdown/YAML + GitHub Actions + GitHub Pages`

| GitHub 账号 | lunafoundry |
| --- | --- |
| 公开项目 | lunafoundry/luna-site  (Public) |
| 内容项目 | lunafoundry/luna-ore  (Private) |
| 第一阶段部署 | GitHub Pages |
| 核心原则 | Content First · Git First · Static First · Hosting Agnostic |

> 用途：作为开发人员实施、联调、部署和后续维护的唯一设计基线。
> 版本：V1.0   ·   日期：2026-09-20
> 说明：本文档中的仓库命名已按最终约定统一为 luna-site + luna-ore；若旧材料中仍出现 lunafoundry.github.io / lunafoundry-content / 裸名 content，应以本文档命名为准。
> 转换说明：本文由设计基线 `LunaFoundry_双仓库网站系统设计与开发交付文档_V1.0.docx` 自动转换；仓库名已从原稿 `content` 更新为 `luna-ore`，其余以实施仓库为准。

---

## 文档控制

| 项目 | 约定 |
| --- | --- |
| 系统名称 | LunaFoundry Content Site |
| 网站代码仓库 | lunafoundry/luna-site（Public） |
| 内容源仓库 | lunafoundry/luna-ore（Private） |
| 技术栈 | Astro 7 / TypeScript / Pagefind / Markdown / YAML |
| 数据存储 | 文件 + Git；不使用数据库作为内容主存储 |
| 部署目标 | 阶段 1：GitHub Pages；阶段 2：VPS/Nginx + CDN |
| 内容版权 | 网站代码可开源；原创博客/小说内容不随代码许可证授权 |

## 目录

- [1. 架构目标与设计原则](#1-架构目标与设计原则)
- [2. 双仓库职责与边界](#2-双仓库职责与边界)
- [3. 总体架构与发布数据流](#3-总体架构与发布数据流)
- [4. luna-site 详细设计](#4-luna-site-详细设计)
- [5. content 详细设计与内容 Schema](#5-content-详细设计与内容-schema)
- [6. 分类、标签、目录与搜索设计](#6-分类、标签、目录与搜索设计)
- [7. 双仓库联动 Workflow 设计](#7-双仓库联动-workflow-设计)
- [8. GitHub CLI 初始化与日常发布流程](#8-github-cli-初始化与日常发布流程)
- [9. 本地开发与联调流程](#9-本地开发与联调流程)
- [10. 安全、权限与版权设计](#10-安全、权限与版权设计)
- [11. 质量保障与失败处理](#11-质量保障与失败处理)
- [12. GitHub Pages 部署与自定义域名](#12-github-pages-部署与自定义域名)
- [13. 后期迁移 VPS/Nginx 的设计](#13-后期迁移-vps/nginx-的设计)
- [14. 开发任务拆分与验收标准](#14-开发任务拆分与验收标准)
- [附录 A. Workflow 参考实现](#附录-a-workflow-参考实现)
- [附录 B. CLI 命令速查](#附录-b-cli-命令速查)
- [附录 C. 开发人员交付清单](#附录-c-开发人员交付清单)

## 1. 架构目标与设计原则

LunaFoundry 的第一阶段目标是建设一个面向公开访问的个人内容网站，主要承载 AI/技术博客、小说连载、开源项目展示、标签/分类导航、全文搜索、RSS 与 SEO。系统不使用数据库存储文章与小说，所有内容长期以 Markdown/YAML/媒体文件作为唯一事实源。

> **核心判断** GitHub Pages 只是第一阶段的托管目标，不是系统架构本身。业务代码、内容模型、搜索与 URL 设计必须能够在未来迁移到 VPS/Nginx/Cloudflare 时保持不变。

### 1.1 设计原则

| 原则 | 工程要求 |
| --- | --- |
| Content First | Markdown/YAML/媒体文件是内容唯一事实源；数据库不是依赖。 |
| Git First | Git 负责版本历史、回滚、审计与发布触发。 |
| Static First | 公开博客/小说在构建阶段生成 HTML；运行时不依赖内容 API。 |
| Repository Isolation | 程序公开、原创内容私有；构建阶段临时合并。 |
| Hosting Agnostic | 除部署 Workflow 外，业务代码不得依赖 GitHub Pages 专有能力。 |
| Reproducible Build | 每次发布绑定一个明确的 content commit SHA，可复现线上版本。 |
| Progressive Enhancement | 动态能力（评论、账号、AI、会员）以后以局部 API 增量加入。 |

### 1.2 第一阶段明确不做
- 不引入 PostgreSQL/MySQL/Redis 作为内容存储。
- 不让浏览器运行时从私有仓库或自建 API 拉取公开正文。
- 不在前端保存 GitHub Token、PAT 或任何私密密钥。
- 不把正式原创文章、小说、草稿直接提交到 Public 的 luna-site 仓库。

## 2. 双仓库职责与边界

### 2.1 Public：lunafoundry/luna-site

该仓库是网站程序本体，可以开源。它负责 Astro 页面、组件、样式、路由、内容 Schema、Pagefind 搜索、构建脚本、CI、GitHub Pages 部署以及少量 Demo 内容。

- 可使用 MIT 等软件许可证。
- 仅保留 examples/ 下的演示内容，用于开源项目自验证。
- content/ 与 public/media/ 为构建工作区，不得成为真实内容的持久存储。
- 必须通过 .gitignore 防止同步后的私有内容被误提交。

### 2.2 Private：lunafoundry/luna-ore

该仓库是 LunaFoundry 的内容源仓库。博客、小说、媒体、草稿和项目介绍均在此维护。它不向匿名访问者开放，也不随 luna-site 的开源许可证授权。

- 正式博客 Markdown。
- 小说作品 YAML 与章节 Markdown。
- 媒体文件（封面、插图、博客配图）。
- 草稿与尚未发布内容。
- 内容创建与发布 CLI 脚本。
- 触发 luna-site 构建的极轻量 GitHub Actions Workflow。

### 2.3 Starter 包重命名要求

| 旧 Starter 名称 | 最终名称 | 开发动作 |
| --- | --- | --- |
| lunafoundry.github.io | luna-site | 重命名目录、package/README/Workflow 默认仓库名。 |
| lunafoundry-content | luna-ore | 重命名目录并更新同步脚本默认路径。 |
| lunafoundry/lunafoundry.github.io | lunafoundry/luna-site | 更新 SITE_REPOSITORY。 |
| lunafoundry/lunafoundry-content | lunafoundry/luna-ore | 更新 CONTENT_REPOSITORY。 |

## 3. 总体架构与发布数据流

```text
                         GitHub account: lunafoundry

        PUBLIC                                      PRIVATE
+-------------------------+               +-------------------------+
| luna-site               |               | luna-ore                |
|                         |               |                         |
| Astro / TypeScript      |               | blog/*.md               |
| UI / Layout / CSS       |               | novels/*/*.md           |
| Content Schema          |               | novel.yaml              |
| Pagefind                |               | projects/*.yaml         |
| Build / Deploy Workflow |               | media/**                |
+------------+------------+               +------------+------------+
             ^                                             |
             | workflow_dispatch(content SHA)              | push main
             +---------------------------------------------+
             |
             v
      +--------------------+
      | GitHub Actions     |
      | checkout site      |
      | checkout luna-ore  |
      | sync + validate    |
      | Astro build        |
      | Pagefind index     |
      +---------+----------+
                |
                v
          GitHub Pages
                |
                v
 https://lunafoundry.github.io/luna-site/
       (later: custom domain / VPS)
```

### 3.1 发布的关键语义

1.  用户向 luna-ore/main 推送内容。

2.  luna-ore 仓库的 notify-site Workflow 仅负责触发 luna-site 的 deploy-pages Workflow，并把当前 GITHUB_SHA 作为 content_ref 参数传过去。

3.  luna-site 使用 CONTENT_REPO_TOKEN 只读 checkout 私有 luna-ore，并固定到指定 SHA，而不是模糊地读取“当时的 main”。

4.  同步脚本把 luna-ore/content/ 临时复制到 luna-site/content/，把 luna-ore/media/ 临时复制到 luna-site/public/media/。

5.  Astro 校验 Schema 并构建静态 HTML；Pagefind 在 dist/ 上生成全文搜索索引。

6.  GitHub Pages 只接收 dist/ 产物。Private 仓库源码不会进入 Public Git 历史。

> **可复现性** 任何线上版本都应能追溯到两个版本号：Site Commit SHA + Content Commit SHA。发生问题时，可以明确回滚程序或内容，而不是依赖“最新 main”。

## 4. luna-site 详细设计

### 4.1 推荐目录结构

```text
luna-site/
├── .github/workflows/
│   ├── ci.yml
│   └── deploy-pages.yml
├── examples/                  # 仅 Demo 内容
│   ├── content/
│   └── media/
├── content/                   # 构建时由 private repo 注入，禁止提交真实内容
├── public/
│   ├── media/                 # 构建时由 private repo 注入
│   └── favicon.svg
├── scripts/
│   ├── sync-content.mjs
│   ├── validate-content.mjs   # 建议新增
│   └── check-links.mjs        # 建议新增
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   ├── utils/
│   ├── content.config.ts
│   └── site.config.ts
├── astro.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.json
├── LICENSE
└── README.md
```

### 4.2 核心页面路由

| URL | 用途 | 数据来源 |
| --- | --- | --- |
| / | 首页：最新博客、推荐小说、项目 | 所有公开 collection |
| /blog/ | 博客列表、筛选 | blog |
| /blog/{slug}/ | 博客详情 + 文内目录 | blog |
| /categories/ | 分类聚合 | blog.category |
| /categories/{category}/ | 按分类查看 | blog.category |
| /tags/ | 标签云/标签列表 | blog.tags |
| /tags/{tag}/ | 按标签查看 | blog.tags |
| /novel/ | 小说书架 | novels |
| /novel/{novel}/ | 作品详情、卷/章目录 | novels + chapters |
| /novel/{novel}/{chapter}/ | 章节阅读 | chapters |
| /projects | 开源项目展示 | projects |
| /search/ | Pagefind 全站搜索 | dist/pagefind |

### 4.3 GitHub Pages Base Path

因为公开仓库最终命名为 luna-site，而不是 lunafoundry.github.io，GitHub Pages 的默认项目站点地址是 https://lunafoundry.github.io/luna-site/。因此所有站内链接、媒体 URL、RSS、Sitemap 和 canonical URL 都必须支持 BASE_PATH。

> **必须处理** 不要在组件里硬编码 href="/blog" 或 src="/media/..."。组件使用统一 withBase() / assetUrl() 帮助函数；Markdown 内联图片若采用 /media/... 逻辑路径，应增加 remark 插件在构建时按 BASE_PATH 重写。绑定自定义域名后 BASE_PATH 改为 /，内容文件无需修改。

### 4.4 package scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "check": "astro check",
    "content:sync": "node scripts/sync-content.mjs",
    "content:demo": "node scripts/sync-content.mjs ./examples",
    "build": "astro build && pagefind --site dist",
    "build:demo": "npm run content:demo && npm run build",
    "preview": "astro preview"
  }
}
```

生产 Workflow 推荐提交 package-lock.json 并使用 npm ci，而不是 npm install，以确保构建可重复。Node 版本固定为 24。

## 5. content 详细设计与内容 Schema

### 5.1 推荐目录

```text
luna-ore/
├── .github/workflows/notify-site.yml
├── content/
│   ├── blog/
│   │   └── 2026/*.md
│   ├── novels/
│   │   └── <novel-slug>/
│   │       ├── novel.yaml
│   │       ├── volume-01/*.md
│   │       └── volume-02/*.md
│   └── projects/*.yaml
├── media/
│   ├── blog/
│   ├── novels/
│   └── projects/
├── templates/
│   ├── blog.md
│   ├── novel.yaml
│   └── chapter.md
├── scripts/
│   ├── new-blog.sh
│   ├── new-novel.sh
│   ├── new-chapter.sh
│   ├── preview.sh
│   └── publish.sh
├── COPYRIGHT.md
└── README.md
```

### 5.2 Blog Schema（目标版）

在原 Starter 的 category + tags 基础上，建议增加 section 与可选 cover。section 表示一级栏目，category 表示二级分类；tags 为横向主题标签。这样既可形成稳定的信息架构，也可支持灵活筛选。

```yaml
---
title: "Agent Runtime 到底解决什么问题"
slug: "agent-runtime"
description: "用于列表、搜索结果和 SEO 的摘要。"
date: 2026-09-20
updated: 2026-09-20
section: "AI"
category: "Agent"
tags: ["Runtime", "MCP", "Tool Use"]
cover: "/media/blog/agent-runtime/cover.webp"
featured: false
draft: false
---

正文从这里开始。
```

### 5.3 Novel Schema

```yaml
# content/novels/star-sea/novel.yaml
title: "星海"
slug: "star-sea"
author: "LunaFoundry"
status: "serializing"      # serializing | completed | paused
description: "小说简介。"
genres: ["科幻", "AI"]
tags: ["人工智能", "星际文明"]
cover: "/media/novels/star-sea/cover.webp"
created: 2026-09-20
updated: 2026-09-20
featured: true
```

### 5.4 Chapter Schema

```yaml
---
title: "第一章 星夜"
novel: "star-sea"
slug: "001"
volume: "第一卷"
chapter: 1
published: 2026-09-20
description: "章节摘要，可选。"
tags: ["人工智能"]
draft: false
---

章节正文……
```

### 5.5 Schema 校验规则
- title、slug、date/published 等关键字段缺失时直接构建失败。
- 同一 collection 内 slug 必须唯一。
- chapter 必须是正整数；同一 novel 内 chapter 不得重复。
- draft=true 的内容不得生成生产路由、RSS、Sitemap 或 Pagefind 索引。
- cover/media 引用可增加构建前文件存在性检查。
- category、section、tags 在输出 URL 前统一做 slugify；展示名称与 URL slug 分离，避免中文 URL 变更造成历史链接不稳定。

## 6. 分类、标签、目录与搜索设计

### 6.1 分类与标签

系统同时支持“结构化分类”和“横向标签”。分类解决内容归档层级，标签解决跨分类主题聚合。它们都来自 Markdown/YAML 元数据，不需要数据库。

| 能力 | 实现方式 | URL/行为 |
| --- | --- | --- |
| 一级栏目 | blog.section | /blog?section=AI 或导航栏目 |
| 二级分类 | blog.category | /categories/agent/ |
| 标签详情页 | blog.tags | /tags/runtime/ |
| 即时标签过滤 | 客户端 JS Island | 博客列表不刷新过滤 |
| 多标签组合 | URL query + 客户端过滤 | /blog?tags=agent,mcp |
| 小说题材 | novel.genres | /novel?genre=科幻 |
| 小说标签 | novel.tags | 可建立 /novel/tags/... |

### 6.2 文内目录（TOC）

博客和长章节应支持根据 Markdown 的 H2/H3 自动生成文章目录。Astro 渲染 Markdown 时读取 headings，桌面端展示右侧 TOC，移动端折叠。目录锚点必须稳定，避免因标题微调造成外部深链失效；必要时允许显式 heading id。

### 6.3 Pagefind 全文搜索

搜索不是运行时后端服务。构建流程先由 Astro 生成完整 HTML，再由 Pagefind 扫描 dist/ 并生成静态索引。搜索索引与网站一起部署到 Pages。

```text
Markdown / YAML
      ↓
Astro build
      ↓
dist/**/*.html
      ↓
Pagefind --site dist
      ↓
dist/pagefind/*
      ↓
GitHub Pages / Nginx
```

- 搜索范围：博客标题/摘要/正文、小说名、章节标题/正文、项目标题/描述。
- draft=true 内容在 Astro 阶段不输出，因此不会进入 Pagefind。
- 分类、标签可作为 Pagefind 元数据/过滤条件的后续增强，但 V1 必须先实现静态标签页与博客列表即时过滤。
- 搜索页支持 Ctrl+K / Cmd+K 快捷入口。
- 将来迁移 VPS 时 Pagefind 无需改变。

## 7. 双仓库联动 Workflow 设计

### 7.1 触发链路

1.  luna-ore/main 的内容或 media 发生 push。

2.  Private Workflow 使用 SITE_WORKFLOW_TOKEN 调用 luna-site 的 workflow_dispatch。

3.  参数 content_ref 固定传当前 content commit SHA。

4.  Public Workflow checkout luna-site 自身。

5.  使用 CONTENT_REPO_TOKEN checkout lunafoundry/luna-ore@content_ref 到 .content-source。

6.  执行 content:sync、Astro check、Astro build、Pagefind。

7.  上传 dist Pages artifact。

8.  deploy-pages 发布到 github-pages environment。

### 7.2 为什么构建放在 Public luna-site

Private luna-ore 仓库只执行“触发”任务，通常一个极短 Job；真正耗时的 Node 安装、Astro 构建、Pagefind 和 Pages 部署全部在 Public luna-site 完成。这既降低私有 Actions 使用量，也让所有网站构建逻辑集中在程序仓库。

### 7.3 Secrets 与 Variables

| 位置 | 名称 | 权限/示例 | 用途 |
| --- | --- | --- | --- |
| luna-site Secret | CONTENT_REPO_TOKEN | Fine-grained PAT；luna-ore: Contents Read | 读取私有内容 |
| luna-ore Secret | SITE_WORKFLOW_TOKEN | Fine-grained PAT；luna-site: Actions Write | 触发网站 Workflow |
| luna-site Variable | CONTENT_REPOSITORY | lunafoundry/luna-ore | 内容仓库标识 |
| luna-ore Variable | SITE_REPOSITORY | lunafoundry/luna-site | 网站仓库标识 |
| luna-site Variable | SITE_URL | https://lunafoundry.github.io | Astro site 基础 URL |
| luna-site Variable | BASE_PATH | /luna-site/ | GitHub Pages 项目路径 |

> **安全要求** 两个 PAT 都使用 Fine-grained Token，并且只授权单一目标仓库与最小权限。不得使用 Classic PAT 的全 repo 范围作为默认方案。不得把 Token 放入代码、.env.example 或前端变量。

### 7.4 Concurrency

luna-site 部署 Workflow 应设置同一并发组并启用 cancel-in-progress。连续修改两次内容时，旧构建可取消，只发布最新内容，避免浪费 runner 时间和旧版本覆盖新版本。

```yaml
concurrency:
  group: lunafoundry-pages
  cancel-in-progress: true
```

## 8. GitHub CLI 初始化与日常发布流程

### 8.1 首次创建两个仓库

```bash
# 登录
$ gh auth login

# Public Site
$ cd luna-site
$ git init -b main
$ git add .
$ git commit -m "Initialize LunaFoundry site"
$ gh repo create lunafoundry/luna-site --public --source=. --remote=origin --push

# Private Content
$ cd ../luna-ore
$ git init -b main
$ git add .
$ git commit -m "Initialize LunaFoundry luna-ore"
$ gh repo create lunafoundry/luna-ore --private --source=. --remote=origin --push
```

### 8.2 配置 Repository Variables

```bash
$ gh variable set CONTENT_REPOSITORY \
    --repo lunafoundry/luna-site \
    --body "lunafoundry/luna-ore"

$ gh variable set SITE_REPOSITORY \
    --repo lunafoundry/luna-ore \
    --body "lunafoundry/luna-site"

$ gh variable set SITE_URL \
    --repo lunafoundry/luna-site \
    --body "https://lunafoundry.github.io"

$ gh variable set BASE_PATH \
    --repo lunafoundry/luna-site \
    --body "/luna-site/"
```

### 8.3 配置 Secrets

先在 GitHub 创建两个 Fine-grained PAT。SITE_WORKFLOW_TOKEN 仅授权 luna-site 的 Actions: Write；CONTENT_REPO_TOKEN 仅授权 luna-ore 的 Contents: Read。随后通过 gh 写入 Secret：

```bash
$ gh secret set CONTENT_REPO_TOKEN --repo lunafoundry/luna-site
# 按提示粘贴只读 content PAT

$ gh secret set SITE_WORKFLOW_TOKEN --repo lunafoundry/luna-ore
# 按提示粘贴仅 Actions Write 的 site PAT
```

### 8.4 第一次部署

```bash
$ gh workflow run deploy-pages.yml \
    --repo lunafoundry/luna-site \
    --ref main \
    -f content_ref=main \
    -f reason=bootstrap

$ gh run list --repo lunafoundry/luna-site --limit 5
$ gh run watch --repo lunafoundry/luna-site
```

### 8.5 日常发布

```bash
$ cd luna-ore
$ ./scripts/new-blog.sh agent-runtime "Agent Runtime 到底解决什么问题" "Agent"
# 编辑文章，将 draft 改为 false

$ ./scripts/publish.sh "Publish Agent Runtime article"

# publish.sh => git add/commit/push
# push => notify-site.yml
# notify-site => luna-site/deploy-pages.yml
# => GitHub Pages 自动更新
```

### 8.6 手工重发与排障 CLI

```bash
# 手工重发指定 content commit
$ gh workflow run deploy-pages.yml \
  --repo lunafoundry/luna-site \
  -f content_ref=<CONTENT_SHA> \
  -f reason=manual-redeploy

# 查看最近运行
$ gh run list --repo lunafoundry/luna-site --limit 10
$ gh run list --repo lunafoundry/luna-ore --limit 10

# 查看失败日志
$ gh run view <RUN_ID> --repo lunafoundry/luna-site --log-failed
```

## 9. 本地开发与联调流程

### 9.1 推荐工作区

```text
workspace/
├── luna-site/
└── luna-ore/
```

两个仓库保持为同级目录。luna-site 的同步脚本默认支持从 ../luna-ore 读取，这样本地开发体验与 CI 构建逻辑一致。

### 9.2 第一次启动

```bash
$ cd luna-site
$ npm install
$ npm run content:sync -- ../luna-ore
$ npm run check
$ npm run dev
```

### 9.3 完整生产构建验证

```bash
$ cd luna-site
$ npm run content:sync -- ../luna-ore
$ npm run check
$ npm run build

# build = astro build + pagefind --site dist
```

### 9.4 公开仓库 PR/CI

Public luna-site 的 pull_request CI 不应依赖 private content Token，否则外部贡献者无法运行。CI 使用 examples/ 的 Demo 内容执行 build:demo。只有 main 部署 Workflow 才读取私有 content。

| 场景 | 内容源 | 是否需要私有 Token |
| --- | --- | --- |
| Public PR CI | luna-site/examples | 否 |
| 本地 UI 开发 | ../luna-ore 或 examples | 视开发者权限 |
| main 自动部署 | lunafoundry/luna-ore | 是 |
| 内容发布触发 | content 当前 SHA | SITE_WORKFLOW_TOKEN |

## 10. 安全、权限与版权设计

### 10.1 内容私有的真实边界

Private content 的意义是隐藏源仓库、草稿、未发布章节、创作结构和 Git 历史。内容一旦发布到公开网站，生成后的 HTML 本身就是公开可访问的，这正符合“希望用户通过网站阅读”的目标。

### 10.2 防止源内容误提交

```text
# luna-site/.gitignore
/content/*
!/content/.gitkeep
/public/media/*
!/public/media/.gitkeep
/.content-source/
```

- 同步脚本每次先清空目标临时目录，再复制内容，避免残留。
- 构建后不执行 git add/commit。
- CI 可增加 git status --porcelain 检查，如果出现受跟踪内容变更则失败。
- 正式内容不放在 examples/。

### 10.3 软件与内容许可证隔离

| 资产 | 建议许可 |
| --- | --- |
| luna-site 源码 | MIT（或其他软件许可证） |
| examples Demo | 可随源码许可证，必须是虚构/示例内容 |
| content 正式博客/小说 | © LunaFoundry · All Rights Reserved |
| 插画/封面 | 按实际版权声明，不自动继承 MIT |

### 10.4 构建供应链
- 提交 package-lock.json；生产使用 npm ci。
- GitHub Actions 使用官方 action 的明确 major 版本；高安全要求时可固定到 commit SHA。
- Private checkout 设置 persist-credentials: false。
- 不要在 workflow log 打印 PAT 或完整敏感环境变量。

## 11. 质量保障与失败处理

### 11.1 构建前校验

| 检查 | 失败策略 |
| --- | --- |
| Astro Content Schema | 字段非法立即 fail |
| Slug 唯一性 | 重复即 fail |
| 章节序号唯一性 | 同一 novel 重复即 fail |
| 媒体引用存在 | 缺失封面/图片 fail 或 warning（按级别） |
| 内部链接 | 生产 build 检查 broken links |
| Draft 泄露 | 断言 dist 中不存在 draft route |
| Search Index | 断言 dist/pagefind 存在 |

### 11.2 发布失败
- content 触发失败：内容 commit 已安全保存在 private repo；不影响当前线上版本。
- luna-site build 失败：Pages 保持上一个成功版本；修复后按原 content SHA 重发。
- Pages deploy 失败：重跑 deploy workflow；不需要重新编辑内容。
- 错误发布：将 content 回滚到上一 commit 或手工触发上一 SHA，重新构建即可。

### 11.3 可观测性

每次部署日志必须输出 Site SHA、Content SHA、内容文件数、媒体文件数、SITE_URL、BASE_PATH（不输出 Secret）。建议在页面构建元信息中保留 build id，但不暴露敏感信息。

## 12. GitHub Pages 部署与自定义域名

### 12.1 GitHub Pages 第一阶段

仓库名为 luna-site，因此默认地址是 https://lunafoundry.github.io/luna-site/。Pages Source 选择 GitHub Actions。Workflow 使用 configure-pages、upload-pages-artifact、deploy-pages 进行发布。deploy job 必须具备 pages: write 与 id-token: write 权限，并使用 github-pages environment。

### 12.2 自定义域名

绑定自定义域名后，目标配置变为：SITE_URL=https://你的域名，BASE_PATH=/。内容仓库与文章 URL 模型不变；所有内部链接和媒体 URL 通过统一 base helper/remark 重写，因此无需批量修改 Markdown。

### 12.3 SEO 设计
- 每篇博客独立 title / description / canonical / Open Graph。
- 生成 sitemap.xml 与 robots.txt。
- RSS 只包含 draft=false 的博客。
- 博客可输出 Article JSON-LD；小说作品可输出 Book/CreativeWork 类结构化数据（根据实际页面语义选择）。
- 分类页、标签页需要稳定 URL，避免只依赖不可索引的客户端筛选。

## 13. 后期迁移 VPS/Nginx 的设计

迁移的目标是只替换“部署目标”，而不是重写内容系统。Astro + Pagefind 仍然输出 dist/ 静态文件。

```text
今天：
content -> Astro -> Pagefind -> dist -> GitHub Pages

以后：
content -> Astro -> Pagefind -> dist -> rsync/Docker -> Nginx -> CDN
```

### 13.1 保持不变
- Markdown/YAML 内容格式。
- 内容目录与 Git 历史。
- Astro 页面、组件与路由。
- Pagefind 搜索。
- 分类/标签/文章目录。
- 公开 URL 结构（使用自定义域名后更容易保持永久稳定）。

### 13.2 只需替换
- deploy-pages.yml 的最后发布步骤。
- 增加 Dockerfile 或 rsync/SSH 部署脚本。
- Nginx 静态资源缓存和 gzip/brotli 配置。
- 可选接入 Cloudflare CDN。

> **架构验收标准** 如果未来迁 VPS 需要迁移数据库、改写文章格式或重做搜索，则说明当前架构产生了不必要的托管耦合。V1 开发应避免这种耦合。

## 14. 开发任务拆分与验收标准

### 14.1 Phase 1：仓库与基础构建
- 按最终命名创建 luna-site Public 和 luna-ore Private。
- 将旧 Starter 中的仓库名全部替换。
- 完成 local sync、demo build、private checkout、Pages workflow。
- 完成 BASE_PATH 与自定义域名兼容。

### 14.2 Phase 2：内容模型
- 升级 Content Schema：section/category/tags/cover/draft/featured。
- 小说增加 genres/tags/cover，章节支持 tags。
- 生产环境彻底排除 draft。
- 增加 slug/章节唯一性校验。

### 14.3 Phase 3：页面与交互
- 首页、博客、小说、项目、About。
- 分类页、标签页、标签即时过滤、多标签 query 状态。
- 博客/章节 H2/H3 文内目录。
- 小说卷/章目录、上一章/下一章、阅读设置 localStorage。
- 暗色模式与中文阅读排版。

### 14.4 Phase 4：搜索与 SEO
- Pagefind 构建、搜索页、Ctrl/Cmd+K。
- RSS、Sitemap、robots、canonical、Open Graph。
- Pagefind 不收录 draft；分类/标签可被搜索引擎独立索引。

### 14.5 Phase 5：自动化与安全
- content push 自动触发 site。
- 绑定 content commit SHA。
- 最小权限 Fine-grained PAT。
- concurrency/cancel-in-progress。
- 失败回滚与 gh CLI 运维命令。

### 14.6 Definition of Done

| 验收项 | 通过条件 |
| --- | --- |
| 双仓库隔离 | Public Git 历史中无正式私有内容 |
| 自动发布 | content push 后无需手动操作即可更新 Pages |
| 可复现 | 部署日志可定位 Site SHA + Content SHA |
| 分类/标签 | 标签详情页与即时过滤均可用 |
| 搜索 | Pagefind 可搜索中文博客与小说正文 |
| Draft | 草稿不出现在页面/RSS/Sitemap/Search |
| 迁移性 | 本地 dist 可由任意静态服务器直接托管 |
| SEO | 核心页面具有 canonical/description/sitemap |

## 附录 A. Workflow 参考实现

### A.1 luna-ore/.github/workflows/notify-site.yml

```yaml
name: Publish Content

on:
  push:
    branches: [main]
    paths:
      - 'content/**/*.md'
      - 'content/**/*.mdx'
      - 'content/**/*.yaml'
      - 'content/**/*.yml'
      - 'media/**'
      - '!content/README.md'
      - '!media/.gitkeep'
  workflow_dispatch:

permissions:
  contents: read

env:
  SITE_REPOSITORY: ${{ vars.SITE_REPOSITORY || 'lunafoundry/luna-site' }}

jobs:
  trigger-site-build:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger site workflow
        env:
          GH_TOKEN: ${{ secrets.SITE_WORKFLOW_TOKEN }}
        run: |
          gh workflow run deploy-pages.yml \
            --repo "$SITE_REPOSITORY" \
            --ref main \
            -f content_ref="$GITHUB_SHA" \
            -f reason="content-publish"

      - name: Print revision
        run: |
          echo "Triggered: $SITE_REPOSITORY"
          echo "Content SHA: $GITHUB_SHA"
```

### A.2 luna-site/.github/workflows/deploy-pages.yml

```yaml
name: Deploy LunaFoundry

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      content_ref:
        description: Private content branch, tag, or commit SHA
        required: false
        default: main
        type: string
      reason:
        description: Trigger reason
        required: false
        default: manual
        type: string

permissions:
  contents: read

concurrency:
  group: lunafoundry-pages
  cancel-in-progress: true

env:
  CONTENT_REPOSITORY: ${{ vars.CONTENT_REPOSITORY || 'lunafoundry/luna-ore' }}
  CONTENT_REF: ${{ inputs.content_ref || 'main' }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout site
        uses: actions/checkout@v7

      - name: Checkout private content
        uses: actions/checkout@v7
        with:
          repository: ${{ env.CONTENT_REPOSITORY }}
          ref: ${{ env.CONTENT_REF }}
          token: ${{ secrets.CONTENT_REPO_TOKEN }}
          path: .content-source
          persist-credentials: false

      - name: Resolve site URL
        shell: bash
        run: |
          echo "SITE_URL=${{ vars.SITE_URL || 'https://lunafoundry.github.io' }}" >> "$GITHUB_ENV"
          echo "BASE_PATH=${{ vars.BASE_PATH || '/luna-site/' }}" >> "$GITHUB_ENV"

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Sync private content
        run: npm run content:sync -- .content-source

      - name: Validate project
        run: npm run check

      - name: Build Astro + Pagefind
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

*说明：上述 Action major 版本按 2026-09-20 的 GitHub 官方文档/官方仓库现状编写；后续升级时应先在 CI 验证。Public Workflow 跨仓库读取 Private repository 不能依赖默认 github.token，需要显式提供最小权限 PAT。*

## 附录 B. CLI 命令速查

| 目的 | 命令 |
| --- | --- |
| 触发指定内容版本 | gh workflow run deploy-pages.yml --repo lunafoundry/luna-site -f content_ref=<SHA> |
| 看站点运行 | gh run list --repo lunafoundry/luna-site --limit 10 |
| 看内容触发运行 | gh run list --repo lunafoundry/luna-ore --limit 10 |
| 看失败日志 | gh run view <RUN_ID> --repo lunafoundry/luna-site --log-failed |
| 设置 Site 变量 | gh variable set CONTENT_REPOSITORY --repo lunafoundry/luna-site --body lunafoundry/luna-ore |
| 设置 Content 变量 | gh variable set SITE_REPOSITORY --repo lunafoundry/luna-ore --body lunafoundry/luna-site |
| 写入读取 Token | gh secret set CONTENT_REPO_TOKEN --repo lunafoundry/luna-site |
| 写入触发 Token | gh secret set SITE_WORKFLOW_TOKEN --repo lunafoundry/luna-ore |

## 附录 C. 开发人员交付清单

□ 两个 GitHub 仓库按最终名称创建并推送。

□ 旧 Starter 的 lunafoundry.github.io / lunafoundry-content 引用已全部清理。

□ content push 可自动触发 luna-site workflow_dispatch。

□ Site Workflow 能按 content SHA checkout private 内容。

□ Public repo .gitignore 可阻止真实 content/media 被提交。

□ Astro Schema 已支持 section/category/tags/draft/featured 与小说 metadata。

□ 分类页、标签页、标签过滤可用。

□ 博客/章节文内目录可用。

□ Pagefind 中文全文搜索可用。

□ GitHub Pages 在 /luna-site/ base path 下无断链/丢图。

□ draft 内容不会进入页面、RSS、Sitemap、Pagefind。

□ package-lock.json 已提交，CI 使用 npm ci。

□ README 覆盖本地开发、内容发布、Workflow、迁移 VPS。

□ 用指定 content SHA 可重发/回滚线上版本。

### 官方实现依据（开发参考）

*https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages*

*https://docs.github.com/en/rest/actions/workflows*

*https://github.com/actions/checkout*

*https://github.com/actions/setup-node*

*https://docs.astro.build/*

*https://pagefind.app/docs/*
