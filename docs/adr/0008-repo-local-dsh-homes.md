# ADR-0008: Repo-local DSH homes and the dsh-blender name

## Status

Accepted (2026-11-16)

## Context

The launchers had accumulated three different DSH home conventions:

- `dsh-agent` used `$HOME/.dsh`, or `$HOME/.dsh-<name>` for its positional selector;
- `dsh-jailbreak` and `dsh-photocraft` hardcoded `$HOME/.dsh-<tool>`;
- `dsm` used the repository's `var/home/dsh`.

The split made the suite's state hard to find, hard to back up as one unit, and easy to
confuse with the harness's own `~/.dsh`. It also meant `dsm` was the only launcher whose
state disappeared when the repository was moved, and the only one not named after the
`dsh-` family it belongs to.

## Decision

1. **One repo-local root.** Every launcher keeps its DSH home under
   `$ROOT/dsh-home/<name>/`. The root is gitignored and `install.sh` creates it with
   mode `0700` because it holds credentials, sessions, and plugin state.
   - `dsh-agent` defaults to `dsh-agent`; its optional first argument replaces that name
     (`dsh-agent p` boots `dsh-home/p`).
   - `dsh-jailbreak` passes `dsh-jailbreak`; `dsh-photocraft` passes `dsh-photocraft`.
   - `dsh-blender` pins `dsh-home/dsh-blender` directly.
   - An inherited `$DSH_HOME` no longer selects the home; the launcher's own mapping wins.

2. **Rename `dsm` to `dsh-blender`.** The launcher file, its user-facing strings, its
   temporary overlay/preset names, and its guard override become `dsh-blender` and
   `DSH_BLENDER_GUARD_ROOT`. The third-party plugin directory stays
   `third-party/dsh-blender-plugin`.

## Consequences

- All suite state for one checkout lives in one place and moves with the repository;
  two clones have independent homes.
- `dsh-home/` sits inside the working tree, so it must stay gitignored; a careless
  `git add -f` could commit credentials.
- The path change is breaking: existing homes must be moved from `~/.dsh`,
  `~/.dsh-jailbreak`, `~/.dsh-photocraft`, and `var/home/dsh` to the new root. The
  migration is a one-time manual step recorded in `MIGRATION.md`, not something the
  launchers do implicitly. `~/.dsh-blender-rt` is not a DSH home — it is the Blender
  plugin's own workDir — and stays where it is.
- `DSM_GUARD_ROOT` is no longer read. Any external script or shell alias that set it must
  switch to `DSH_BLENDER_GUARD_ROOT` (or rely on the `$ROOT/bin` default).
- ADR-0001's `var/home/dsh/` and ADR-0005's `DSM_GUARD_ROOT` consequence are superseded
  for the parts named here; the historical decisions themselves are unchanged.
