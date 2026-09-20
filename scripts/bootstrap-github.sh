#!/usr/bin/env bash
# 创建/推送两个 GitHub 仓库并写入 Repository Variables。
# 幂等：仓库已存在则跳过创建，只更新变量与远端。
#
#   ./scripts/bootstrap-github.sh
#
# 可用环境变量覆盖：GITHUB_OWNER / SITE_REPO / CONTENT_REPO / CONTENT_DIR
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
owner="${GITHUB_OWNER:-lunafoundry}"
site_repo="${SITE_REPO:-luna-site}"
content_repo="${CONTENT_REPO:-content}"
site_dir="$root"
content_dir="${CONTENT_DIR:-$root/../content}"

command -v gh >/dev/null 2>&1 || { echo "缺少 gh CLI" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "缺少 git" >&2; exit 1; }
gh auth status >/dev/null

create_repo_if_missing() {
  local full="$1" visibility="$2" description="$3"
  if gh repo view "$full" >/dev/null 2>&1; then
    echo "仓库已存在，跳过创建: $full"
    return
  fi
  if [ "$visibility" = "public" ]; then
    gh repo create "$full" --public --description "$description"
  else
    gh repo create "$full" --private --description "$description"
  fi
}

push_repo() {
  local dir="$1" full="$2"
  cd "$dir"
  [ -d .git ] || git init -b main
  git add -A
  git diff --cached --quiet || git commit -m "Initialize LunaFoundry"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "https://github.com/$full.git"
  else
    git remote add origin "https://github.com/$full.git"
  fi
  git branch -M main
  git push -u origin main
}

create_repo_if_missing "$owner/$site_repo" public "LunaFoundry public Astro + Pagefind site engine"
create_repo_if_missing "$owner/$content_repo" private "Private LunaFoundry writing and media source"

echo "写入 Repository Variables..."
gh variable set CONTENT_REPOSITORY --repo "$owner/$site_repo" --body "$owner/$content_repo"
gh variable set SITE_URL --repo "$owner/$site_repo" --body "https://$owner.github.io"
gh variable set BASE_PATH --repo "$owner/$site_repo" --body "/$site_repo/"
gh variable set SITE_REPOSITORY --repo "$owner/$content_repo" --body "$owner/$site_repo"

echo "推送私有内容仓库..."
push_repo "$content_dir" "$owner/$content_repo"

echo "推送站点仓库..."
push_repo "$site_dir" "$owner/$site_repo"

echo "启用 GitHub Pages（Actions 源）..."
if gh api "repos/$owner/$site_repo/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$owner/$site_repo/pages" -f build_type=workflow >/dev/null || true
else
  gh api --method POST "repos/$owner/$site_repo/pages" -f build_type=workflow >/dev/null || true
fi

cat <<EOF2

仓库已就绪：
  站点（Public）:  https://github.com/$owner/$site_repo
  内容（Private）: https://github.com/$owner/$content_repo

下一步：创建两个 Fine-grained PAT，然后运行 ./scripts/configure-secrets.sh
首次部署前 Actions 失败属正常现象（缺 Secret）。
EOF2
