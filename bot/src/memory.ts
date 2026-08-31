import { getDb } from './db.js'

const SEMANTIC_PATTERN = /\b(my|i am|i'm|i prefer|remember|always|never|меня|я|зовут|помни|запомни|всегда|никогда)\b/i

export async function buildMemoryContext(chatId: string, userMessage: string): Promise<string> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  const sanitized = userMessage.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, ' ').trim()
  const words = sanitized.split(/\s+/).filter(Boolean)
  const ftsResults: Array<{ id: number; content: string; sector: string }> = []

  if (words.length > 0) {
    const ftsQuery = words.map(w => w + '*').join(' OR ')
    try {
      const rows = db.prepare(
        `SELECT m.id, m.content, m.sector
         FROM memories_fts f
         JOIN memories m ON m.id = f.rowid
         WHERE memories_fts MATCH ? AND m.chat_id = ?
         LIMIT 3`
      ).all(ftsQuery, chatId) as Array<{ id: number; content: string; sector: string }>
      ftsResults.push(...rows)
    } catch {
      // FTS table may not exist yet — TODO: ensure db.ts creates memories_fts
    }
  }

  const recentRows = db.prepare(
    `SELECT id, content, sector FROM memories WHERE chat_id = ? ORDER BY accessed_at DESC LIMIT 5`
  ).all(chatId) as Array<{ id: number; content: string; sector: string }>

  const seen = new Map<number, { content: string; sector: string }>()
  for (const row of [...ftsResults, ...recentRows]) {
    if (!seen.has(row.id)) seen.set(row.id, { content: row.content, sector: row.sector })
  }

  if (seen.size === 0) return ''

  const updateStmt = db.prepare(
    `UPDATE memories SET accessed_at = ?, salience = MIN(salience + 0.1, 5.0) WHERE id = ?`
  )
  for (const id of seen.keys()) {
    updateStmt.run(now, id)
  }

  const lines = Array.from(seen.values()).map(r => `- ${r.content} (${r.sector})`)
  return '[Memory context]\n' + lines.join('\n')
}

export async function saveConversationTurn(chatId: string, userMsg: string, assistantMsg: string): Promise<void> {
  if (userMsg.length <= 20 || userMsg.startsWith('/')) return

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const sector = SEMANTIC_PATTERN.test(userMsg) ? 'semantic' : 'episodic'

  db.prepare(
    `INSERT INTO memories (chat_id, content, sector, salience, created_at, accessed_at)
     VALUES (?, ?, ?, 1.0, ?, ?)`
  ).run(chatId, userMsg, sector, now, now)

  if (assistantMsg.length > 20) {
    db.prepare(
      `INSERT INTO memories (chat_id, content, sector, salience, created_at, accessed_at)
       VALUES (?, ?, 'episodic', 1.0, ?, ?)`
    ).run(chatId, assistantMsg, now, now)
  }
}

export function runDecaySweep(): void {
  const db = getDb()
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400
  db.prepare(`UPDATE memories SET salience = salience * 0.98 WHERE created_at < ?`).run(oneDayAgo)
  db.prepare(`DELETE FROM memories WHERE salience < 0.1`).run()
}
