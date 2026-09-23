# GitHub CLI 初始化与运维

> 同一台机器上有多个 GitHub 账号（如本机同时有个人账号与 `labuno`）时，
> 先按 [`MULTI-ACCOUNT.md`](./MULTI-ACCOUNT.md) 完成一次性身份配置，
> 再执行本文的建仓步骤；本文所有脚本都已锁定目标账号，不会误用活跃账号。

前置：`gh auth login`，账号对 `labuno` 有仓库创建权限。命令中的路径以两个仓库同级存放为例：

```text
workspace/
├── luna-site/
└── luna-ore/
```

## 1. 创建两个仓库

```bash
# Public：站点程序
cd luna-site
git init -b main
git add .
git commit -m "Initialize LunaFoundry site"
gh repo create labuno/luna-site --public --source=. --remote=origin --push

# Private：内容源（写作与媒体原料）
cd ../luna-ore
git init -b main
git add .
git commit -m "Initialize LunaFoundry luna-ore"
gh repo create labuno/luna-ore --private --source=. --remote=origin --push
```

## 2. 配置 Repository Variables

```bash
gh variable set CONTENT_REPOSITORY --repo labuno/luna-site --body "labuno/luna-ore"
gh variable set SITE_URL --repo labuno/luna-site --body "https://labuno.github.io"
gh variable set BASE_PATH --repo labuno/luna-site --body "/luna-site/"

gh variable set SITE_REPOSITORY --repo labuno/luna-ore --body "labuno/luna-site"
```

## 3. 创建 Fine-grained PAT 并写入 Secrets

在 GitHub → Settings → Developer settings → Fine-grained tokens 创建两个 token：

| Token | 授权范围 | 权限 |
|-------|----------|------|
| `CONTENT_REPO_TOKEN` | 仅 `labuno/luna-ore` | Contents: Read |
| `SITE_WORKFLOW_TOKEN` | 仅 `labuno/luna-site` | Actions: Write |

```bash
gh secret set CONTENT_REPO_TOKEN --repo labuno/luna-site   # 粘贴只读 luna-ore PAT
gh secret set SITE_WORKFLOW_TOKEN --repo labuno/luna-ore   # 粘贴 Actions Write 的 site PAT
```

不要使用 Classic PAT 的全 `repo` 范围；token 不得写入代码、`.env.example` 或前端变量。

## 4. 启用 Pages（Actions 源）

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
`deploy-pages.yml` 已声明 `pages: write`、`id-token: write` 与 `github-pages` environment。

## 5. 首次部署

```bash
# 直接指定私有内容分支或 SHA
gh workflow run deploy-pages.yml \
  --repo labuno/luna-site \
  --ref main \
  -f content_ref=main \
  -f reason=bootstrap

gh run list --repo labuno/luna-site --limit 5
gh run watch --repo labuno/luna-site
```

## 6. 日常发布

```bash
cd luna-ore
./scripts/new-blog.sh agent-runtime "Agent Runtime 到底解决什么问题" "Agent" "AI"
# 编辑文章，把 draft 改为 false
./scripts/publish.sh "Publish Agent Runtime article"
# push → notify-site.yml → luna-site/deploy-pages.yml → Pages 自动更新
```

## 7. 重发、回滚与排障

```bash
# 用指定内容 SHA 重建（回滚内容）
gh workflow run deploy-pages.yml --repo labuno/luna-site \
  -f content_ref=<CONTENT_SHA> -f reason=manual-redeploy

# 回滚站点代码：用旧 commit 作为 ref 触发
gh workflow run deploy-pages.yml --repo labuno/luna-site --ref <SITE_SHA>

gh run list --repo labuno/luna-site --limit 10
gh run list --repo labuno/luna-ore --limit 10
gh run view <RUN_ID> --repo labuno/luna-site --log-failed
```

## 8. 自定义域名

```bash
gh variable set SITE_URL  --repo labuno/luna-site --body "https://your-domain.com"
gh variable set BASE_PATH --repo labuno/luna-site --body "/"
# 重新触发部署；DNS 与 Pages 侧同时配置域名与 HTTPS
```
