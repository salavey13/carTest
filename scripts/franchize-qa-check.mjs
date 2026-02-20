#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const baseUrl = (process.env.FRANCHIZE_QA_BASE_URL || 'https://v0-car-test.vercel.app').replace(/\/$/, '')
const slug = process.env.FRANCHIZE_QA_SLUG || 'vip-bike'

const checks = [
  { name: 'catalog', path: `/franchize/${slug}` },
  { name: 'about', path: `/franchize/${slug}/about` },
  { name: 'contacts', path: `/franchize/${slug}/contacts` },
  { name: 'cart', path: `/franchize/${slug}/cart` },
  { name: 'order', path: `/franchize/${slug}/order/demo-order` },
]

const failures = []

for (const check of checks) {
  const url = `${baseUrl}${check.path}`
  try {
    const statusCode = Number(
      execFileSync('curl', ['-sS', '-L', '-o', '/dev/null', '-w', '%{http_code}', url], {
        encoding: 'utf-8',
      }).trim(),
    )

    if (!Number.isFinite(statusCode) || statusCode < 200 || statusCode > 299) {
      failures.push(`${check.name}: HTTP ${statusCode}`)
      console.error(`❌ ${check.name.padEnd(8)} ${url} -> ${statusCode}`)
      continue
    }

    console.log(`✅ ${check.name.padEnd(8)} ${url} -> ${statusCode}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${check.name}: ${message}`)
    console.error(`❌ ${check.name.padEnd(8)} ${url} -> ${message}`)
  }
}

if (failures.length > 0) {
  console.error('\nFranchize QA smoke failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('\nFranchize QA smoke passed.')
