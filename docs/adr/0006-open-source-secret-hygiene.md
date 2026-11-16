# ADR-0006: Open-source secret hygiene without a commit hook

## Status

Accepted (2026-11-16)

## Context

The repository is about to be published. It has zero commits today, so no history needs
scrubbing — the only window that matters is the very first `git add`. `.env` holds two
real credentials (`DDD_AUTH_TOKEN`, `TAVILY_API_KEY`) plus a loopback endpoint, and its
mode was `0644`. A read-only audit found no `/Users/...` paths, e-mails, private keys, or
hostnames in the other 22 entries; the only machine-specific strings were four
`/opt/home/Bin` references (ADR-0004) and `.DS_Store` noise.

## Decision

- `.env` is gitignored and never committed; it stays at the repository root.
- `.env.example` is committed and declares **all nine** variables the scripts read:
  `DDD_BASE_URL`, `DDD_AUTH_TOKEN`, `DDD_MODEL`, `DDD_PROTOCOL`, `DDD_CONTEXT_WINDOW`,
  `TAVILY_API_KEY`, and `CCC_BASE_URL`, `CCC_AUTH_TOKEN`, `CCC_MODEL` (the last three are
  read by `ccc`, which exits immediately when they are unset — they were simply missing
  from the old `.env`). Optional switches are listed as comments.
- The local `.env` is `chmod 600`.
- The gate before the first commit is an explicit check, not a hook:

  ```
  git add -A
  git diff --cached --name-only | grep -E '(^|/)\.env$|^var/|^bin/(ai-bridge|ma|photocraft-cli)$'
  ```

  Any output means stop and `git reset`.

- No pre-commit secret scanner is installed. `.DS_Store` files are trashed, not committed.

## Consequences

- Protection rests on one manual check plus discipline. A future contributor — or a
  careless `git add` on another machine — has no automated backstop, and a leaked `.env`
  can only be remedied by rotating `DDD_AUTH_TOKEN` and `TAVILY_API_KEY`, not by deleting
  the commit.
- `.env.example` is more complete than the `.env` it was derived from, so it doubles as
  documentation for the `ccc` path that previously failed silently.
- Re-running `setup-matt-pocock-skills` or adding hooks later does not conflict with this
  decision; it is reversible by adding a hook alone.
