import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

// Integration specs (tests/prepayments.spec.ts, tests/evening-summary-
// prepayment.spec.ts) create a real Supabase client at module scope and need
// the Supabase env that Next.js loads automatically but vitest does not.
// Load ONLY those keys from .env.local — the example-derived file contains
// placeholders for other services that must not leak into env-branching
// unit tests. Process env always wins (no override).
const envFile = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  const wanted = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && wanted.includes(m[1]) && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
}

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: ['tests/franchize/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
