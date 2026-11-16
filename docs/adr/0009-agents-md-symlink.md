# ADR-0009: DSH homes symlink the AGENTS template

## Status

Accepted (2026-11-16)

## Context

`$DSH_HOME/AGENTS.md` is the user-global instruction layer dsh loads for every session
in a home. The launchers seeded it once: `dsh-agent` copied `assets/global-AGENTS.md`
into a new home and never touched an existing file, while `dsh-blender` had no handling
at all. That made the template a starting point rather than a source of truth. A home
created before a template edit kept the old rules indefinitely, and nothing reported
which homes were stale. With four homes (`dsh-agent`, `dsh-jailbreak`,
`dsh-photocraft`, `dsh-blender`) and more possible through `dsh-agent <name>`, drift was
the normal outcome.

## Decision

1. Every launcher that boots a home (`dsh-agent` directly; `dsh-blender`; and
   `dsh-jailbreak` / `dsh-photocraft` through their `exec dsh-agent <home>` handover)
   re-asserts `$DSH_HOME/AGENTS.md` as a **symbolic link** to
   `assets/global-AGENTS.md` on each launch, after all pre-flight checks and before
   `exec`.
2. A symbolic link that resolves to the template (`-L` and `-ef`) is in sync and
   produces no action or output. The `-L` test is deliberate: a hard link or a copy with
   identical bytes is not accepted, because the home entry must be the visible
   `AGENTS.md -> .../assets/global-AGENTS.md` link and must keep following the template
   path across atomic replacements.
3. Anything else is replaced without asking. Content that differs from the template is
   copied to `backups/agents/<home>-AGENTS.md.<timestamp>.<pid>` first; a failed backup
   warns but does not stop the replacement.
4. The link is created under a hidden temporary name and renamed over the destination, so
   a concurrent launch never observes a missing or partial `AGENTS.md`.
5. Failures (missing template, a directory in the way, read-only home) only warn; a
   broken link must never cost the boot. Symbolic links work across filesystems, so a
   home on another volume needs no copy fallback.
6. `DSA_AGENTS_LINK=off` disables enforcement; `DSA_SEED_AGENTS=off` remains honored as
   the legacy spelling. `DSA_AGENTS_LINK` wins when both are set.
7. The logic was duplicated verbatim in `dsh-agent` and `dsh-blender`, because both
   launchers stayed single self-contained files (the precedent set by the inline preset
   derivation); the two blocks carried a keep-in-sync note.
   **Superseded by ADR-0010:** `dsh-blender` now delegates to `dsh-agent`, so the
   block lives only in `dsh-agent`.

## Consequences

- There is exactly one editable copy of the global instructions: opening a home's
  `AGENTS.md` opens `assets/global-AGENTS.md`. Editing it through the link edits the
  tracked template, and `git status` shows that file as modified.
- Local customizations in a home are destroyed at the next launch by design. The backup
  under `backups/agents/` (gitignored) is the recovery path.
- Older homes that hold a hard link or a plain copy are converted to a symbolic link on
  their next launch. Identical bytes need no backup; divergent bytes are preserved in
  `backups/agents/` first.
- An atomic replacement of the template (git checkout, most editors' safe-save) does not
  break the link: the symlink follows the path, so the next session reads the new
  content without a relink. A hard link would have been left pointing at the old inode.
- `ls -l` shows `AGENTS.md -> /abs/path/assets/global-AGENTS.md`; an operator can tell a
  managed home from a dangling or foreign file at a glance. A dangling link is obvious
  and is repaired on the next launch.
- The target is absolute, matching the existing `$DSH_HOME/cordis.patch.yml` links. If
  the repository moves, the links dangle until the next launch rewrites them against the
  new `ROOT` (the launcher treats "exists but does not resolve to the template" as
  replaceable). A relative target would survive a move but read less clearly in `ls`.
- Historical first-use "seed" wording in ADR-0001 and `MIGRATION.md` describes what was
  true at the time and stays unchanged; current vocabulary lives in `GLOSSARY.md`.
- The check and replacement run before `exec`, so a launch that fails during pre-flight
  leaves no link, backup, or status change behind.

## Alternatives considered

- **Hard link (bare `ln`)** — rejected: `ls -l` shows no `->`, a hard link is
  indistinguishable from a regular file apart from its link count, it cannot cross
  filesystems, and an atomic save or `git checkout` breaks it and forces another relink.
- **Copy the template on every launch** — rejected: each home keeps an independent
  inode, so a home file and the repo template can diverge within one launch, and every
  launch rewrites content that is meant to be tracked.
- **Keep the copy-once seed and add a manual sync command** — rejected: the stale state
  is silent, so nobody runs the command.
- **Refuse to overwrite divergent content** — rejected: the requirement is that all
  homes track the template; a backup preserves the old bytes without blocking that.
- **Relative symlink** — rejected for consistency with the existing `cordis.patch.yml`
  links and readability; the launcher repairs dangling absolute links on the next
  launch, so a moved repository self-heals.

## References

- ADR-0001 — layered layout (`assets/` holds the AGENTS template)
- ADR-0008 — repo-local DSH homes
- ADR-0010 — `dsh-blender` delegates to `dsh-agent`
- `GLOSSARY.md` — AGENTS template, AGENTS link
- `bin/dsh-agent`, `bin/dsh-blender`
