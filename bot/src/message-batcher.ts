// Generic timer-based message batcher.
// Используется в bot.ts для двух задач:
//   1) Сбор частей Telegram media_group_id (album) в один запрос.
//   2) Debounce для append-while-thinking — собираем подряд идущие сообщения
//      пока юзер дописывает, обрабатываем когда тишина N мс.
//
// Контракт: `add(key, item)` добавляет item в буфер по ключу и сбрасывает
// таймер. Когда таймер истекает (delay мс тишины) — вызывается onFlush
// с массивом всех накопленных items.

export interface BatcherOptions<T> {
  /** Delay in ms before flushing after the last `add` for this key. */
  delay: number
  /** Called when the timer fires. Items in insertion order. */
  onFlush: (key: string, items: T[]) => void | Promise<void>
}

interface Entry<T> {
  timer: ReturnType<typeof setTimeout>
  items: T[]
}

export class MessageBatcher<T> {
  private buffers = new Map<string, Entry<T>>()

  constructor(private readonly opts: BatcherOptions<T>) {}

  /** Add an item to the batch for `key`. Resets the flush timer. */
  add(key: string, item: T): void {
    const existing = this.buffers.get(key)
    if (existing) {
      clearTimeout(existing.timer)
      existing.items.push(item)
      existing.timer = this.scheduleFlush(key)
      return
    }
    const entry: Entry<T> = {
      items: [item],
      timer: this.scheduleFlush(key),
    }
    this.buffers.set(key, entry)
  }

  /** Force immediate flush for `key`. No-op if no buffer. */
  flush(key: string): void {
    const entry = this.buffers.get(key)
    if (!entry) return
    clearTimeout(entry.timer)
    this.buffers.delete(key)
    void this.opts.onFlush(key, entry.items)
  }

  /** Drop buffer for `key` without invoking onFlush. */
  clear(key: string): void {
    const entry = this.buffers.get(key)
    if (!entry) return
    clearTimeout(entry.timer)
    this.buffers.delete(key)
  }

  /** True if buffer for `key` exists. Useful for "ещё собираю" UX. */
  has(key: string): boolean {
    return this.buffers.has(key)
  }

  /** Count items currently buffered for `key`. */
  size(key: string): number {
    return this.buffers.get(key)?.items.length ?? 0
  }

  private scheduleFlush(key: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      const entry = this.buffers.get(key)
      if (!entry) return
      this.buffers.delete(key)
      void this.opts.onFlush(key, entry.items)
    }, this.opts.delay)
  }
}
