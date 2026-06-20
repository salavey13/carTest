'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, Bell, Bike, ShoppingBag, Wallet, CheckCircle2, Circle, Plus, Trash2, AlertTriangle, Clock, Zap } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────

interface DashboardData {
  ok: boolean
  date: string
  dateDisplay: string
  isToday: boolean
  summary: {
    rentalsCount: number
    salesCount: number
    rentalsRevenue: number
    salesRevenue: number
    depositsHeld: number
    totalToday: number
  }
  rentals: RentalRow[]
  sales: SaleRow[]
  reminders: ReminderRow[]
  weekChart: WeekBucket[]
}

interface RentalRow {
  rentalId: string
  bikeId: string
  bikeMake: string
  bikeModel: string
  renterName: string
  totalCost: number
  deposit: number
  dailyPrice: number
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
}

interface SaleRow {
  contractKey: string
  bikeId: string
  buyerName: string
  salePrice: number
  warrantyMonths: string
  createdAt: string
}

interface ReminderRow {
  rentalId: string
  bikeId: string
  renterName: string
  bikeLabel: string
  endDate: string | null
  hoursLeft: number
  severity: 'overdue' | 'today' | 'soon' | 'upcoming'
  label: string
}

interface WeekBucket {
  date: string
  label: string
  rentals: number
  sales: number
  total: number
}

interface Todo {
  id: string
  date: string
  text: string
  done: boolean
  source: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))
const fmtRub = (n: number) => `${fmt(n)} ₽`

function todayStr() {
  // Moscow day
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateInput(iso: string): string {
  // YYYY-MM-DD → DD.MM.YYYY for display
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min}м назад`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}ч назад`
  return `${Math.floor(hr / 24)}д назад`
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#121520] text-[#7D828C] font-mono flex items-center justify-center">Загрузка...</div>}>
      <HomeInner />
    </Suspense>
  )
}

function HomeInner() {
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') || todayStr()
  const [date, setDate] = useState<string>(initialDate)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Todos state
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [showOpenTodos, setShowOpenTodos] = useState(true)

  const fetchData = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard?date=${d}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'failed')
      setData(json)
      setLastRefresh(new Date())
    } catch (e: any) {
      setError(e.message || 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTodos = useCallback(async (d: string) => {
    try {
      const res = await fetch(`/api/todos?date=${d}&include_open=${showOpenTodos ? '1' : '0'}`)
      const json = await res.json()
      if (json.ok) setTodos(json.todos)
    } catch (e) {
      console.error('todos fetch failed', e)
    }
  }, [showOpenTodos])

  useEffect(() => {
    fetchData(date)
  }, [date, fetchData])

  useEffect(() => {
    fetchTodos(date)
  }, [date, fetchTodos])

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => fetchData(date), 60000)
    return () => clearInterval(t)
  }, [date, fetchData])

  // ── Todo handlers ──
  const addTodo = async () => {
    const text = newTodo.trim()
    if (!text) return
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, text, source: 'manual' }),
      })
      const json = await res.json()
      if (json.ok) {
        setNewTodo('')
        fetchTodos(date)
      }
    } catch (e) { console.error(e) }
  }

  const toggleTodo = async (id: string, done: boolean) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t))
    try {
      await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done: !done }),
      })
    } catch (e) { console.error(e) }
  }

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    try {
      await fetch(`/api/todos?id=${id}`, { method: 'DELETE' })
    } catch (e) { console.error(e) }
  }

  const refresh = () => fetchData(date)

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#121520] text-[#E6D8C4] font-mono">
      <style>{`
        body { background: #121520; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1B2132; }
        ::-webkit-scrollbar-thumb { background: #313648; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #4A4F60; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4BD55] flex items-center gap-2">
              <Zap className="w-7 h-7" strokeWidth={2.5} />
              VIP BIKE DASHBOARD
            </h1>
            <p className="text-xs text-[#7D828C] mt-1">
              Обновлено: {lastRefresh.toLocaleTimeString('ru-RU')}
              {data?.isToday && <span className="ml-2 text-[#F4BD55]">● сегодня</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="p-2 hover:bg-[#2A2E3E] rounded-md transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-[#1B2132] border border-[#313648] rounded-md px-3 py-2">
              <Calendar className="w-4 h-4 text-[#F4BD55]" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-transparent text-[#E6D8C4] outline-none [color-scheme:dark]"
              />
              <span className="text-xs text-[#7D828C]">{formatDateInput(date)}</span>
            </div>
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              className="p-2 hover:bg-[#2A2E3E] rounded-md transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDate(todayStr())}
              className="px-3 py-2 text-xs bg-[#2A2E3E] hover:bg-[#313648] rounded-md transition-colors"
            >
              Сегодня
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 hover:bg-[#2A2E3E] rounded-md transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-[#3B1818] border border-[#5C2424] text-[#E35B5B] p-4 rounded-md mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Ошибка загрузки: {error}</span>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-20 text-[#7D828C]">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            Загрузка данных за {formatDateInput(date)}...
          </div>
        ) : data ? (
          <main className="space-y-6">
            {/* ── Big total ── */}
            <section className="bg-gradient-to-br from-[#3B2F0E] via-[#1B2132] to-[#121520] border border-[#5C4A1A]/50 rounded-xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="text-xs text-[#F4BD55] uppercase tracking-widest mb-2">Итого за {data.dateDisplay}</div>
                  <div className="text-5xl sm:text-6xl font-bold text-[#F4BD55] tabular-nums">
                    {fmtRub(data.summary.totalToday)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-[#1B2132]/50 rounded-lg p-3 border border-[#313648]">
                    <div className="text-[#7D828C] text-xs mb-1">Аренды</div>
                    <div className="text-[#E6D8C4] font-bold tabular-nums">{fmtRub(data.summary.rentalsRevenue)}</div>
                    <div className="text-[#7D828C] text-xs mt-1">{data.summary.rentalsCount} шт.</div>
                  </div>
                  <div className="bg-[#1B2132]/50 rounded-lg p-3 border border-[#313648]">
                    <div className="text-[#7D828C] text-xs mb-1">Продажи</div>
                    <div className="text-[#F4BD55] font-bold tabular-nums">{fmtRub(data.summary.salesRevenue)}</div>
                    <div className="text-[#7D828C] text-xs mt-1">{data.summary.salesCount} шт.</div>
                  </div>
                  <div className="col-span-2 bg-[#1B2132]/50 rounded-lg p-3 border border-[#313648]">
                    <div className="text-[#7D828C] text-xs mb-1">Депозиты на руках</div>
                    <div className="text-[#FFCA60] font-bold tabular-nums">{fmtRub(data.summary.depositsHeld)}</div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Reminders ── */}
            <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-[#F4BD55]">
                  <Bell className="w-5 h-5" />
                  Напоминалки
                </h2>
                <span className="text-xs text-[#7D828C]">{data.reminders.length} активных аренд</span>
              </div>

              {data.reminders.length === 0 ? (
                <div className="text-[#7D828C] text-sm py-4 text-center">Активных аренд нет — все чисто ✓</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {data.reminders.map(r => (
                    <div
                      key={r.rentalId}
                      className={`flex items-center justify-between p-3 rounded-md border ${
                        r.severity === 'overdue'
                          ? 'bg-[#3B1818]/40 border-[#5C2424]'
                          : r.severity === 'today'
                          ? 'bg-[#3B2F0E]/40 border-[#5C4A1A]'
                          : r.severity === 'soon'
                          ? 'bg-[#3B2F0E]/30 border-[#5C4A1A]/50'
                          : 'bg-[#2A2E3E]/30 border-[#2A2E3E]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {r.severity === 'overdue' ? (
                          <AlertTriangle className="w-4 h-4 text-[#E35B5B] flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-[#F4BD55] flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {r.bikeLabel} — {r.renterName}
                          </div>
                          <div className="text-xs text-[#7D828C]">
                            {r.endDate ? new Date(r.endDate).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold tabular-nums px-2 py-1 rounded ${
                        r.severity === 'overdue'
                          ? 'bg-[#5C2424]/60 text-[#E35B5B]'
                          : r.severity === 'today'
                          ? 'bg-[#5C4A1A]/60 text-[#FFCA60]'
                          : r.severity === 'soon'
                          ? 'bg-[#3B2F0E]/40 text-[#F4BD55]'
                          : 'bg-[#313648] text-[#A7ABB4]'
                      }`}>
                        {r.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Two-column: rentals + sales ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rentals */}
              <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#F4BD55]">
                  <Bike className="w-5 h-5" />
                  Аренды за день
                  <span className="text-xs text-[#7D828C] ml-auto">{data.rentals.length}</span>
                </h2>
                {data.rentals.length === 0 ? (
                  <div className="text-[#7D828C] text-sm py-4 text-center">Нет аренд за этот день</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {data.rentals.map(r => (
                      <div key={r.rentalId} className="bg-[#2A2E3E]/30 border border-[#2A2E3E] rounded-md p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">
                              {r.bikeMake} {r.bikeModel}
                            </div>
                            <div className="text-xs text-[#A7ABB4] truncate">{r.renterName}</div>
                            <div className="text-xs text-[#7D828C] mt-1">
                              {r.startDate ? new Date(r.startDate).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                              {' → '}
                              {r.endDate ? new Date(r.endDate).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-[#F4BD55] tabular-nums">{fmtRub(r.totalCost)}</div>
                            {r.deposit > 0 && (
                              <div className="text-xs text-[#FFCA60]/80">+деп {fmt(r.deposit)}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2A2E3E]/50 text-xs">
                          <span className="text-[#7D828C]">{timeAgo(r.createdAt)}</span>
                          <span className={`px-2 py-0.5 rounded ${
                            r.status === 'active' || r.status === 'ongoing' || r.status === 'confirmed'
                              ? 'bg-[#3B2F0E]/40 text-[#FFCA60]'
                              : r.status === 'pending' || r.status === 'pending_confirmation'
                              ? 'bg-[#3B2F0E]/40 text-[#FFCA60]'
                              : 'bg-[#313648] text-[#A7ABB4]'
                          }`}>{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Sales */}
              <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#F4BD55]">
                  <ShoppingBag className="w-5 h-5" />
                  Продажи за день
                  <span className="text-xs text-[#7D828C] ml-auto">{data.sales.length}</span>
                </h2>
                {data.sales.length === 0 ? (
                  <div className="text-[#7D828C] text-sm py-4 text-center">Нет продаж за этот день</div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {data.sales.map(s => (
                      <div key={s.contractKey} className="bg-[#2A2E3E]/30 border border-[#2A2E3E] rounded-md p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm truncate">{s.bikeId}</div>
                            <div className="text-xs text-[#A7ABB4] truncate">{s.buyerName}</div>
                            <div className="text-xs text-[#7D828C] mt-1">Гарантия: {s.warrantyMonths} мес.</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-[#F4BD55] tabular-nums">{fmtRub(s.salePrice)}</div>
                          </div>
                        </div>
                        <div className="text-xs text-[#7D828C] mt-2 pt-2 border-t border-[#2A2E3E]/50">
                          {timeAgo(s.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ── Week chart ── */}
            <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#F4BD55]">
                <Wallet className="w-5 h-5" />
                Выручка за неделю
              </h2>
              <WeekChart buckets={data.weekChart} />
            </section>

            {/* ── Two-column: todos + checklist ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Todos */}
              <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-[#F4BD55]">
                    <CheckCircle2 className="w-5 h-5" />
                    Дневник оператора
                  </h2>
                  <label className="flex items-center gap-2 text-xs text-[#7D828C] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOpenTodos}
                      onChange={e => setShowOpenTodos(e.target.checked)}
                      className="accent-[#F4BD55]"
                    />
                    + открытые
                  </label>
                </div>

                {/* Add new todo */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
                    placeholder="Новое TODO за этот день..."
                    className="flex-1 bg-[#2A2E3E] border border-[#2A2E3E] rounded-md px-3 py-2 text-sm outline-none focus:border-[#F4BD55]"
                  />
                  <button
                    onClick={addTodo}
                    className="px-3 py-2 bg-[#D4A540] hover:bg-[#FFCA60] text-white rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {todos.length === 0 ? (
                  <div className="text-[#7D828C] text-sm py-4 text-center">Список пуст</div>
                ) : (
                  <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
                    {todos.map(t => (
                      <div key={t.id} className="flex items-start gap-2 p-2 hover:bg-[#2A2E3E]/50 rounded group">
                        <button onClick={() => toggleTodo(t.id, t.done)} className="mt-0.5 flex-shrink-0">
                          {t.done ? (
                            <CheckCircle2 className="w-4 h-4 text-[#F4BD55]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#7D828C] hover:text-[#A7ABB4]" />
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${t.done ? 'line-through text-[#7D828C]' : 'text-[#E6D8C4]'}`}>
                          {t.text}
                        </span>
                        {t.source === 'telegram-bot' && (
                          <span className="text-xs text-[#F4BD55]/60 px-1">TG</span>
                        )}
                        {t.date !== date && (
                          <span className="text-xs text-[#7D828C] px-1">{formatDateInput(t.date)}</span>
                        )}
                        <button
                          onClick={() => deleteTodo(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-[#7D828C] hover:text-[#E35B5B] transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Checklist */}
              <ChecklistSection date={date} />
            </div>
          </main>
        ) : null}

        <footer className="mt-12 pt-6 border-t border-[#313648] text-center text-xs text-[#7D828C]">
          VIP Bike Dashboard · сделано на ZAI · данные из Supabase ({data?.date || date})
        </footer>
      </div>
    </div>
  )
}

// ─── Week chart component ──────────────────────────────────────────────────

function WeekChart({ buckets }: { buckets: WeekBucket[] }) {
  const max = Math.max(1, ...buckets.map(b => b.total))
  const today = todayStr()

  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-4 h-48 mb-3">
        {buckets.map(b => {
          const h = (b.total / max) * 100
          const isToday = b.date === today
          return (
            <div key={b.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-xs text-[#7D828C] tabular-nums opacity-0 group-hover:opacity-100 transition">
                {b.total > 0 ? fmt(b.total) : ''}
              </div>
              <div className="w-full flex-1 flex flex-col justify-end relative">
                {/* Sales portion (amber, top) */}
                {b.sales > 0 && (
                  <div
                    className="w-full bg-[#D4A540]/80 hover:bg-[#F4BD55] transition-colors rounded-t"
                    style={{ height: `${(b.sales / max) * 100}%` }}
                    title={`Продажи: ${fmtRub(b.sales)}`}
                  />
                )}
                {/* Rentals portion (emerald, bottom) */}
                {b.rentals > 0 && (
                  <div
                    className={`w-full bg-[#F4BD55]/80 hover:bg-[#FFCA60] transition-colors ${b.sales === 0 ? 'rounded-t' : ''}`}
                    style={{ height: `${(b.rentals / max) * 100}%` }}
                    title={`Аренды: ${fmtRub(b.rentals)}`}
                  />
                )}
                {b.total === 0 && (
                  <div className="w-full h-1 bg-[#2A2E3E] rounded-t" />
                )}
                {isToday && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#F4BD55] rounded-full" />
                )}
              </div>
              <div className={`text-xs ${isToday ? 'text-[#F4BD55] font-bold' : 'text-[#7D828C]'}`}>
                {b.label}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-4 text-xs text-[#7D828C]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#F4BD55]/80 rounded-sm" />
          <span>Аренды</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#D4A540]/80 rounded-sm" />
          <span>Продажи</span>
        </div>
      </div>
    </div>
  )
}

// ─── Checklist section ─────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  rentalKey: string
  scope: string
  label: string
  checked: boolean
}

function ChecklistSection({ date }: { date: string }) {
  const [scope, setScope] = useState<'handover' | 'return'>('handover')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(false)

  // Use date as rentalKey for the daily checklist (so each day has its own)
  const rentalKey = `day-${date}`

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/checklists?rentalKey=${rentalKey}&scope=${scope}`)
      const json = await res.json()
      if (json.ok) setItems(json.items)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [rentalKey, scope])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const toggle = async (id: string, checked: boolean) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i))
    try {
      await fetch('/api/checklists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, checked: !checked }),
      })
    } catch (e) { console.error(e) }
  }

  const done = items.filter(i => i.checked).length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <section className="bg-[#1B2132] border border-[#313648] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[#F4BD55]">
          <CheckCircle2 className="w-5 h-5" />
          Чек-лист
        </h2>
        <div className="flex gap-1 bg-[#2A2E3E] rounded-md p-0.5">
          <button
            onClick={() => setScope('handover')}
            className={`px-3 py-1 text-xs rounded transition ${scope === 'handover' ? 'bg-[#D4A540] text-white' : 'text-[#A7ABB4]'}`}
          >
            Выдача
          </button>
          <button
            onClick={() => setScope('return')}
            className={`px-3 py-1 text-xs rounded transition ${scope === 'return' ? 'bg-[#D4A540] text-white' : 'text-[#A7ABB4]'}`}
          >
            Возврат
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#7D828C] mb-1">
          <span>{done} из {total}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-[#2A2E3E] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#D4A540] to-[#F4BD55] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-[#7D828C] text-sm py-4 text-center">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="text-[#7D828C] text-sm py-4 text-center">Чек-лист пуст</div>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
          {items.map(i => (
            <button
              key={i.id}
              onClick={() => toggle(i.id, i.checked)}
              className="flex items-start gap-2 p-2 w-full text-left hover:bg-[#2A2E3E]/50 rounded transition"
            >
              {i.checked ? (
                <CheckCircle2 className="w-4 h-4 text-[#F4BD55] flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-[#7D828C] flex-shrink-0 mt-0.5" />
              )}
              <span className={`text-sm ${i.checked ? 'line-through text-[#7D828C]' : 'text-[#E6D8C4]'}`}>
                {i.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
