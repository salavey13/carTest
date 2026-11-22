import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { Bot, InputFile, InlineKeyboard } from 'grammy'
import { logger } from './logger.js'
import { downloadMedia, buildPhotoMessage, buildDocumentMessage, buildMediaMessage } from './media.js'
import { transcribeAudio } from './voice.js'
import { buildMemoryContext, saveConversationTurn } from './memory.js'
import { runAgent, type ProgressEvent } from './agent.js'
import { MessageBatcher } from './message-batcher.js'
import { cancelAndPrepareMerge, MAX_CASCADE_LEVEL, CANCEL_MERGE_REASON } from './cancel-and-merge.js'
import { writeEnvKey } from './env.js'

const SHOW_PROGRESS = (process.env.SHOW_PROGRESS ?? 'true').toLowerCase() !== 'false'
const PROGRESS_THROTTLE_MS = 1200
const PROGRESS_MAX_LINES = 15
const PROGRESS_DELETE_AFTER = (process.env.PROGRESS_DELETE_AFTER ?? 'true').toLowerCase() !== 'false'
import { getSession, setSession, clearSession, getRecentMemories, getChatModel, setChatModel } from './db.js'
import {
  PROJECT_ROOT,
  TELEGRAM_BOT_TOKEN,
  ALLOWED_CHAT_ID,
  MAX_MESSAGE_LENGTH,
  TYPING_REFRESH_MS,
  ANTHROPIC_MODEL,
  MODELS,
  findModel,
  NOTES_DIR_NAME,
  PRECOMPACT_INPUT_TOKENS,
} from './config.js'
import {
  handleConnectCommand,
  getConnectionsStatus,
  pollOAuthCompletion,
  isValidService,
  isConnected,
  DEFAULT_TOOLKITS,
  type ComposioService,
} from './composio.js'
import { isEscalationTrigger, handleEscalation } from './escalation.js'

const ACTIVE_CONTEXT_PATH = path.join(PROJECT_ROOT, 'workspace', 'active-context.md')

// Runtime-mutable allowed chat id. Starts from config value.
// On first /start it is set to the registering user and persisted to .env.
let runtimeAllowedChatId = ALLOWED_CHAT_ID
/** Exposed for tests only — resets runtime state between test cases. */
export function _setRuntimeAllowedChatId(v: string): void {
  runtimeAllowedChatId = v
}

// Карта активных runAgent по chat_id. Используется для:
//  - кнопки [⛔ Стоп] под progress-сообщением (callback_query → abort)
//  - cancel-and-merge: новое сообщение пока run активен → abort + merge + relaunch
const activeRuns = new Map<string, AbortController>()
// Последний prompt активного run — нужен для склейки при cancel-and-merge
const lastPrompts = new Map<string, string>()
// Глубина каскада cancel-and-merge (макс MAX_CASCADE_LEVEL подряд)
const cascadeLevel = new Map<string, number>()

// Telegram-альбом приходит как несколько отдельных update'ов с одним media_group_id.
// Без batcher'а бот видел только первое сообщение (с caption) и игнорировал остальные.
// textBatcher решает append-while-thinking — юзер пишет вдогонку, склеиваем в один запрос.
const MEDIA_GROUP_DEBOUNCE_MS = 1500
const TEXT_DEBOUNCE_MS = 1500

interface BatchedPart {
  content: string
  ctx: any
}

const mediaGroupBatcher = new MessageBatcher<BatchedPart>({
  delay: MEDIA_GROUP_DEBOUNCE_MS,
  onFlush: async (key, parts) => {
    if (!parts.length) return
    const ctx = parts[parts.length - 1]!.ctx
    const combined = parts.map((p) => p.content).join('\n\n')
    try {
      await handleMessage(ctx, combined)
    } catch (err) {
      logger.error({ err, key }, 'media-group flush failed')
    }
  },
})

const textBatcher = new MessageBatcher<BatchedPart>({
  delay: TEXT_DEBOUNCE_MS,
  onFlush: async (key, parts) => {
    if (!parts.length) return
    const ctx = parts[parts.length - 1]!.ctx
    const combined = parts.map((p) => p.content).join('\n')
    try {
      await handleMessage(ctx, combined)
    } catch (err) {
      logger.error({ err, key }, 'text-debounce flush failed')
    }
  },
})

function withForwardMeta(ctx: any, content: string): string {
  const f = ctx.message?.forward_origin
  if (!f) return content
  let meta = '[Переслано]'
  if (f.type === 'user' && f.sender_user) {
    const name = [f.sender_user.first_name, f.sender_user.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'пользователь'
    meta = `[Переслано от ${name}]`
  } else if (f.type === 'channel' && f.chat) {
    const title = f.chat.title || f.chat.username || 'канал'
    meta = `[Переслано из канала ${title}]`
  } else if (f.type === 'chat' && f.sender_chat) {
    const title = f.sender_chat.title || f.sender_chat.username || 'чат'
    meta = `[Переслано из чата ${title}]`
  } else if (f.type === 'hidden_user') {
    meta = `[Переслано (скрытый автор: ${f.sender_user_name || 'аноним'})]`
  }
  return `${meta}\n${content}`
}

// NOTES_DIR_NAME из .env (например 'second-brain' для Obsidian-vault, 'notes' для обычного репо)
const VAULT_DIR = path.join(PROJECT_ROOT, 'workspace', NOTES_DIR_NAME)
const VAULT_INBOX = path.join(VAULT_DIR, 'INBOX')

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
}

function syncVault(commitMessage: string): void {
  // Безопасно: каждая команда — отдельный spawn с массивом аргументов, без shell-интерполяции.
  // commitMessage передаётся как отдельный argv-аргумент → пользовательский текст не парсится bash.
  // Без VAULT_DIR/notes/.git spawn падает ENOENT и unhandled error event валит бота.
  // Поэтому: каждый spawn получает .on('error', handler) — крах гасится, /note продолжает работать.
  if (!existsSync(VAULT_DIR)) return
  const gitOpts = { cwd: VAULT_DIR, stdio: 'ignore' as const }
  const add = spawn('git', ['add', '.'], gitOpts)
  add.on('error', (err) => { console.error('syncVault: git add failed:', err.message) })
  add.on('close', (addCode) => {
    if (addCode !== 0) return
    const commit = spawn('git', ['commit', '--allow-empty-message', '-m', commitMessage], gitOpts)
    commit.on('error', (err) => { console.error('syncVault: git commit failed:', err.message) })
    commit.on('close', (commitCode) => {
      // commit может выйти 1 если нечего коммитить — это норма
      if (commitCode === 0) {
        const push = spawn('git', ['push'], { ...gitOpts, detached: true })
        push.on('error', (err) => { console.error('syncVault: git push failed:', err.message) })
        push.unref()
      }
    })
  })
}
const EMPTY_ACTIVE_CONTEXT = `# Active Context

> Оперативная память ассистента. Что сейчас актуально, открытые задачи, последние решения.
> Обновляй через \`/context update <текст>\` в Telegram или редактируй файл напрямую.

## Сейчас работаю над

(пусто)

## Открытые вопросы

(пусто)

## Последние решения

(пусто)
`

const voiceModeChats = new Set<string>()

export function formatForTelegram(text: string): string {
  // Extract code blocks first to protect their content
  const codeBlocks: string[] = []
  let result = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, content) => {
    const idx = codeBlocks.length
    const inner = lang
      ? `<pre><code class="language-${lang}">${content}</code></pre>`
      : `<pre>${content}</pre>`
    codeBlocks.push(inner)
    return `\x00CB${idx}\x00`
  })

  // Escape HTML entities in text nodes (before adding any HTML tags)
  // We operate on regions outside our placeholders
  result = result
    .split(/(\x00CB\d+\x00)/)
    .map((part, i) => {
      if (i % 2 === 1) return part // placeholder — leave alone
      // Escape &, <, > that are NOT part of HTML we'll create
      return part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    })
    .join('')

  // Inline code (after entity escaping so backtick content is safe)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  result = result.replace(/__(.+?)__/g, '<b>$1</b>')

  // Italic: *text* or _text_ (single, not double)
  result = result.replace(/\*([^*\n]+?)\*/g, '<i>$1</i>')
  result = result.replace(/_([^_\n]+?)_/g, '<i>$1</i>')

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>')

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Headings: # Heading at start of line
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>')

  // Checkboxes
  result = result.replace(/^- \[ \]/gm, '&#9744;')
  result = result.replace(/^- \[x\]/gi, '&#9745;')

  // Strip horizontal rules and bold-style dividers
  result = result.replace(/^---+$/gm, '')
  result = result.replace(/^\*{3,}$/gm, '')

  // TODO: raw HTML stripping is tricky — we'd need to strip tags not in Telegram's allowed set
  // without breaking the tags we just created. Leaving as-is for now since Claude rarely emits raw HTML.

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    result = result.split(`\x00CB${idx}\x00`).join(block)
  })

  return result
}

export function splitMessage(text: string, limit = MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= limit) return [text]

  const chunks: string[] = []
  let current = ''

  for (const line of text.split('\n')) {
    const candidate = current ? current + '\n' + line : line
    if (candidate.length <= limit) {
      current = candidate
    } else {
      if (current) chunks.push(current)
      // If a single line exceeds the limit, hard-split it
      if (line.length > limit) {
        for (let i = 0; i < line.length; i += limit) {
          chunks.push(line.slice(i, i + limit))
        }
        current = ''
      } else {
        current = line
      }
    }
  }

  if (current) chunks.push(current)
  return chunks
}

export function isAuthorised(chatId: number | string): boolean {
  // HIGH-3: fail-closed — без ALLOWED_CHAT_ID никто не проходит
  if (!runtimeAllowedChatId) {
    logger.warn({ chatId }, 'isAuthorised: ALLOWED_CHAT_ID не настроен — гейт закрыт')
    return false
  }
  const allowed = runtimeAllowedChatId.split(',').map(s => s.trim()).filter(Boolean)
  return allowed.includes(String(chatId))
}

// Tag format: <file>/abs/path/to.ext</file> or <file caption="...">/abs/path</file>
const FILE_TAG_RE = /<file(?:\s+caption="([^"]*)")?>([^<]+)<\/file>/gi
const PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm'])
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.oga', '.m4a', '.wav', '.flac'])

// Telegram caption limit (фото/видео/документ)
const TG_CAPTION_LIMIT = 1024

function normalizeForDup(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

async function sendTaggedFiles(ctx: any, text: string): Promise<string> {
  const matches = [...text.matchAll(FILE_TAG_RE)]
  if (matches.length === 0) return text

  // Strip tags first to compute "remaining text" once for dedup check
  const remainingText = text.replace(FILE_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim()
  const remainingNorm = normalizeForDup(remainingText)

  for (const m of matches) {
    let caption = m[1]?.trim() || undefined
    const filepath = m[2].trim()

    // Anti-dup: если caption ≈ оставшийся текст — выкидываем caption (избегаем дубликата)
    if (caption && remainingNorm && normalizeForDup(caption) === remainingNorm) {
      caption = undefined
    }
    // Telegram лимит на caption — мягко обрезаем
    if (caption && caption.length > TG_CAPTION_LIMIT) {
      caption = caption.slice(0, TG_CAPTION_LIMIT - 1) + '…'
    }
    const ext = path.extname(filepath).toLowerCase()
    try {
      // Verify file exists and is readable before sending
      await fs.access(filepath)
      const stat = await fs.stat(filepath)
      if (!stat.isFile()) throw new Error('not a file')
      // Telegram limits: bots can send up to 50MB via API
      if (stat.size > 50 * 1024 * 1024) throw new Error(`file too large: ${stat.size} bytes`)

      const file = new InputFile(filepath)
      if (PHOTO_EXT.has(ext)) {
        await ctx.replyWithPhoto(file, caption ? { caption } : undefined)
      } else if (VIDEO_EXT.has(ext)) {
        await ctx.replyWithVideo(file, caption ? { caption } : undefined)
      } else if (AUDIO_EXT.has(ext)) {
        await ctx.replyWithAudio(file, caption ? { caption } : undefined)
      } else {
        await ctx.replyWithDocument(file, caption ? { caption } : undefined)
      }
      logger.info({ filepath, ext, size: stat.size }, 'sent file to chat')
    } catch (err) {
      logger.warn({ err, filepath }, 'failed to send tagged file')
      await ctx.reply(`Не смог отправить файл: <code>${filepath}</code>\n${err instanceof Error ? err.message : String(err)}`, { parse_mode: 'HTML' }).catch(() => {})
    }
  }

  return remainingText
}

async function handleMessage(
  ctx: any,
  rawText: string,
  _forceVoiceReply = false
): Promise<void> {
  const chatId = ctx.chat.id

  if (!isAuthorised(chatId)) {
    logger.warn({ chatId }, 'Unauthorised chat')
    await ctx.reply('Not authorized.')
    return
  }

  const memContext = await buildMemoryContext(String(chatId), rawText)
  let fullMessage = memContext ? `${memContext}\n\n${rawText}` : rawText

  // Cancel-and-merge: если runAgent уже работает — abort + склеить prompts + relaunch
  // в той же сессии. Защищает от потери сообщений-вдогонку (Юлин кейс пост+кеды).
  if (activeRuns.has(String(chatId))) {
    logger.info({ chatId: String(chatId) }, 'cancel-and-merge: aborting previous run')
    const cm = await cancelAndPrepareMerge({
      chatId: String(chatId),
      activeRuns,
      lastPrompts,
      cascadeLevel,
      newPrompt: fullMessage,
    })

    if (cm.action === 'reject_cascade') {
      logger.info({ chatId: String(chatId), level: cm.cascadeLevel }, 'cancel-and-merge: cascade limit')
      await ctx.reply(
        `Слишком много изменений подряд (${MAX_CASCADE_LEVEL} уровня склейки). ` +
        `Доделаю текущий запрос — потом пришли новое отдельным сообщением.`
      ).catch(() => {})
      return
    }

    if (cm.action === 'timeout_force') {
      logger.warn({ chatId: String(chatId) }, 'cancel-and-merge: timeout force-clear semaphore')
    }

    await ctx.reply('[Отменено — продолжаю с учётом нового сообщения]').catch(() => {})
    logger.info({ chatId: String(chatId), level: cm.cascadeLevel }, `merged prompt cascade level=${cm.cascadeLevel}`)
    fullMessage = cm.mergedPrompt ?? fullMessage
  }

  const sessionRow = getSession(String(chatId))
  const sessionId = sessionRow?.session_id

  await ctx.api.sendChatAction(chatId, 'typing')
  const typingInterval = setInterval(() => {
    ctx.api.sendChatAction(chatId, 'typing').catch(() => {})
  }, TYPING_REFRESH_MS)

  // Live progress message (appears, edits as Claude works, deletes at end)
  let progressMsgId: number | undefined
  const progressLines: string[] = []
  let lastEditAt = 0
  let editScheduled = false
  let progressFinished = false

  const stopKeyboard = new InlineKeyboard().text('⛔ Стоп', `stop:${chatId}`)

  if (SHOW_PROGRESS) {
    try {
      const sent = await ctx.reply('▸ Думаю...', { reply_markup: stopKeyboard })
      progressMsgId = sent.message_id
    } catch (err) {
      logger.warn({ err }, 'failed to send progress message')
    }
  }

  const flushEdit = async () => {
    if (!progressMsgId || progressFinished) return
    lastEditAt = Date.now()
    const lines = progressLines.slice(-PROGRESS_MAX_LINES)
    const body = lines.length ? lines.map(l => `▸ ${l}`).join('\n') : '▸ Думаю...'
    const text = `<b>В работе</b>\n\n${body}`
    try {
      await ctx.api.editMessageText(chatId, progressMsgId, text, { parse_mode: 'HTML', reply_markup: stopKeyboard })
    } catch (err) {
      // Telegram returns 400 if text didn't change — silent ignore
    }
  }

  const scheduleEdit = () => {
    if (!progressMsgId || editScheduled || progressFinished) return
    const wait = Math.max(0, lastEditAt + PROGRESS_THROTTLE_MS - Date.now())
    editScheduled = true
    setTimeout(() => {
      editScheduled = false
      flushEdit()
    }, wait)
  }

  const pushLine = (line: string) => {
    // Склейка повторов: подряд идущие одинаковые строки превращаются в `Xxx (×N)`.
    if (!line) return
    const last = progressLines[progressLines.length - 1]
    if (!last) {
      progressLines.push(line)
      return
    }
    const lastBase = last.replace(/\s\(×\d+\)$/, '')
    if (lastBase === line) {
      const m = last.match(/\(×(\d+)\)$/)
      const n = m ? Number(m[1]) + 1 : 2
      progressLines[progressLines.length - 1] = `${lastBase} (×${n})`
    } else {
      progressLines.push(line)
    }
  }

  const onProgress = (event: ProgressEvent) => {
    if (!progressMsgId) return
    if (event.kind === 'init') {
      pushLine('Поехали')
    } else if (event.kind === 'tool') {
      pushLine(event.summary)
    }
    // 'thinking' и 'done' пропускаем — мусор / финал
    scheduleEdit()
  }

  let text: string | null = null
  let newSessionId: string | undefined
  let aborted = false
  let overloaded = false
  let inputTokens: number | undefined

  const abortController = new AbortController()
  activeRuns.set(String(chatId), abortController)
  lastPrompts.set(String(chatId), fullMessage)

  try {
    const chatModel = getChatModel(String(chatId)) ?? ANTHROPIC_MODEL
    let result = await runAgent(fullMessage, sessionId, undefined, chatModel, onProgress, abortController)

    // Auto-compact: SDK исчерпал окно контекста → сбрасываем сессию и переотправляем сообщение
    if (result.contextOverflow) {
      logger.warn({ chatId: String(chatId) }, 'context window limit — auto-compact: clearing session and retrying')
      clearSession(String(chatId))
      pushLine('Контекст пересжат - стартую чистую сессию')
      scheduleEdit()
      const compactPrefix =
        '[Системное: предыдущая сессия превысила лимит контекста и была сброшена. ' +
        'Память клиента (workspace/active-context.md, memories DB) и sticky-правила подгружены заново. ' +
        'Продолжай работу с сохранением домена и стиля речи владельца.]\n\n'
      result = await runAgent(compactPrefix + fullMessage, undefined, undefined, chatModel, onProgress, abortController)
    }

    text = result.text
    newSessionId = result.newSessionId
    aborted = !!result.aborted
    inputTokens = result.inputTokens
  } catch (err) {
    // Транзиентная перегрузка движка (429/529/overloaded), ретраи исчерпаны — НЕ молчим:
    // даём оператору понятный ответ вместо «бот завис». Прочие ошибки пробрасываем как раньше.
    const m = err instanceof Error ? err.message : String(err)
    if (/\b429\b|\b529\b|overloaded|rate[_ ]?limit|too many requests|service[_ ]?unavailable/i.test(m)) {
      overloaded = true
      await ctx.reply('⚠️ Движок временно перегружен на стороне провайдера. Я на месте — повтори запрос через минуту.').catch(() => {})
    } else {
      throw err
    }
  } finally {
    activeRuns.delete(String(chatId))
    lastPrompts.delete(String(chatId))
    clearInterval(typingInterval)
    progressFinished = true
    if (progressMsgId) {
      if (PROGRESS_DELETE_AFTER) {
        try { await ctx.api.deleteMessage(chatId, progressMsgId) } catch {}
      } else {
        // оставляем последний снимок цепочки (без кнопки Стоп — уже неактуальна)
        const lines = progressLines.slice(-PROGRESS_MAX_LINES)
        const body = lines.length ? lines.map(l => `▸ ${l}`).join('\n') : '▸ (нет шагов)'
        const status = overloaded ? 'Движок перегружен' : aborted ? 'Остановлено' : 'Готово'
        try {
          await ctx.api.editMessageText(chatId, progressMsgId, `<b>${status}</b>\n\n${body}`, { parse_mode: 'HTML' })
        } catch {}
      }
    }
  }

  // Перегрузка движка уже сообщена оператору в catch — выходим, не шлём «[Empty response]».
  if (overloaded) return

  if (aborted) {
    // Если abort был частью cancel-and-merge — новый handleMessage уже
    // отправил "[Отменено — продолжаю...]". Не дублируем reply, тихо выходим.
    if (abortController.signal.reason === CANCEL_MERGE_REASON) {
      return
    }
    // Пользовательский [⛔ Стоп] — успешное завершение, сбросить cascade
    cascadeLevel.delete(String(chatId))
    await ctx.reply('Остановлено. Что дальше?')
    return
  }

  // Нормальное успешное завершение → cascade сбрасываем
  cascadeLevel.delete(String(chatId))

  if (newSessionId && newSessionId !== sessionId) {
    setSession(String(chatId), newSessionId)
  }

  // Превентивная компрессия: если окно превысило порог — сбрасываем сессию ДО overflow.
  // Следующее сообщение стартует чисто, sticky + active-context + memories DB подгружаются заново.
  if (text && typeof inputTokens === 'number' && inputTokens > PRECOMPACT_INPUT_TOKENS) {
    logger.warn(
      { chatId: String(chatId), inputTokens, threshold: PRECOMPACT_INPUT_TOKENS },
      'precompact: input tokens exceeded threshold — clearing session proactively',
    )
    clearSession(String(chatId))
  }

  await saveConversationTurn(String(chatId), rawText, text ?? '')

  // Auto-sync vault if agent wrote anything in second-brain/
  syncVault(`bot: ${rawText.split('\n')[0].slice(0, 60)}`)

  if (!text) {
    await ctx.reply('[Empty response]')
    return
  }

  // Extract <file>/abs/path</file> markers and send each as appropriate media.
  text = await sendTaggedFiles(ctx, text)
  if (!text.trim()) return  // только файлы, текста нет

  const chunks = splitMessage(formatForTelegram(text))
  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, { parse_mode: 'HTML' })
    } catch {
      // HTML parse error — fallback to plain text
      await ctx.reply(chunk)
    }
  }
}

export const BOT_COMMANDS: { command: string; description: string }[] = [
  // ── Меню VIP BIKE (бот проката). Договор/повторный клиент — естественным языком (скилл contract-agent). ──
  { command: 'start',       description: 'Старт / что умеет бот' },
  { command: 'dogovor',     description: 'Новый договор аренды' },
  { command: 'klient',      description: 'Найти постоянного клиента' },
  { command: 'newchat',     description: 'Новая сессия (сбросить контекст)' },
  { command: 'context',     description: 'Оперативный контекст' },
  { command: 'schedule',    description: 'Напоминания (вернуть/продлить байк)' },
  { command: 'model',       description: 'Переключить модель' },
  { command: 'skills',      description: 'Навыки бота' },
  { command: 'agents',      description: 'Агенты бота' },
  { command: 'remember',    description: 'Запомнить правило (всегда в системе)' },
  { command: 'rules',       description: 'Показать правила' },
  { command: 'chatid',      description: 'Узнать свой chat_id' },
]

// ─── Exported handlers (testable without full Bot wiring) ────────────────────

export async function handleStart(ctx: any): Promise<void> {
  const chatId = ctx.chat.id as number
  const chatIdStr = String(chatId)

  // Register ALLOWED_CHAT_ID on first run (empty env = first registering user takes the slot)
  if (!runtimeAllowedChatId) {
    runtimeAllowedChatId = chatIdStr
    writeEnvKey('ALLOWED_CHAT_ID', chatIdStr)
  } else if (!isAuthorised(chatId)) {
    await ctx.reply('Бот не сконфигурирован для тебя.')
    return
  }

  // Always go straight to welcome — no onboarding FSM
  const welcomePath = path.join(PROJECT_ROOT, 'workspace', 'welcome.md')
  try {
    const raw = await fs.readFile(welcomePath, 'utf-8')
    const chunks = splitMessage(formatForTelegram(raw))
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(() => ctx.reply(chunk))
    }
  } catch {
    await ctx.reply('Привет! Я твой ассистент. Напиши мне что-нибудь.')
  }
}

export async function handleTextMessage(ctx: any): Promise<void> {
  const chatId = ctx.chat.id as number
  const text = ctx.message.text as string

  if (isEscalationTrigger(text)) {
    await handleEscalation(chatId, text, async (reply) => { await ctx.reply(reply) })
    return
  }

  // Append-while-thinking: ждём 1.5s тишины перед запуском agent.run.
  // Если юзер дошлёт уточнение — таймер сбрасывается и сообщения склеиваются.
  const enriched = withForwardMeta(ctx, text)
  textBatcher.add(`text:${chatId}`, { content: enriched, ctx })
}

export function createBot(): Bot {
  const bot = new Bot(TELEGRAM_BOT_TOKEN)

  // Меню команд. ВАЖНО: ставим И для default-scope, И для all_private_chats.
  // Telegram резолвит команды по специфичности скоупа — если ранее (старый деплой/конфиг)
  // команды выставлялись в более узкий scope all_private_chats, то наш default-вызов
  // его НЕ перекрывает → клиент в личке видит старое кешированное меню. Ставим оба.
  void Promise.all([
    bot.api.setMyCommands(BOT_COMMANDS),
    bot.api.setMyCommands(BOT_COMMANDS, { scope: { type: 'all_private_chats' } }),
  ]).catch((err) => {
    logger.warn({ err }, 'setMyCommands failed (non-fatal)')
  })

  bot.command('start', handleStart)

  bot.command('chatid', async (ctx) => {
    await ctx.reply(`Your chat ID: ${ctx.chat.id}`)
  })

  // ── VIP BIKE: подсказки-команды меню (реальная работа — естественным языком/фото через скилл) ──
  bot.command('dogovor', async (ctx) => {
    await ctx.reply(
      'Оформляю договор аренды.\n\n' +
      'Новый клиент — пришли фото паспорта и ВУ + напиши байк, даты и депозит.\n' +
      'Постоянный клиент — напиши его фамилию или телефон (документы уже в базе, нужны только байк и даты).',
    )
  })
  bot.command('klient', async (ctx) => {
    await ctx.reply('Напиши фамилию или телефон клиента — найду в базе для повторного оформления.')
  })

  bot.command('connections', async (ctx) => {
    try {
      const status = await getConnectionsStatus()
      const lines = ['<b>Статус подключений:</b>', '']
      const kb = new InlineKeyboard()
      let needReconnect = false
      for (const s of status) {
        const mark = s.status === 'ACTIVE' ? '✅' : s.status === 'EXPIRED' ? '⚠️' : '❌'
        const label = s.status === 'ACTIVE' ? 'подключён' : s.status === 'EXPIRED' ? 'токен истёк' : 'не подключён'
        lines.push(`${mark} ${s.emoji} ${s.label} — ${label}`)
        if (s.status !== 'ACTIVE') {
          kb.text(`🔄 ${s.emoji} ${s.label}`, `connect:${s.slug}`).row()
          needReconnect = true
        }
      }
      if (needReconnect) {
        lines.push('', 'Тапни ниже чтобы подключить или переподключить:')
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb })
      } else {
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
      }
    } catch (err) {
      await ctx.reply(`Ошибка: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  bot.command('connect', async (ctx) => {
    const service = (ctx.match as string | undefined)?.trim() ?? ''
    // Empty arg → выдаём inline-кнопки вместо текстового списка
    if (!service) {
      const kb = new InlineKeyboard()
      for (const t of DEFAULT_TOOLKITS) {
        kb.text(`${t.emoji} ${t.label}`, `connect:${t.slug}`).row()
      }
      await ctx.reply('Подключить сервис — тапни ниже:', { reply_markup: kb })
      return
    }
    const wasConnected = isValidService(service) && isConnected(service as ComposioService, ctx.chat.id)
    const reply = await handleConnectCommand(ctx.chat.id, service)
    await ctx.reply(reply)
    if (isValidService(service) && !wasConnected) {
      void pollOAuthCompletion(
        ctx.chat.id,
        service as ComposioService,
        (text) => ctx.reply(text).then(() => {}),
      )
    }
  })

  // Inline-кнопка: connect:<slug> — то же что /connect <slug>, только из tap
  bot.callbackQuery(/^connect:([a-z]+)$/, async (ctx) => {
    const slug = ctx.match[1]
    await ctx.answerCallbackQuery().catch(() => {})
    if (!isValidService(slug)) {
      await ctx.reply(`Неизвестный сервис: ${slug}`)
      return
    }
    const chatId = ctx.chat?.id
    if (!chatId) return
    const wasConnected = isConnected(slug as ComposioService, chatId)
    const reply = await handleConnectCommand(chatId, slug)
    await ctx.reply(reply)
    if (!wasConnected) {
      void pollOAuthCompletion(
        chatId,
        slug as ComposioService,
        (text) => ctx.reply(text).then(() => {}),
      )
    }
  })

  bot.command('newchat', async (ctx) => {
    clearSession(String(ctx.chat.id))
    await ctx.reply('Новая сессия начата.')
  })

  // Кнопка [⛔ Стоп] под progress-сообщением. callback_data: stop:<chatId>
  bot.callbackQuery(/^stop:(-?\d+)$/, async (ctx) => {
    const targetChatId = ctx.match[1]
    const controller = activeRuns.get(targetChatId)
    if (!controller) {
      await ctx.answerCallbackQuery({ text: 'Нечего останавливать', show_alert: false })
      return
    }
    controller.abort()
    activeRuns.delete(targetChatId)
    await ctx.answerCallbackQuery({ text: '⛔ Остановлено' })
  })

  bot.command('forget', async (ctx) => {
    clearSession(String(ctx.chat.id))
    await ctx.reply('Новая сессия начата.')
  })

  bot.command('memory', async (ctx) => {
    const rows = getRecentMemories(String(ctx.chat.id), 10)
    if (!rows.length) {
      await ctx.reply('Нет сохранённых воспоминаний.')
      return
    }
    const text = rows.map((r: { content: string; sector: string }, i: number) =>
      `${i + 1}. [${r.sector}] ${r.content}`
    ).join('\n')
    await ctx.reply(text)
  })

  // ─── Sticky rules (только владелец) ────────────────────────────────────────
  // Хранятся в workspace/agent-rules.md и подгружаются в КАЖДОМ ответе агента
  // (см. agent.ts). В отличие от семантической памяти memories — эти всегда в системе.
  const stickyRulesPath = path.join(PROJECT_ROOT, 'workspace', 'agent-rules.md')

  async function ensureRulesFile(): Promise<void> {
    try {
      await fs.access(stickyRulesPath)
    } catch {
      const header =
        '# Sticky Rules — постоянная память бота\n\n' +
        '> Подгружается в системный промпт перед каждым ответом.\n' +
        '> Управление через /remember, /unrule, /rules.\n\n' +
        '## Активные правила\n\n(пока пусто — добавь через /remember)\n\n' +
        '---\n\n## Лог изменений\n\n| Дата | Правило |\n|------|---------|\n'
      await fs.mkdir(path.dirname(stickyRulesPath), { recursive: true })
      await fs.writeFile(stickyRulesPath, header)
    }
  }

  bot.command('remember', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }
    const text = (ctx.match ?? '').trim()
    if (!text) {
      await ctx.reply('Использование: /remember <правило>\nПример: /remember всегда отвечать кратко')
      return
    }
    try {
      await ensureRulesFile()
      let content = await fs.readFile(stickyRulesPath, 'utf-8')
      const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16)
      content = content.replace(/\(пока пусто[^)]+\)\n?/, '')
      content = content.replace(
        /(## Активные правила\n\n)((?:- .+\n)*)/,
        (_m, head, list) => `${head}${list}- ${text}\n`,
      )
      // replacer-функция: $1/$& в тексте пользователя не интерпретируются как backref
      const escapedForTable = text.replace(/\|/g, '\\|')
      content = content.replace(
        /(\| Дата \| Правило \|\n\|[^\n]+\|\n)/,
        (header) => `${header}| ${stamp} | ${escapedForTable} |\n`,
      )
      await fs.writeFile(stickyRulesPath, content)
      await ctx.reply(`Запомнил: ${text}\n\nПравило применяется к каждому ответу.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await ctx.reply(`Ошибка: ${msg}`)
    }
  })

  bot.command('unrule', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }
    const text = (ctx.match ?? '').trim()
    if (!text) { await ctx.reply('Использование: /unrule <часть текста правила>\n/rules — посмотреть.'); return }
    try {
      await ensureRulesFile()
      let content = await fs.readFile(stickyRulesPath, 'utf-8')
      const re = new RegExp(`^- .*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\n`, 'gm')
      const before = content
      content = content.replace(re, '')
      if (content === before) { await ctx.reply(`Правил с «${text}» не нашёл.`); return }
      await fs.writeFile(stickyRulesPath, content)
      await ctx.reply(`Удалил правила с «${text}».`)
    } catch (err) {
      await ctx.reply(`Ошибка: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  bot.command('rules', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }
    try {
      await ensureRulesFile()
      const content = await fs.readFile(stickyRulesPath, 'utf-8')
      const match = content.match(/## Активные правила\n\n([\s\S]*?)(?=\n---|\n## )/)
      const body = (match?.[1] ?? '').trim() || '(правил нет)'
      await ctx.reply(`Sticky rules:\n\n${body}\n\n/remember <текст> — добавить\n/unrule <часть> — удалить`)
    } catch {
      await ctx.reply('Файл правил пуст или недоступен.')
    }
  })

  bot.command('agents', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }

    function parseAgent(text: string, fallback: string): { name: string; desc: string } {
      const m = text.match(/^---[\s\S]*?\nname:\s*(.+?)\n[\s\S]*?\ndescription:\s*(.+?)(?:\n|$)[\s\S]*?---/)
      return { name: m?.[1]?.trim() || fallback, desc: m?.[2]?.trim() || '(без описания)' }
    }

    async function readAgentsDir(dir: string): Promise<string[]> {
      const items: string[] = []
      try {
        const files = await fs.readdir(dir)
        for (const f of files) {
          if (!f.endsWith('.md')) continue
          try {
            const text = await fs.readFile(path.join(dir, f), 'utf-8')
            const { name, desc } = parseAgent(text, f.replace(/\.md$/, ''))
            const shortDesc = desc.length > 140 ? desc.slice(0, 140) + '…' : desc
            items.push(`<b>${name}</b> — ${shortDesc}`)
          } catch { /* skip */ }
        }
      } catch { /* dir may not exist */ }
      return items
    }

    const projectAgents: string[] = []
    for (const dir of [path.join(PROJECT_ROOT, 'workspace', '.claude', 'agents'), path.join(PROJECT_ROOT, '.claude', 'agents')]) {
      projectAgents.push(...await readAgentsDir(dir))
    }

    const pluginAgents: { plugin: string; items: string[] }[] = []
    const pluginsDir = path.join(homedir(), '.claude', 'plugins')
    try {
      const plugins = await fs.readdir(pluginsDir, { withFileTypes: true })
      for (const p of plugins) {
        if (!p.isDirectory()) continue
        const agentsDir = path.join(pluginsDir, p.name, 'agents')
        const items = await readAgentsDir(agentsDir)
        if (items.length) pluginAgents.push({ plugin: p.name, items })
      }
    } catch { /* no plugins dir */ }

    const sections: string[] = []
    if (projectAgents.length) {
      sections.push(`<b>Проектные (${projectAgents.length}):</b>\n\n${projectAgents.join('\n\n')}`)
    }
    for (const pa of pluginAgents) {
      sections.push(`<b>Плагин ${pa.plugin} (${pa.items.length}):</b>\n\n${pa.items.join('\n\n')}`)
    }

    const body = sections.length
      ? sections.join('\n\n———\n\n')
      : '(агентов нет)\n\nСоздать: «создай агента для [задача]»'

    const chunks = body.match(/[\s\S]{1,3500}(?=\n\n|$)/g) ?? [body]
    await ctx.reply(`Настроенные агенты:\n\n${chunks[0]}`, { parse_mode: 'HTML' })
    for (let i = 1; i < chunks.length; i++) await ctx.reply(chunks[i], { parse_mode: 'HTML' })
    await ctx.reply('Запуск: просто напиши задачу, бот сам поднимет нужного агента.')
  })

  bot.command('skills', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }

    function parseSkillMeta(text: string, fallback: string): { name: string; desc: string } {
      const m = text.match(/^---[\s\S]*?\nname:\s*(.+?)\n[\s\S]*?\ndescription:\s*(.+?)(?:\n|$)[\s\S]*?---/)
      const name = m?.[1]?.trim() || fallback
      const desc = (m?.[2]?.trim() || '')
      return { name, desc: desc.length > 140 ? desc.slice(0, 140) + '…' : desc }
    }

    async function readSkillsDir(dir: string): Promise<string[]> {
      const items: string[] = []
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const e of entries) {
          let skillPath = ''
          let fallback = ''
          if (e.isDirectory()) {
            skillPath = path.join(dir, e.name, 'SKILL.md')
            fallback = e.name
          } else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md') {
            skillPath = path.join(dir, e.name)
            fallback = e.name.replace(/\.md$/, '')
          } else continue
          try {
            const text = await fs.readFile(skillPath, 'utf-8')
            const { name, desc } = parseSkillMeta(text, fallback)
            items.push(`<b>${name}</b>${desc ? ' — ' + desc : ''}`)
          } catch { /* skip */ }
        }
      } catch { /* dir may not exist */ }
      return items
    }

    const localDir = path.join(PROJECT_ROOT, 'workspace', 'skills')
    const globalDir = path.join(homedir(), '.claude', 'skills')
    const localItems = await readSkillsDir(localDir)
    const globalItems = await readSkillsDir(globalDir)

    const pluginSkills: { plugin: string; items: string[] }[] = []
    const pluginsDir = path.join(homedir(), '.claude', 'plugins')
    try {
      const plugins = await fs.readdir(pluginsDir, { withFileTypes: true })
      for (const p of plugins) {
        if (!p.isDirectory()) continue
        const skillsDir = path.join(pluginsDir, p.name, 'skills')
        const items = await readSkillsDir(skillsDir)
        if (items.length) pluginSkills.push({ plugin: p.name, items })
      }
    } catch { /* no plugins dir */ }

    const sections: string[] = []
    if (localItems.length) sections.push(`<b>Проектные (${localItems.length}):</b>\n\n${localItems.join('\n\n')}`)
    if (globalItems.length) sections.push(`<b>Глобальные (${globalItems.length}):</b>\n\n${globalItems.join('\n\n')}`)
    for (const ps of pluginSkills) {
      sections.push(`<b>Плагин ${ps.plugin} (${ps.items.length}):</b>\n\n${ps.items.join('\n\n')}`)
    }

    const body = sections.length
      ? sections.join('\n\n———\n\n')
      : '(скиллов нет)\n\nСоздать: «создай скилл для [задача]»'

    const chunks = body.match(/[\s\S]{1,3500}(?=\n\n|$)/g) ?? [body]
    await ctx.reply(`Настроенные скиллы:\n\n${chunks[0]}`, { parse_mode: 'HTML' })
    for (let i = 1; i < chunks.length; i++) await ctx.reply(chunks[i], { parse_mode: 'HTML' })
    await ctx.reply('Триггерятся автоматически по описанию.')
  })

  bot.command('diagnose', async (ctx) => {
    if (!isAuthorised(ctx.chat.id)) { await ctx.reply('Нет прав.'); return }
    const prompt =
      'Проведи диагностику бота. Прочитай logs/ (последние 200 строк stderr/stdout) и pm2/launchd логи если доступны. ' +
      'Найди ошибки, сгруппируй по типу (квота API, парсинг, сеть, конфиг, баг кода), по каждой — одна строка «что чинить». ' +
      'Кратко, без воды. Если ошибок нет — так и скажи. Не правь код сам.'
    await handleMessage(ctx, prompt)
  })

  bot.command('context', async (ctx) => {
    const arg = (ctx.match ?? '').trim()

    if (!arg) {
      const content = await fs.readFile(ACTIVE_CONTEXT_PATH, 'utf-8').catch(() => '')
      if (!content.trim()) {
        await ctx.reply('Active context пуст.')
        return
      }
      const chunks = splitMessage(content)
      for (const chunk of chunks) await ctx.reply(chunk)
      return
    }

    if (arg === 'clear') {
      await fs.mkdir(path.dirname(ACTIVE_CONTEXT_PATH), { recursive: true })
      await fs.writeFile(ACTIVE_CONTEXT_PATH, EMPTY_ACTIVE_CONTEXT)
      await ctx.reply('Active context очищен.')
      return
    }

    if (arg.startsWith('update')) {
      const note = arg.slice('update'.length).trim()
      if (!note) {
        await ctx.reply('Использование: /context update <текст>')
        return
      }
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const existing = await fs.readFile(ACTIVE_CONTEXT_PATH, 'utf-8').catch(() => EMPTY_ACTIVE_CONTEXT)
      const appended = `${existing.trimEnd()}\n\n## ${stamp}\n${note}\n`
      await fs.mkdir(path.dirname(ACTIVE_CONTEXT_PATH), { recursive: true })
      await fs.writeFile(ACTIVE_CONTEXT_PATH, appended)
      await ctx.reply('Записал в active context.')
      return
    }

    await ctx.reply(
      'Команды:\n' +
      '/context — показать\n' +
      '/context update <текст> — добавить запись\n' +
      '/context clear — очистить'
    )
  })

  bot.command('note', async (ctx) => {
    const note = (ctx.match ?? '').trim()
    if (!note) {
      await ctx.reply('Использование: /note <текст заметки>\nЗапишу в INBOX/ vault и запушу.')
      return
    }
    try {
      await fs.mkdir(VAULT_INBOX, { recursive: true })
      const now = new Date()
      const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '')
      const slug = slugify(note.split('\n')[0]) || 'note'
      const filename = `${stamp}-${slug}.md`
      const filepath = path.join(VAULT_INBOX, filename)
      const body = `---\ncreated: ${now.toISOString()}\nsource: telegram-bot\n---\n\n${note}\n`
      await fs.writeFile(filepath, body)
      syncVault(`note: ${note.split('\n')[0].slice(0, 60)}`)
      await ctx.reply(`Записал: <code>INBOX/${filename}</code>`, { parse_mode: 'HTML' })
    } catch (err) {
      logger.error({ err }, '/note failed')
      await ctx.reply('Не смог записать заметку.')
    }
  })

  bot.command('model', async (ctx) => {
    const chatId = String(ctx.chat.id)
    const arg = (ctx.match ?? '').trim()
    const current = getChatModel(chatId) ?? ANTHROPIC_MODEL

    if (!arg) {
      const lines = ['Доступные модели:', '']
      MODELS.forEach((m, i) => {
        const mark = m.id === current ? '✓' : ' '
        const flag = m.supported ? '' : ' [не поддерживается]'
        lines.push(`${mark} ${i + 1}. ${m.label}${flag}`)
        lines.push(`   <code>${m.id}</code>`)
      })
      lines.push('')
      const example = MODELS[1]?.id ?? MODELS[0]?.id ?? 'glm-5.1'
      lines.push(`Переключить: <code>/model ${example}</code>`)
      lines.push('Или по номеру: <code>/model 2</code>')
      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' })
      return
    }

    let target = findModel(arg)
    if (!target) {
      const idx = parseInt(arg, 10)
      if (idx >= 1 && idx <= MODELS.length) target = MODELS[idx - 1]
    }

    if (!target) {
      await ctx.reply(`Не нашёл модель "${arg}". Список: /model`)
      return
    }

    if (!target.supported) {
      await ctx.reply(`Модель "${target.label}" пока не поддерживается через эту прослойку.`)
      return
    }

    setChatModel(chatId, target.id)
    clearSession(chatId)
    await ctx.reply(`Модель: ${target.label}\n(сессия сброшена для применения)`)
  })

  bot.command('schedule', async (ctx) => {
    await ctx.reply(
      'Для создания задачи используй CLI:\n' +
      '<code>node dist/schedule-cli.js create "PROMPT" "CRON" CHAT_ID</code>\n\n' +
      'Примеры cron:\n' +
      '• Каждый день в 9:00: <code>0 9 * * *</code>\n' +
      '• Каждый понедельник: <code>0 9 * * 1</code>\n' +
      '• Каждые 4 часа: <code>0 */4 * * *</code>',
      { parse_mode: 'HTML' }
    )
  })

  bot.on('message:text', handleTextMessage)

  bot.on('message:voice', async (ctx) => {
    const fileId = ctx.message.voice.file_id
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, fileId)
      const transcript = await transcribeAudio(localPath)
      await ctx.reply(`[Voice transcribed]: ${transcript}`)
      await handleMessage(ctx, `[Voice transcribed]: ${transcript}`, false)
    } catch (err) {
      logger.error({ err }, 'Voice handler error')
      await ctx.reply('Не удалось обработать голосовое сообщение.')
    }
  })

  bot.on('message:photo', async (ctx) => {
    const photos = ctx.message.photo
    const largest = photos[photos.length - 1]
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, largest.file_id)
      const raw = buildPhotoMessage(localPath, ctx.message.caption ?? undefined)
      const message = withForwardMeta(ctx, raw)
      const mgId = ctx.message.media_group_id
      if (mgId) {
        mediaGroupBatcher.add(`mg:${ctx.chat.id}:${mgId}`, { content: message, ctx })
      } else {
        await handleMessage(ctx, message)
      }
    } catch (err) {
      logger.error({ err }, 'Photo handler error')
      await ctx.reply('Не удалось обработать фото.')
    }
  })

  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, doc.file_id, doc.file_name ?? undefined)
      const raw = buildDocumentMessage(localPath, doc.file_name ?? 'file', ctx.message.caption ?? undefined)
      const message = withForwardMeta(ctx, raw)
      const mgId = ctx.message.media_group_id
      if (mgId) {
        mediaGroupBatcher.add(`mg:${ctx.chat.id}:${mgId}`, { content: message, ctx })
      } else {
        await handleMessage(ctx, message)
      }
    } catch (err) {
      logger.error({ err }, 'Document handler error')
      await ctx.reply('Не удалось обработать документ.')
    }
  })

  bot.on('message:audio', async (ctx) => {
    const a = ctx.message.audio
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, a.file_id, a.file_name ?? `audio.${a.mime_type?.split('/')[1] ?? 'mp3'}`)
      const raw = buildMediaMessage(localPath, a.file_name ?? 'audio.mp3', ctx.message.caption ?? undefined)
      const message = withForwardMeta(ctx, raw)
      const mgId = ctx.message.media_group_id
      if (mgId) {
        mediaGroupBatcher.add(`mg:${ctx.chat.id}:${mgId}`, { content: message, ctx })
      } else {
        await handleMessage(ctx, message)
      }
    } catch (err) {
      logger.error({ err }, 'Audio handler error')
      await ctx.reply('Не удалось обработать аудио.')
    }
  })

  bot.on('message:video', async (ctx) => {
    const v = ctx.message.video
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, v.file_id, v.file_name ?? `video.${v.mime_type?.split('/')[1] ?? 'mp4'}`)
      const raw = buildMediaMessage(localPath, v.file_name ?? 'video.mp4', ctx.message.caption ?? undefined)
      const message = withForwardMeta(ctx, raw)
      const mgId = ctx.message.media_group_id
      if (mgId) {
        mediaGroupBatcher.add(`mg:${ctx.chat.id}:${mgId}`, { content: message, ctx })
      } else {
        await handleMessage(ctx, message)
      }
    } catch (err) {
      logger.error({ err }, 'Video handler error')
      await ctx.reply('Не удалось обработать видео.')
    }
  })

  bot.on('message:video_note', async (ctx) => {
    const vn = ctx.message.video_note
    try {
      const localPath = await downloadMedia(TELEGRAM_BOT_TOKEN, vn.file_id, 'video_note.mp4')
      const message = buildMediaMessage(localPath, 'video_note.mp4')
      await handleMessage(ctx, message)
    } catch (err) {
      logger.error({ err }, 'VideoNote handler error')
      await ctx.reply('Не удалось обработать видеосообщение.')
    }
  })

  bot.catch((err) => {
    logger.error({ err }, 'Bot error')
  })

  return bot
}
