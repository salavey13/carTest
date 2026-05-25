// /types/telegram.d.ts
// ─────────────────────────────────────────────────────
// All Telegram types are now in telegram.ts.
// This file exists for backward compatibility — any
// file that imported from '@/types/telegram' will
// resolve to telegram.ts automatically (TypeScript
// prefers .ts over .d.ts when both exist).
//
// The `declare global` Window augmentation in telegram.ts
// takes effect when that module is imported anywhere
// (e.g., useTelegramAuth.ts imports from here).
// ─────────────────────────────────────────────────────

export * from './telegram'
