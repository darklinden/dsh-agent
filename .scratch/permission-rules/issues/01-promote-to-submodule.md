# 01 — Publish and promote dsh-permission-rules to a submodule

Status: ready-for-human
Type: task

## Context

The plugin is developed as a standalone local repository at
`third-party/dsh-permission-rules`, ignored by `.gitignore` (ADR-0011). It is
staged but **not committed**: this session's guard refuses `git commit`/`push`,
so history and publishing belong to the operator. The mounting logic lives in
`bin/dsh-agent-rules`, a trial copy of `dsh-agent`; promotion has two halves —
publish the plugin, and copy the launcher block into `dsh-agent`.

## Steps

1. Commit the staged files in the plugin repository
   (`git -C third-party/dsh-permission-rules commit`).
2. Create `darklinden/dsh-permission-rules` on GitHub and push `main`.
3. Remove the `/third-party/dsh-permission-rules/` line from this repo's
   `.gitignore` (same commit as the pointer, or the submodule is untracked).
4. Move the checkout out of the tree (e.g. `third-party/dsh-permission-rules.local`),
   then add the submodule per ADR-0003:
   `git submodule add -b main https://github.com/darklinden/dsh-permission-rules.git third-party/dsh-permission-rules`.
5. Copy the permission-rules block (env docs, install/patch/status logic) from
   `bin/dsh-agent-rules` into `bin/dsh-agent`, then trash `bin/dsh-agent-rules`.
   The default home is `dsh-agent` again, and the block installs from the same
   `third-party/` path — no other launcher change is needed.
6. Re-run `dsh-agent` once: it reinstalls from that path (now the submodule) and
   prints `Permission rules: on (…)`.
7. Trash the old local copy after the submodule clone is verified.
8. Commit `.gitmodules` + the pointer. `pull-all` / `push-all` discover the new
   submodule automatically.

## Acceptance

- `git submodule status` lists the new path at the recorded commit.
- A fresh clone + `install.sh` boots with the rule table mounted.
- `git status` no longer reports the directory as ignored or untracked.
