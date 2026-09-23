#!/usr/bin/env bash
# 为某个 GitHub 账号配置“账号级”git 身份与 SSH 别名，一次配置、长期复用。
#
#   ./scripts/setup-git-account.sh --account labuno [--root <dir>] [--generate-key]
#
# 会做四件事（全部幂等，重复执行不会产生重复配置）：
#   1. 生成 ~/.gitconfig-<account>：commit 身份 + URL 重写（HTTPS/原 SSH -> 专用 SSH 别名）
#   2. 在 ~/.gitconfig 中追加 includeIf：只对 <root> 目录下的仓库生效，不影响个人账号
#   3. 在 ~/.ssh/config 中追加 Host 别名（默认 github-<account>），指向该账号专属 key
#   4. 检查 / 可选生成该账号的 SSH key，并打印下一步
#
# 常用环境变量覆盖：GITHUB_OWNER / GIT_USER_NAME / GIT_EMAIL / ACCOUNT_ID
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
account="${GITHUB_OWNER:-labuno}"
repo_root="$(dirname "$root_dir")"
scope_root="$repo_root"
ssh_alias=""
key_path=""
generate_key=0
dry_run=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --account) account="$2"; shift 2 ;;
    --root) scope_root="$2"; shift 2 ;;
    --ssh-alias) ssh_alias="$2"; shift 2 ;;
    --key) key_path="$2"; shift 2 ;;
    --generate-key) generate_key=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

ssh_alias="${ssh_alias:-github-$account}"
key_path="${key_path:-$HOME/.ssh/id_ed25519_$account}"
scope_root="$(cd "$scope_root" && pwd)"
account_config="$HOME/.gitconfig-$account"
global_config="$HOME/.gitconfig"
ssh_config="$HOME/.ssh/config"

say() { printf '%s\n' "$*"; }
run_or_print() {
  if [ "$dry_run" = 1 ]; then
    say "  [dry-run] $*"
  else
    "$@"
  fi
}

# ---- 账号信息 ----
account_id="${ACCOUNT_ID:-}"
if [ -z "$account_id" ]; then
  if ! account_id="$(gh api "users/$account" --jq .id 2>/dev/null)"; then
    echo "无法确定账号 $account 的 ID：请设置 ACCOUNT_ID 或先 gh auth login" >&2
    exit 1
  fi
fi
user_name="${GIT_USER_NAME:-$account}"
user_email="${GIT_EMAIL:-${account_id}+${account}@users.noreply.github.com}"

say "账号:        $account (id=$account_id)"
say "提交身份:    $user_name <$user_email>"
say "作用目录:    $scope_root/"
say "SSH 别名:    $ssh_alias -> $key_path"
say ""

# ---- 1. 账号级 gitconfig ----
say "[1/4] 写入 $account_config"
account_config_content="# 由 scripts/setup-git-account.sh 管理：$account
[user]
	name = $user_name
	email = $user_email
[url \"git@$ssh_alias:\"]
	insteadOf = https://github.com/$account/
	insteadOf = git@github.com:$account/
[github]
	user = $account
"
if [ "$dry_run" = 1 ]; then
  say "  [dry-run] 写入上述内容"
else
  printf '%s' "$account_config_content" > "$account_config"
fi

# ---- 2. ~/.gitconfig includeIf ----
marker="managed by setup-git-account.sh: $account"
say "[2/4] 在 $global_config 中确保 includeIf 规则"
if [ -f "$global_config" ] && grep -qF "$marker" "$global_config"; then
  if grep -qF "gitdir:$scope_root/" "$global_config"; then
    say "  已存在，跳过"
  else
    say "  已存在该账号的规则，但作用目录不同。请手动删除旧规则后重跑："
    grep -nF "gitdir:" "$global_config" | sed 's/^/    /'
  fi
elif [ "$dry_run" = 1 ]; then
  say "  [dry-run] 追加：[includeIf \"gitdir:$scope_root/\"] -> $account_config"
else
  {
    say ""
    say "# >>> $marker"
    say "[includeIf \"gitdir:$scope_root/\"]"
    say "	path = $account_config"
    say "# <<< $marker"
  } >> "$global_config"
  say "  已追加"
fi

# ---- 3. ~/.ssh/config Host 别名 ----
say "[3/4] 在 $ssh_config 中确保 Host $ssh_alias"
mkdir -p "$(dirname "$ssh_config")"
if [ -f "$ssh_config" ] && grep -qF "Host $ssh_alias" "$ssh_config"; then
  say "  已存在，跳过"
elif [ "$dry_run" = 1 ]; then
  say "  [dry-run] 追加：Host $ssh_alias (HostName github.com, IdentityFile ~/.ssh/$(basename "$key_path"))"
else
  {
    say ""
    say "# >>> $marker"
    say "Host $ssh_alias"
    say "	HostName github.com"
    say "	User git"
    say "	IdentityFile ~/.ssh/$(basename "$key_path")"
    say "	IdentitiesOnly yes"
    say "# <<< $marker"
  } >> "$ssh_config"
  chmod 600 "$ssh_config" 2>/dev/null || true
  say "  已追加"
fi

# ---- 4. SSH key ----
say "[4/4] 检查 SSH key: $key_path"
key_exists=0
[ -f "$key_path" ] && key_exists=1
if [ "$key_exists" = 1 ]; then
  say "  已存在"
elif [ "$generate_key" = 1 ]; then
  if [ "$dry_run" = 1 ]; then
    say "  [dry-run] ssh-keygen -t ed25519 -C \"$account\" -f $key_path"
  else
    ssh-keygen -t ed25519 -C "$account" -f "$key_path" -N "" >/dev/null
    say "  已生成（无口令）。如需口令：ssh-keygen -p -f $key_path"
  fi
else
  say "  不存在。生成：ssh-keygen -t ed25519 -C \"$account\" -f $key_path -N ''"
  say "  （或重新执行本脚本并加 --generate-key）"
fi

if gh auth token --user "$account" >/dev/null 2>&1; then
  say ""
  say "gh 已登录该账号：gh 命令可用 GH_TOKEN=\$(gh auth token -u $account) 精确指定身份"
else
  say ""
  say "提醒：gh 目前未登录 $account。登录后即可用它建仓："
  say "  gh auth login --hostname github.com   # 选择 $account 账号"
fi

cat <<EOF2

下一步：
  1. 把公钥加到该账号（Settings -> SSH and GPG keys，或登录后执行）：
       gh ssh-key add $key_path.pub --title "MacBook $(hostname -s)"
  2. 验证：ssh -T git@$ssh_alias
  3. 建仓并推送（本仓库，脚本会自动使用 $account 身份与远端）：
       ./scripts/bootstrap-github.sh
EOF2
