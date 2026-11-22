import { describe, it, expect, vi } from 'vitest'
import {
  buildMergedPrompt,
  cancelAndPrepareMerge,
  MAX_CASCADE_LEVEL,
  CANCEL_MERGE_REASON,
} from '../cancel-and-merge.js'

type State = {
  activeRuns: Map<string, AbortController>
  lastPrompts: Map<string, string>
  cascadeLevel: Map<string, number>
}

function freshState(): State {
  return {
    activeRuns: new Map(),
    lastPrompts: new Map(),
    cascadeLevel: new Map(),
  }
}

function startFakeRun(
  state: State,
  chatId: string,
  prompt: string,
  cleanupAfterMs = 50
): AbortController {
  const controller = new AbortController()
  state.activeRuns.set(chatId, controller)
  state.lastPrompts.set(chatId, prompt)
  controller.signal.addEventListener('abort', () => {
    setTimeout(() => {
      state.activeRuns.delete(chatId)
      state.lastPrompts.delete(chatId)
    }, cleanupAfterMs)
  })
  return controller
}

describe('buildMergedPrompt', () => {
  it('combines old and new prompts with system hint', () => {
    const merged = buildMergedPrompt('сделай два визуала', 'добавь кеды')
    expect(merged).toContain('[Прежний запрос пользователя]:')
    expect(merged).toContain('сделай два визуала')
    expect(merged).toContain('[SYSTEM:')
    expect(merged).toContain('[Новое сообщение]:')
    expect(merged).toContain('добавь кеды')
    const oldIdx = merged.indexOf('сделай два визуала')
    const newIdx = merged.indexOf('добавь кеды')
    expect(oldIdx).toBeLessThan(newIdx)
  })
})

describe('cancelAndPrepareMerge', () => {
  it('T1: aborts active controller when run is in progress', async () => {
    const state = freshState()
    const ctl = startFakeRun(state, 'chat-1', 'старый')
    expect(ctl.signal.aborted).toBe(false)

    const result = await cancelAndPrepareMerge({
      chatId: 'chat-1',
      ...state,
      newPrompt: 'новый',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })

    expect(ctl.signal.aborted).toBe(true)
    expect(ctl.signal.reason).toBe(CANCEL_MERGE_REASON)
    expect(result.action).toBe('merge')
  })

  it('T2: produces correctly merged prompt from old and new', async () => {
    const state = freshState()
    startFakeRun(state, 'chat-2', 'старый запрос')

    const result = await cancelAndPrepareMerge({
      chatId: 'chat-2',
      ...state,
      newPrompt: 'новое сообщение',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })

    expect(result.action).toBe('merge')
    expect(result.mergedPrompt).toBeDefined()
    expect(result.mergedPrompt!).toContain('старый запрос')
    expect(result.mergedPrompt!).toContain('новое сообщение')
    expect(result.mergedPrompt!).toContain('[SYSTEM:')
  })

  it('T3: cascade level 1 → 2 → 3 → 4 reject', async () => {
    const state = freshState()

    // level 1
    startFakeRun(state, 'chat-3', 'p0')
    const r1 = await cancelAndPrepareMerge({
      chatId: 'chat-3',
      ...state,
      newPrompt: 'p1',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(r1.action).toBe('merge')
    expect(r1.cascadeLevel).toBe(1)

    // level 2
    startFakeRun(state, 'chat-3', r1.mergedPrompt!)
    const r2 = await cancelAndPrepareMerge({
      chatId: 'chat-3',
      ...state,
      newPrompt: 'p2',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(r2.action).toBe('merge')
    expect(r2.cascadeLevel).toBe(2)

    // level 3
    startFakeRun(state, 'chat-3', r2.mergedPrompt!)
    const r3 = await cancelAndPrepareMerge({
      chatId: 'chat-3',
      ...state,
      newPrompt: 'p3',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(r3.action).toBe('merge')
    expect(r3.cascadeLevel).toBe(3)
    expect(r3.cascadeLevel).toBe(MAX_CASCADE_LEVEL)

    // level 4 — must reject
    startFakeRun(state, 'chat-3', r3.mergedPrompt!)
    const r4 = await cancelAndPrepareMerge({
      chatId: 'chat-3',
      ...state,
      newPrompt: 'p4',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(r4.action).toBe('reject_cascade')
    expect(r4.cascadeLevel).toBe(MAX_CASCADE_LEVEL)
    // Existing run must NOT be aborted on cascade-reject
    expect(state.activeRuns.has('chat-3')).toBe(true)
  })

  it('T4: timeout force-clears state if cleanup never happens', async () => {
    const state = freshState()
    // Start a run whose cleanup will NEVER fire (cleanupAfterMs huge)
    startFakeRun(state, 'chat-4', 'застрял', 10_000)

    const sleepSpy = vi.fn(async (ms: number) => {
      // do nothing — fast path, but advance our perceived time
      await new Promise(r => setTimeout(r, 0))
    })

    const result = await cancelAndPrepareMerge({
      chatId: 'chat-4',
      ...state,
      newPrompt: 'новое',
      timeoutMs: 30,
      pollIntervalMs: 5,
      sleep: sleepSpy,
    })

    expect(result.action).toBe('timeout_force')
    expect(result.mergedPrompt).toContain('застрял')
    expect(result.mergedPrompt).toContain('новое')
    expect(state.activeRuns.has('chat-4')).toBe(false)
    expect(state.lastPrompts.has('chat-4')).toBe(false)
  })

  it('T5: no active run → no abort, merge action with newPrompt unchanged', async () => {
    const state = freshState()

    const result = await cancelAndPrepareMerge({
      chatId: 'chat-5',
      ...state,
      newPrompt: 'один запрос',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })

    expect(result.action).toBe('merge')
    expect(result.mergedPrompt).toBe('один запрос')
    expect(result.cascadeLevel).toBe(1)
  })

  it('T6: already-aborted controller is not aborted again', async () => {
    const state = freshState()
    const ctl = startFakeRun(state, 'chat-6', 'старый')
    ctl.abort()
    const spy = vi.spyOn(ctl, 'abort')

    await cancelAndPrepareMerge({
      chatId: 'chat-6',
      ...state,
      newPrompt: 'новый',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })

    expect(spy).not.toHaveBeenCalled()
  })

  it('T7: cascade level resets between distinct chats', async () => {
    const state = freshState()
    startFakeRun(state, 'chat-a', 'pa')
    const ra = await cancelAndPrepareMerge({
      chatId: 'chat-a',
      ...state,
      newPrompt: 'na',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(ra.cascadeLevel).toBe(1)

    startFakeRun(state, 'chat-b', 'pb')
    const rb = await cancelAndPrepareMerge({
      chatId: 'chat-b',
      ...state,
      newPrompt: 'nb',
      timeoutMs: 1000,
      pollIntervalMs: 5,
    })
    expect(rb.cascadeLevel).toBe(1)
  })
})
