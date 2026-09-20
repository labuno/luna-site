# GitHub CLI 初始化与运维

> 同一台机器上有多个 GitHub 账号（如本机同时有个人账号与 `lunafoundry`）时，
> 先按 [`MULTI-ACCOUNT.md`](./MULTI-ACCOUNT.md) 完成一次性身份配置，
> 再执行本文的建仓步骤；本文所有脚本都已锁定目标账号，不会误用活跃账号。

前置：`gh auth login`，账号对 `lunafoundry` 有仓库创建权限。命令中的路径以两个仓库同级存放为例：

```text
workspace/
├── luna-site/
└── content/
```

## 1. 创建两个仓库

```bash
# Public：站点程序
cd luna-site
git init -b main
git add .
git commit -m "Initialize LunaFoundry site"
gh repo create lunafoundry/luna-site --public --source=. --remote=origin --push

# Private：内容源
cd ../content
git init -b main
git add .
git commit -m "Initialize LunaFoundry content"
gh repo create lunafoundry/content --private --source=. --remote=origin --push
```

## 2. 配置 Repository Variables

```bash
gh variable set CONTENT_REPOSITORY --repo lunafoundry/luna-site --body "lunafoundry/content"
gh variable set SITE_URL --repo lunafoundry/luna-site --body "https://lunafoundry.github.io"
gh variable set BASE_PATH --repo lunafoundry/luna-site --body "/luna-site/"

gh variable set SITE_REPOSITORY --repo lunafoundry/content --body "lunafoundry/luna-site"
```

## 3. 创建 Fine-grained PAT 并写入 Secrets

在 GitHub → Settings → Developer settings → Fine-grained tokens 创建两个 token：

| Token | 授权范围 | 权限 |
|-------|----------|------|
| `CONTENT_REPO_TOKEN` | 仅 `lunafoundry/content` | Contents: Read |
| `SITE_WORKFLOW_TOKEN` | 仅 `lunafoundry/luna-site` | Actions: Write |

```bash
gh secret set CONTENT_REPO_TOKEN --repo lunafoundry/luna-site   # 粘贴只读 content PAT
gh secret set SITE_WORKFLOW_TOKEN --repo lunafoundry/content    # 粘贴 Actions Write 的 site PAT
```

不要使用 Classic PAT 的全 `repo` 范围；token 不得写入代码、`.env.example` 或前端变量。

## 4. 启用 Pages（Actions 源）

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
`deploy-pages.yml` 已声明 `pages: write`、`id-token: write` 与 `github-pages` environment。

## 5. 首次部署

```bash
# 直接指定私有内容分支或 SHA
gh workflow run deploy-pages.yml \
  --repo lunafoundry/luna-site \
  --ref main \
  -f content_ref=main \
  -f reason=bootstrap

gh run list --repo lunafoundry/luna-site --limit 5
gh run watch --repo lunafoundry/luna-site
```

## 6. 日常发布

```bash
cd content
./scripts/new-blog.sh agent-runtime "Agent Runtime 到底解决什么问题" "Agent" "AI"
# 编辑文章，把 draft 改为 false
./scripts/publish.sh "Publish Agent Runtime article"
# push → notify-site.yml → luna-site/deploy-pages.yml → Pages 自动更新
```

## 7. 重发、回滚与排障

```bash
# 用指定内容 SHA 重建（回滚内容）
gh workflow run deploy-pages.yml --repo lunafoundry/luna-site \
  -f content_ref=<CONTENT_SHA> -f reason=manual-redeploy

# 回滚站点代码：用旧 commit 作为 ref 触发
gh workflow run deploy-pages.yml --repo lunafoundry/luna-site --ref <SITE_SHA>

gh run list --repo lunafoundry/luna-site --limit 10
gh run list --repo lunafoundry/content --limit 10
gh run view <RUN_ID> --repo lunafoundry/luna-site --log-failed
```

## 8. 自定义域名

```bash
gh variable set SITE_URL  --repo lunafoundry/luna-site --body "https://your-domain.com"
gh variable set BASE_PATH --repo lunafoundry/luna-site --body "/"
# 重新触发部署；DNS 与 Pages 侧同时配置域名与 HTTPS
```
