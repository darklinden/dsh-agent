# ADR-0010: dsh-blender delegates to dsh-agent

## Status

Accepted (2026-11-16)

## Context

`dsh-blender` had grown into a second copy of `dsh-agent`: it loaded `.env`, validated
the `DDD_*` route, generated the model/telemetry/Tavily overlay, derived the
`web_search` preset takeover, prepended the wrong-command guard, and re-asserted the
AGENTS.md link. `dsh-jailbreak` and `dsh-photocraft` already use the thinner pattern:
own one tool's setup, then `exec dsh-agent <home>`.

Two behaviours were intentionally kept out of that handover:

- The persisted `agent-preset-registry.selectedDefault` lookup existed only in
  `dsh-blender`. Moving it into `dsh-agent` would change every home, including
  `dsh-jailbreak` and `dsh-photocraft`.
- The wrong-command guard had no configurable root in `dsh-agent`. A generic
  `DSH_GUARD_ROOT` is additive and leaves the default (`bin/`) untouched.

## Decision

1. `dsh-blender` becomes a thin front end: source `.env`, gate the plugin build and
   host links, pin the project plugin config, preserve its own persisted preset, install
   the Blender home layer, then `exec dsh-agent dsh-blender "$@"`.
2. The Blender plugin row moves to `assets/dsh-blender.patch.yml`, symlinked from
   `dsh-home/dsh-blender/cordis.patch.yml`. The row names `lib/index.js` by a plain
   relative path resolved from `$DSH_HOME` (two levels below the repo root), not a
   `!!js` expression: dsh's profile compatibility preflight calls `name.startsWith()`
   before the patch loader evaluates `!!js`, so a tagged value would be disabled. The
   package is never installed into a profile.
3. `dsh-agent` gains only `DSH_GUARD_ROOT`, defaulting to its own `bin/`. Its preset
   resolution, overlay, telemetry, AGENTS link and profile checks stay unchanged.
4. The persisted-preset lookup stays in `dsh-blender` deliberately, so
   `dsh-jailbreak` and `dsh-photocraft` keep their current default behaviour.
5. `DSH_BLENDER_GUARD_ROOT` remains a legacy alias read by `dsh-blender`;
   `DSH_GUARD_ROOT` wins when both are set.

## Consequences

- Common route, telemetry, guard and AGENTS logic has one copy in `dsh-agent`;
  `dsh-blender` keeps only the Blender-specific gate, config pin, preset compatibility
  and home-layer install.
- The Blender row is home-scoped: a direct `dsh-agent dsh-blender` launch also mounts
  it, while a plain `dsh --profile pi-tui` launch in another home does not.
- A foreign `cordis.patch.yml` is never overwritten; the launcher warns that the session
  may have no Blender tools. A dangling link is repaired on launch. A missing asset or a
  failed link install is fatal, because a Blender session without the row is misleading.
- `.env` is re-sourced by `dsh-agent`; an entry there that defines `DSH_BLENDER_CONFIG`
  wins over the project pin and is reported.
- `DSH_GUARD_ROOT` is opt-in. With it unset, `dsh-jailbreak` and `dsh-photocraft` behave
  exactly as before.
- Supersedes ADR-0009 decision 7 (the duplicated AGENTS block) and ADR-0008's
  `DSH_BLENDER_GUARD_ROOT` naming as the only guard-root knob.

## Alternatives considered

- **Keep the standalone launcher** — rejected: it keeps two copies of the route,
  telemetry, preset-derivation and guard logic, which had already drifted.
- **Give `dsh-agent` an extra `--patch` extension point** — rejected for now: the home
  layer is the established seam used by `dsh-jailbreak` and `dsh-photocraft`, and the
  front ends share one home-level model.
- **Move persisted-preset lookup into `dsh-agent`** — rejected for this change: it would
  alter the other homes' default preset selection. The compatibility copy stays local.
- **Require the Blender row in every home** — rejected: the plugin must exist only in
  `dsh-blender` sessions.

## References

- ADR-0008 — repo-local DSH homes and the dsh-blender name
- ADR-0009 — DSH homes symlink the AGENTS template
- `GLOSSARY.md` — front end, home layer, GUARD_ROOT
- `bin/dsh-agent`, `bin/dsh-blender`, `assets/dsh-blender.patch.yml`
