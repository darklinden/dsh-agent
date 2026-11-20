# ADR-0011: Declarative permission rules as a plugin plus a tracked rule patch

## Status

Accepted (2026-11-20); the plugin repository is a local trial checkout until the
operator publishes it (see "Trial phase and promotion").

## Context

The harness (0.2.2-rc.1) owns a coarse permission model, not a rule table:

- `dsh-permission-presets` offers three named presets, each bundling one sandbox
  mode with one approval policy (`read-only`/`ask`, `workspace-write`/`ask`,
  `danger-full-access`/`never`). Sessions switch presets whole; there is no
  per-tool or per-path entry.
- `dsh-sandbox-policy` accepts `mode`, `workspaceRoot`, and
  `additionalWritableRoots`. It constrains writes; reads are unrestricted.
- `dsh-user-approval` composes approval answerers over one waterfall and states
  that a deployment composes **one terminal answerer** — sibling listener order
  is not a policy-priority mechanism.
- `dsh-tools` runs `tools/pre-execute` (reorderable allow/deny/ask), then the ask
  resolution, then monotonic `ctx.tools.guard` guards, then dispatch. A guard
  runs only when the waterfall allowed, which includes an approved `ask`, and no
  later listener can turn its denial back into permission.
- `dsh-tool-bash` carries `TODO(permissions): deployment policy belongs in
  tools/pre-execute and sandboxing executors`.
- `dsh-fs-observation-policy` owns the single-slot, first-wins `fs/*` intent
  gates, and its README directs layered permission interception to `tools/*`.

Meanwhile this suite's user-global `AGENTS.md` states A2 (never delete; move to
the trash) and A4 (never view secrets) in prose only: nothing at the tool
boundary enforces either, and the sandbox does not gate reads at all.

The repository layout (ADR-0001) has four top-level locations and no place for a
first-party package; third-party code enters as submodules (ADR-0003), and a
plain nested repository is either rejected by `git add` or swallowed as ordinary
files.

## Decision

1. **A plugin, not a patched harness.** `@darklinden/dsh-permission-rules` is a
   plain profile dependency (no `dsh.bundle.patch`). It declares only
   `name`/`inject`/`apply`, imports no packages, and is installed with
   `dsh plugin --profile <p> -- add <source>`.
2. **Rules are a tracked asset.** `assets/permission-rules.patch.yml` inserts the
   row and carries the table; the launcher mounts it as a second `--patch` overlay
   (`--patch` is repeatable). Editing policy is a diff in this repository, never
   a plugin republish.
3. **Two enforcement seams, one evaluator.** A prepended `tools/pre-execute`
   listener denies immediately (no reviewer tokens, no approval prompt for an
   already-refused call) and, for `ask` rules, runs the rest of the waterfall
   first so any downstream deny/ask/cancel wins. The same deny rules are also
   registered through `ctx.tools.guard`, which runs after an approval and is
   monotonic.
4. **Command rules are analyzed, not eyeballed.** `scope: subcommand` splits the
   line on `&&`/`||`/`;`/`|`/newlines, resolves quotes, drops redirections,
   strips leading `VAR=value` and safe wrappers (`sudo`, `timeout`, `nice`,
   `nohup`, `env`, `xargs`, …), and expands `sh -c`/`eval`. Anything the analyzer
   refuses to model (`$(…)`, heredoc, subshell, process substitution) falls back
   to whole-line matching — with an unanchored retry for anchored patterns — so
   an unparseable command is never assumed harmless. `kind: prefix|exact` gives
   word-boundary semantics instead of raw regular expressions.
5. **Never an approval answerer.** That would compete with the human approval
   surface for the single terminal answerer, and the rules would not run at all
   under `approval: never` — silently disabled exactly where access is widest.
6. **Never `fs/*`.** The intent slots are single-slot and first-wins; binding
   them would displace `fs-observation-policy`.
7. **Never write `sandbox/mode` or `approval/policy`.** Presets fold only those
   two knobs, so touching them would turn every preset selection into `custom`.
8. **Failure policy.** Invalid config throws at plugin load (a boot that silently
   drops the operator's rules is worse than a boot that refuses); a failed
   install warns and launches without the rule patch (the launcher must not brick
   on an optional plugin); a matched surface above `maxSurfaceBytes` denies,
   because a truncated surface is a silently bypassable one.
9. **Scope.** This is a policy aid, not the isolation boundary. Subcommand
   analysis resolves quoting and wrappers, but variables (`$SUB`), `$(…)`-built
   argv, git aliases, and interpreters (`python -c …`) stay invisible; the
   sandbox and the approval policy remain what confines effects.

### Trial phase and promotion

The mounting logic lives in `bin/dsh-agent-rules`, a copy of `dsh-agent` that
differs only by the permission-rules block. It takes the home name as its first
argument like `dsh-agent`, so testing uses a dedicated home:

```sh
bin/dsh-agent-rules dsh-permission-rules
```

This boots `dsh-home/dsh-permission-rules` and leaves the shared `dsh-agent` and
`dsh-home/dsh-agent` untouched — the shared launcher and its home are never the
test bed. Promotion is a manual copy of the block into `dsh-agent` once the
operator has proven the behaviour; `dsh-agent-rules` then goes away.

The plugin itself is developed in `third-party/dsh-permission-rules/` as a
standalone local git repository, ignored by the superproject (`.gitignore`) so
`git add` never swallows it and `pull-all`/`push-all` never treat it as a
submodule. The launcher installs from that path, so publishing the repository
changes no launcher code: the operator publishes it, removes the ignore line,
and replaces the checkout with a submodule (`git submodule add -b main
<https-url> third-party/dsh-permission-rules`), following ADR-0003's
move-then-verify procedure for the old copy.

## Consequences

- Policy is reviewable: the table diffs like any asset, and a rule change needs no
  package release.
- The plugin installs per profile, while the overlay applies to every profile
  this launcher boots and every home it launches in — that is what "global"
  means here, and `DSH_PERMISSION_RULES=off` is the only exit. The split is
  deliberate: the package is a dependency of a profile, the policy is a property
  of the suite.
- A failed install is a policy gap that only the launch status line reveals;
  that is the price of not blocking the boot. A fresh clone cannot reproduce the
  rules until the plugin repository is published and installed, so the launcher
  warns and continues instead of refusing to start.
- No per-agent narrowing (agent-scoped guards would be a separate feature), no
  content matching for `write`, and interactive terminal input is invisible to a
  per-call rule.
- A denial names the rule id and states that the call did not execute. The
  pre-execute decision also carries the stable code (`PERMISSION_RULE_DENIED`) in
  `info` for durable projections; the guard path returns text only, because a
  `ToolGuard` result is a bare reason string — it repeats the same text, and the
  model is told not to retry with a different spelling.
