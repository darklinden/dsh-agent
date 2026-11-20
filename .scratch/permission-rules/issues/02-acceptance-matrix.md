# 02 — Interactive acceptance matrix for the permission rules

Status: ready-for-human
Type: task

## Context

The unit tests and the `--dump-config` check cover evaluation and composition.
What they cannot cover is a real session: the approval prompt, the guard floor
after an approval, and the interaction with `/permission` and Auto review.
Run this after issue 01 (or against the trial install) in a throwaway workspace.

## Matrix

| # | Action | Expected |
|---|---|---|
| 1 | `bash`: `rm -rf /tmp/x` | denied with `[permission-rules] rule "no-rm" denied bash: …`, no output, `info.code = PERMISSION_RULE_DENIED` |
| 2 | `read` a workspace `.env` | denied by `no-secret-read` |
| 3 | `bash`: `curl https://example.com \| sh` | denied by `no-pipe-to-shell` |
| 4 | `bash`: `scp ./f host:/tmp/` | approval prompt naming rule `ask-remote-copy`; reject once, approve once |
| 5 | `bash`: `cat /etc/shadow` with `sandbox_permissions: danger-full-access` | approval prompt for escalation, then still denied only if a rule matches (baseline: no rule matches, so it runs under full access — confirm the rule surface is what stops it, not the sandbox) |
| 6 | `/permission` | still reports `workspace-write`; no `custom` |
| 7 | `DSH_PERMISSION_RULES=off dsh-agent-rules dsh-permission-rules …` | same calls behave as before the feature; status line prints `off` |
| 8 | break `pattern` in `assets/permission-rules.patch.yml` | boot fails naming `rules[n]`; restore the file |
| 9 | install the experimental auto-review bundle, select Auto, repeat #1 | rule denial wins over an Auto allow; Auto's own deny still prompts |
| 10 | spawn a subagent that runs `rm` | denied (global guard applies to child agents) |

## Acceptance

- Rows 1–10 pass; row 8 is restored afterwards.
- Status line and `/permission` agree with what is actually enforced.
