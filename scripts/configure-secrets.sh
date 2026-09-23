#!/usr/bin/env bash
# 安全写入两个最小权限 PAT，并触发一次绑定内容 SHA 的部署。
#
#   ./scripts/configure-secrets.sh
#
# PAT 通过 stdin 直接交给 gh，不落盘、不回显、不进入 shell 历史。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
owner="${GITHUB_OWNER:-labuno}"
site_repo="${SITE_REPO:-luna-site}"
content_repo="${CONTENT_REPO:-luna-ore}"

command -v gh >/dev/null 2>&1 || { echo "缺少 gh CLI" >&2; exit 1; }
gh auth status >/dev/null

cat <<EOF2
请先在 GitHub 创建两个 Fine-grained Personal Access Token：

1) CONTENT_REPO_TOKEN
   Repository: $owner/$content_repo
   Permission: Contents = Read-only

2) SITE_WORKFLOW_TOKEN
   Repository: $owner/$site_repo
   Permission: Actions = Read and write

粘贴在下方。输入不可见，仅用于写入 GitHub Secrets。
EOF2

printf 'CONTENT_REPO_TOKEN: '
IFS= read -r -s content_token
printf '\n'
printf 'SITE_WORKFLOW_TOKEN: '
IFS= read -r -s site_token
printf '\n'

if [ -z "$content_token" ] || [ -z "$site_token" ]; then
  echo "Token 不能为空。" >&2
  exit 1
fi

printf '%s' "$content_token" | gh secret set CONTENT_REPO_TOKEN --repo "$owner/$site_repo"
printf '%s' "$site_token" | gh secret set SITE_WORKFLOW_TOKEN --repo "$owner/$content_repo"
unset content_token site_token

content_sha="$(gh api "repos/$owner/$content_repo/commits/main" --jq .sha)"

gh workflow run deploy-pages.yml \
  --repo "$owner/$site_repo" \
  --ref main \
  -f content_ref="$content_sha" \
  -f reason="initial-publish"

cat <<EOF2

Secrets 已配置，已触发首次部署（content_ref=${content_sha}）。

  查看运行: gh run list --repo $owner/$site_repo --limit 5
  跟踪进度: gh run watch --repo $owner/$site_repo
EOF2
