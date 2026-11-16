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
assets/       tracked support files read by scripts (presets, patch overlays, AGENTS seed)
third-party/  submodules (added in Stage 4; empty until then): ai-bridge, micro-agent,
              dsh-purge-community, dsh-pi-tui, dsh-blender-plugin
var/          gitignored runtime state: var/logs/<tool>/, var/home/dsh/
.env          local secrets, never committed
install.sh    submodules -> build -> fetch -> var/ -> PATH report
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

`install.sh` is idempotent. It initialises submodules, builds `bin/ai-bridge` and `bin/ma`
with `cargo build --release` (then `cargo clean`s the multi-GB `target/`), fetches
`photocraft-cli` from its GitHub release, creates `var/`, and tells you whether `bin/` is
on `PATH`. It never edits your shell configuration; add this line yourself, above any
older copy of these scripts:

```sh
export PATH="/path/to/dsh-agent/bin:$PATH"
```

Requirements: `dsh` installed globally, a Rust toolchain (`rustup`), `curl`/`unzip`,
and `git` for the plugin install.

## Entry points

| command | what it does |
|---|---|
| `dsh-agent` | a DSH session with its own home, endpoint, preset, guard and seeded `AGENTS.md` |
| `dsh-photocraft` | `dsh-agent` with the Photocraft automation scope |
| `dsh-jailbreak` | `dsh-agent` with the purge plugin installed into the profile |
| `dsm` | the Blender plugin session (needs the `dsh-blender-plugin` submodule built) |
| `ai-bridge`, `ai-bridge-with-log` | the local model bridge, foreground or logged in the background |
| `ccc`, `commit` | small helpers |
| `pull-all`, `push-all` | pull/push this superproject and every submodule, with pointer consistency checks |
| `wrong-cmd`, `wrong-cmd-subcmd`, `wrong-cmd.d/` | the guard (see below) |

## Configuration

`.env` at the repository root. See [`.env.example`](.env.example) for all nine variables
the scripts read, plus the optional switches. Three of them are secrets:
`DDD_AUTH_TOKEN`, `TAVILY_API_KEY`, `CCC_AUTH_TOKEN`.

## The guard

`dsh-agent` prepends `bin/wrong-cmd.d/` to `PATH` immediately before `exec`;
`dsh-photocraft` and `dsh-jailbreak` inherit it by exec'ing `dsh-agent`, and `dsm` does the
same itself through `DSM_GUARD_ROOT` (default `bin/`). Every guarded name is
a symlink in that directory — `rm`, `ssh`, `dd`, `mkfs`, … resolve to `wrong-cmd`, while
`git`, `npm`, `pnpm` resolve to `wrong-cmd-subcmd`, which refuses the dangerous
subcommands and passes everything else through. To guard another command, add a symlink to
the directory; the listing is the guarded set. Scope is `PATH` resolution only.

## License

MIT — see [LICENSE](LICENSE).
