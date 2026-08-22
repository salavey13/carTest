#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const baseUrl = (process.env.MAP_RIDERS_QA_BASE_URL || 'https://v0-car-test.vercel.app').replace(/\/$/, '')
const slug = process.env.MAP_RIDERS_QA_SLUG || 'vip-bike'

const slugQuery = `?slug=${encodeURIComponent(slug)}`

const checks = [
  { name: 'map-page', path: `/franchize/${slug}/map-riders` },
  { name: 'api-overview', path: `/api/map-riders/overview${slugQuery}`, expectsJsonSuccess: true },
  { name: 'api-leaderboard', path: `/api/map-riders/leaderboard${slugQuery}`, expectsJsonSuccess: true },
  { name: 'api-health', path: `/api/map-riders/health${slugQuery}`, expectsJsonSuccess: true },
  { name: 'api-legacy', path: `/api/map-riders${slugQuery}`, expectsJsonSuccess: true },
]

const failures = []

for (const check of checks) {
  const url = `${baseUrl}${check.path}`
  try {
    const response = execFileSync('curl', ['-sS', '-L', '-w', '\n%{http_code}', url], {
      encoding: 'utf-8',
    })
    const splitAt = response.lastIndexOf('\n')
    const body = splitAt >= 0 ? response.slice(0, splitAt) : ''
    const statusCode = Number(splitAt >= 0 ? response.slice(splitAt + 1).trim() : response.trim())

    if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode > 299) {
      failures.push(`${check.name}: HTTP ${statusCode}`)
      console.error(`❌ ${check.name.padEnd(14)} ${url} -> ${statusCode}`)
      continue
    }

    if (check.expectsJsonSuccess) {
      const json = JSON.parse(body)
      if (json?.success !== true) {
        failures.push(`${check.name}: JSON success was not true`)
        console.error(`❌ ${check.name.padEnd(14)} ${url} -> JSON success=false`)
        continue
      }
    }

    console.log(`✅ ${check.name.padEnd(14)} ${url} -> ${statusCode}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${check.name}: ${message}`)
    console.error(`❌ ${check.name.padEnd(14)} ${url} -> ${message}`)
  }
}

if (failures.length > 0) {
  console.error('\nMapRiders QA smoke failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('\nMapRiders QA smoke passed.')
