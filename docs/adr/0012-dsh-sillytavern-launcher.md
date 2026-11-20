# ADR-0012: `dsh-sillytavern` imports an AI preset for the TUI

## Status

Accepted (2026-11-20).

## Context

The suite needed a launcher that makes a SillyTavern chat configuration usable when the
TUI starts. The file that motivated it,
`assets/sillytavern/preset.json`, is a SillyTavern **AI Response
Configuration** preset: 41 `prompts`, a `prompt_order`, `temperature`,
`openai_max_tokens`, `openai_max_context`, the sampler block and
`extensions.luker` display regex. It is not a character card, worldbook or chat log.

The obvious candidates were rejected for the TUI + host-version combination on this
machine (DSH `0.2.2-rc.1`, `@xmoon76/dsh-pi-tui` `0.5.6`):

| candidate | why not |
|---|---|
| `pmp-dsh-tavern` 3.0.5 | declares DSH `>=0.2.1-rc.2 <0.2.2-0`; the current `0.2.2-rc.1` is outside it, and its UI is a Web client |
| `dsh-tavern` 2.8.1 | management panel is Web-only; the TUI cannot import or select cards/presets, and the host code is heavier |
| `dsh-nexttavern` | requires DSH `0.2.2-rc.5+` and targets Web / Windows Desktop |
| `dsh-universal-worldbook` | handles worldbooks, not AI presets |

`dsh-sillytavern-presets` 1.0.7 is the fit: a 29 KB prebuilt host plugin with
`engines.dsh >= 0.2.0-rc.2`, no build step, and a host half that injects the active
preset as one `systemPrompt.section` and overrides `temperature`/`maxTokens` on
`agent/request`. Its client half is Web-only, but the host half needs only `webServer`
and `systemPrompt`, both present in the `pi-tui` profile. The TUI therefore gets the
preset without mounting a settings page.

## Decision

1. Add `bin/dsh-sillytavern` as a thin front end for `dsh-agent`, with its own home
   `dsh-home/dsh-sillytavern` and profile `pi-tui` (or `$DSH_PI_TUI_PROFILE`). The
   common `.env`, route, telemetry, guard, AGENTS and permission-rule plumbing stays in
   `dsh-agent`.
2. Bootstrap a missing profile with `@xmoon76/dsh-pi-tui@0.5.6`. The local checkout's
   0.5.7 declares DSH `>=0.2.2-rc.3`; pinning 0.5.6 keeps the first install working on
   the current `0.2.2-rc.1` host. `DSH_SILLYTAVERN_BOOTSTRAP=off` restores the
   report-don't-populate behaviour.
3. Add `dsh-sillytavern-presets` as a git submodule under
   `third-party/dsh-sillytavern-presets` and install it once from that checkout with
   `dsh plugin ... add`. This follows ADR-0003: the superproject pins the plugin commit,
   and there is no download or hash step. A missing or incomplete submodule is reported
   with the exact `git submodule update --init` command; the launch still boots without
   the preset. `DSH_SILLYTAVERN_PLUGIN_SOURCE` overrides the source for a working copy,
   tarball or git spec.
4. Import the preset through the plugin's own HTTP handler, not a copy of its
   normalization. `assets/dsh-sillytavern-import.mjs` imports the host module, calls
   `apply()` with a minimal fake context, captures the route handler and drives
   `state` / `import` / `select` / `archive`. This keeps prompt-order groups, macro
   handling, filtering and persistence owned by the plugin.
5. Make the import idempotent with `launcher-import.json` beside the plugin's
   `presets.json`: `{ source, sha256, presetId, importedAt }`. An unchanged file is only
   re-selected. A changed file imports a new preset, selects it and archives the
   previous launcher-managed preset after the new one is active, so a failed import
   leaves the old prompt layer in place.
6. Scope the launcher to AI presets only. Character cards, worldbooks, the preset's
   display regex, memory and the Web settings page are explicitly out of scope.

## Consequences

- Starting the TUI with a tavern preset needs no Web UI and no manual import. The
  launcher prints the preset name, effective prompt count, temperature/maxTokens and
  the store path before exec'ing `dsh-agent`.
- The plugin's Web client half is unused in this home. Its host half still registers a
  loopback route, but the TUI never renders the settings page; the launcher is the
  supported import path.
- The profile records the plugin as a `link:` dependency sourced from
  `third-party/dsh-sillytavern-presets`; the submodule commit is the version pin, and
  the checkout must stay present for that home to load the plugin. Because the
  dependency is a link, moving that commit changes the code loaded on the next launch.
- The import helper depends on the plugin's internal route contract. A plugin upgrade
  that changes the routes or the `publicState`/`publicPreset` shape makes the helper
  fail loudly; the launcher only warns and the TUI still boots. Re-verify the helper
  when moving the submodule commit.
- A changed preset becomes a new plugin record and the previous one is archived; the
  plugin's `uniqueName` gives later copies a `(2)`, `(3)` suffix. This is cosmetic and
  preserves the old prompt layer for recovery.
- The preset becomes system instructions. It can conflict with `AGENTS.md` or the
  conversation's own rules. Permission rules still deny/ask at the tool boundary, but
  the model's behaviour can change; only trusted presets belong here.
- Only `temperature` and `maxTokens` are applied; `top_p`, penalties, seed and the rest
  are stored and exported by the plugin but do not reach the Harness request.

## Alternatives considered

- **`dsh-tavern` / `pmp-dsh-tavern` / `dsh-nexttavern`** — rejected above: Web-first
  management and/or an incompatible DSH version window.
- **A Web profile + manual import, then TUI** — rejected: the request is specifically
  "start the TUI and use the preset", and the TUI cannot reach the Web settings page.
- **Copy the plugin's normalization into the launcher** — rejected: it would drift from
  the plugin's prompt-order/macro/persistence rules and silently import differently.
- **Write a dedicated TUI extension** — out of scope for a launcher; the host-half
  plugin already provides the injection seam.

## References

- ADR-0007 — plugin source and install-once conventions
- ADR-0008 — repo-local DSH homes
- ADR-0010 — thin front ends delegate to `dsh-agent`
- `bin/dsh-sillytavern`, `assets/dsh-sillytavern-import.mjs`
- `third-party/dsh-sillytavern-presets` (submodule)
- `dsh-sillytavern-presets` v1.0.7 (MIT):
  `https://github.com/Xxsttb/dsh-sillytavern-presets`
