# Permission rules — declarative deny/ask over the tool pipeline

Status: implemented in trial form; promotion to a submodule is issue 01, the
interactive acceptance run is issue 02.

## Problem

The harness's permission model is three presets (sandbox mode + approval policy)
plus per-call escalation. It has no per-tool or per-path rule table, and reads
are not gated at all. This suite already states "never delete" (A2) and "never
read secrets" (A4) in the user-global `AGENTS.md`, but nothing at the tool
boundary enforces either.

## Design

- **Plugin** `third-party/dsh-permission-rules` — a plain profile dependency
  (no `dsh.bundle.patch`), no imports, `node --test` only.
- **Rule table** `assets/permission-rules.patch.yml` — tracked, diffable;
  `bin/dsh-agent-rules` (the trial copy of `dsh-agent`) mounts it as a second
  `--patch` overlay after installing the plugin (install-once, like the jailbreak
  plugin). Testing uses a dedicated home: `bin/dsh-agent-rules
  dsh-permission-rules` boots `dsh-home/dsh-permission-rules`, so the shared
  launcher and its home are never touched.
- **Enforcement** — a prepended `tools/pre-execute` listener for fast `deny` and
  downstream-aware `ask`, plus `ctx.tools.guard` for the monotonic deny floor.
  Never an approval answerer (single terminal answerer, and `approval: never`
  would skip it), never `fs/*` (single-slot, owned by `fs-observation-policy`).
- **No sandbox/approval writes** — presets keep folding only their two knobs, so
  `/permission` never reports `custom`.

Precedence, as composed with the rest of the harness:

| Situation | Outcome |
|---|---|
| deny rule matches, Auto review would allow | deny (rule wins) |
| Auto review denies under `ask`, user approves | deny if a deny rule matches (guard) |
| ask rule matches, a later listener denies/asks/cancels | downstream wins |
| ask rule matches, `approval: never` (Full access, child agents) | deny |
| escalated bash retry (`sandbox_permissions`) | still matched (`args` surface + guard runs after approval) |

## Rule schema

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | unique; appears in the denial text |
| `tool` | yes | name, list, or `*` glob (whole-name; `*` is the only wildcard) |
| `match` | no | `command` / `path` / `url` / `args` / `any` (default `any`) |
| `scope` | no | `command` (default) or `subcommand`; the latter requires `match: command` |
| `kind` | no | `regex` (default), `prefix`, `exact` |
| `pattern` | yes | JS RegExp source, or the literal for `prefix` / `exact` |
| `flags` | no | e.g. `i`; only with `kind: regex` |
| `action` | yes | `deny` / `ask` |
| `reason` | yes | one sentence for the model and the approving human |
| `code` | no | defaults to `PERMISSION_RULE_DENIED` / `PERMISSION_RULE_APPROVAL` |

`scope: subcommand` runs `lib/shell.js` first: split on `&&`/`||`/`;`/`|`/newlines,
resolve quotes (so `g""it commit` is `git commit`), drop redirections, strip leading
`VAR=value` and safe wrappers (`sudo`, `timeout`, `nice`, `nohup`, `env`, `xargs`, …), and
expand `sh -c` / `eval`. Lines it cannot model (`$(…)`, heredoc, subshell, process
substitution) fall back to whole-line matching, with an unanchored retry for anchored
patterns — an unparseable command is never assumed harmless.

`maxSurfaceBytes` (default 65536) denies oversized surfaces rather than
truncating them.

## Failure policy

- Invalid config → throws at plugin load (boot fails, naming `rules[i]`).
- Missing plugin / failed install → launcher warns, boots without the rule patch.
- Oversized surface → deny (`PERMISSION_RULE_SURFACE_TOO_LARGE`).

## Verification so far

- `node --test` in the plugin: 41 tests — analyzer (splitting, quotes, wrappers,
  redirections, `sh -c`/`eval` expansion, fail-closed constructs), surfaces,
  precedence, oversize, validation, stateless matching, `prepend` ordering,
  guard-less compositions, and a shipped-table test that asserts the asset's
  patterns verbatim and runs the bypass cases (`/bin/rm`, `\rm`, `sudo rm`,
  `timeout 5 rm`, `$(rm …)`, `bash -c`, `git -C … commit`, `Remove-Item`,
  `C:\repo\.env`, `.env.staging`) plus the false-positive cases
  (`echo rm`, `printf "rm -rf /"`, `git log --grep commit`, `echo "git commit"`).
- `dsh --profile pi-tui --patch assets/permission-rules.patch.yml --dump-config`
  composes the row with the full table, in the trial home and in the shared one.
- Trial home `dsh-home/dsh-permission-rules`: `dsh plugin --profile pi-tui -- add
  @xmoon76/dsh-pi-tui@^0.5.6` installs the TUI profile; `bin/dsh-agent-rules`
  then installs the rule plugin (`link:` dependency, dev edits are live) and
  prints `Permission rules: on (…)` with two `--patch` arguments.
- Launcher states exercised end to end (with a fake `dsh` that forwards
  `plugin` and echoes the launch argv): bare invocation → trial home, `on`;
  `DSH_PERMISSION_RULES=off` → one `--patch`; a missing rule patch → warning and
  one `--patch`.
- `zsh -n` clean; `bin/dsh-agent` is byte-identical to `HEAD` (the shared
  launcher is untouched).
- Live enforcement observed: the session that was running while this was built
  (launched from the pre-revert launcher) has the plugin mounted — a `bash` call
  whose text contained the literal trigger was denied with the rule id and the
  "did not execute" sentence. That same session runs the *pre-fix* table, which
  is how the `"`-boundary bypass was found; the fixes above take effect on the
  next launch.
- False-positive note: `command` rules match the whole command text, so a
  command that merely mentions a trigger (a test fixture, a doc edit) is denied
  too. That is inherent to text matching and documented in the plugin README.
- Launcher: `zsh -n` clean; the readiness predicate accepts the probe profile and
  rejects a missing package.

## Known limits

Regex, not parsing — quoting/encoding can dodge a rule. No per-agent narrowing,
no content matching, and interactive terminal input is invisible. The sandbox
and approval policy remain the isolation boundary.

## Follow-ups

- Issue 01: publish and promote the checkout to a submodule.
- Issue 02: interactive acceptance matrix.
- Optional later: a runtime-context line so the model knows rules exist;
  `match: content`; agent-scoped guards.
