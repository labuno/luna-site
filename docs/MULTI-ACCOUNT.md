# 多账号共存：一台机器管理多个 GitHub 身份

目标：`labuno`（本站点账号，2026-09 由 `lunafoundry` 更名而来）与个人账号（例如 `lucas-zan`）在同一台 Mac 上互不干扰，
此后新建仓库不需要重复配置。

> 备注：此前按旧名生成的机器配置（`~/.gitconfig-lunafoundry`、SSH 别名 `github-lunafoundry`、`~/.ssh/id_ed25519_lunafoundry`）指向同一账号，仍可继续使用；如需统一为新命名，请先删除 `~/.gitconfig` 与 `~/.ssh/config` 中对应的旧配置块，再按下文命令重跑。

## 三层身份，各自独立

| 层 | 作用范围 | 配置位置 | 本项目做法 |
|---|---|---|---|
| Git 提交身份 | 某目录下的所有仓库 | `~/.gitconfig` + `includeIf` | 目录级自动切换，无需每仓设置 |
| Git 推送身份 | 某账号的仓库 | `~/.ssh/config` 专用 Host 别名 | 一个账号一把 key，互不冲突 |
| gh CLI 身份 | 命令行调用 API/工作流 | gh 多账号（keyring） | 脚本内 `GH_TOKEN=$(gh auth token -u <账号>)` 锁定，不改全局状态 |
| CI 凭据（跨仓库） | Actions 运行 | Repository Secrets | 两个 Fine-grained PAT；仓库规模变大后可换 GitHub App |

## 一次性配置

```bash
cd luna-site
./scripts/setup-git-account.sh \
  --account labuno \
  --root /Users/lucas/Documents/products/blog-pack \
  --generate-key
```

脚本（幂等，可重复执行）会写三处配置并生成一把专属 SSH key：

1. `~/.gitconfig-labuno`：提交身份 + URL 重写
   （`https://github.com/labuno/…` 与 `git@github.com:labuno/…` 都自动改写成专用别名）
2. `~/.gitconfig`：追加一条 `includeIf "gitdir:<root>/"`，只对 `<root>` 下的仓库生效
3. `~/.ssh/config`：追加 `Host github-labuno`（`IdentityFile ~/.ssh/id_ed25519_labuno`、`IdentitiesOnly yes`）
4. `~/.ssh/id_ed25519_labuno{,.pub}`：账号专属密钥

然后把公钥添加到该账号，并验证：

```bash
gh auth login --hostname github.com          # 添加 labuno 账号（多账号共存，不覆盖个人账号）
gh ssh-key add ~/.ssh/id_ed25519_labuno.pub --title "$(hostname -s)"
ssh -T git@github-labuno                # 期望：Hi labuno! You've successfully authenticated...
```

验证 git 身份（在作用目录内的任意仓库中）：

```bash
git config user.name    # LunaFoundry
git config user.email   # 330791588+labuno@users.noreply.github.com
```

## 日常使用

```bash
# gh 命令默认用活跃账号；需要以某个账号执行时，单条命令指定即可
GH_TOKEN="$(gh auth token -u labuno)" gh repo list labuno

# 切换 gh 的默认活跃账号（影响所有未指定账号的命令）
gh auth switch --user labuno
gh auth status
```

`scripts/bootstrap-github.sh` 与 `scripts/configure-secrets.sh` 已经内置账号锁定：
它们通过 `gh auth token --user <owner>` 取凭据，**不会**因为活跃账号是别人而把仓库建错地方。
建仓前可先用 `--dry-run` 检查计划：

```bash
./scripts/bootstrap-github.sh --dry-run
```

## 新仓库如何接入（以后照做）

1. 把仓库放在同一作用目录下（例如 `/Users/lucas/Documents/products/blog-pack/`），
   git 身份与 SSH 别名自动生效，无需任何配置。
2. 克隆/新建时使用别名地址：
   `git clone git@github-labuno:labuno/<repo>.git`
   或先 `git remote set-url origin git@github-labuno:labuno/<repo>.git`。
3. 需要 CI 跨仓库访问时，再按 `docs/GITHUB-CLI.md` 配置 Variables/Secrets。

如果新仓库不在同一目录，两种选择：把 `--root` 换成新的父目录重新执行一次
（脚本会提示旧规则需要手动删除），或直接在仓库内设置本地身份：

```bash
git config user.name "LunaFoundry"
git config user.email "330791588+labuno@users.noreply.github.com"
git config url."git@github-labuno:".insteadOf "https://github.com/labuno/"
```

## CI 凭据的长期选择

| 方案 | 适用 | 说明 |
|---|---|---|
| 两个 Fine-grained PAT（当前） | 1–2 个仓库对 | 权限最小、配置简单；有有效期，到期需轮换 |
| GitHub App + installation token | 仓库/组织变多 | 无长期密钥，token 由 workflow 动态生成（`actions/create-github-app-token`），审批粒度更细 |

仓库数量增加后再迁移到 GitHub App 即可，工作流中只是把 `secrets.CONTENT_REPO_TOKEN`
换成上一步生成的 `steps.app-token.outputs.token`，其余逻辑不变。

## 解除或迁移

- 删除账号配置：移除 `~/.gitconfig` 中带 `managed by setup-git-account.sh` 注释的块、
  删除 `~/.gitconfig-<账号>`、移除 `~/.ssh/config` 中同名注释块与对应的 key。
- 换账号：用新账号重新执行 `setup-git-account.sh`；旧块按上面步骤清理。
- 不要把私钥提交到仓库；`~/.ssh` 与 `~/.gitconfig*` 都在仓库之外。
