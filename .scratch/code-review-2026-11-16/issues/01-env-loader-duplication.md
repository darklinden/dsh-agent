# 01 — Six copies of the `.env` loader

Status: needs-triage
Type: task

Found by the 2026-11-16 code review (Standards axis, smell: Duplicated Code).

## What

The same loader block appears six times — `bin/ccc:9-14`, `bin/dsh-agent:79-84`,
`bin/dsh-blender:94-99`, `bin/pull-all:8-13`, `bin/push-all:8-13`, `bin/dsh-jailbreak:80-84`:

```sh
if [ -f "$ROOT/.env" ]; then
    echo "Loading environment variables from $ROOT/.env ..."
    set -a
    source "$ROOT/.env"
    set +a
fi
```

`dsh-jailbreak:80-84` is the same block minus the echo, which is the drift already
visible: the load message is the part that varies, and it is duplicated six times over.

## Shape of the fix

An `assets/load-env.sh` sourced by each launcher, or a `bin/` helper — `assets/` is the
documented home for files scripts *read* (GLOSSARY.md), so `assets/` is the right side.
Each launcher keeps its `ROOT=` computation and calls `. "$ROOT/assets/load-env.sh"`.

## Why deferred

Touches six working entry points, one of them (`dsh-blender`, 591 lines) with its own
preflight ordering. No test harness exists to catch a sourcing regression, and `dsh`'s own
`DSH_HOME` inheritance makes a silent break easy to miss.
