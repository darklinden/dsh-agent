# ADR-0005: The guard bundle lives inside `bin/`

## Status

Accepted (2026-11-16); the `dsm`/`DSM_GUARD_ROOT` naming is superseded by ADR-0008.

## Context

The guard is three things that must sit together: `wrong-cmd` and `wrong-cmd-subcmd`
(the shim binaries) plus `wrong-cmd.d/` (the shim directory, whose listing *is* the
guarded command set). `dsh-agent` prepends that directory to `PATH` immediately before
`exec`, and `dsm` does the same through `GUARD_ROOT`.

When the shim directory was classified as an asset and moved to `assets/`, its 24
relative symlinks (`../wrong-cmd`) pointed outside `assets/` and every guarded name
became a dangling link. The shims are executables, not data: they belong with the
binaries they point at.

## Decision

`bin/wrong-cmd`, `bin/wrong-cmd-subcmd`, and `bin/wrong-cmd.d/` stay together in `bin/`.

- The launchers' `SCRIPT_DIR`-relative lookups (`$SCRIPT_DIR/wrong-cmd.d`,
  `$SCRIPT_DIR/wrong-cmd`, `$SCRIPT_DIR/wrong-cmd-subcmd`) are therefore unchanged —
  zero code changes for the guard.
- Shim targets stay `../wrong-cmd` (and `../wrong-cmd-subcmd`): `wrong-cmd.d/` is
  one level below `bin/`, so these resolve to `bin/wrong-cmd` and
  `bin/wrong-cmd-subcmd`. A bare `wrong-cmd` target would dangle.
- `dsm`'s `DSM_GUARD_ROOT` default becomes `$ROOT/bin`, which still resolves
  `$GUARD_ROOT/wrong-cmd.d`, `$GUARD_ROOT/wrong-cmd`, `$GUARD_ROOT/wrong-cmd-subcmd`.

## Consequences

- The guard's behaviour is preserved by construction rather than by care — but the 24
  shim links still need a regression test after migration: `rm …` must be refused,
  `ssh …` must be refused, `git status` must pass, `pwd` must pass.
- `dsh-blender-plugin`'s existing guard integration keeps working because it also reads
  the shim directory rather than hardcoding command names.
- A future move of the guard bundle would break every launcher's assumption at once; this
  ADR records that the co-location is deliberate, not incidental.
