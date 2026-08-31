import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { STORE_DIR } from './config.js'

// CommonJS compat: better-sqlite3 default export varies by bundler/ESM interop
const BetterSqlite3 = (Database as any).default ?? Database

const dbPath = path.join(STORE_DIR, 'claudeclaw.db')
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })

const db = new BetterSqlite3(dbPath) as InstanceType<typeof Database>
db.pragma('journal_mode = WAL')

// Expose raw db for memory.ts which builds its own queries
export function getDb(): InstanceType<typeof Database> {
  return db
}

// ─── Schema ─────────────────────────────────────────────────────────────────

/**
 * Идемпотентная миграция composio_* таблиц: старые алиасы (gdrive, calendar)
 * → полные слаги (googledrive, googlecalendar) + расширение CHECK до 6 сервисов.
 * Запускается до db.exec(CREATE TABLE IF NOT EXISTS ...) — потому что IF NOT EXISTS
 * не пересоздаёт существующую таблицу со старой схемой.
 */
function migrateComposioSchema(): void {
  const tableSchema = (name: string): string | null => {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(name) as { sql: string } | undefined
    return row?.sql ?? null
  }

  const needsMigration = (sql: string | null): boolean => {
    if (!sql) return false
    return /'gdrive'|'calendar'/.test(sql) && !/'googledrive'/.test(sql)
  }

  const connSql = tableSchema('composio_connections')
  if (needsMigration(connSql)) {
    db.exec(`
      BEGIN;
      ALTER TABLE composio_connections RENAME TO composio_connections_old;
      CREATE TABLE composio_connections (
        chat_id      INTEGER NOT NULL,
        service      TEXT    NOT NULL CHECK(service IN ('notion','googledrive','googlecalendar','gmail','googlesheets','googledocs')),
        connected_at INTEGER NOT NULL,
        PRIMARY KEY (chat_id, service)
      );
      INSERT INTO composio_connections(chat_id, service, connected_at)
      SELECT chat_id,
        CASE service
          WHEN 'gdrive'   THEN 'googledrive'
          WHEN 'calendar' THEN 'googlecalendar'
          ELSE service
        END,
        connected_at
      FROM composio_connections_old
      WHERE CASE service
              WHEN 'gdrive'   THEN 'googledrive'
              WHEN 'calendar' THEN 'googlecalendar'
              ELSE service
            END IN ('notion','googledrive','googlecalendar','gmail','googlesheets','googledocs');
      DROP TABLE composio_connections_old;
      COMMIT;
    `)
  }

  if (tableSchema('composio_pending')) {
    db.exec(`
      UPDATE composio_pending SET service = 'googledrive'    WHERE service = 'gdrive';
      UPDATE composio_pending SET service = 'googlecalendar' WHERE service = 'calendar';
    `)
  }
}

export function initDatabase(): void {
  migrateComposioSchema()

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id    TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id     TEXT    NOT NULL,
      topic_key   TEXT,
      content     TEXT    NOT NULL,
      sector      TEXT    NOT NULL CHECK(sector IN ('semantic','episodic')),
      salience    REAL    NOT NULL DEFAULT 1.0,
      created_at  INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content='memories',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS memories_fts_insert
    AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_update
    AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_fts_delete
    AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES ('delete', old.id, old.content);
    END;

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id          TEXT    PRIMARY KEY,
      chat_id     TEXT    NOT NULL,
      prompt      TEXT    NOT NULL,
      schedule    TEXT    NOT NULL,
      next_run    INTEGER NOT NULL,
      last_run    INTEGER,
      last_result TEXT,
      status      TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
      created_at  INTEGER NOT NULL,
      error_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status_next
      ON scheduled_tasks(status, next_run);

    CREATE TABLE IF NOT EXISTS chat_settings (
      chat_id    TEXT PRIMARY KEY,
      model      TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS onboarding_state (
      chat_id      INTEGER PRIMARY KEY,
      current_step INTEGER NOT NULL DEFAULT 1,
      answers      TEXT    NOT NULL DEFAULT '{}',
      updated_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS composio_connections (
      chat_id      INTEGER NOT NULL,
      service      TEXT    NOT NULL CHECK(service IN ('notion','googledrive','googlecalendar','gmail','googlesheets','googledocs')),
      connected_at INTEGER NOT NULL,
      PRIMARY KEY (chat_id, service)
    );

    CREATE TABLE IF NOT EXISTS composio_pending (
      chat_id       INTEGER NOT NULL,
      service       TEXT    NOT NULL,
      connection_id TEXT    NOT NULL,
      started_at    INTEGER NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','TIMEOUT','FAILED')),
      PRIMARY KEY (chat_id, service)
    );

    CREATE TABLE IF NOT EXISTS escalations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id      INTEGER NOT NULL,
      user_message TEXT    NOT NULL,
      payload_json TEXT    NOT NULL,
      status       TEXT    NOT NULL CHECK(status IN ('pending','accepted','escalated','answered','ignored')),
      created_at   INTEGER NOT NULL,
      resolved_at  INTEGER
    );
  `)

  // Миграция: добавить error_count к существующим боевым БД (идемпотентно)
  try {
    db.exec(`ALTER TABLE scheduled_tasks ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // column already exists — no-op
  }
}

// ─── Chat Settings ───────────────────────────────────────────────────────────

export function getChatModel(chatId: string): string | null {
  const row = db.prepare('SELECT model FROM chat_settings WHERE chat_id = ?').get(chatId) as { model: string | null } | undefined
  return row?.model ?? null
}

export function setChatModel(chatId: string, model: string): void {
  db.prepare(`
    INSERT INTO chat_settings(chat_id, model, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET model = excluded.model, updated_at = excluded.updated_at
  `).run(chatId, model, Date.now())
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// Returns object shape so callers can do row?.session_id
export function getSession(chatId: string): { session_id: string } | null {
  return db.prepare('SELECT session_id FROM sessions WHERE chat_id = ?').get(chatId) as { session_id: string } | null
}

export function setSession(chatId: string, sessionId: string): void {
  db.prepare(`
    INSERT INTO sessions(chat_id, session_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at
  `).run(chatId, sessionId, Date.now())
}

export function clearSession(chatId: string): void {
  db.prepare('DELETE FROM sessions WHERE chat_id = ?').run(chatId)
}

// ─── Memory CRUD ─────────────────────────────────────────────────────────────

export type Memory = {
  id: number
  chat_id: string
  topic_key: string | null
  content: string
  sector: 'semantic' | 'episodic'
  salience: number
  created_at: number
  accessed_at: number
}

export function insertMemory(
  chatId: string,
  content: string,
  sector: 'semantic' | 'episodic',
  topicKey?: string,
  salience = 1.0,
): void {
  const now = Date.now()
  db.prepare(`
    INSERT INTO memories(chat_id, topic_key, content, sector, salience, created_at, accessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, topicKey ?? null, content, sector, salience, now, now)
}

export function searchMemoriesFTS(query: string, limit = 3): Memory[] {
  // Sanitize: keep only alphanumeric (incl cyrillic) + spaces, append * for prefix match
  const safe = query.replace(/[^a-zA-Zа-яёА-ЯЁ0-9 ]/g, ' ').trim()
  if (!safe) return []
  const ftsQuery = safe.split(/\s+/).filter(Boolean).map(t => `${t}*`).join(' ')
  return db.prepare(`
    SELECT m.*
    FROM memories m
    JOIN memories_fts fts ON fts.rowid = m.id
    WHERE memories_fts MATCH ?
    ORDER BY fts.rank
    LIMIT ?
  `).all(ftsQuery, limit) as Memory[]
}

export function getRecentMemories(chatId: string, limit = 5): Memory[] {
  return db.prepare(`
    SELECT * FROM memories
    WHERE chat_id = ?
    ORDER BY accessed_at DESC
    LIMIT ?
  `).all(chatId, limit) as Memory[]
}

export function touchMemory(id: number): void {
  db.prepare(`
    UPDATE memories
    SET accessed_at = ?, salience = MIN(salience + 0.1, 5.0)
    WHERE id = ?
  `).run(Date.now(), id)
}

export function decayMemories(): void {
  const cutoff = Date.now() - 86_400_000
  db.prepare('UPDATE memories SET salience = salience * 0.98 WHERE created_at < ?').run(cutoff)
  db.prepare('DELETE FROM memories WHERE salience < 0.1').run()
}

// ─── Scheduled Tasks ─────────────────────────────────────────────────────────

export type ScheduledTask = {
  id: string
  chat_id: string
  prompt: string
  schedule: string
  next_run: number
  last_run: number | null
  last_result: string | null
  status: 'active' | 'paused'
  created_at: number
  error_count: number
}

// status defaults to 'active' and error_count to 0, so callers can omit them
export function createTask(task: Omit<ScheduledTask, 'last_run' | 'last_result' | 'created_at' | 'status' | 'error_count'> & { status?: 'active' | 'paused' }): void {
  db.prepare(`
    INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.chat_id, task.prompt, task.schedule, task.next_run, task.status ?? 'active', Date.now())
}

export function listTasks(chatId?: string): ScheduledTask[] {
  if (chatId) {
    return db.prepare('SELECT * FROM scheduled_tasks WHERE chat_id = ? ORDER BY created_at DESC').all(chatId) as ScheduledTask[]
  }
  return db.prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC').all() as ScheduledTask[]
}

export function getDueTasks(): ScheduledTask[] {
  return db.prepare(`
    SELECT * FROM scheduled_tasks
    WHERE status = 'active' AND next_run <= ?
  `).all(Math.floor(Date.now() / 1000)) as ScheduledTask[]
}

// Accepts structured update object (as scheduler.ts passes it).
// Optional: error_count (defaults to 0 on success), status (to pause on poison-guard).
export function updateTaskAfterRun(
  id: string,
  update: { next_run: number; last_run: number; last_result: string; error_count?: number; status?: 'active' | 'paused' },
): void {
  if (update.status !== undefined) {
    db.prepare(`
      UPDATE scheduled_tasks
      SET last_run = ?, last_result = ?, next_run = ?, error_count = ?, status = ?
      WHERE id = ?
    `).run(update.last_run, update.last_result, update.next_run, update.error_count ?? 0, update.status, id)
  } else {
    db.prepare(`
      UPDATE scheduled_tasks
      SET last_run = ?, last_result = ?, next_run = ?, error_count = ?
      WHERE id = ?
    `).run(update.last_run, update.last_result, update.next_run, update.error_count ?? 0, id)
  }
}

export function pauseTask(id: string): void {
  db.prepare("UPDATE scheduled_tasks SET status = 'paused' WHERE id = ?").run(id)
}

// Accepts optional computeNextRun callback so schedule-cli.ts can pass it
export function resumeTask(id: string, computeNextRun?: (schedule: string) => number): number {
  const task = db.prepare('SELECT schedule, next_run FROM scheduled_tasks WHERE id = ?').get(id) as { schedule: string; next_run: number } | undefined
  const nextRun = computeNextRun && task ? computeNextRun(task.schedule) : (task?.next_run ?? Math.floor(Date.now() / 1000))
  db.prepare("UPDATE scheduled_tasks SET status = 'active', next_run = ? WHERE id = ?").run(nextRun, id)
  return nextRun
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id)
}

// ─── Onboarding State ────────────────────────────────────────────────────────

export type OnboardingRow = {
  chat_id: number
  current_step: number
  answers: string
  updated_at: number
}

export function getOnboardingRow(chatId: number): OnboardingRow | null {
  return db.prepare('SELECT * FROM onboarding_state WHERE chat_id = ?').get(chatId) as OnboardingRow | null
}

export function upsertOnboardingRow(chatId: number, step: number, answers: string): void {
  db.prepare(`
    INSERT INTO onboarding_state(chat_id, current_step, answers, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      current_step = excluded.current_step,
      answers      = excluded.answers,
      updated_at   = excluded.updated_at
  `).run(chatId, step, answers, Date.now())
}

export function deleteOnboardingRow(chatId: number): void {
  db.prepare('DELETE FROM onboarding_state WHERE chat_id = ?').run(chatId)
}

// ─── Composio Connections ─────────────────────────────────────────────────────

export function markComposioConnected(chatId: number, service: string): void {
  db.prepare(`
    INSERT INTO composio_connections(chat_id, service, connected_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id, service) DO UPDATE SET connected_at = excluded.connected_at
  `).run(chatId, service, Date.now())
}

export function isComposioConnected(chatId: number, service: string): boolean {
  const row = db.prepare(
    'SELECT 1 FROM composio_connections WHERE chat_id = ? AND service = ?',
  ).get(chatId, service)
  return row !== undefined
}

export function getComposioConnectedServices(chatId: number): string[] {
  const rows = db.prepare(
    'SELECT service FROM composio_connections WHERE chat_id = ? ORDER BY connected_at ASC',
  ).all(chatId) as { service: string }[]
  return rows.map(r => r.service)
}

/** Удалить запись о подключении (если live API подтвердил что отозвано). */
export function forgetComposioConnection(chatId: number, service: string): void {
  db.prepare(
    'DELETE FROM composio_connections WHERE chat_id = ? AND service = ?',
  ).run(chatId, service)
}

// ─── Composio Pending (OAuth poll) ───────────────────────────────────────────

export type ComposioPendingRow = {
  chat_id: number
  service: string
  connection_id: string
  started_at: number
  status: 'PENDING' | 'ACTIVE' | 'TIMEOUT' | 'FAILED'
}

export function markComposioPending(chatId: number, service: string, connectionId: string): void {
  db.prepare(`
    INSERT INTO composio_pending(chat_id, service, connection_id, started_at, status)
    VALUES (?, ?, ?, ?, 'PENDING')
    ON CONFLICT(chat_id, service) DO UPDATE SET
      connection_id = excluded.connection_id,
      started_at    = excluded.started_at,
      status        = 'PENDING'
  `).run(chatId, service, connectionId, Date.now())
}

export function getComposioPending(chatId: number, service: string): ComposioPendingRow | null {
  return (db.prepare(
    'SELECT * FROM composio_pending WHERE chat_id = ? AND service = ?',
  ).get(chatId, service) as ComposioPendingRow | undefined) ?? null
}

export function updateComposioPendingStatus(
  chatId: number,
  service: string,
  status: ComposioPendingRow['status'],
): void {
  db.prepare(
    'UPDATE composio_pending SET status = ? WHERE chat_id = ? AND service = ?',
  ).run(status, chatId, service)
}

export function removeComposioPending(chatId: number, service: string): void {
  db.prepare(
    'DELETE FROM composio_pending WHERE chat_id = ? AND service = ?',
  ).run(chatId, service)
}

// ─── Escalations ─────────────────────────────────────────────────────────────

export type EscalationStatus = 'pending' | 'accepted' | 'escalated' | 'answered' | 'ignored'

export type EscalationRow = {
  id: number
  chat_id: number
  user_message: string
  payload_json: string
  status: EscalationStatus
  created_at: number
  resolved_at: number | null
}

export function insertEscalation(data: {
  chat_id: number
  user_message: string
  payload_json: string
  status: EscalationStatus
}): number {
  const result = db.prepare(`
    INSERT INTO escalations(chat_id, user_message, payload_json, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.chat_id, data.user_message, data.payload_json, data.status, Date.now())
  return Number(result.lastInsertRowid)
}

export function updateEscalationStatus(id: number, status: EscalationStatus): void {
  const resolvedAt = status === 'pending' ? null : Date.now()
  db.prepare(`
    UPDATE escalations
    SET status = ?, resolved_at = ?
    WHERE id = ?
  `).run(status, resolvedAt, id)
}

export function getPendingEscalations(): EscalationRow[] {
  return db.prepare(`
    SELECT * FROM escalations WHERE status = 'pending' ORDER BY created_at ASC
  `).all() as EscalationRow[]
}

export function getEscalation(id: number): EscalationRow | null {
  return (
    (db.prepare('SELECT * FROM escalations WHERE id = ?').get(id) as EscalationRow | undefined) ??
    null
  )
}
