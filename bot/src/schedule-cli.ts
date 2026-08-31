import cronParser from 'cron-parser'
const { parseExpression } = (cronParser as any).default ?? cronParser

import { initDatabase, listTasks, createTask, deleteTask, pauseTask, resumeTask } from './db.js'
import { computeNextRun } from './scheduler.js'

initDatabase()

const [cmd, ...args] = process.argv.slice(2)

function formatDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString()
}

function validateCron(expr: string): void {
  try {
    parseExpression(expr)
  } catch (err: any) {
    console.error(`Invalid cron: ${err.message}`)
    process.exit(1)
  }
}

switch (cmd) {
  case 'create': {
    const [prompt, schedule, chatId] = args
    if (!prompt || !schedule || !chatId) {
      console.error('Usage: schedule-cli create "<prompt>" "<cron>" <chat_id>')
      process.exit(1)
    }
    validateCron(schedule)
    const id = crypto.randomUUID()
    const nextRun = computeNextRun(schedule)
    createTask({ id, chat_id: chatId, prompt, schedule, next_run: nextRun })
    console.log(`Task created: ${id}`)
    console.log(`Next run: ${formatDate(nextRun)}`)
    break
  }

  case 'list': {
    const tasks = listTasks()
    if (tasks.length === 0) {
      console.log('No scheduled tasks.')
      break
    }
    console.log(
      'ID'.padEnd(38) +
      'Status'.padEnd(10) +
      'Schedule'.padEnd(18) +
      'Next Run'.padEnd(25) +
      'Prompt'
    )
    console.log('-'.repeat(110))
    for (const t of tasks) {
      console.log(
        t.id.padEnd(38) +
        t.status.padEnd(10) +
        t.schedule.padEnd(18) +
        formatDate(t.next_run).padEnd(25) +
        t.prompt.slice(0, 50)
      )
    }
    break
  }

  case 'delete': {
    const [id] = args
    if (!id) {
      console.error('Usage: schedule-cli delete <id>')
      process.exit(1)
    }
    deleteTask(id)
    console.log(`Task ${id} deleted.`)
    break
  }

  case 'pause': {
    const [id] = args
    if (!id) {
      console.error('Usage: schedule-cli pause <id>')
      process.exit(1)
    }
    pauseTask(id)
    console.log(`Task ${id} paused.`)
    break
  }

  case 'resume': {
    const [id] = args
    if (!id) {
      console.error('Usage: schedule-cli resume <id>')
      process.exit(1)
    }
    const nextRun = resumeTask(id, computeNextRun)
    console.log(`Task ${id} resumed. Next run: ${formatDate(nextRun)}`)
    break
  }

  default: {
    console.error('Unknown command. Available: create, list, delete, pause, resume')
    process.exit(1)
  }
}
