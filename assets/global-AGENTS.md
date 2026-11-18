# Global Agent Rules

## 0. Iron rules
- THINK IN English, ANSWER IN Chinese.
- NEVER run `rm` / `del` / `Remove-Item`, or any deletion — always move to trash.
  (authoritative form: A2)

## A. Hard Gates (absolute, no exceptions)
- A1 Language: always answer in Chinese (authority: section 0 above).
- A2 Deletion: never execute `rm` / `del` / `Remove-Item` or any delete command; every deletion
  is a move to the real OS trash via its API — never `mv` into a homemade `~/.trash` directory:
  - macOS / Linux / WSL: `trash <path>` (the suite's `bin/trash`; use
    `"$DSH_AGENT_ROOT/bin/trash"` if `bin/` is not on PATH). It uses Finder or a real
    `trash` binary on macOS, `gio trash` / `trash-put` / the freedesktop XDG Trash on Linux,
    the Windows Recycle Bin for `/mnt/<drive>` paths under WSL, and XDG Trash for Linux files.
  - macOS fallback: `osascript -e 'tell application "Finder" to delete POSIX file "/abs/path"'`.
  - Linux fallback: `gio trash <path>`, or `trash-put <path>` (trash-cli).
  - native Windows (PowerShell, built-in): `Add-Type -AssemblyName Microsoft.VisualBasic;`
    `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p,'OnlyErrorDialogs','SendToRecycleBin')`
    — directories use `DeleteDirectory`; local volumes only (network paths throw).
  Inspect soft / hard / symbolic links before touching them.
- A3 Write intent: without an explicit write intent, do not write, create, or modify any file.
  (Exceptions: backup files and temporary test scripts.)
- A4 Secrets: never view or output any key, password, token, or private data. When unavoidable,
  reference only the environment-variable name.
- A5 Custom slot: reserved for project-specific global rules that must always be obeyed.
- A6 Temp files: create task scratch files, downloads, and intermediate output under `tmp/` at the
  workspace root (`mkdir -p tmp`). Never place them in the system temp area — `/tmp`, `/var/tmp`,
  `$TMPDIR`, or an OS temp API. `tmp/` must be gitignored; add `/tmp/` to the workspace
  `.gitignore` if it is missing. If the workspace is unwritable, stop and ask instead of falling
  back to the system temp area.

## B. Execution Protocol (self-check before every action)
- B1 Before acting, print one line: 【Goal】 + 【Minimal file list I intend to read】.
- B2 Any new read/search must be able to change the current answer. If it cannot, it is
  divergence — forbidden.
- B3 Stop as soon as the information suffices. No "let me double-check" / "just one quick look"
  scope creep.
- B4 Verification applies only to the conclusion already given; it must not introduce new files
  or directories.
- B5 Explicit divergence blacklist: whole-directory / whole-project `grep` or scan; browsing
  adjacent directories, old snapshots, `.imported` / `backup` files, or unrelated plugins that
  are not the subject of the question; refactoring, optimization, beautification, formatting.

## C. Conflict Resolution
- C1 When "rigor / verification" conflicts with B, B wins: stop and ask first, then decide
  whether to look.
- C2 Priority: A > the user's direct instruction this turn > B > all other preferences.
- C3 If unsure whether something is in scope: ask in one sentence; never guess and act.

## D. Engineering Constraints (parallel to A/B/C; A and C2 win on conflict)
- D1 Backup & cleanup: before changing important files (config, environment, core files), back
  up to `backups/` at the project root; clean up this task's test/temp files when done.
- D2 Sub-agent review: after finishing a complex feature module, or before delivering to the
  user, call a sub-agent for a read-only review of the delivered code/implementation. Review is
  an authorized action; its read scope is bounded by the deliverable and its direct dependencies
  and does NOT count as B2/B5 divergence. Simple tasks (config edits, single-point text changes)
  are exempt.
- D3 Verification duty: for time-sensitive, disputed, or latest information, search and verify as
  needed — never conclude from intuition. C1 still wins: when "should I search this time" is
  itself uncertain, ask first; do not expand scope unilaterally.
- D4 Shortest path: solve the question the user explicitly asked with the fewest steps and fewest
  files. No refactoring, no optimization.
- D5 No guessing: conclusions must rest on file or command evidence; with no evidence, say you
  don't know.

