# ADR-0013: The TUI bundle is linked from the local checkout

## Status

Accepted (2026-11-26).

## Context

`dsh-agent` boots `dsh --profile pi-tui`, so the TUI surface is a profile
dependency: `@xmoon76/dsh-pi-tui`. Every home carried it as a registry range
(`^0.5.6`, resolved to the published 0.5.6), installed by
`dsh plugin --profile pi-tui -- add @xmoon76/dsh-pi-tui@latest`.

`third-party/dsh-pi-tui` has been a submodule since ADR-0003, but nothing used it
at runtime. For the permission rules (ADR-0011) the same layout is used the other
way round: a `link:` dependency on the checkout, so a local change is a working-
tree edit and not a release. The TUI kept the release path only because nobody
had asked for the other one.

Three facts decide the design:

- The checkout is **source only**. `package.json` points `main` at
  `dist/index.mjs`, and `dist/` plus `node_modules/` are gitignored, so a fresh
  clone has neither. `pnpm install` plus `pnpm build` (the `packages/pi-tui`
  fork, then the tsdown bundle) produces them; the build takes a couple of
  minutes the first time and seconds afterwards.
- A bundle is resolved through its `package.json`, so a link to an unbuilt
  checkout boots **nothing**, and a link to a stale build silently boots the
  **previous** code. Neither failure announces itself.
- `dsh-upgrade` deliberately does not touch submodules: pulling one would move a
  commit and change the superproject's git state, which the command promises
  never to do. `pull-all` owns that. But `pull-all` only `git pull`s — it cannot
  rebuild `dist/`, so after a pull a linked profile would keep running the old
  build with no signal.

ADR-0012 pinned the SillyTavern bootstrap at 0.5.6 because the host was
`0.2.2-rc.1` and the checkout's 0.5.7 requires `dsh >= 0.2.2-rc.3`. The host is
now `0.2.2-rc.5`, so the local 0.5.7 satisfies its own `engines.dsh`.

## Decision

1. **Link, don't install.** `dsh-agent` links `@xmoon76/dsh-pi-tui` from
   `third-party/dsh-pi-tui` exactly as it links the permission rules. The
   migration is install-once: a profile that declares a registry range or a
   different link path is moved by one `dsh plugin add <checkout>`; a profile
   whose declaration already matches costs a filesystem check and prints
   nothing. A failed link keeps whatever is installed — a warning, never a
   failed boot.
2. **One owner for the build.** New `bin/dsh-pi-tui-build` re-syncs
   dependencies (`pnpm install --frozen-lockfile`, idempotent on a current tree)
   and runs `pnpm build`. Staleness is a stamp — `dist/.dsh-build-stamp`, written
   only after a build completes — so an interrupted build (tsdown cleans `dist/`
   first) never looks current; the stamp must be newer than `package.json`, the
   lockfile, `pnpm-workspace.yaml`, `tsdown.config.ts`, `src/`, `generated/` and
   every `packages/*/src` tree, files and directories alike. `--check` reports
   and changes nothing; `--force` rebuilds; anything else is a no-op with a
   version line.
3. **The pin is not a hard gate.** The checkout pins `pnpm` through
   `packageManager` for upstream reproducibility. Where that pin cannot be
   materialized (a read-only `HOME`, a sandboxed home), pnpm fails with
   `ERR_PNPM_PRIVATE_INSTALL` before doing any work; the helper retries once with
   the pnpm already on `PATH` and says so, because a stale build is the worse
   failure.
4. **The launcher pre-flights, the upgrader rebuilds.** `dsh-agent` runs the
   helper only when the build is stale, and verifies that the profile's
   `node_modules` resolves to the checkout rather than trusting the manifest
   alone: a half-finished `dsh plugin add` leaves the previous copy in place, and
   booting it would be the silent drift this decision exists to remove. A failed
   rebuild with a previous build on disk boots that build and says so; a link
   that resolves to nothing is refused with the repair command. `dsh-upgrade`
   rebuilds every linked checkout after its profile step, which is the only
   mutation it makes to a checkout; `dist/` and `node_modules/` are ignored
   there, so no submodule commit moves and the superproject stays clean — unless
   a rebuild rewrites the tracked `generated/` tree, which the helper reports
   instead of hiding.
   `--check` reports `tui-current` / `tui-stale`, and fails on a broken checkout
   instead of calling it stale.
5. **Degrade, but never lie.** A missing checkout, a failed build with no
   profile linked yet, or `DSH_PI_TUI_SOURCE=npm` uses the published package with
   a warning. `DSH_PI_TUI_SOURCE` moves the checkout. A profile that already
   links a checkout is not silently relinked to the registry: the launch says so
   and prints the exact revert command, because the link still wins at boot.
6. **install.sh builds on a fresh clone**, so the first launch never meets an
   unbuilt checkout.
7. **A failed build is recoverable.** The previous `dist/` is snapshotted under
   `backups/dsh-pi-tui/` (gitignored) and restored when the build fails, and a
   pid lock under `$TMPDIR` keeps a launch and `dsh-upgrade` from building the
   same checkout concurrently. A build that rewrites the tracked `generated/`
   tree is reported, because that would dirty the submodule and block
   `pull-all`.

## Consequences

- A TUI change is a checkout edit plus `dsh-pi-tui-build` — no registry release,
  no profile update. The checkout is the source of truth for every home; its
  `engines.dsh` is what dsh enforces at boot.
- Every existing home is migrated once (one `dsh plugin add` per profile), and
  the build must be current after every source pull.
- The suite can now run a TUI version the registry does not have, and a registry
  release no longer reaches a home by itself. `pull-all` + `dsh-upgrade` is the
  refresh path; `dsh-upgrade --check` names a stale build.
- `link:` skips the registry's peer-dependency install: the bundle resolves its
  peers from the checkout's own `node_modules`, which is why `pnpm install` is
  part of the build, and why `pnpm add` prints a peer warning that is expected.
- A build that cannot run costs either the previous build (restored, and named in
  the output) or a clear refusal — never a silent boot on an older copy;
  `backups/dsh-pi-tui/` holds the snapshots until the OS trash takes them.
- ADR-0012's bootstrap pin (0.5.6) still governs a *missing* SillyTavern profile;
  the shared launcher relinks that profile to the checkout afterwards, so the pin
  only covers the first install.
- Rollback: `DSH_PI_TUI_SOURCE=npm` plus one
  `dsh plugin --profile pi-tui -- add @xmoon76/dsh-pi-tui@latest` per profile, or
  move the profile back to an older commit and rebuild.
