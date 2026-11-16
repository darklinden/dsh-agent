# Migration Plan: flat root → `bin/ assets/ third-party/ var/`

**Status: Stages 0–1 executed (2026-11-16); Stages 2–6 outstanding.** This document is
the executable plan; the reasoning behind each decision lives in `docs/adr/0001`–`0008`
and is not repeated here.

| Stage | State |
|---|---|
| 0 — backup | done — `backups/2026-11-16-migration/` holds the pre-move copies |
| 1 — file layer + script edits | done — `bin/`, `assets/`, `var/` in place; every §1.3 retarget applied, 24 shims verified in place |
| 2 — secret gate | pending — `.env` is still `0644`; the maintainer runs `chmod 600` and the gate |
| 3 — first commit | pending — the repo has zero commits |
| 4 — submodules | pending — `third-party/` is empty and there is no `.gitmodules` |
| 5 — build + PATH | pending |
| 6 — retire `usrbin` duplicates | pending |

Target layout, entry points, and guard behaviour: ADR-0001, ADR-0004, ADR-0005.
Source-of-truth switch and its verification window: ADR-0002.
Submodules: ADR-0003. Secret gate: ADR-0006. Plugin source: ADR-0007.
Post-Stage-1 home and naming decision: ADR-0008.

> **Post-Stage-1 change (2026-11-16):** `bin/dsm` is now `bin/dsh-blender`
> (`DSM_GUARD_ROOT` → `DSH_BLENDER_GUARD_ROOT`), and DSH homes moved under the
> repo-local `dsh-home/<name>/` root (ADR-0008). The stage commands below describe the
> earlier flat → layered move and are kept as history; the one-time home migration is in
> “Post-Stage-1 home migration” at the end of this file.

## Preconditions

- `/opt/home/Bin` is left untouched until Stage 6; the old entry points keep working
  through every earlier stage.
- `git` in this repo is blocked by the guard in interactive dsh sessions: every `git`
  command below is run by the maintainer, not by an agent.
- Executing agent: read this file plus the eight scripts it names. Line numbers are
  deliberately absent — locate each reference with `grep -n` against the working copy.

## Stage 0 — backup

```sh
cd /opt/home/Github/dsh-agent
mkdir -p backups/2026-11-16-migration
cp -a .env ai-bridge ai-bridge-with-log ccc commit dsh-agent dsh-agent-preset.mjs \
      dsh-jailbreak dsh-jailbreak-cwd-variable.mjs dsh-jailbreak.patch.yml \
      dsh-photocraft dsh-photocraft.patch.yml dsm global-AGENTS.md ma pull-all \
      push-all wrong-cmd wrong-cmd-subcmd wrong-cmd.d \
      backups/2026-11-16-migration/
```

`backups/` is gitignored. Restore after Stage 1 by copying back over the tree.

## Stage 1 — file layer (no git)

### 1.1 Directories

```sh
mkdir -p bin assets third-party var/logs/ai-bridge var/logs/ma var/home/dsh
```

### 1.2 Moves

```sh
# launchers and guard -> bin/
mv ai-bridge-with-log ccc commit dsh-agent dsh-jailbreak dsh-photocraft dsm \
   pull-all push-all wrong-cmd wrong-cmd-subcmd wrong-cmd.d bin/
# support files -> assets/
mv dsh-agent-preset.mjs global-AGENTS.md dsh-jailbreak-cwd-variable.mjs \
   dsh-jailbreak.patch.yml dsh-photocraft.patch.yml assets/
# the plugin must leave the tree before Stage 4 re-adds it as a submodule
mv dsh-blender-plugin /opt/home/Github/dsh-blender-plugin-old
# history logs are discarded (ADR-0001); new logs land in var/
trash ai-bridge-logs ma-logs
# macOS noise
trash .DS_Store bin/.DS_Store assets/.DS_Store 2>/dev/null
```

`bin/ai-bridge` and `bin/ma` stay where they are — they are already in `bin/` and are
gitignored build output (ADR-0004).

### 1.3 Script edits

Every touched script gets, immediately after its `SCRIPT_DIR=` line:

```sh
ROOT="$(dirname "$SCRIPT_DIR")"
```

`bin/dsh-agent` additionally exports `DSH_AGENT_ROOT="$ROOT"` (the patch overlays read
it). Then, per file — find each reference with `grep -n` first:

| File | References to retarget |
|---|---|
| `bin/dsh-agent` | `$SCRIPT_DIR/.env` → `$ROOT/.env` (3×) · `$SCRIPT_DIR/dsh-agent-preset.mjs` → `$ROOT/assets/dsh-agent-preset.mjs` (3×) · `AGENTS_TEMPLATE="$SCRIPT_DIR/global-AGENTS.md"` → `$ROOT/assets/global-AGENTS.md` · **leave** the `wrong-cmd.d` / `wrong-cmd` / `wrong-cmd-subcmd` lookups alone (ADR-0005) |
| `bin/dsh-photocraft` | `$SCRIPT_DIR/.env` → `$ROOT/.env` (3×) · `ln -s "$SCRIPT_DIR/dsh-photocraft.patch.yml"` → `$ROOT/assets/dsh-photocraft.patch.yml` · `PHOTOCRAFT_CLI` default → `$SCRIPT_DIR/photocraft-cli` · **leave** `exec "$SCRIPT_DIR/dsh-agent"` |
| `bin/dsh-jailbreak` | `$SCRIPT_DIR/.env` → `$ROOT/.env` (2×) · add `PLUGIN_PKG="${DSH_JAILBREAK_PLUGIN_PKG:-dsh-purge-community}"` · `PLUGIN_SOURCE` default → `github:darklinden/dsh-purge-community` · `plugin_ready()`: all three `dsh-purge` literals → `"$PLUGIN_PKG"` (pass it as `argv[2]` to `node -e`) · `$SCRIPT_DIR/dsh-jailbreak.patch.yml` → `$ROOT/assets/dsh-jailbreak.patch.yml` (3×) · user-facing `dsh-purge` strings → `$PLUGIN_PKG` |
| `bin/ai-bridge-with-log` | `cd "$SCRIPT_DIR"` → `cd "$ROOT"` · `mkdir -p ai-bridge-logs` / `LOG=` / `PIDFILE=` → `$ROOT/var/logs/ai-bridge/…` · **leave** both `$SCRIPT_DIR/ai-bridge` execs |
| `bin/dsm` | `PROJ_TAG` computed from `$ROOT` · `.env` → `$ROOT/.env` (3×) · `DSH_HOME="$SCRIPT_DIR/.dsh"` → `$ROOT/var/home/dsh` · `PLUGIN_DIR="$SCRIPT_DIR/dsh-blender-plugin"` → `$ROOT/third-party/dsh-blender-plugin` · `$SCRIPT_DIR/dsh-blender.config.json` → `$ROOT/dsh-blender.config.json` (2×) · `GUARD_ROOT` default → `$ROOT/bin` · comments at the guard/plugin sections |
| `bin/ccc` | `.env` → `$ROOT/.env` (2×) |
| `bin/pull-all`, `bin/push-all` | `.env` → `$ROOT/.env` (3× each) |
| `assets/dsh-jailbreak.patch.yml` | `name: /opt/home/Bin/dsh-jailbreak-cwd-variable.mjs` → `name: !!js process.env.DSH_AGENT_ROOT + '/assets/dsh-jailbreak-cwd-variable.mjs'` |
| `assets/dsh-photocraft.patch.yml` | `process.env.PHOTOCRAFT_CLI ?? '/opt/home/Bin/photocraft-cli'` → `process.env.PHOTOCRAFT_CLI ?? (process.env.DSH_AGENT_ROOT + '/bin/photocraft-cli')` |
| `bin/wrong-cmd.d/*` | 24 links keep `../wrong-cmd` / `../wrong-cmd-subcmd`: `wrong-cmd.d/` sits one level below `bin/`, so these resolve to `bin/wrong-cmd` and `bin/wrong-cmd-subcmd`. A bare `wrong-cmd` target would dangle. |

Unchanged: `bin/commit` (`$SCRIPT_DIR/ma` is a sibling), `bin/wrong-cmd`,
`bin/wrong-cmd-subcmd`, `assets/dsh-agent-preset.mjs`,
`assets/dsh-jailbreak-cwd-variable.mjs`.

### 1.4 New files

`.gitignore`, `.env.example`, `install.sh`, `README.md`, `LICENSE` — content in Appendix
A/B/C and in the repository root after Stage 1.

Added after this plan was written, with no stage change of its own: `GLOSSARY.md`,
`AGENTS.md`, `docs/adr/0001`–`0007`, and
`docs/agents/{domain,issue-tracker,triage-labels}.md`. They land in the Stage 3 commit.

## Stage 2 — secret gate (maintainer, non-skippable)

```sh
cd /opt/home/Github/dsh-agent
chmod 600 .env
git status --short
# must show no .env, no var/, no bin/{ai-bridge,ma,photocraft-cli}
git add -A
git diff --cached --name-only | grep -E '(^|/)\.env$|^var/|^bin/(ai-bridge|ma|photocraft-cli)$'
# must print nothing; if it prints, `git reset` and stop
```

## Stage 3 — first commit (maintainer)

```sh
git commit -m "Reorganize into bin/ + assets/ + var/ layout; add install.sh, .env.example, docs"
git branch -M main
```

Publishing (remote + push) is outside this plan.

## Stage 4 — submodules (maintainer)

```sh
git config --global url."git@github.com:".insteadOf "https://github.com/"
git submodule add -b main https://github.com/darklinden/ai-bridge.git third-party/ai-bridge
git submodule add -b main https://github.com/darklinden/micro-agent.git third-party/micro-agent
git submodule add -b main https://github.com/darklinden/dsh-purge-community.git third-party/dsh-purge-community
git submodule add -b main https://github.com/XMoon/dsh-pi-tui.git third-party/dsh-pi-tui
git submodule add -b main https://github.com/sixtysevenlf/dsh-blender-plugin.git third-party/dsh-blender-plugin
git commit -m "Add third-party submodules"
```

Rebuild the plugin, then remove the old copy:

```sh
cd third-party/dsh-blender-plugin
npm ci
DSH_CHECKOUT=<dsh source checkout> bash scripts/build.sh
cd ../..
trash /opt/home/Github/dsh-blender-plugin-old
```

## Stage 5 — build and switch PATH (maintainer)

```sh
./install.sh
# ~/.zshrc: insert ABOVE the /opt/home/Bin line
#   export PATH="/opt/home/Github/dsh-agent/bin:$PATH"
exec zsh
command -v dsh-agent wrong-cmd ma ai-bridge photocraft-cli
```

Guard regression, inside a `dsh-agent` session:

```sh
rm -rf /tmp/should-block   # expect: wrong-cmd refuses
ssh example.com            # expect: refused
git log -1                 # expect: allowed
pwd                        # expect: allowed
```

## Stage 6 — retire the `usrbin` duplicates (maintainer)

```sh
cd /opt/home/Bin
trash ai-bridge ai-bridge-with-log ai-bridge-logs ccc commit dsh-agent \
      dsh-agent-preset.mjs dsh-jailbreak dsh-jailbreak-cwd-variable.mjs \
      dsh-jailbreak.patch.yml dsh-photocraft dsh-photocraft.patch.yml dsm \
      global-AGENTS.md ma ma-logs pull-all push-all wrong-cmd wrong-cmd-subcmd wrong-cmd.d
trash photocraft-cli        # untracked by usrbin; bin/photocraft-cli replaces it
git status --short && git commit -m "Move dsh/ai scripts to the dsh-agent repo" && git push
```

## Rollback

| After | Action |
|---|---|
| Stage 1 | copy `backups/2026-11-16-migration/.` back over the tree |
| Stage 3 | `git reset --hard <first-commit>`; if that is not enough, restore from backup |
| Stage 5 | delete the `PATH` line, `exec zsh` |
| Stage 6 | in `/opt/home/Bin`: `git reset --hard HEAD~1` (files remain in usrbin history), push |

## Known transition windows

- Stage 1 → Stage 4: `dsm` exits because `third-party/dsh-blender-plugin` is absent.
- Stage 1 → Stage 5: `dsh-photocraft` cannot find `bin/photocraft-cli`.
- Both affect only the new entry points; `/opt/home/Bin` still serves the old ones.

---

## Appendix A — `.gitignore`

```gitignore
.DS_Store
.env
dsh-blender.config.json
dsh-home/
var/
backups/
bin/ai-bridge
bin/ma
bin/photocraft-cli
```

## Appendix B — `.env.example`

```sh
# ---- DDD endpoint (read by dsh-agent / dsh-blender) ----
DDD_BASE_URL=http://127.0.0.1:18650
DDD_AUTH_TOKEN=                   # secret
DDD_MODEL=
DDD_PROTOCOL=anthropic-messages   # anthropic-messages | openai-completions | openai-responses
DDD_CONTEXT_WINDOW=

# ---- Tavily MCP (read by dsh-agent / dsh-blender) ----
TAVILY_API_KEY=                   # secret

# ---- ccc only (ccc exits when any of these is unset) ----
CCC_BASE_URL=
CCC_AUTH_TOKEN=                   # secret
CCC_MODEL=

# ---- optional switches (defaults apply when commented out) ----
# DSH_CMD_GUARD=on
# DSA_SEED_AGENTS=on
# DSA_WEB_SEARCH=off
# DSH_PI_TUI_PROFILE=pi-tui
# DSH_PI_TUI_PRESET=
# DSH_PI_TUI_RESUME_SESSION=
# DSH_PI_TUI_WORKSPACE_TARGET=
# PHOTOCRAFT_CLI=                 # default <repo>/bin/photocraft-cli
# PHOTOCRAFT_CLI_VERSION=          # default: the latest release tag
# DSH_BLENDER_GUARD_ROOT=         # default <repo>/bin
# DSH_JAILBREAK_PLUGIN_SOURCE=    # default github:darklinden/dsh-purge-community
# DSH_JAILBREAK_PLUGIN_PKG=       # default dsh-purge-community
# DSP_MCP_ROOT=
# DSP_HOME_NAME=                  # default dsh-photocraft, under <repo>/dsh-home/
# DSP_AUTOMATION_ROOT=
# DSH_JAILBREAK_HOME_NAME=        # default dsh-jailbreak, under <repo>/dsh-home/
```

## Appendix C — `install.sh`

```bash
#!/usr/bin/env bash
# Idempotent: submodules -> build bin/{ai-bridge,ma} (then cargo clean) ->
# fetch the latest photocraft-cli -> create var/ and dsh-home/ -> report PATH status.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd "$ROOT"
say() { printf '==> %s\n' "$*"; }
die() { printf 'install: %s\n' "$*" >&2; exit 1; }

# One EXIT trap for the temp download directory. `tmp` is deliberately NOT
# function-local: the trap runs after the frame that created it is gone, and
# under `set -u` a `local` here aborts the trap with "tmp: unbound variable",
# which also turns a successful install into exit status 1.
tmp=""
cleanup() {
    if [ -n "$tmp" ] && [ -d "$tmp" ]; then
        trash "$tmp" 2>/dev/null || rm -rf "$tmp" || true
    fi
    return 0
}
trap cleanup EXIT

PHOTOCRAFT_VERSION="${PHOTOCRAFT_CLI_VERSION:-}"   # empty => the latest release

# Version selection: an explicit PHOTOCRAFT_CLI_VERSION always wins; otherwise
# follow the latest release tag. Resolving through the /releases/latest redirect
# keeps the unauthenticated GitHub API (60 requests/h) out of the install path.
resolve_photocraft_version() {
    local final
    final=$(curl -fsSIL --max-time 25 \
                --retry 3 --retry-delay 2 --retry-all-errors \
                -o /dev/null -w '%{url_effective}' \
                "https://github.com/storytold/photocraft/releases/latest" 2>/dev/null) || return 1
    case "$final" in
        */releases/tag/v[0-9]*) printf '%s\n' "${final##*/releases/tag/v}" ;;
        *) return 1 ;;
    esac
}

if [ -f .gitmodules ]; then
    say "initializing submodules"
    git submodule update --init --recursive
fi

build_rust() { # <subdir> <bin>
    local dir="third-party/$1" name="$2"
    [ -f "$dir/Cargo.toml" ] || die "missing $dir/Cargo.toml — submodule not checked out?"
    command -v cargo >/dev/null || die "cargo not found (rustup.rs) — needed to build $name"
    say "building $name"
    cargo build --release --manifest-path "$dir/Cargo.toml"
    install -m 0755 "$dir/target/release/$name" "bin/$name"
    say "cleaning $dir/target"
    cargo clean --manifest-path "$dir/Cargo.toml"
}
build_rust ai-bridge ai-bridge
build_rust micro-agent ma

install_photocraft() {
    local want="$PHOTOCRAFT_VERSION" have=""
    if [ -z "$want" ]; then
        say "resolving the latest photocraft-cli release"
        want=$(resolve_photocraft_version) \
            || die "could not resolve the latest photocraft release — set PHOTOCRAFT_CLI_VERSION=x.y.z and re-run"
    fi
    if [ -x bin/photocraft-cli ]; then
        have=$(bin/photocraft-cli --version 2>/dev/null | awk '{print $2}')
    fi
    if [ "$have" = "$want" ]; then say "photocraft-cli $want already installed"; return 0; fi
    [ "$(uname -s)" = "Darwin" ] || die "photocraft-cli fetch is macOS-only; set PHOTOCRAFT_CLI to an existing binary"
    command -v curl >/dev/null || die "curl not found"
    command -v unzip >/dev/null || die "unzip not found"
    local url="https://github.com/storytold/photocraft/releases/download/v${want}/photocraft-cli-${want}-macos-universal.zip"
    say "fetching photocraft-cli $want"
    tmp=$(mktemp -d)
    # Retries because this is a 60+ MB asset behind a GitHub redirect, and a
    # single transient reset (e.g. a proxy dropping the TLS connection) would
    # otherwise fail the whole install after the Rust builds already succeeded.
    # --retry-all-errors needs curl >= 7.71; without it, curl retries only the
    # transient classes it knows.
    curl -fL --progress-bar \
        --retry 5 --retry-delay 3 --retry-all-errors --connect-timeout 20 \
        "$url" -o "$tmp/pc.zip" \
      || die "could not fetch $url — put a photocraft-cli ${want} binary at bin/photocraft-cli and re-run"
    unzip -q "$tmp/pc.zip" -d "$tmp/x"
    local found
    found=$(find "$tmp/x" -type f -name 'photocraft-cli' -perm -u+x | head -1)
    [ -n "$found" ] || found=$(find "$tmp/x" -type f -name 'photocraft-cli' | head -1)
    [ -n "$found" ] || die "photocraft-cli not found inside the release zip"
    install -m 0755 "$found" bin/photocraft-cli
    say "photocraft-cli -> bin/photocraft-cli ($(bin/photocraft-cli --version 2>/dev/null))"
}
install_photocraft

mkdir -p var/logs/ai-bridge var/logs/ma dsh-home
chmod 700 dsh-home
[ -f .env ] || say "warning: .env missing — cp .env.example .env and fill it in"
for s in wrong-cmd wrong-cmd-subcmd; do [ -x "bin/$s" ] || die "bin/$s not executable"; done
[ -n "$(ls -A bin/wrong-cmd.d 2>/dev/null)" ] || die "bin/wrong-cmd.d is empty — guard shims missing"

case ":$PATH:" in
  *":$ROOT/bin:"*) say "$ROOT/bin is on PATH" ;;
  *) say "add this line to ~/.zshrc, ABOVE the /opt/home/Bin entry:"
     printf '\n    export PATH="%s/bin:$PATH"\n\n' "$ROOT" ;;
esac
say "done"
```

## Post-Stage-1 home migration

Run this from a plain terminal, **after every DSH session has exited**. The current
session's `DSH_HOME` may be `~/.dsh`; moving it while that session is live would break it.
The commands move state, never delete it, and skip a destination that already exists.

```sh
ROOT=/opt/home/Github/dsh-agent   # adjust if the repo lives elsewhere
mkdir -p "$ROOT/dsh-home"
chmod 700 "$ROOT/dsh-home"

move_home() {
    src=$1; dest=$2
    [ -e "$src" ] || [ -L "$src" ] || return 0
    if [ -e "$dest" ] || [ -L "$dest" ]; then
        echo "skip: target already exists -> $dest"
        return 0
    fi
    mv "$src" "$dest"
}

move_home "$HOME/.dsh"             "$ROOT/dsh-home/dsh-agent"
move_home "$HOME/.dsh-jailbreak"   "$ROOT/dsh-home/dsh-jailbreak"
move_home "$HOME/.dsh-photocraft"  "$ROOT/dsh-home/dsh-photocraft"
move_home "$ROOT/var/home/dsh"     "$ROOT/dsh-home/dsh-blender"
```

`~/.dsh-blender-rt` is deliberately **not** moved: it is the Blender plugin's own workDir
(`os.homedir()/.dsh-blender-rt`, per `third-party/dsh-blender-plugin/runtime/config.ts`),
not a DSH home. Moving it would orphan the plugin's renders and ledger.

The two home-level patch links that the launchers install are symlinks into `assets/`.
If a moved home still points at a pre-migration `/opt/home/Bin/...` copy, re-point only
that launcher-managed link; leave any other link alone and report it:

```sh
repoint() { # <home-name> <asset>
    link="$ROOT/dsh-home/$1/cordis.patch.yml"
    want="$ROOT/assets/$2"
    [ -L "$link" ] || return 0
    case "$(readlink "$link")" in
        /opt/home/Bin/*) ln -sfn "$want" "$link" ;;
        *) echo "left foreign link alone: $link -> $(readlink "$link")" ;;
    esac
}
repoint dsh-jailbreak   dsh-jailbreak.patch.yml
repoint dsh-photocraft  dsh-photocraft.patch.yml
```

`var/home/` is left in place empty; it can be moved to the trash once nothing references
it. No `rm` is used anywhere in this migration.
