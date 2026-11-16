# 02 — `dsm` inlines `assets/dsh-agent-preset.mjs`

Status: needs-triage
Type: task

Found by the 2026-11-16 code review (Standards axis, smell: Duplicated Code).

## What

`bin/dsm:313-421` re-implements `assets/dsh-agent-preset.mjs` inside a heredoc — same
derivation, copied out and then drifted. The comment above it admits the coupling: `dsm`
"stays one self-contained file; keep the two in sync".

Two copies of the preset-derivation logic means a fix to one silently leaves the other
wrong, and the preset name (`@deepseek-ai/dsh-agent-preset`) is asserted in both.

## Shape of the fix

Drop the heredoc and call `node "$ROOT/assets/dsh-agent-preset.mjs"`, the way
`bin/dsh-agent:264` already does. The "one self-contained file" property is worth less than
the duplication it buys: `dsm` already depends on `$ROOT/assets/` for its patch overlay.

## Why deferred

The inlined copy has already diverged from the helper (module loading, the `argv` comments
and the `die` prefix all differ), so this is not a mechanical move: the difference has to
be reconciled deliberately, then proven against a real `dsh` install by comparing the
generated overlay. No such install is available here.
