# ADR-0007: Track the fork, unpinned, for the jailbreak plugin

## Status

Accepted (2026-11-16)

## Context

`dsh-jailbreak` installs the purge plugin into a DSH profile by forwarding a source
spec to `pnpm add`. Its default source was another party's floating branch tarball
(`github.com/mmparko/dsh-purge/archive/refs/heads/master.tar.gz`) — unpinned, and named
after a repository this project does not control.

The fork `darklinden/dsh-purge-community` (fork of `kingcharleslzy-ai/dsh-purge`, default
branch `main`, package name `dsh-purge-community`, version 1.7.14) is the source this
project actually maintains. Its `lib/`, `bin/`, `client.js`, and `cordis.patch.yml` are
committed and it declares no `prepare` script, so a pnpm git dependency installs without
running a build. Its own `package.json` advertises `dsh.install.preferred: "tarball"`
pointing at the upstream release asset.

The detection logic, meanwhile, hardcoded the string `dsh-purge` in three places
(`node_modules/dsh-purge/package.json`, `bundles.includes("dsh-purge")`,
`"dsh-purge" in dependencies`). With a package named `dsh-purge-community` it would
report "not installed" forever: reinstall on every launch, then boot without the plugin
and print `partial`.

## Decision

- `PLUGIN_SOURCE` defaults to `github:darklinden/dsh-purge-community` — the fork, with
  **no** SHA or tag pin. Version locking is handled by the maintainer on the fork.
- `PLUGIN_PKG` defaults to `dsh-purge-community` (overridable via
  `DSH_JAILBREAK_PLUGIN_PKG`) and `plugin_ready()` uses it for all three checks.
- The upstream release tarball advertised in the fork's metadata is **not** used, since
  it would install upstream code while the submodule tracks the fork (ADR-0003).

## Consequences

- A new profile's first install gets whatever `main` is at that moment. Existing installs
  do not drift: the profile's `pnpm-lock.yaml` records the resolved commit, and
  `plugin_ready()` short-circuits any reinstall once the bundle is present.
- No `dsh-purge` dependency exists in the three profiles on this machine, so no
  remove-and-reinstall step is required during migration; both bundles would otherwise
  patch twice.
- Installing requires `git` and GitHub access on the target machine, unlike a tarball.
- Switching to a pinned tag or to the fork's own release asset later is a one-line change
  plus this ADR's successor.
