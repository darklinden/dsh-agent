# AGENTS.md

This repository holds the dsh/ai script suite: the launchers, the dangerous-command
guard, and the support files they read. Layout decisions are recorded as ADRs in
`docs/adr/`; shared vocabulary lives in `GLOSSARY.md`.

`assets/global-AGENTS.md` is **not** this repo's agent instructions — it is a template
seeded into other DSH homes. Do not merge the two.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, label strings unchanged (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded in each issue's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

single-context: `GLOSSARY.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
