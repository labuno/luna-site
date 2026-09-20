---
title: "开始把内容放回文件"
slug: "hello-lunafoundry"
description: "为什么 LunaFoundry 用 Markdown、YAML 与 Git 作为内容的长期存储，而不是数据库。"
date: 2026-09-01
updated: 2026-09-20
section: "Notes"
category: "Meta"
tags: ["Content First", "Git", "静态站点"]
cover: "/media/blog/hello-lunafoundry/cover.svg"
featured: true
draft: false
---

站点上线第一件事，先把原则写清楚。

## 为什么不用数据库

内容站真正的资产是文本本身，而不是承载它的系统。

- Markdown/YAML 可以直接阅读、diff、回滚；
- Git 天然提供版本历史与审计；
- 构建产物是静态 HTML，任何静态服务器都能托管。

## 内容如何流动

写作发生在私有内容仓库，发布链路如下：

### 一次发布

1. 在 `content/` 提交文章；
2. `notify-site.yml` 触发站点构建，并带上当前 commit SHA；
3. 站点仓库 checkout 该 SHA 的内容，构建并部署。

![内容流动示意](/media/blog/hello-lunafoundry/cover.svg)

### 可复现

每次部署都能回答两个问题：站点代码是哪个版本、内容又是哪个版本。

## 下一步

搜索引擎与全文检索都由构建期生成，见 [Pagefind 与静态搜索](/blog/astro-pagefind/)。

```bash
npm run content:demo
npm run build:demo
```
