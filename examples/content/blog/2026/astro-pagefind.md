---
title: "Pagefind：给静态站加一个不需要后端的全文搜索"
slug: "astro-pagefind"
description: "构建期生成索引、运行时零依赖，Pagefind 与 Astro 的组合足以支撑中英文内容站。"
date: 2026-09-08
section: "Engineering"
category: "Astro"
tags: ["Astro", "Pagefind", "搜索"]
cover: "/media/blog/astro-pagefind/cover.svg"
draft: false
---

静态站最常见的问题之一是搜索：没有后端，怎么全文检索？

## 构建期索引

Pagefind 在 `astro build` 之后扫描 `dist/` 中的 HTML 并生成索引目录：

```bash
npm run build   # astro build && pagefind --site dist
```

### 为什么够用

- 索引是静态文件，随站点一起部署；
- 浏览器只在搜索时按需拉取分片；
- 迁移到 VPS/Nginx 时无需改动。

## 中文检索

Pagefind 依据 `<html lang>` 选择分词策略，中文站点保持 `lang="zh-CN"` 即可。

### 与草稿的边界

草稿在 Astro 渲染阶段就不会生成 HTML，因此不会进入索引。
