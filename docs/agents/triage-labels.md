# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to
the strings used in this repo. The tracker is local markdown, so a "label" is the value
written on an issue file's `Status:` line — there is no hosted label object to create.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), write the
corresponding string on the issue's `Status:` line.

Wayfinding tickets use `Status: claimed` / `Status: resolved` instead, per
`issue-tracker.md`; they are not triage states.
