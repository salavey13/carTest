import cronParser from 'cron-parser'
const { parseExpression } = (cronParser as any).default ?? cronParser

import { getDueTasks, updateTaskAfterRun } from './db.js'
import { runAgent } from './agent.js'
import { logger } from './logger.js'

type Sender = (chatId: string, text: string) => Promise<void>

let sender: Sender | null = null

// Сколько подряд ошибок до авто-паузы задачи (poison-guard)
const MAX_TASK_ERRORS = 3

// Guard от наложения запусков: setInterval не ждёт завершения async-tick'а,
// а runAgent занимает 30-60с. Без флага параллельные tick'и дублируют отправку.
let isRunning = false

export function initScheduler(send: Sender): void {
  sender = send
  setInterval(() => {
    void runDueTasks()
  }, 60_000)
  logger.info('Scheduler initialized — polling every 60s')
}

export async function runDueTasks(): Promise<void> {
  if (isRunning) {
    logger.debug('runDueTasks: предыдущий проход ещё идёт, пропускаем tick')
    return
  }
  isRunning = true
  try {
    const now = Math.floor(Date.now() / 1000)
    const tasks = getDueTasks()

    for (const task of tasks) {
      // chat_id может содержать запятые (legacy bug) — берём первый валидный
      const chatId = String(task.chat_id || '').split(',')[0].trim()
      if (!chatId || chatId === 'unknown' || !/^-?\d+$/.test(chatId)) {
        logger.warn({ taskId: task.id, raw: task.chat_id }, 'Напоминание пропущено: невалидный chat_id')
        const nextRun = computeNextRun(task.schedule)
        updateTaskAfterRun(task.id, { next_run: nextRun, last_run: now, last_result: 'skipped: invalid chat_id', error_count: 0 })
        continue
      }

      try {
        const result = await runAgent(task.prompt, undefined, undefined)
        const text = (result.text ?? '').trim()

        if (!text) {
          logger.warn({ taskId: task.id }, 'Напоминание: пустой ответ модели, пропускаем отправку')
        } else if (sender) {
          await sender(chatId, text)
        }

        // Успех → next_run вперёд, error_count сброшен
        const nextRun = computeNextRun(task.schedule)
        updateTaskAfterRun(task.id, {
          next_run: nextRun,
          last_run: now,
          last_result: text.slice(0, 500) || 'empty',
          error_count: 0,
        })

        logger.info({ taskId: task.id, nextRun }, 'Напоминание выполнено')
      } catch (err) {
        // Упавшая задача: двигаем next_run на следующий слот (иначе долбит каждый poll),
        // инкрементим error_count, после MAX_TASK_ERRORS подряд — пауза (poison-guard).
        const msg = err instanceof Error ? err.message : String(err)
        const errorCount = (task.error_count ?? 0) + 1
        const paused = errorCount >= MAX_TASK_ERRORS
        let nextRun = task.next_run
        try {
          nextRun = computeNextRun(task.schedule)
        } catch (cronErr) {
          // битый cron — не валим весь проход, оставляем next_run как был, но пауза
          logger.error({ taskId: task.id, cronErr }, 'Напоминание: битый cron, ставлю на паузу')
        }
        updateTaskAfterRun(task.id, {
          next_run: nextRun,
          last_run: now,
          last_result: `error (${errorCount}/${MAX_TASK_ERRORS}): ${msg.slice(0, 400)}`,
          error_count: errorCount,
          status: paused ? 'paused' : 'active',
        })
        logger.error({ taskId: task.id, err, errorCount, paused }, 'Напоминание упало')
      }
    }
  } finally {
    isRunning = false
  }
}

export function computeNextRun(cronExpression: string): number {
  return Math.floor(parseExpression(cronExpression).next().getTime() / 1000)
}
