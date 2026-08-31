/**
 * modules/digest/store.ts
 * Дедуп-стор для утреннего дайджеста: помнит уже показанные новости/события,
 * чтобы в следующих дайджестах отдавать ТОЛЬКО новое.
 * Хранилище — JSON (новости публичные, не ПДн): workspace/store/digest-seen.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STORE_PATH = path.resolve(process.env.DIGEST_SEEN_PATH ?? 'workspace/store/digest-seen.json');
const RETENTION_DAYS = 30; // дольше не помним — события устаревают

export interface SeenItem {
  id: string;
  title: string;
  firstSeen: string; // ISO
}

export interface Candidate {
  title: string;
  [k: string]: unknown;
}

/** Стабильный id по заголовку (регистр/пробелы нормализованы). */
export function normId(title: string): string {
  const norm = title.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

function load(): SeenItem[] {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as SeenItem[];
  } catch {
    return [];
  }
}

function save(items: SeenItem[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

/**
 * Оставить только НОВЫЕ кандидаты (которых ещё не было) и (по умолчанию)
 * записать их как показанные. Старые записи (>RETENTION_DAYS) подчищаются.
 */
export function filterNew(candidates: Candidate[], opts?: { record?: boolean }): Candidate[] {
  const seen = load();
  const seenIds = new Set(seen.map((s) => s.id));
  const fresh: Candidate[] = [];
  const freshIds = new Set<string>();
  for (const c of candidates) {
    const id = normId(String(c.title ?? ''));
    if (!id || seenIds.has(id) || freshIds.has(id)) continue; // дубль (вчерашний или внутри пачки)
    freshIds.add(id);
    fresh.push(c);
  }
  if (opts?.record !== false && fresh.length) {
    const now = new Date().toISOString();
    for (const c of fresh) seen.push({ id: normId(String(c.title)), title: String(c.title), firstSeen: now });
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    save(seen.filter((s) => new Date(s.firstSeen).getTime() >= cutoff));
  }
  return fresh;
}

export function listSeen(): SeenItem[] {
  return load();
}

export function resetSeen(): void {
  save([]);
}
