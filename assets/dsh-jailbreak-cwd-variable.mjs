// dsh-jailbreak-cwd-variable — register the `cwd` prompt variable this dsh
// build does not ship.
//
// Why: dsh-purge rewrites the assembled prompt at runtime
// (lib/identity.js → overlayOfficialIdentity) and always sets the
// `deployment:persona-suffix` section text to
//
//   "Your working directory is {{cwd}}."
//
// while its own DSH_INTERPOLATE_ALLOWED set assumes the host interpolates `cwd`
// next to `model`/`provider`. This dsh build (0.2.1-rc.2) registers only
// `provider` and `model` — dsh-agent-loop is the only registrant — so prompt
// assembly throws on every turn:
//
//   unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix";
//   registered variables: provider, model
//
// and the TUI just shows "sending" and never answers. A static `personaSuffix`
// cannot repair it: the plugin normalizes any cwd-only suffix back to that exact
// template, so the missing piece is the variable itself. Editing the installed
// plugin would be undone by the next install or update, so the capability is
// registered here instead — the same `systemPrompt.variable()` call the host
// makes for provider/model, evaluated per assembly, mounted only in the home
// that carries this layer (a plain `dsh --profile pi-tui` launch elsewhere is
// untouched).
export const name = 'dsh-jailbreak-cwd-variable'
export const inject = ['systemPrompt']

export function apply(ctx) {
    try {
        return ctx.systemPrompt.variable('cwd', () => process.cwd())
    } catch {
        // A host that registers `cwd` itself wins: a duplicate registration
        // throws by design, and this layer must never break such a boot.
        return undefined
    }
}

export default { name, inject, apply }
