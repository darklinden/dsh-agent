#!/usr/bin/env node
/**
 * dsh-sillytavern-import — seed the dsh-sillytavern-presets store from one
 * SillyTavern AI preset file and make it the active prompt layer.
 *
 * Why this helper exists
 * ----------------------
 * The plugin's settings page is a Web client; the TUI never mounts it. The
 * host half is the useful part for a TUI session: it injects the active
 * preset as one System Prompt section and overrides temperature/maxTokens on
 * `agent/request`. To make "start the TUI with this preset" true on the very
 * first launch, the preset has to be in the plugin's store before the host
 * boots.
 *
 * The helper deliberately drives the plugin's OWN HTTP handler instead of
 * re-implementing its import/normalize/persist rules. It imports the host
 * module, calls `apply()` with a minimal fake context, captures the route
 * handler it registers, and then issues the same requests the Web settings
 * page would: state, import, select, archive. That keeps prompt_order groups,
 * macro handling, prompt filtering and the on-disk format owned by the
 * plugin. If the plugin changes that contract, this helper fails loudly and
 * the launcher only warns; it never blocks the TUI.
 *
 * Idempotence
 * -----------
 * `launcher-import.json` next to the plugin's `presets.json` records
 * { source, sha256, presetId, importedAt }. An unchanged file is only
 * re-selected, never re-imported. A changed file imports a new preset, selects
 * it, archives the previous launcher-managed preset (never the new one) and
 * updates the marker. Without a marker, a preset already carrying the same
 * sourceFileName is adopted instead of duplicated (a manual import from the
 * same file).
 *
 * Scope
 * -----
 * SillyTavern AI presets only: prompts / prompt_order / temperature /
 * maxTokens. Character cards, worldbooks and the preset's display regex are
 * not handled here and are left to other plugins.
 *
 * Usage: node assets/dsh-sillytavern-import.mjs <profile-dir> <preset.json>
 * Exit:  0 imported / selected / unchanged; 1 plugin or preset failure;
 *        2 usage error.
 *
 * Environment:
 *   DSH_HOME                     plugin data root; derived from <profile-dir>
 *                                when absent (so a direct invocation still
 *                                writes into the right home).
 *   DSH_SILLYTAVERN_PRESETS_DIR  optional override read by the plugin itself.
 *   DSH_SILLYTAVERN_PLUGIN_PKG   installed package name (default
 *                                dsh-sillytavern-presets).
 *   DSH_SILLYTAVERN_FORCE_IMPORT on|1|true imports even when the hash matches.
 *   DSH_SILLYTAVERN_DEBUG        print stack traces on failure.
 */

import { createHash } from 'node:crypto'
import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'

const PREFIX = '/plugins/sillytavern-presets'
const ORIGIN = 'http://dsh.local'
const DEBUG = process.env.DSH_SILLYTAVERN_DEBUG === '1'

function fail(message) {
  console.error(`SillyTavern: ${message}`)
  process.exit(1)
}

function warn(message) {
  console.error(`SillyTavern: warning: ${message}`)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function forceImport() {
  return ['1', 'on', 'true'].includes((process.env.DSH_SILLYTAVERN_FORCE_IMPORT ?? '').toLowerCase())
}

async function sha256File(file) {
  const hash = createHash('sha256')
  hash.update(await readFile(file))
  return hash.digest('hex')
}

async function readMarker(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return isPlainObject(parsed) ? parsed : null
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    warn(`cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Write the marker atomically. A reader must never see a half-written file,
 * and a failure to write the marker must not undo an import that already
 * landed — the next launch adopts the same sourceFileName preset instead.
 */
async function writeMarker(file, marker) {
  const temp = `${file}.tmp.${process.pid}`
  await writeFile(temp, `${JSON.stringify(marker, null, 2)}\n`, 'utf8')
  await rename(temp, file)
}

function makeResponse() {
  let status = 0
  const chunks = []
  const response = {
    writableEnded: false,
    writeHead(code) {
      status = code
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.from(chunk))
      response.writableEnded = true
    },
  }
  return {
    response,
    result() {
      const text = Buffer.concat(chunks).toString('utf8')
      let body = null
      if (text !== '') {
        try {
          body = JSON.parse(text)
        } catch {
          throw new Error(`plugin returned non-JSON (HTTP ${status}): ${text.slice(0, 200)}`)
        }
      }
      if (status < 200 || status >= 300) {
        const detail = body?.error
        const suffix = detail ? ` ${detail.code ?? ''}: ${detail.message ?? ''}`.trimEnd() : ''
        throw new Error(`plugin request failed (HTTP ${status})${suffix}`)
      }
      return body
    },
  }
}

/**
 * Call the handler the plugin registered, with the same request shape the
 * loopback Web server would provide. `sameOrigin` compares Origin's host to
 * the Host header, so both carry dsh.local and the write routes accept it.
 */
function makeCall(handler) {
  return async function call(method, url, body) {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
    request.url = url
    request.method = method
    request.headers = {
      host: 'dsh.local',
      origin: ORIGIN,
      'content-type': 'application/json',
    }
    const envelope = makeResponse()
    await handler(request, envelope.response)
    if (!envelope.response.writableEnded) throw new Error('plugin handler did not end the response')
    return envelope.result()
  }
}

async function loadPlugin(profileDir) {
  const packageName = process.env.DSH_SILLYTAVERN_PLUGIN_PKG || 'dsh-sillytavern-presets'
  const entry = path.join(profileDir, 'node_modules', packageName, 'lib', 'index.js')
  let info
  try {
    info = await stat(entry)
  } catch {
    throw new Error(`${packageName} is not installed under ${profileDir} (missing ${entry})`)
  }
  if (!info.isFile()) throw new Error(`${entry} is not a file`)

  const module = await import(pathToFileURL(entry).href)
  if (typeof module.apply !== 'function') throw new Error(`${entry} exports no apply() host entry`)

  let handler = null
  const ctx = {
    effect(fn) {
      const disposer = fn()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    systemPrompt: {
      section() {
        return () => {}
      },
    },
    on() {
      return () => {}
    },
    webServer: {
      register(route) {
        if (isPlainObject(route) && typeof route.handler === 'function') handler = route.handler
        return () => {}
      },
    },
    logger: {
      warn(error) {
        warn(error instanceof Error ? error.message : String(error))
      },
    },
    emit() {},
  }
  await module.apply(ctx)
  if (handler === null) throw new Error(`${entry} registered no webServer route`)
  return makeCall(handler)
}

function validatePreset(document, source) {
  if (!isPlainObject(document)) {
    throw new Error(`${source} is not a JSON object`)
  }
  const prompts = Array.isArray(document.prompts) ? document.prompts : []
  const order = Array.isArray(document.prompt_order) ? document.prompt_order : []
  if (prompts.length === 0 && order.length === 0) {
    throw new Error(`${source} has no prompts or prompt_order; it does not look like a SillyTavern AI preset`)
  }
  return document
}

function summarize(preset) {
  if (!preset) return 'preset selected'
  const active = preset.effectivePromptCount ?? preset.promptCount ?? '?'
  const total = preset.promptCount ?? '?'
  const parts = [`${active}/${total} prompts`]
  if (preset.temperature !== null && preset.temperature !== undefined) {
    parts.push(`temperature ${preset.temperature}`)
  }
  if (preset.maxTokens !== null && preset.maxTokens !== undefined) {
    parts.push(`maxTokens ${preset.maxTokens}`)
  }
  return `preset "${preset.name}" selected (${parts.join(', ')})`
}

async function main() {
  const [profileArg, presetArg] = process.argv.slice(2)
  if (!profileArg || !presetArg) {
    console.error('usage: node assets/dsh-sillytavern-import.mjs <profile-dir> <preset.json>')
    process.exit(2)
  }

  const profileDir = path.resolve(profileArg)
  const source = path.resolve(presetArg)
  if (!process.env.DSH_HOME || process.env.DSH_HOME.trim() === '') {
    // <home>/profiles/<profile> — the launcher exports DSH_HOME, but a direct
    // invocation should still land in the same store.
    process.env.DSH_HOME = path.resolve(profileDir, '..', '..')
  }

  const info = await stat(source).catch(() => null)
  if (info === null || !info.isFile()) throw new Error(`preset file not found: ${source}`)
  let document
  try {
    document = JSON.parse(await readFile(source, 'utf8'))
  } catch (error) {
    throw new Error(`cannot parse ${source}: ${error instanceof Error ? error.message : String(error)}`)
  }
  validatePreset(document, source)

  const call = await loadPlugin(profileDir)
  let state = await call('GET', `${PREFIX}/state`)
  if (!isPlainObject(state) || !Array.isArray(state.presets) || typeof state.dataFile !== 'string') {
    throw new Error('plugin state response has no presets/dataFile')
  }

  const fileName = path.basename(source)
  const digest = await sha256File(source)
  const markerFile = path.join(path.dirname(state.dataFile), 'launcher-import.json')
  const marker = await readMarker(markerFile)
  const markerPreset = marker?.presetId
    ? state.presets.find(preset => preset.id === marker.presetId)
    : null
  const sameSource = marker?.source === source
  const sameContent = sameSource && marker?.sha256 === digest

  async function select(preset) {
    if (state.activeId === preset.id && state.enabled !== false) return
    state = await call('POST', `${PREFIX}/presets/${encodeURIComponent(preset.id)}/select`, {})
  }

  async function remember(preset) {
    try {
      await writeMarker(markerFile, {
        source,
        sha256: digest,
        presetId: preset.id,
        importedAt: Date.now(),
      })
    } catch (error) {
      warn(`cannot write ${markerFile}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function current(preset) {
    const latest = Array.isArray(state.presets)
      ? state.presets.find(item => item.id === preset.id)
      : null
    console.log(`SillyTavern: ${summarize(latest ?? preset)}`)
    console.log(`SillyTavern: data ${state.dataFile}`)
  }

  // Unchanged: the marker's preset is still there and usable.
  if (!forceImport() && sameContent && markerPreset && !markerPreset.archived) {
    await select(markerPreset)
    await remember(markerPreset)
    current(markerPreset)
    return
  }

  // No marker, or its preset disappeared: adopt an existing import of the
  // same file instead of duplicating it. A changed hash keeps going to the
  // import branch so the new content actually replaces the old prompt layer.
  const adoptable = (!marker || sameContent)
    ? state.presets.find(preset => preset.sourceFileName === fileName && !preset.archived)
    : null
  if (!forceImport() && adoptable) {
    await select(adoptable)
    await remember(adoptable)
    current(adoptable)
    return
  }

  const imported = await call('POST', `${PREFIX}/import`, { json: document, fileName })
  const preset = imported?.preset
  if (!isPlainObject(preset) || typeof preset.id !== 'string') {
    throw new Error('plugin import response has no preset id')
  }

  // Record the new preset before selecting it. If the select fails, the next
  // launch sees the new hash/preset and selects it instead of importing yet
  // another copy of the same unchanged file.
  await remember(preset)

  state = await call('POST', `${PREFIX}/presets/${encodeURIComponent(preset.id)}/select`, {})

  // Archive only after the new preset is active, so a failed import leaves
  // the previous prompt layer in place. Never archive the preset just made.
  if (markerPreset && markerPreset.id !== preset.id && !markerPreset.archived) {
    try {
      await call('POST', `${PREFIX}/presets/${encodeURIComponent(markerPreset.id)}/archive`, {
        archived: true,
      })
      // The archive route answers { preset, state }, unlike select/state; take
      // the nested projection so the summary reads a top-level `presets` list.
      state = await call('GET', `${PREFIX}/state`)
    } catch (error) {
      warn(`could not archive the previous preset ${markerPreset.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  current(preset)
}

main().catch((error) => {
  fail(DEBUG ? (error instanceof Error ? (error.stack ?? error.message) : String(error)) : (error instanceof Error ? error.message : String(error)))
})
