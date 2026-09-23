# 内容 Schema 与校验规则

站点构建时会把内容仓库（默认 `../luna-ore`，可用 `CONTENT_SOURCE_DIR` 覆盖）同步到
`content/` 与 `public/media/` 工作区。本文是全部字段与校验规则的参考。

## 目录布局

```text
content/
├── blog/<year>/*.md          # 博客文章
├── novels/<slug>/novel.yaml  # 小说元数据
│   └── <volume-dir>/*.md     # 章节（如 volume-01/001.md）
└── projects/*.yaml           # 项目条目
media/                        # 媒体文件，构建时映射为站点 /media/**
├── blog/<slug>/
├── novels/<slug>/
└── projects/
```

## Blog（`content/blog/<year>/<file>.md`）

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

## Novel（`content/novels/<slug>/novel.yaml`）

字段：`title` `slug` `author` `status`(serializing | completed | paused) `description`
`genres[]` `tags[]` `cover?` `created` `updated` `featured`

## Chapter（`content/novels/<slug>/<volume-dir>/<NNN>.md`）

字段：`title` `novel`（小说 slug）`slug` `volume` `chapter`（正整数）`published` `tags[]` `draft`

## Project（`content/projects/<name>.yaml`）

字段：`title` `description` `url?` `repo?` `status`(idea | building | active | archived) `tags[]` `featured`

## 校验规则

以下情况会校验失败并中止构建：

- 必填字段缺失；
- slug 重复（含分类/标签 slug 冲突）；
- 同一小说内章节号或章节 slug 重复；
- 章节的 `novel` 引用不存在；
- `cover` 或正文中引用的 `/media/...` 文件缺失。

## 草稿语义

`draft: true` 的内容不会生成页面，也不会进入 RSS、Sitemap 与 Pagefind 搜索索引。
`check:dist` 会在构建后断言草稿路由、RSS、索引中均无草稿内容。

## 分类、标签与 URL

- 展示名称与 URL slug 解耦：URL 一律使用 slug（中文保留字符、英文小写连字符）。
- 重命名展示名而保持旧链接：在 [`src/lib/taxonomy-overrides.mjs`](../src/lib/taxonomy-overrides.mjs)
  中加一条 `'old-slug': '新展示名'`。
- `/tags/{slug}/` 聚合博客、小说、章节与项目的标签；`/categories/{slug}/` 聚合博客分类。
- 博客列表支持 `?section=` 与 `?tags=a,b`（AND 组合，客户端即时过滤，URL 可分享）；
  小说书架支持 `?genre=`。

## 媒体约定

- 文章配图放 `media/blog/<slug>/`，正文以 `/media/blog/<slug>/xxx.webp` 引用；
- 小说封面放 `media/novels/<slug>/cover.webp`，在 `novel.yaml` 的 `cover` 字段引用；
- 引用的文件必须真实存在，否则构建失败。
