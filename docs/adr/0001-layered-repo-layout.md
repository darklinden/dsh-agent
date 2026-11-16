# ADR-0001: Adopt a layered repository layout

## Status

Accepted (2026-11-16); DSH home placement is superseded by ADR-0008.

## Context

The suite arrived as 23 flat entries at the repository root: launchers, the guard, its
shim directory, two 8–14 MB binaries, a preset helper, patch overlays, an AGENTS seed
template, and two multi-megabyte log directories. Every launcher resolves its data files
next to itself (`SCRIPT_DIR` sibling assumption), so the flat layout was the only thing
that worked — but it made "what is executable" and "what is data" indistinguishable, and
it left build output and logs inside the tree with no rule keeping them out of git.

## Decision

Adopt four top-level locations with one meaning each:

- `bin/` — everything executable and on `PATH`: launchers, guard, shims, built binaries.
- `assets/` — tracked support files that scripts read: presets, patch overlays, the AGENTS seed template.
- `third-party/` — submodules (ADR-0003).
- `var/` — gitignored runtime state: `var/logs/<tool>/` and `var/home/dsh/`.

Machine-local files stay at the repository root: `.env` and `dsh-blender.config.json`.
Scripts compute `ROOT="$(dirname "$SCRIPT_DIR")"` and address `assets/`, `var/`,
`third-party/`, and `.env` through it; `dsh-agent` exports `DSH_AGENT_ROOT="$ROOT"` so
the patch overlays can do the same.

The guard bundle (`wrong-cmd`, `wrong-cmd-subcmd`, `wrong-cmd.d/`) moves into `bin/` as
a unit, which is why its `SCRIPT_DIR`-relative lookups need no change at all (ADR-0005).

## Consequences

- 13 path references across 8 scripts are rewritten; the 24 shim symlinks stay as
  `../wrong-cmd*` and are verified in place (no retarget needed).
- The repo becomes relocatable: no absolute path may point at the repository itself.
- `.env` sitting at the root keeps the highest-edit-frequency file one level shallower
  than `assets/`, at the cost of the root not being purely a container of directories.
- Two runtime directories legitimately do not exist in a fresh clone (`var/`); scripts
  must create them rather than assume them.
