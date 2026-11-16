# 04 — The blocked-subcommand list is a space-separated string

Status: needs-triage
Type: task

Found by the 2026-11-16 code review (Standards axis, smell: Primitive Obsession).

## What

`bin/wrong-cmd-subcmd` is POSIX `sh` (`#!/bin/sh`), not zsh. It stores the guarded
subcommands as one space-separated string per command family (`:73-74`):

```sh
git)      blocked='commit push pull merge rebase reset' ;;
npm|pnpm) blocked='publish' ;;
```

and re-parses that string with an unquoted `for b in $blocked` at two places
(`:110` and `:120`). A command name containing a space could never be represented, and
the unquoted expansion means the guard's behaviour depends on `IFS` still being the
default at both sites.

## Shape of the fix

POSIX-safe options, in order of preference:

1. Newline-delimited list consumed by `while IFS= read -r b; do … done <<EOF`, so no word
   splitting and no `IFS` dependency.
2. A `case "$1" in` membership helper (`is_blocked git commit`), which keeps the list in
   the same shape but makes the split explicit and testable.

An array is **not** available here — that would need a `#!/bin/sh` → zsh switch in the
guard, which is a decision of its own.

## Why deferred

It is a readability fix in the guard, the one file in this repository whose behaviour must
not shift silently. Bundle it with the guard regression test that `MIGRATION.md` Stage 5
already calls for, so the change lands with evidence rather than by inspection.
