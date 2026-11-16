# ADR-0002: `dsh-agent` becomes the single source of truth

## Status

Accepted (2026-11-16)

## Context

The same launchers lived in two places: `/opt/home/Bin` (the `usrbin` repository, whose
directory is the first `PATH` entry in `~/.zshrc`) and the newly extracted
`/opt/home/Github/dsh-agent`. Edits in one copy would silently diverge from the other;
neither directory could be described as the truth. `usrbin` also holds ~110 unrelated
scripts, so it cannot simply become this suite's home.

## Decision

`dsh-agent` is the only source of truth for these scripts. `usrbin` keeps only the
non-dsh scripts.

The switch is done as a PATH prepend, not an in-place overwrite:

1. Point `~/.zshrc` at `$REPO/bin`, **above** the `/opt/home/Bin` entry.
2. Verify every entry point, including a guard regression test.
3. Only then move the 23 duplicated entries in `/opt/home/Bin` to the macOS trash and
   commit that removal in `usrbin`.

No symlink farm between the two directories: a link layer leaves "which file actually
ran" permanently ambiguous, while a `PATH` line is one reversible line.

## Consequences

- Both copies are executable during the verification window; a divergence noticed in
  that window is a bug in the migration, not a normal state.
- Rollback is removing one line from `~/.zshrc`; recovery of `usrbin` is `git reset
  --hard` on that repository, since the removed files remain in its history.
- `photocraft-cli` stays in `/opt/home/Bin` initially and moves to `bin/` once
  `install.sh` can fetch it from its GitHub release (ADR-0004).
