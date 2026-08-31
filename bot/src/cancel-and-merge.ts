// Cancel-and-merge: if a new message arrives while runAgent is active,
// abort the current run, wait for cleanup, and merge old+new prompts
// for a fresh launch in the same session.
//
// See PLAN-2026-05-16-cancel-and-merge.md for the architecture rationale.

export const MAX_CASCADE_LEVEL = 3
export const DEFAULT_CANCEL_TIMEOUT_MS = 5000
export const DEFAULT_POLL_INTERVAL_MS = 100

// AbortSignal.reason marker — позволяет финализирующему handleMessage отличить
// cancel-and-merge от пользовательской [⛔ Стоп] и не дублировать "Остановлено" reply.
export const CANCEL_MERGE_REASON = 'cancel-merge'

export function buildMergedPrompt(oldPrompt: string, newPrompt: string): string {
  return (
    `[Прежний запрос пользователя]:\n${oldPrompt}\n\n` +
    `[SYSTEM: пользователь добавил уточнение/новые материалы пока шла обработка, продолжай с учётом обоих]\n\n` +
    `[Новое сообщение]:\n${newPrompt}`
  )
}

export type CancelMergeAction = 'merge' | 'reject_cascade' | 'timeout_force'

export interface CancelMergeResult {
  action: CancelMergeAction
  mergedPrompt?: string
  cascadeLevel: number
}

export interface CancelMergeOpts {
  chatId: string
  activeRuns: Map<string, AbortController>
  lastPrompts: Map<string, string>
  cascadeLevel: Map<string, number>
  newPrompt: string
  timeoutMs?: number
  pollIntervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

export async function cancelAndPrepareMerge(
  opts: CancelMergeOpts
): Promise<CancelMergeResult> {
  const { chatId, activeRuns, lastPrompts, cascadeLevel, newPrompt } = opts
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CANCEL_TIMEOUT_MS
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const sleep = opts.sleep ?? defaultSleep

  const currentLevel = cascadeLevel.get(chatId) ?? 0
  const nextLevel = currentLevel + 1

  if (nextLevel > MAX_CASCADE_LEVEL) {
    return { action: 'reject_cascade', cascadeLevel: currentLevel }
  }

  const controller = activeRuns.get(chatId)
  const oldPrompt = lastPrompts.get(chatId) ?? ''
  const mergedPrompt = oldPrompt
    ? buildMergedPrompt(oldPrompt, newPrompt)
    : newPrompt

  if (controller && !controller.signal.aborted) {
    controller.abort(CANCEL_MERGE_REASON)
  }

  const deadline = Date.now() + timeoutMs
  while (activeRuns.has(chatId) && Date.now() < deadline) {
    await sleep(pollMs)
  }

  cascadeLevel.set(chatId, nextLevel)

  if (activeRuns.has(chatId)) {
    activeRuns.delete(chatId)
    lastPrompts.delete(chatId)
    return { action: 'timeout_force', mergedPrompt, cascadeLevel: nextLevel }
  }

  return { action: 'merge', mergedPrompt, cascadeLevel: nextLevel }
}
