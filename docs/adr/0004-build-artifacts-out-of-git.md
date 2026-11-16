# ADR-0004: Build artifacts stay out of git; `install.sh` produces them

## Status

Accepted (2026-11-16)

## Context

`ai-bridge` (8.9 MB) and `ma` (13.9 MB) are Mach-O binaries built from two of the
submodules, plus `photocraft-cli` (133 MB, universal), which comes from a third party.
`usrbin` already gitignored all three, so the historical decision was "do not track
binaries" — but nothing ever replaced them automatically, which is why the copies were
hand-managed and always stale after a rebuild.

## Decision

`bin/ai-bridge`, `bin/ma`, and `bin/photocraft-cli` are gitignored and produced by one
idempotent `install.sh` at the repository root:

- `git submodule update --init --recursive`
- `cargo build --release --manifest-path third-party/<repo>/Cargo.toml`, then
  `install -m 0755 target/release/<name> bin/<name>`, then
  `cargo clean --manifest-path third-party/<repo>/Cargo.toml` to reclaim the multi-GB
  `target/` directory that a submodule checkout would otherwise leave behind
- fetch `photocraft-cli` from the `storytold/photocraft` GitHub release
  (`photocraft-cli-<ver>-macos-universal.zip`), unpack, install to `bin/photocraft-cli`,
  skipping the download when the installed `--version` already matches
- create `var/logs/{ai-bridge,ma}` and `var/home/dsh`
- report whether `bin/` is on `PATH`, without editing shell configuration

The `photocraft-cli` version is pinned by `PHOTOCRAFT_CLI_VERSION` and defaults to
`0.8.2`, the version the launcher's flags (`--tiff-layers`, `--tga-bits`, …) were written
against. Upstream is at `v0.23.1`; bumping it is a deliberate change with a smoke test,
not a side effect of installing.

## Consequences

- No binary provenance in git history; the source of every artifact is a submodule commit
  plus a release tag, both recoverable from `.gitmodules` and the script.
- A fresh install compiles `ai-bridge` from scratch (its `target/` is not carried over),
  which is slow, and then deletes `target/` again — the trade is disk over rebuild time.
- `dsh-photocraft` now defaults `PHOTOCRAFT_CLI` to `$SCRIPT_DIR/photocraft-cli`; the old
  `/opt/home/Bin` default disappears with the `usrbin` cleanup, and the patch overlay
  resolves it through `DSH_AGENT_ROOT`.
- `install.sh` never touches `~/.zshrc`, so `PATH` remains the user's decision and the
  single manual step in setup.
