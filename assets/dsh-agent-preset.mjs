// Derive the preset takeover from the installed official preset file.
// argv: node, <this helper>, <dsh bin>, <official preset patch>, <derived output>, <preset>
import { createRequire } from 'node:module'
import fs from 'node:fs'
const yaml = createRequire(process.argv[2])('yaml')
const srcPath = process.argv[3]
const outPath = process.argv[4]
const preset = process.argv[5]
const die = (code, message) => { console.error('dsh-agent: ' + message); process.exit(code) }
const jsTag = { tag: 'tag:yaml.org,2002:js', resolve: (value) => ({ __jsExpr: value }) }
const parse = (text, what) => {
  try {
    return yaml.parse(text, { customTags: [jsTag] })
  } catch (error) {
    die(1, 'cannot parse ' + what + ': ' + (error?.message ?? error))
  }
}

const source = fs.readFileSync(srcPath, 'utf8')
const srcRow = parse(source, 'the official preset file')?.[0]?.insert?.[0]
const srcConfig = srcRow?.config
if (srcRow?.name !== '@deepseek-ai/dsh-agent-preset' || !Array.isArray(srcConfig?.plugins)) {
  die(1, 'unexpected official preset file: ' + srcPath)
}
const toolWeb = srcConfig.plugins.find((row) => row?.id === 'tool-web')
if (!toolWeb) die(3, "preset '" + preset + "' has no tool-web row: nothing to disable")
if (toolWeb.config?.search === false) die(4, "preset '" + preset + "' already ships search: false")

// Text surgery: rewrite ONLY the tool-web item, so every other byte — each
// `!!js` expression, the plan-mode literal block — is preserved verbatim.
const lines = source.split('\n')
const start = lines.findIndex((line) => /^\s*- id: tool-web\s*$/.test(line))
if (start < 0) die(1, 'tool-web row not found in the preset text')
const pad = lines[start].match(/^\s*/)[0]
let end = lines.length
for (let i = start + 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const indent = lines[i].match(/^\s*/)[0]
  if (indent.length < pad.length + 2) { end = i; break }
  if (indent.length === pad.length && /^-\s/.test(lines[i].trim())) { end = i; break }
}
const config = { ...(toolWeb.config ?? {}), search: false }
const configText = yaml.stringify(config, { lineWidth: 0 }).replace(/\n$/, '')
  .split('\n').map((line) => ' '.repeat(pad.length + 4) + line).join('\n')
// A `!!js` value parses to a sentinel object that stringify would re-emit as a
// plain `__jsExpr:` map, silently changing its meaning. No shipped preset puts
// one in tool-web today; fail loud rather than corrupt it if that ever changes.
if (configText.includes('__jsExpr')) {
  die(1, "tool-web config holds a !!js value this surgery cannot preserve")
}
const toolWebName = toolWeb.name ?? '@deepseek-ai/dsh-tool-web'
const item = [
  pad + '- id: tool-web',
  ' '.repeat(pad.length + 2) + 'name: ' + (/'/.test(toolWebName) ? JSON.stringify(toolWebName) : "'" + toolWebName + "'"),
  ' '.repeat(pad.length + 2) + 'config:',
  configText,
]
let out = [...lines.slice(0, start), ...item, ...lines.slice(end)].join('\n')
// The official file leads with its own header comment; this copy is generated.
let outLines = out.split('\n')
let head = 0
while (head < outLines.length && outLines[head].trim().startsWith('#')) head++
outLines = outLines.slice(head)
// Lift the `- insert:` list to a top-level entry: an overlay's non-insert entry
// replaces the target row's whole config, which is how this patch overrides the
// `preset-<id>` declaration the bundle already mounted. The list's own indent is
// measured, never assumed.
const insertAt = outLines.findIndex((line) => /^- insert:\s*$/.test(line))
if (insertAt < 0) die(1, 'the official preset file has no top-level `- insert:`')
const block = outLines.slice(insertAt + 1)
const blockLine = block.find((line) => line.trim())
const blockIndent = blockLine ? blockLine.match(/^\s*/)[0] : ''
if (!blockIndent) die(1, 'the `- insert:` list has no indented items')
outLines = [
  ...outLines.slice(0, insertAt),
  ...block.map((line) => (line.trim() && line.startsWith(blockIndent) ? line.slice(blockIndent.length) : line)),
]
out = outLines.join('\n')

// Assert the surgery changed exactly one thing: tool-web's config.
const derived = parse(out, 'the derived block')?.[0]
if (derived?.name !== '@deepseek-ai/dsh-agent-preset') die(1, 'derived declaration name drifted')
if (derived?.config?.id !== srcConfig.id) die(1, 'derived preset id drifted')
const before = srcConfig.plugins
const after = Array.isArray(derived?.config?.plugins) ? derived.config.plugins : []
if (after.length !== before.length) die(1, 'plugin count drifted')
if (before.map((row) => row.id).join() !== after.map((row) => row.id).join()) {
  die(1, 'plugin order drifted')
}
for (let i = 0; i < before.length; i++) {
  if (before[i].id === 'tool-web') continue
  if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) {
    die(1, 'plugin ' + before[i].id + ' drifted')
  }
}
const patched = after.find((row) => row?.id === 'tool-web')
if (patched?.config?.search !== false) die(1, 'derived tool-web does not disable web_search')
if ((patched?.config?.fetch ?? true) !== (toolWeb.config?.fetch ?? true)) {
  die(1, 'derived tool-web does not keep web_fetch')
}
if (JSON.stringify(patched.config) !== JSON.stringify(config)) die(1, 'derived tool-web config drifted')
// Write-then-rename: the cache above means another launch may READ this file
// while this one rewrites it, so the swap must be atomic — a reader sees either
// the previous complete block or the new one, never a truncated copy.
const tmpPath = outPath + '.' + process.pid + '.tmp'
fs.writeFileSync(tmpPath, out)
fs.renameSync(tmpPath, outPath)
