# dsh-agent

Launcher suite for [DSH](https://www.npmjs.com/package/@deepseek-ai/dsh): opinionated
entry points that give each session its own home, model endpoint, agent preset, and a
dangerous-command guard. It also carries the support files those launchers read and an
`install.sh` that builds what cannot live in git.

> **Status:** Stage 1 of the migration is done — the `bin/`, `assets/` and `var/` layout is
> in place. Stages 2–6 (secret gate, first commit, submodules, build, retiring
> `/opt/home/Bin`) are still outstanding, so `third-party/` is empty and the repository has
> no commits yet. The stage table in [`MIGRATION.md`](MIGRATION.md) is the current truth.

## Layout

```
bin/          everything executable and on PATH
assets/       tracked support files read by scripts (presets, patch overlays, AGENTS template)
third-party/  submodules: ai-bridge, micro-agent, dsh-purge-community, dsh-pi-tui,
              dsh-blender-plugin, dsh-permission-rules, dsh-sillytavern-presets
var/          gitignored runtime state: var/logs/<tool>/
dsh-home/     gitignored DSH homes, one directory per launcher (may hold credentials
              and session history)
.env          local secrets, never committed
install.sh    submodules -> build -> fetch -> var/ + dsh-home/ -> PATH report
```

Decisions behind this layout are recorded as ADRs in [`docs/adr/`](docs/adr/); vocabulary
is in [`GLOSSARY.md`](GLOSSARY.md).

## Install

```sh
git clone --recursive https://github.com/darklinden/dsh-agent.git
cd dsh-agent
cp .env.example .env && chmod 600 .env   # fill in the values
./install.sh
```

`--recursive` has nothing to fetch until Stage 4 adds the submodules: before that,
`third-party/` stays empty and `./install.sh` skips its submodule pass because there is no
`.gitmodules` to read. Nothing else in the clone changes.

`install.sh` is idempotent. It initialises submodules, builds the linked
`dsh-pi-tui` checkout (`dist/` is gitignored, so a fresh clone has no TUI build —
see below), builds `bin/ai-bridge` and `bin/ma`
with `cargo build --release` (then `cargo clean`s the multi-GB `target/`), fetches
`photocraft-cli` from its GitHub release (macOS only — elsewhere it warns and skips, or
installs a binary you pass as `PHOTOCRAFT_CLI=/path/to/photocraft-cli`), creates `var/` and
`dsh-home/`, and tells you
whether `bin/` is on `PATH`. It never edits your shell configuration; add this line
yourself, above any older copy of these scripts:

```sh
export PATH="/path/to/dsh-agent/bin:$PATH"
```

Requirements: `dsh` installed globally, `zsh` (every launcher and helper), `pnpm`
(profile installs and the TUI build), a Rust toolchain (`rustup`), `curl`/`unzip`,
and `git` for the plugin install.

## Upgrade

`bin/dsh-upgrade` refreshes the global dsh, then every profile's plugins:

```sh
dsh-upgrade          # npm -g dsh@latest, then dsh plugin update in every profile
dsh-upgrade --check  # report the dsh version and each profile's outdated packages
```

Needs `node` and `pnpm` (`dsh plugin` forwards to pnpm); the dsh half also needs
a global `npm`. It upgrades dsh first, and the profile updates then run npm's
own global dsh (`npm prefix -g`/bin/dsh), never a different dsh earlier on
`PATH`. `--no-dsh` skips the upgrade and uses the dsh already on `PATH` instead.

Each profile's `package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are
copied to `backups/dsh-upgrade/<timestamp>/` before pnpm runs, and pnpm's output
is kept next to them as `pnpm.log`. If pnpm refuses the update because
`node_modules` was linked from another store, that profile is relinked once (a
frozen `dsh plugin -- install`) and the update retried; a failed update prints
the exact `cp` commands plus the `pnpm install` that rebuilds `node_modules`
from them. A profile that fails does not stop the others, and the command exits
1 if any failed. `--latest` lets pnpm cross the ranges in `package.json` (major
versions included, not with `--check`); `--no-dsh` / `--no-plugins` run one half
only.

`--check` runs `pnpm outdated` in every profile and installs nothing.

Scope: profile dependencies, plus the build of the local TUI checkout they link.
`link:` plugins follow their `third-party/` checkout, and pulling that checkout
stays `pull-all`'s job — moving a submodule commit would change the
superproject's git state, which this command never does. What `pull-all` cannot
do is rebuild: the checkout's `dist/` is gitignored, so a pulled source would
keep booting the previous code. `dsh-upgrade` therefore rebuilds every linked
checkout (`dsh-pi-tui-build`, a no-op while current) after the profile step —
restoring the previous build if the rebuild fails — and `--check` reports
`tui-current` / `tui-stale` / `check-failed` instead of building. The Blender
plugin is loaded by file path, so a dsh upgrade may need its rebuild. If dsh
reports an incompatible plugin at boot, review the printed
`dsh plugin ... allow-version` command before granting it.

## Entry points

| command | what it does |
|---|---|
| `dsh-agent` | a DSH session with its own home, endpoint, preset, guard and an `AGENTS.md` symlinked to the repo template |
| `dsh-photocraft` | `dsh-agent` with the Photocraft automation scope |
| `dsh-jailbreak` | `dsh-agent` with the purge plugin installed into the profile |
| `dsh-blender` | `dsh-agent` in the Blender home, with the Blender plugin row (needs the `dsh-blender-plugin` submodule built) |
| `dsh-sillytavern` | `dsh-agent` in its own home with a SillyTavern AI preset imported as the active TUI prompt layer (no Web UI needed) |
| `dsh-upgrade` | upgrade the global dsh, every plugin in `dsh-home/*/profiles/*`, and the linked TUI build (see `--help`) |
| `dsh-pi-tui-build` | build the local `dsh-pi-tui` checkout the profiles link (`--check` reports, `--force` rebuilds) |
| `ai-bridge`, `ai-bridge-with-log` | the local model bridge, foreground or logged in the background |
| `ccc`, `commit` | small helpers |
| `pull-all`, `push-all` | pull/push this superproject and every submodule, with pointer consistency checks |
| `trash` | move files/directories to the real OS trash (macOS, Linux, WSL) |
| `wrong-cmd`, `wrong-cmd-subcmd`, `wrong-cmd.d/` | the guard (see below) |

## Configuration

`.env` at the repository root. See [`.env.example`](.env.example) for the required
endpoint, MCP and ccc variables plus the optional switches. Three of them are secrets:
`DDD_AUTH_TOKEN`, `TAVILY_API_KEY`, `CCC_AUTH_TOKEN`.

## The guard

`dsh-agent` prepends `bin/wrong-cmd.d/` to `PATH` immediately before `exec`;
`dsh-photocraft`, `dsh-jailbreak`, `dsh-blender` and `dsh-sillytavern` inherit it by
exec'ing `dsh-agent`. `DSH_GUARD_ROOT` selects another guard bundle directory (default
`bin/`); `DSH_BLENDER_GUARD_ROOT` remains a legacy alias read by `dsh-blender`.
Every guarded name is a symlink in that directory — `rm`, `ssh`, `dd`, `mkfs`, … resolve
to `wrong-cmd`, while `git`, `npm`, `pnpm` resolve to `wrong-cmd-subcmd`, which refuses
the dangerous subcommands and passes everything else through. To guard another command,
add a symlink to the directory; the listing is the guarded set. Scope is `PATH`
resolution only.

## The TUI bundle

`dsh-agent` boots `dsh --profile pi-tui`, and that profile links the TUI bundle
from the `third-party/dsh-pi-tui` submodule instead of installing the published
package (ADR-0013). A TUI change is a checkout edit plus a build:

```sh
# edit third-party/dsh-pi-tui/src/...
dsh-pi-tui-build     # install once, then pnpm build; a no-op while dist/ is current
dsh-agent            # links it on first use, then boots it
```

The launcher links it per profile on first use (`dsh plugin -- add <checkout>`),
checks that the profile's `node_modules` really resolves to that checkout (a
half-finished add must not keep booting the previous copy), rebuilds only when
the sources are newer than the last build, and shows the result as
`TUI: @xmoon76/dsh-pi-tui <- <checkout>` in its status block. A missing checkout
or a failed build with no profile linked yet falls back to the published package
with a warning — a profile that already links the checkout is the exception, it
never switches source behind your back; a failed rebuild with a previous build on
disk boots that build and says so; a link that resolves to nothing is refused
with the repair command rather than booted on the old copy. `DSH_PI_TUI_SOURCE=npm` keeps the published
package — against an already-linked profile it prints the exact revert command
instead of pretending to have switched.

`pull-all` owns the checkout's commits; `dsh-upgrade` rebuilds it after the
profile step, and `install.sh` builds it on a fresh clone. The checkout pins
`pnpm` in `packageManager`; where that pin cannot be materialized (read-only
`HOME`, a sandboxed home), the build retries once with the `pnpm` on `PATH`.

## Permission rules

`dsh-agent` mounts `assets/permission-rules.patch.yml` as a second `--patch`
overlay and installs `@darklinden/dsh-permission-rules` into the profile on first
use (install-once, like the jailbreak plugin). The table declares `deny` / `ask` rules
matched against a tool name plus one narrow surface — shell command, file path,
URL, or serialized arguments — so the A2 (no `rm`) and A4 (no secrets) statements
in `AGENTS.md` are enforced at the tool boundary as well as in prose. Command
rules can be scoped to simple commands: the plugin splits `&&` / `;` / `|`
lines, resolves quotes, and strips `sudo` / `timeout` / `env` wrappers before
matching, so `echo rm` is allowed while `sudo rm` and `git -C repo commit` are
caught.

A `deny` is returned before any slower reviewer and again from the monotonic tool
guard, so neither an LLM reviewer (the experimental Auto preset) nor a human
approval can override it; an `ask` goes through the normal approval flow and
becomes a denial under `approval: never` (Full access, delegated children). The
plugin never changes the sandbox mode or the approval policy, so the
`/permission` presets stay intact.

`DSH_PERMISSION_RULES=off` launches without the patch; `_PATCH`, `_SOURCE` and
`_PKG` move the rule file, the install source and the package name. The rules are
a policy aid, not the isolation boundary: patterns run on text and can be dodged
by quoting or encoding, while the sandbox and approval policy remain what
confines effects.

## SillyTavern presets

`dsh-sillytavern` is a thin front end for `dsh-agent` with its own home
(`dsh-home/dsh-sillytavern`) and the `dsh-sillytavern-presets` plugin installed into
that home's `pi-tui` profile. On first use it bootstraps `@xmoon76/dsh-pi-tui@0.5.6`
when the profile is missing, installs the plugin from the checked-out
`third-party/dsh-sillytavern-presets` submodule, imports one SillyTavern **AI preset**
and selects it before the TUI starts. The plugin's own settings page is a Web client
the TUI never mounts; this launcher is the supported way to point the TUI at a preset.

An "AI preset" here is the JSON with `prompts` / `prompt_order` / `temperature` /
`openai_max_tokens` — SillyTavern's AI Response Configuration. It is not a character
card, worldbook, chat log or the preset's display regex. The plugin injects the active
prompts as one System Prompt section and applies temperature/maxTokens to the request;
the other sampler fields are preserved by the plugin but not applied.

The preset comes from `DSH_SILLYTAVERN_PRESET`; the default is the repo's
`assets/sillytavern/preset.json` when that file exists. The import is
idempotent by content hash: an unchanged file is only re-selected, a changed file
imports a new preset, selects it and archives the previous launcher-managed one.
`DSH_SILLYTAVERN_IMPORT=off` skips the import, `_FORCE_IMPORT=on` re-imports even when
unchanged, and `_BOOTSTRAP=off` reports a missing profile instead of installing one.
The plugin store is
`dsh-home/dsh-sillytavern/plugin-data/dsh-sillytavern-presets/presets.json`;
`launcher-import.json` next to it records the source path, hash and preset id.

First install needs the plugin submodule: `git submodule update --init
third-party/dsh-sillytavern-presets` (or `./install.sh`). Set
`DSH_SILLYTAVERN_PLUGIN_SOURCE` to another directory, tarball or git spec to override it.
The preset becomes system instructions and can conflict with `AGENTS.md` or the
conversation's own rules. The permission rules still deny/ask at the tool boundary, but
the model's behaviour can change; only import presets you trust.

## Trash

`bin/trash` is the suite's cross-platform deletion path. It never invents a
`~/.trash`: macOS uses Finder (or a real `trash` binary when installed), Linux
uses `gio trash` / `trash-cli` and falls back to the freedesktop XDG Trash, and
WSL sends `/mnt/<drive>` paths to the Windows Recycle Bin while keeping Linux-side
files in the XDG Trash. It accepts one or more paths, refuses `/` and drive/mount
roots, and never overwrites an existing trash entry. On success it logs
`trash <path> => <trash location>` to stderr.

## License

MIT — see [LICENSE](LICENSE).
