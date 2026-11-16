# 03 — `bin/dsh-agent` carries six unrelated responsibilities

Status: needs-triage
Type: task

Found by the 2026-11-16 code review (Standards axis, smell: Divergent Change).

## What

`bin/dsh-agent` is 437 lines and changes for six unrelated reasons:

| lines | responsibility |
|---|---|
| 101-115 | home selection (first positional argument) |
| 132-149 | endpoint normalisation (`DDD_PROTOCOL` → `/v1` suffix) |
| 281-343 | patch-overlay generation |
| 196-276 | preset takeover (`DSA_WEB_SEARCH=off`) |
| 345-376 | guard prepend |
| 413-435 | `AGENTS.md` seeding |

Its siblings (`dsh-photocraft`, `dsh-jailbreak`) already carry near-copies of the home
selection, the guard and the patch-layer install, so the seam is not hypothetical: there is
already more than one caller for most of these blocks.

## Shape of the fix

Extract the overlay/preset blocks into `assets/` scripts and the home/guard blocks into a
shared `assets/` fragment. `dsh-agent` keeps argument parsing, the `.env` load, and `exec`.

## Why deferred

The same reason as 01: it is the file every other entry point depends on, and there is no
test that would tell us a refactor broke a boot. Do this after Stage 5 gives a working
install to regress against.
