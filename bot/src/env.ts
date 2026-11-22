import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export function readEnvFile(keys?: string[]): Record<string, string> {
  const envPath = path.join(PROJECT_ROOT, '.env')
  let raw: string
  try {
    raw = readFileSync(envPath, 'utf8')
  } catch {
    return {}
  }

  const result: Record<string, string> = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    result[key] = value
    // Propagate to process.env so subprocess (claude CLI) inherits arbitrary keys
    // like KIE_API_KEY, ELEVENLABS_API_KEY without explicit re-exporting in config.ts
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  if (keys) {
    const filtered: Record<string, string> = {}
    for (const k of keys) {
      if (k in result) filtered[k] = result[k]
    }
    return filtered
  }

  return result
}

/**
 * Write or update a single key in the .env file.
 * If the key already exists, its line is replaced in-place.
 * If not, a new line is appended.
 * Also updates process.env immediately so the current process sees the new value.
 */
export function writeEnvKey(key: string, value: string): void {
  const envPath = path.join(PROJECT_ROOT, '.env')
  let raw = ''
  try {
    raw = readFileSync(envPath, 'utf8')
  } catch {
    // .env may not exist yet — start empty
  }

  const lines = raw.split('\n')
  const idx = lines.findIndex((l) => {
    const eq = l.indexOf('=')
    return eq !== -1 && l.slice(0, eq).trim() === key
  })

  const newLine = `${key}=${value}`
  if (idx !== -1) {
    lines[idx] = newLine
  } else {
    if (raw.length && !raw.endsWith('\n')) lines.push('')
    lines.push(newLine)
  }

  writeFileSync(envPath, lines.join('\n'), 'utf8')
  process.env[key] = value
}
