# GLOSSARY

Vocabulary this repo actually uses. If a term here has an avoided synonym, use the
listed term instead. New terms are added lazily, when a decision or code path finally
needs the word.

## Repository layout

**superproject** — this repo (`dsh-agent`) as a git repository. It records the pinned
commit of every submodule but not their contents.

**submodule** — one of the five repos checked out under `third-party/`. Each keeps its
own `.git`, its own remote, and its own history; the superproject only stores a commit
pointer.

**`bin/`** — the single flat directory put on `PATH`. Holds the launchers, the guard,
the guard shims, and the binaries `install.sh` produces. Anything here is executable.

**`assets/`** — tracked support files that scripts *read* but never put on `PATH`:
presets, patch overlays, and the AGENTS template.

**`var/`** — gitignored runtime state: `var/logs/<tool>/`. Deleting it loses logs,
never source.

**`dsh-home/`** — gitignored repo-local root for DSH homes, one subdirectory per
launcher (`dsh-agent`, `dsh-jailbreak`, `dsh-photocraft`, `dsh-blender`). It may hold
credentials, sessions, and plugin state, so it is never committed.

**`ROOT`** — the repo root as computed by a script: `dirname "$SCRIPT_DIR"`. Every path
to `assets/`, `var/`, `third-party/`, or `.env` is expressed through it.

**SCRIPT_DIR sibling assumption** — the pre-migration habit of every launcher: data
files are resolved next to the script (`$SCRIPT_DIR/<file>`). Once scripts live in
`bin/` and data in `assets/`, that assumption only still holds for the guard bundle,
which is kept together in `bin/` on purpose (ADR-0005).

**`install.sh`** — the idempotent bootstrap at the repo root. Initialises submodules,
builds `bin/ai-bridge` and `bin/ma`, fetches `bin/photocraft-cli`, creates `var/` and
`dsh-home/`, and reports whether `bin/` is on `PATH`. It never edits shell configuration.

## Guard

**guard** — the dangerous-command tripwire. Launchers prepend a shim directory to
`PATH` so that guarded names resolve to `wrong-cmd` instead of the real binary.

**`wrong-cmd`** — the shim binary that refuses guarded names (`rm`, `ssh`, `dd`, …).

**`wrong-cmd-subcmd`** — the subcommand-aware half: refuses the dangerous subcommands of
`git`/`npm`/`pnpm` while letting `git status`, `git log`, … through.

**shim** — one entry in `bin/wrong-cmd.d/`: a symlink named after the guarded command
whose target is `../wrong-cmd` or `../wrong-cmd-subcmd`, i.e. the binaries one level up in
`bin/`. The directory listing *is* the guarded set.

**`GUARD_ROOT`** — the directory that holds `wrong-cmd`, `wrong-cmd-subcmd`, and
`wrong-cmd.d/`. After migration that is `bin/`, which is also why those three never need
their paths rewritten. `DSH_GUARD_ROOT` selects another directory.

## Trash

**`trash`** — `bin/trash`, the suite's one move-to-real-OS-trash command. It dispatches
to Finder or a real `trash` binary on macOS, `gio trash` / `trash-cli` or the freedesktop
XDG Trash on Linux, and the Windows Recycle Bin for `/mnt/<drive>` paths under WSL;
Linux-side WSL files use XDG Trash. It never creates a homemade `~/.trash`.

## DSH

**DSH home** — a directory (`$DSH_HOME`) holding one suite's profiles, sessions,
credentials, and plugins. Every launcher pins one under `dsh-home/<name>/`:
`dsh-agent` defaults to `dsh-agent`, its optional first argument replaces that name, and
the front ends pass their own (`dsh-jailbreak`, `dsh-photocraft`, `dsh-blender`).

**front end** — a `bin/dsh-*` launcher that owns one tool's setup and then
`exec`s `dsh-agent <home>`; the shared route/guard/AGENTS plumbing lives there.

**profile** — a named plugin set inside a DSH home (`pi-tui`, `dsh-tui`, …). Plugins are
installed per profile with `dsh plugin --profile <name> -- add <spec>`, which forwards to
pnpm in the profile directory.

**home layer** — `$DSH_HOME/cordis.patch.yml`, a patch list applied after every
profile's bundle layer and before `--patch` overlays. Tool-specific rows live here:
the purge prompt fix, the Photocraft MCP server, the Blender plugin.

**plugin source** — what that `add` installs. Kept in `dsh-jailbreak` as
`PLUGIN_SOURCE`, defaulting to the fork of the purge plugin (ADR-0007).

**AGENTS template** — `assets/global-AGENTS.md`: the one copy of the user-global
instructions. A DSH home never keeps a copy of its own.

**AGENTS link** — `$DSH_HOME/AGENTS.md` as a symbolic link to the AGENTS template,
enforced by the launchers on every start. An entry that is not a symlink resolving to the
template is replaced; differing content is backed up under `backups/agents/` first.
`DSA_AGENTS_LINK=off` skips enforcement (`DSA_SEED_AGENTS=off` is the legacy spelling).
