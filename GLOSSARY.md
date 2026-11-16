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
presets, patch overlays, and the AGENTS seed template.

**`var/`** — gitignored runtime state: `var/logs/<tool>/` and `var/home/dsh/`. Deleting
it loses history and local DSH state, never source.

**`ROOT`** — the repo root as computed by a script: `dirname "$SCRIPT_DIR"`. Every path
to `assets/`, `var/`, `third-party/`, or `.env` is expressed through it.

**SCRIPT_DIR sibling assumption** — the pre-migration habit of every launcher: data
files are resolved next to the script (`$SCRIPT_DIR/<file>`). Once scripts live in
`bin/` and data in `assets/`, that assumption only still holds for the guard bundle,
which is kept together in `bin/` on purpose (ADR-0005).

**`install.sh`** — the idempotent bootstrap at the repo root. Initialises submodules,
builds `bin/ai-bridge` and `bin/ma`, fetches `bin/photocraft-cli`, creates `var/`, and
reports whether `bin/` is on `PATH`. It never edits shell configuration.

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
their paths rewritten.

## DSH

**DSH home** — a directory (`$DSH_HOME`) holding one suite's profiles, sessions,
credentials, and plugins. `dsm` keeps the Blender session's under `var/home/dsh/`; the
`dsh-agent` family uses `$HOME/.dsh` and `$HOME/.dsh-<name>` instead.

**profile** — a named plugin set inside a DSH home (`pi-tui`, `dsh-tui`, …). Plugins are
installed per profile with `dsh plugin --profile <name> -- add <spec>`, which forwards to
pnpm in the profile directory.

**plugin source** — what that `add` installs. Kept in `dsh-jailbreak` as
`PLUGIN_SOURCE`, defaulting to the fork of the purge plugin (ADR-0007).

**seed** — first-use copy of `assets/global-AGENTS.md` into a new DSH home as its
`AGENTS.md`. Never overwrites an existing file; `DSA_SEED_AGENTS=off` skips it.
