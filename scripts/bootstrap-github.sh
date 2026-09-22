#!/usr/bin/env bash
# 创建/推送两个 GitHub 仓库并写入 Repository Variables。
#
#   ./scripts/bootstrap-github.sh [--dry-run]
#
# 账号锁定：默认使用 $GITHUB_OWNER（默认 lunafoundry）的 gh 凭据，
# 通过 `gh auth token --user` 取 token，因此不依赖当前 gh 活跃账号。
#
# 环境变量覆盖：
#   GITHUB_OWNER   目标账号（默认 lunafoundry）
#   GIT_PROTOCOL   ssh（默认）| https
#   SSH_HOST_ALIAS SSH 别名（默认 github-<owner>，先在 setup-git-account.sh 中配置）
#   SITE_REPO / CONTENT_REPO / CONTENT_DIR
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
owner="${GITHUB_OWNER:-lunafoundry}"
site_repo="${SITE_REPO:-luna-site}"
content_repo="${CONTENT_REPO:-luna-ore}"
content_dir="${CONTENT_DIR:-$root/../luna-ore}"
git_protocol="${GIT_PROTOCOL:-ssh}"
ssh_alias="${SSH_HOST_ALIAS:-github-$owner}"
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --protocol) git_protocol="$2"; shift 2 ;;
    --ssh-alias) ssh_alias="$2"; shift 2 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

remote_url() {
  local repo="$1"
  if [ "$git_protocol" = "ssh" ]; then
    echo "git@$ssh_alias:$owner/$repo.git"
  else
    echo "https://github.com/$owner/$repo.git"
  fi
}

say() { printf '%s\n' "$*"; }

command -v gh >/dev/null 2>&1 || { echo "缺少 gh CLI" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "缺少 git" >&2; exit 1; }

# ---- 账号锁定 ----
account_token=""
if [ "$dry_run" = 0 ]; then
  if ! account_token="$(gh auth token --user "$owner" 2>/dev/null)"; then
    cat >&2 <<EOF2
gh 未登录账号 $owner（当前活跃账号可能是别人）。
先执行：gh auth login --hostname github.com    # 选择 $owner
或用：  GITHUB_OWNER=<你的账号> $0
EOF2
    exit 1
  fi
  export GH_TOKEN="$account_token"
  gh auth status >/dev/null
fi

# ---- SSH 连通性预检（避免建完仓推不上去）----
if [ "$dry_run" = 0 ] && [ "$git_protocol" = "ssh" ]; then
  if ! ssh_out="$(ssh -o BatchMode=yes -o ConnectTimeout=6 -T "git@$ssh_alias" 2>&1)"; then :; fi
  case "$ssh_out" in
    *"successfully authenticated"*) say "SSH 别名 $ssh_alias 认证成功" ;;
    *)
      cat >&2 <<EOF2
SSH 别名 $ssh_alias 认证失败：
  $ssh_out

请先完成（见 docs/GITHUB-CLI.md 的“多账号共存”一节）：
  ./scripts/setup-git-account.sh --account $owner --generate-key
  并把公钥添加到 $owner 账号：gh ssh-key add ~/.ssh/id_ed25519_$owner.pub --title "\$(hostname -s)"
验证：ssh -T git@$ssh_alias
EOF2
      exit 1
      ;;
  esac
fi

# ---- 计划输出 ----
say "账号:        $owner"
say "站点仓库:    $owner/$site_repo  ($(remote_url "$site_repo"))"
say "内容仓库:    $owner/$content_repo ($(remote_url "$content_repo"))"
say "内容目录:    $content_dir"
say "Variables:"
say "  CONTENT_REPOSITORY = $owner/$content_repo"
say "  SITE_URL           = https://$owner.github.io"
say "  BASE_PATH          = /$site_repo/"
say "  SITE_REPOSITORY    = $owner/$site_repo"
say ""

if [ "$dry_run" = 1 ]; then
  say "[dry-run] 不执行任何创建或推送。去掉 --dry-run 即按上述计划执行。"
  exit 0
fi

create_repo_if_missing() {
  local full="$1" visibility="$2" description="$3"
  if gh repo view "$full" >/dev/null 2>&1; then
    say "仓库已存在，跳过创建: $full"
    return
  fi
  if [ "$visibility" = "public" ]; then
    gh repo create "$full" --public --description "$description"
  else
    gh repo create "$full" --private --description "$description"
  fi
}

push_repo() {
  local dir="$1" repo="$2"
  cd "$dir"
  [ -d .git ] || git init -b main

  # 身份兜底：若全局 includeIf 未覆盖该目录，则写入仓库级身份
  if [ -z "$(git config user.email || true)" ]; then
    git config user.name "$owner"
    git config user.email "$(account_email)"
  fi

  git add -A
  git diff --cached --quiet || git commit -m "Initialize $repo"

  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$(remote_url "$repo")"
  else
    git remote add origin "$(remote_url "$repo")"
  fi
  git branch -M main
  git push -u origin main
}

account_id="$(gh api "users/$owner" --jq .id)"
account_email() { echo "${account_id}+${owner}@users.noreply.github.com"; }

create_repo_if_missing "$owner/$site_repo" public "LunaFoundry public Astro + Pagefind site engine"
create_repo_if_missing "$owner/$content_repo" private "Private LunaFoundry writing and media ore"

say "写入 Repository Variables..."
gh variable set CONTENT_REPOSITORY --repo "$owner/$site_repo" --body "$owner/$content_repo"
gh variable set SITE_URL --repo "$owner/$site_repo" --body "https://$owner.github.io"
gh variable set BASE_PATH --repo "$owner/$site_repo" --body "/$site_repo/"
gh variable set SITE_REPOSITORY --repo "$owner/$content_repo" --body "$owner/$site_repo"

say "推送站点仓库..."
push_repo "$root" "$site_repo"

say "推送私有内容仓库..."
push_repo "$content_dir" "$content_repo"

say "启用 GitHub Pages（Actions 源）..."
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
（首次部署前 Actions 失败属正常现象——它由 configure-secrets.sh 触发。）
EOF2
