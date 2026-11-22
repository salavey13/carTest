import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MessageBatcher } from '../message-batcher.js'

describe('MessageBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes single item after delay', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 1500, onFlush })

    batcher.add('chat-1', 'hello')
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1499)
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush).toHaveBeenCalledWith('chat-1', ['hello'])
  })

  it('joins items added within the debounce window', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 1500, onFlush })

    batcher.add('chat-1', 'first')
    vi.advanceTimersByTime(500)
    batcher.add('chat-1', 'second')
    vi.advanceTimersByTime(500)
    batcher.add('chat-1', 'third')

    // 1500ms тишина с момента последнего add
    vi.advanceTimersByTime(1499)
    expect(onFlush).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush).toHaveBeenCalledWith('chat-1', ['first', 'second', 'third'])
  })

  it('keeps order of insertion', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<number>({ delay: 100, onFlush })

    batcher.add('k', 1)
    batcher.add('k', 2)
    batcher.add('k', 3)
    batcher.add('k', 4)
    vi.advanceTimersByTime(100)

    expect(onFlush).toHaveBeenCalledWith('k', [1, 2, 3, 4])
  })

  it('uses independent timers for different keys', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 1000, onFlush })

    batcher.add('chat-A', 'a1')
    vi.advanceTimersByTime(700)
    batcher.add('chat-B', 'b1')
    vi.advanceTimersByTime(300) // chat-A flushes here (at 1000ms total)

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush).toHaveBeenCalledWith('chat-A', ['a1'])

    vi.advanceTimersByTime(700) // chat-B flushes here (700+300 from B start)
    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush).toHaveBeenLastCalledWith('chat-B', ['b1'])
  })

  it('flush() drains buffer immediately', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 5000, onFlush })

    batcher.add('k', 'x')
    batcher.add('k', 'y')
    batcher.flush('k')

    expect(onFlush).toHaveBeenCalledWith('k', ['x', 'y'])
    // Timer не сработает второй раз
    vi.advanceTimersByTime(10000)
    expect(onFlush).toHaveBeenCalledOnce()
  })

  it('clear() drops buffer without invoking onFlush', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 1000, onFlush })

    batcher.add('k', 'x')
    batcher.clear('k')
    vi.advanceTimersByTime(5000)

    expect(onFlush).not.toHaveBeenCalled()
    expect(batcher.has('k')).toBe(false)
  })

  it('has() and size() reflect buffer state', () => {
    const batcher = new MessageBatcher<string>({ delay: 1000, onFlush: () => {} })
    expect(batcher.has('k')).toBe(false)
    expect(batcher.size('k')).toBe(0)

    batcher.add('k', 'a')
    batcher.add('k', 'b')
    expect(batcher.has('k')).toBe(true)
    expect(batcher.size('k')).toBe(2)

    vi.advanceTimersByTime(1000)
    expect(batcher.has('k')).toBe(false)
    expect(batcher.size('k')).toBe(0)
  })

  it('flush() on missing key is a no-op', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 1000, onFlush })
    expect(() => batcher.flush('nonexistent')).not.toThrow()
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('add after flush starts a fresh buffer', () => {
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<string>({ delay: 100, onFlush })

    batcher.add('k', 'first')
    vi.advanceTimersByTime(100)
    expect(onFlush).toHaveBeenCalledWith('k', ['first'])

    batcher.add('k', 'second')
    vi.advanceTimersByTime(100)
    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush).toHaveBeenLastCalledWith('k', ['second'])
  })

  it('supports arbitrary payload type with structured data', () => {
    interface MediaPart {
      filePath: string
      caption?: string
    }
    const onFlush = vi.fn()
    const batcher = new MessageBatcher<MediaPart>({ delay: 500, onFlush })

    batcher.add('album-42', { filePath: '/tmp/1.jpg', caption: 'three pics' })
    batcher.add('album-42', { filePath: '/tmp/2.jpg' })
    batcher.add('album-42', { filePath: '/tmp/3.jpg' })
    vi.advanceTimersByTime(500)

    expect(onFlush).toHaveBeenCalledWith('album-42', [
      { filePath: '/tmp/1.jpg', caption: 'three pics' },
      { filePath: '/tmp/2.jpg' },
      { filePath: '/tmp/3.jpg' },
    ])
  })
})
