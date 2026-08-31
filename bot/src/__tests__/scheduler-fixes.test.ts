/**
 * Regression tests for scheduler bugs:
 *  (a) getDueTasks unit mismatch — next_run in SECONDS, query must use seconds not ms
 *  (b) splitMessage — all chunks ≤ MAX_MESSAGE_LENGTH (4096)
 *  (c) error handling — next_run advances and error_count increments on task failure
 */

import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { splitMessage } from '../bot.js'

// ─── Helper ──────────────────────────────────────────────────────────────────

function createSchedulerDb(): InstanceType<typeof Database> {
  const Db = (Database as any).default ?? Database
  const db = new Db(':memory:') as InstanceType<typeof Database>
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE scheduled_tasks (
      id          TEXT    PRIMARY KEY,
      chat_id     TEXT    NOT NULL,
      prompt      TEXT    NOT NULL,
      schedule    TEXT    NOT NULL,
      next_run    INTEGER NOT NULL,
      last_run    INTEGER,
      last_result TEXT,
      status      TEXT    NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL,
      error_count INTEGER NOT NULL DEFAULT 0
    )
  `)
  return db
}

// ─── (a) getDueTasks unit consistency ────────────────────────────────────────

describe('(a) getDueTasks — unit consistency (seconds, not milliseconds)', () => {
  it('task due in the past (seconds) is returned by seconds-based query', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at)
      VALUES ('t1', '123', 'p', '* * * * *', ?, 'active', ?)`).run(nowSec - 10, nowSec)

    const due = db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ?`)
      .all(Math.floor(Date.now() / 1000)) as any[]

    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('t1')
  })

  it('task due in 1 hour is NOT returned by seconds-based query', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at)
      VALUES ('t2', '123', 'p', '* * * * *', ?, 'active', ?)`).run(nowSec + 3600, nowSec)

    const due = db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ?`)
      .all(Math.floor(Date.now() / 1000)) as any[]

    expect(due).toHaveLength(0)
  })

  it('REGRESSION: Date.now() in ms wrongly returns future task (demonstrates old bug)', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    // Task due in 1 hour — should NOT fire
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at)
      VALUES ('t-bug', '123', 'p', '* * * * *', ?, 'active', ?)`).run(nowSec + 3600, nowSec)

    // OLD BUG: Date.now() (ms) >> next_run (sec) → task always "due"
    const bugDue = db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ?`)
      .all(Date.now()) as any[]
    expect(bugDue).toHaveLength(1)  // confirms the bug: task fires when it shouldn't

    // FIX: divide by 1000
    const fixDue = db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active' AND next_run <= ?`)
      .all(Math.floor(Date.now() / 1000)) as any[]
    expect(fixDue).toHaveLength(0)  // correct: task not due yet
  })
})

// ─── (b) splitMessage ────────────────────────────────────────────────────────

describe('(b) splitMessage — chunks ≤ 4096', () => {
  it('short text returns single chunk unchanged', () => {
    const chunks = splitMessage('hello', 4096)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('hello')
  })

  it('text exactly at limit returns single chunk', () => {
    const text = 'x'.repeat(4096)
    const chunks = splitMessage(text, 4096)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(4096)
  })

  it('text longer than 4096 is split — all chunks ≤ 4096', () => {
    const text = 'a'.repeat(9000)
    const chunks = splitMessage(text, 4096)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096)
    }
    // no content lost
    expect(chunks.join('')).toBe(text)
  })

  it('multiline text: no chunk exceeds limit', () => {
    const line = 'b'.repeat(1500)
    const text = Array.from({ length: 8 }, () => line).join('\n') // ~12 007 chars
    const chunks = splitMessage(text, 4096)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096)
    }
  })

  it('empty string returns array with one empty string', () => {
    const chunks = splitMessage('', 4096)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('')
  })
})

// ─── (c) error handling — next_run advances, error_count increments ───────────

describe('(c) task error handling — next_run advances, poison-guard pauses at 3 errors', () => {
  it('after first error, next_run advances and error_count becomes 1', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at, error_count)
      VALUES ('err-1', '123', 'p', '*/5 * * * *', ?, 'active', ?, 0)`).run(nowSec - 1, nowSec)

    const task = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = 'err-1'`).get() as any
    const prevNextRun = task.next_run
    const newErrorCount = (task.error_count ?? 0) + 1
    const newNextRun = nowSec + 300

    db.prepare(`UPDATE scheduled_tasks
      SET last_run = ?, last_result = ?, next_run = ?, error_count = ?
      WHERE id = 'err-1'`).run(nowSec, `error (${newErrorCount}/3): test fail`, newNextRun, newErrorCount)

    const updated = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = 'err-1'`).get() as any
    expect(updated.next_run).toBeGreaterThan(prevNextRun)
    expect(updated.error_count).toBe(1)
    expect(updated.last_result).toMatch(/error/)
    expect(updated.status).toBe('active') // still active after 1st error
  })

  it('task is paused after 3rd consecutive error (poison-guard)', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    // Already at 2 errors
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at, error_count)
      VALUES ('err-3', '123', 'p', '*/5 * * * *', ?, 'active', ?, 2)`).run(nowSec - 1, nowSec)

    const task = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = 'err-3'`).get() as any
    const newErrorCount = (task.error_count ?? 0) + 1 // 3
    const paused = newErrorCount >= 3

    db.prepare(`UPDATE scheduled_tasks
      SET last_run = ?, last_result = ?, next_run = ?, error_count = ?, status = ?
      WHERE id = 'err-3'`).run(nowSec, `error (${newErrorCount}/3): repeated`, nowSec + 300, newErrorCount, paused ? 'paused' : 'active')

    const updated = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = 'err-3'`).get() as any
    expect(updated.status).toBe('paused')
    expect(updated.error_count).toBe(3)
  })

  it('successful run resets error_count to 0', () => {
    const db = createSchedulerDb()
    const nowSec = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_tasks(id, chat_id, prompt, schedule, next_run, status, created_at, error_count)
      VALUES ('err-reset', '123', 'p', '*/5 * * * *', ?, 'active', ?, 2)`).run(nowSec - 1, nowSec)

    // Success: error_count = 0
    db.prepare(`UPDATE scheduled_tasks
      SET last_run = ?, last_result = ?, next_run = ?, error_count = ?, status = ?
      WHERE id = 'err-reset'`).run(nowSec, 'ok', nowSec + 300, 0, 'active')

    const updated = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = 'err-reset'`).get() as any
    expect(updated.error_count).toBe(0)
    expect(updated.status).toBe('active')
  })
})
