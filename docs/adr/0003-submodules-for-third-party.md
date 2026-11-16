# ADR-0003: Bring the third-party repositories in as submodules

## Status

Accepted (2026-11-16)

## Context

Five repositories are involved and all of them already exist as independent, clean,
in-sync clones elsewhere under `/opt/home/Github`:

| repo | size on disk | note |
|---|---|---|
| `darklinden/ai-bridge` | 3.4 GB (almost all `target/`) | builds `bin/ai-bridge` |
| `darklinden/micro-agent` | 668 KB | builds `bin/ma` |
| `darklinden/dsh-purge-community` | — | fork of `kingcharleslzy-ai/dsh-purge`; default branch `main` |
| `XMoon/dsh-pi-tui` | 79 MB | TUI profile plugins |
| `sixtysevenlf/dsh-blender-plugin` | 9.7 MB incl. `node_modules` | already nested inside this tree |

`dsh-blender-plugin` was a plain nested git repository, which `git add` either rejects as
an embedded repo or swallows as ordinary files.

## Decision

All five become submodules under `third-party/<name>`, added with an explicit `-b main`
so the recorded `.gitmodules` branch lets `pull-all` check out a branch instead of
stranding a detached HEAD.

`.gitmodules` records **HTTPS** URLs so anyone can clone the superproject anonymously;
the maintainer's machine maps them to SSH for pushing:

```
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

The existing `dsh-blender-plugin` checkout is moved out of the tree first, then replaced
by a fresh submodule clone and rebuilt (`npm ci`, `scripts/build.sh`); the old copy is
kept until the rebuilt plugin is verified, then trashed.

## Consequences

- A fresh clone needs `git clone --recursive` or `install.sh`, which runs
  `git submodule update --init --recursive`.
- A second checkout of each repository now exists on this machine; `third-party/` is the
  one this suite uses.
- `dsh-blender-plugin`'s `node_modules` and build output are not carried over — they are
  rebuilt, so the plugin is unusable between the move and the rebuild.
- Submodule pointers must be committed and pushed after any submodule update
  (`pull-all`/`push-all` already handle that consistency check).
