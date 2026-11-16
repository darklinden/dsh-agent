# Code review 2026-11-16 — deferred findings

## Status: open

The two-axis review of Stage 1 of the layout migration (Standards + Spec) produced
findings in two classes:

- **Fixed in the same pass**: `install.sh`'s EXIT trap, `ai-bridge-with-log`'s usage
  comments, the patch-layer install reports in `dsh-photocraft` / `dsh-jailbreak`, the
  unquoted `$ROOT` in `ccc`, and the doc/code drift in `.env.example`, `MIGRATION.md`,
  `README.md`, `GLOSSARY.md`.
- **Deferred, tracked here**: four refactors that would each move code between the
  launchers. They are deferred because the repository has zero commits and no tests, and
  deduplicating six scripts with nothing to verify against trades a known cost (duplicated
  lines) for an unknown one (four launchers that stop booting).

Nothing in this directory blocks the Stage 2–6 work in `MIGRATION.md`.

## Issues

- `issues/01-env-loader-duplication.md` — six copies of the `.env` loader.
- `issues/02-dsm-preset-inline.md` — `dsm` inlines `assets/dsh-agent-preset.mjs`.
- `issues/03-split-dsh-agent.md` — `bin/dsh-agent` has six unrelated responsibilities.
- `issues/04-guard-blocked-list.md` — the blocked-subcommand list is a space-separated string.
