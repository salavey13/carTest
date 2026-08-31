import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './logger.js'
import { initDatabase } from './db.js'
import { runDecaySweep } from './memory.js'
import { cleanupOldUploads } from './media.js'
import { run } from '@grammyjs/runner'
import { createBot, splitMessage, formatForTelegram } from './bot.js'
import { startErrorWatcher } from './error-watcher.js'
import { initScheduler } from './scheduler.js'
import { TELEGRAM_BOT_TOKEN, STORE_DIR } from './config.js'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

function showBanner(): void {
  const bannerPath = path.join(_dirname, '..', 'banner.txt')
  try {
    const banner = fs.readFileSync(bannerPath, 'utf8')
    console.log(banner)
  } catch {
    console.log('ClaudeClaw v1.0')
    console.log('================')
  }
}

function acquireLock(): void {
  const pidFile = path.join(STORE_DIR, 'claudeclaw.pid')
  if (fs.existsSync(pidFile)) {
    const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10)
    if (!isNaN(oldPid)) {
      try {
        process.kill(oldPid, 0) // throws if dead
        logger.warn({ oldPid }, 'Killing previous instance')
        process.kill(oldPid, 'SIGTERM')
      } catch {
        // dead — overwrite silently
      }
    }
  }
  fs.writeFileSync(pidFile, String(process.pid))
}

function releaseLock(): void {
  const pidFile = path.join(STORE_DIR, 'claudeclaw.pid')
  try {
    fs.unlinkSync(pidFile)
  } catch {
    // already gone
  }
}

async function main(): Promise<void> {
  showBanner()

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set. Add it to .env and try again.')
    process.exit(1)
  }

  fs.mkdirSync(STORE_DIR, { recursive: true })
  acquireLock()

  initDatabase()

  runDecaySweep()
  setInterval(runDecaySweep, 24 * 60 * 60 * 1000)

  cleanupOldUploads()
  // 152-ФЗ: брошенные ПДн в uploads/ (фото, staged-*.json от prep без finalize) не должны
  // лежать до следующего рестарта — чистим периодически, не только на старте.
  setInterval(cleanupOldUploads, 60 * 60 * 1000)

  const bot = createBot()

  // Авто-диагностика: hook на logger.error/fatal, DM владельцу с rate-limit
  startErrorWatcher(bot.api)

  initScheduler(async (chatId, text) => {
    // Нарезка ≤4096 + HTML-форматирование, как в обычном пути bot.ts (sendMessage без нарезки роняет длинные напоминания)
    const chunks = splitMessage(formatForTelegram(text))
    for (const chunk of chunks) {
      await bot.api.sendMessage(chatId, chunk, { parse_mode: 'HTML' })
        .catch(() => bot.api.sendMessage(chatId, chunk))
    }
  })

  // grammY runner — обрабатывает апдейты конкурентно. Иначе пока крутится runAgent
  // (30-60с), бот не забирает следующие апдейты из Telegram → кнопка "Стоп" не дойдёт.
  const handle = run(bot)

  const shutdown = async () => {
    logger.info('Shutting down')
    await handle.stop()
    releaseLock()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  logger.info('ClaudeClaw running')
  await handle.task()
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error')
  process.exit(1)
})
