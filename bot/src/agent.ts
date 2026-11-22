import fs from 'node:fs/promises'
import path from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import {
  PROJECT_ROOT,
  ANTHROPIC_API_KEY,
  ANTHROPIC_AUTH_TOKEN,
  ANTHROPIC_BASE_URL,
  ANTHROPIC_MODEL,
  ANTHROPIC_DEFAULT_SONNET_MODEL,
  ANTHROPIC_DEFAULT_OPUS_MODEL,
  ANTHROPIC_DEFAULT_HAIKU_MODEL,
  TYPING_REFRESH_MS,
  CLAUDE_CODE_PATH,
} from './config.js'
import { logger } from './logger.js'

export type ProgressEvent =
  | { kind: 'init' }
  | { kind: 'tool'; tool: string; summary: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'done' }

function truncate(s: string, n: number): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Транзиентные перегрузки модели (429 / overloaded / 529) — стоит повторить с паузой.
// Auth-провалы (401), context overflow, битый ключ — НЕ ретраим (бесполезно).
function isRetryableOverload(msg: string): boolean {
  if (!msg) return false
  return /\b429\b|\b529\b|overloaded|rate[_ ]?limit|too many requests|service[_ ]?unavailable/i.test(msg)
}

const RETRY_BACKOFF_MS = [3000, 8000, 15000, 30000, 45000, 60000, 90000] // до 7 повторов (~4.2 мин) — переживаем волну 529 z.ai
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function basenameOnly(p: string): string {
  const s = String(p || '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

// Эвристический разбор bash-команды → человеческое описание.
// Применяется только если в input.description нет осмысленной строки.
function describeBashCommand(cmd: string): string {
  const c = cmd.trim()
  const first = c.split(/\s+/)[0] || ''
  // Часто встречающиеся паттерны
  if (/^B64=/.test(c) || /\bbase64\b/.test(c)) return 'Кодирую файл'
  if (/^curl\b.*-F\s+["']?file=@/.test(c)) return 'Загружаю файл'
  if (/^curl\b/.test(c)) return 'HTTP-запрос'
  if (/^wget\b/.test(c)) return 'Скачиваю по URL'
  if (/^kill\b/.test(c)) return 'Останавливаю процесс'
  if (/^rm\b/.test(c)) return 'Удаляю файлы'
  if (/^mkdir\b/.test(c)) return 'Создаю папку'
  if (/^cp\b/.test(c)) return 'Копирую файлы'
  if (/^mv\b/.test(c)) return 'Перемещаю файлы'
  if (/^cd\b/.test(c)) return 'Переход в папку'
  if (/^ls\b|^find\b/.test(c)) return 'Смотрю файлы'
  if (/^cat\b|^head\b|^tail\b|^less\b/.test(c)) return 'Читаю файл'
  if (/^grep\b|^rg\b|^ag\b/.test(c)) return 'Ищу по тексту'
  if (/^git\s+commit/.test(c)) return 'Git: коммит'
  if (/^git\s+push/.test(c)) return 'Git: пуш'
  if (/^git\s+pull/.test(c)) return 'Git: пулл'
  if (/^git\b/.test(c)) return 'Git-операция'
  if (/^npm\s+install|^pnpm\s+install|^yarn\s+install/.test(c)) return 'Ставлю зависимости'
  if (/^npm\s+run\s+build|^tsc\b|^vite\s+build/.test(c)) return 'Сборка проекта'
  if (/^python3?\s/.test(c)) return 'Запускаю Python'
  if (/^node\s/.test(c)) return 'Запускаю Node'
  if (/^ssh\b/.test(c)) return 'SSH-команда'
  if (/^rsync\b|^scp\b/.test(c)) return 'Синхронизация файлов'
  if (/^echo\b|^printf\b/.test(c)) return 'Готовлю текст'
  if (/^export\s|^env\b/.test(c)) return 'Настройка окружения'
  // Дефолт — короткое имя команды
  return first ? `Команда: ${first}` : 'Выполняю команду'
}

// MCP — мапинг известных action'ов на короткие русские названия.
function describeMcp(name: string, _input: any): string {
  // name = mcp__<server>__<action>
  const parts = name.replace(/^mcp__/, '').split('__')
  const server = parts[0] || 'mcp'
  const action = parts.slice(1).join('.').toUpperCase()
  // Composio
  if (server === 'composio') {
    if (/^COMPOSIO_(MULTI_)?EXECUTE_TOOL/.test(action)) return 'Composio: внешнее действие'
    if (/^COMPOSIO_REMOTE_WORKBENCH/.test(action))      return 'Composio: подбор инструмента'
    if (/^COMPOSIO_SEARCH_TOOLS/.test(action))          return 'Composio: ищу подходящий тулл'
    if (/^COMPOSIO_MANAGE_CONNECTIONS/.test(action))    return 'Composio: проверяю подключения'
    return 'Composio: запрос'
  }
  // Notion
  if (server === 'notionApi' || server === 'notion') {
    if (/SEARCH/.test(action))   return 'Notion: поиск'
    if (/CREATE|APPEND/.test(action)) return 'Notion: создаю запись'
    if (/UPDATE|PATCH/.test(action))  return 'Notion: правлю запись'
    if (/RETRIEVE|GET|QUERY/.test(action)) return 'Notion: читаю'
    return 'Notion: запрос'
  }
  // Playwright
  if (server === 'playwright') {
    if (/NAVIGATE/.test(action))   return 'Браузер: открываю страницу'
    if (/SCREENSHOT/.test(action)) return 'Браузер: скриншот'
    if (/CLICK|TYPE|FILL/.test(action)) return 'Браузер: действие на странице'
    return 'Браузер: действие'
  }
  // kie.ai
  if (server === 'kie-ai-mcp' || server === 'kie') {
    if (/IMAGE/.test(action)) return 'Генерирую картинку (kie.ai)'
    if (/VIDEO/.test(action)) return 'Генерирую видео (kie.ai)'
    if (/AUDIO|MUSIC/.test(action)) return 'Генерирую аудио (kie.ai)'
    return 'kie.ai: запрос'
  }
  return `${server}: ${truncate(action.toLowerCase(), 40)}`
}

function summarizeTool(name: string, input: any): string {
  if (!input || typeof input !== 'object') return name
  if (name === 'Read')  return `Читаю ${basenameOnly(input.file_path)}`
  if (name === 'Write') return `Пишу ${basenameOnly(input.file_path)}`
  if (name === 'Edit')  return `Правлю ${basenameOnly(input.file_path)}`
  if (name === 'Bash') {
    const desc = String(input.description || '').trim()
    // description от Claude обычно уже человеческое — используем его если есть
    if (desc && desc.length <= 60) return desc
    return describeBashCommand(String(input.command || ''))
  }
  if (name === 'Glob') return `Поиск файлов: ${truncate(String(input.pattern || ''), 50)}`
  if (name === 'Grep') return `Ищу по тексту: ${truncate(String(input.pattern || ''), 50)}`
  if (name === 'WebSearch') return `Поиск в сети: ${truncate(String(input.query || ''), 50)}`
  if (name === 'WebFetch')  return `Открываю URL: ${truncate(String(input.url || ''), 50)}`
  if (name === 'Task') {
    const sub = input.subagent_type || 'agent'
    return `Запускаю агента (${sub})`
  }
  if (name === 'Skill') return `Скилл: ${input.skill || input.name || '?'}`
  if (name === 'TodoWrite') {
    const n = Array.isArray(input.todos) ? input.todos.length : 0
    return `Обновляю план (${n})`
  }
  if (name.startsWith('mcp__')) return describeMcp(name, input)
  return name
}

// Превращает сырое сообщение об ошибке от Claude Code SDK в человекочитаемый текст для пользователя.
// Возвращает null если ошибку нужно показать generic-сообщением.
function formatUserFacingError(rawMsg: string): string | null {
  if (!rawMsg) return null
  // Z.AI / Anthropic 5-часовой usage cap
  // Пример: "API Error: Request rejected (429) · Usage limit reached for 5 hour. Your limit will reset at 2026-05-15 05:36:15"
  const usageLimit = rawMsg.match(/Usage limit reached(?:\s+for\s+(\d+)\s+hour)?.*?reset at\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/i)
  if (usageLimit) {
    const hours = usageLimit[1] || '5'
    const resetAt = usageLimit[2]
    return `Лимит модели исчерпан (${hours}-часовой кэп Z.AI). Сброс: ${resetAt} UTC. После этого продолжу.`
  }
  // Общий 429 без подробностей
  if (/\b429\b|rate[_ ]?limit|too many requests/i.test(rawMsg)) {
    return 'Лимит запросов исчерпан. Подожди несколько минут и попробуй снова.'
  }
  // Auth-провалы (битый ключ, истёк, нет квоты)
  if (/401|unauthorized|invalid[_ ]?api[_ ]?key|invalid[_ ]?credentials|insufficient[_ ]?quota/i.test(rawMsg)) {
    return 'API-ключ не работает (просрочен / квота исчерпана). Скажи Олегу подменить ключ в .env.'
  }
  // Сеть упала
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(rawMsg)) {
    return 'Сеть отвалилась при запросе к модели. Попробуй ещё раз через минуту.'
  }
  return null
}

export async function runAgent(
  message: string,
  sessionId?: string,
  onTyping?: () => void,
  modelOverride?: string,
  onProgress?: (event: ProgressEvent) => void,
  abortController?: AbortController,
): Promise<{ text: string | null; newSessionId?: string; aborted?: boolean; contextOverflow?: boolean; inputTokens?: number }> {
  // CLAUDE.md грузится в системный промпт через settingSources:['project'] (кэшируется, без дубля).
  // Здесь больше НЕ читаем CLAUDE.md — только лёгкий identity-якорь ниже (см. parts.push).
  const activeContext = await fs.readFile(
    path.join(PROJECT_ROOT, 'workspace', 'active-context.md'),
    'utf-8',
  ).catch(() => '')

  // Sticky rules — жёсткие правила, добавляемые владельцем через /remember.
  // В отличие от семантической `memories` — эти ВСЕГДА в системном промпте.
  const stickyRules = await fs.readFile(
    path.join(PROJECT_ROOT, 'workspace', 'agent-rules.md'),
    'utf-8',
  ).catch(() => '')

  const parts: string[] = []
  parts.push('Ты — персональный AI-ассистент владельца этого Telegram-бота. Твоя личность, правила, инструменты и стиль речи заданы в системных инструкциях (CLAUDE.md) — следуй им неукоснительно.')
  if (stickyRules.trim()) {
    parts.push(`---\nSTICKY RULES (workspace/agent-rules.md) — обязательны к исполнению в каждом ответе:\n\n${stickyRules}`)
  }
  if (activeContext.trim()) {
    parts.push(`---\nActive context (current state of work):\n\n${activeContext}`)
  }
  parts.push(`---\nUser message:\n${message}`)
  const fullMessage = parts.length > 1 ? parts.join('\n\n') : message

  const typingInterval = onTyping ? setInterval(onTyping, TYPING_REFRESH_MS) : undefined

  let text: string | null = null
  let newSessionId: string | undefined
  let inputTokens: number | undefined

  try {
    // Pass credentials via env so the claude CLI subprocess picks them up.
    // Two supported modes:
    //   (1) AITunnel/native: ANTHROPIC_AUTH_TOKEN set explicitly, ANTHROPIC_API_KEY MUST be empty
    //   (2) kie.ai legacy: ANTHROPIC_API_KEY contains the proxy key, mirror it into AUTH_TOKEN
    const envOverride: Record<string, string | undefined> = {
      ...process.env,
    }
    if (ANTHROPIC_AUTH_TOKEN) {
      envOverride['ANTHROPIC_AUTH_TOKEN'] = ANTHROPIC_AUTH_TOKEN
      envOverride['ANTHROPIC_API_KEY'] = ''
    } else if (ANTHROPIC_API_KEY) {
      envOverride['ANTHROPIC_AUTH_TOKEN'] = ANTHROPIC_API_KEY
    }
    if (ANTHROPIC_BASE_URL) envOverride['ANTHROPIC_BASE_URL'] = ANTHROPIC_BASE_URL
    if (ANTHROPIC_DEFAULT_SONNET_MODEL) envOverride['ANTHROPIC_DEFAULT_SONNET_MODEL'] = ANTHROPIC_DEFAULT_SONNET_MODEL
    if (ANTHROPIC_DEFAULT_OPUS_MODEL) envOverride['ANTHROPIC_DEFAULT_OPUS_MODEL'] = ANTHROPIC_DEFAULT_OPUS_MODEL
    if (ANTHROPIC_DEFAULT_HAIKU_MODEL) envOverride['ANTHROPIC_DEFAULT_HAIKU_MODEL'] = ANTHROPIC_DEFAULT_HAIKU_MODEL

    const options: Parameters<typeof query>[0]['options'] = {
      cwd: PROJECT_ROOT,
      resume: sessionId,
      settingSources: ['project', 'user'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      model: modelOverride || ANTHROPIC_MODEL || undefined,
      env: envOverride,
      pathToClaudeCodeExecutable: CLAUDE_CODE_PATH || undefined,
      abortController,
    }

    // Retry на транзиентные перегрузки модели (429/overloaded/529): максимум 2 повтора
    // с паузой (3с, 8с). Не зацикливаем — на не-retryable ошибке пробрасываем в outer catch.
    for (let attempt = 0; ; attempt++) {
      try {
        // Сброс накопителя перед попыткой — чтобы при ретрае не остался текст от упавшего стрима.
        text = null
        const stream = query({ prompt: fullMessage, options })

        for await (const event of stream) {
          if (event.type === 'system' && event.subtype === 'init') {
            newSessionId = event.session_id
            onProgress?.({ kind: 'init' })
          } else if (event.type === 'assistant') {
            const blocks = (event as any).message?.content
            if (Array.isArray(blocks)) {
              for (const block of blocks) {
                if (block?.type === 'tool_use') {
                  onProgress?.({ kind: 'tool', tool: block.name, summary: summarizeTool(block.name, block.input) })
                } else if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
                  onProgress?.({ kind: 'thinking', text: block.text.slice(0, 120) })
                }
              }
            }
          } else if (event.type === 'result') {
            onProgress?.({ kind: 'done' })
            const usage = (event as any).usage
            if (usage && typeof usage === 'object') {
              // input_tokens включает в себя cache_read и cache_creation. Это полный счёт окна.
              const inp = Number(usage.input_tokens) || 0
              const cacheRead = Number(usage.cache_read_input_tokens) || 0
              const cacheCreate = Number(usage.cache_creation_input_tokens) || 0
              inputTokens = inp + cacheRead + cacheCreate
            }
            if ('result' in event) {
              // SDKResultSuccess
              const rawResult = (event as any).result as string
              // Иногда SDK успешно возвращает result, но текст содержит "API Error: ..." — переформатируем
              const friendly = formatUserFacingError(rawResult)
              text = friendly ?? rawResult
            } else {
              // SDKResultError — surface the error type
              logger.error({ subtype: event.subtype }, 'agent returned error result')
              const errResult = (event as any).result as string | undefined
              // MED: перегрузка может прийти как result-event (не exception) — пробрасываем в catch → retry
              if (errResult && isRetryableOverload(errResult) && attempt < RETRY_BACKOFF_MS.length) {
                throw new Error(errResult)
              }
              const friendly = errResult ? formatUserFacingError(errResult) : null
              text = friendly ?? `Ошибка модели: ${event.subtype}`
            }
          }
        }
        break // стрим прошёл без исключения — выходим из retry-цикла
      } catch (streamErr) {
        // Abort — не ретраим, пробрасываем в outer catch (там корректный возврат aborted)
        if (abortController?.signal.aborted) throw streamErr
        const m = String((streamErr as any)?.message ?? streamErr ?? '')
        if (isRetryableOverload(m) && attempt < RETRY_BACKOFF_MS.length) {
          const wait = RETRY_BACKOFF_MS[attempt]
          logger.warn({ attempt: attempt + 1, waitMs: wait, err: m.slice(0, 200) }, 'runAgent: перегрузка модели, повтор')
          await sleep(wait)
          continue
        }
        throw streamErr // не-retryable или попытки исчерпаны → outer catch
      }
    }
  } catch (err) {
    if (abortController?.signal.aborted) {
      logger.info('runAgent aborted by user')
      return { text: null, newSessionId, aborted: true }
    }
    const errMsg = String((err as any)?.message ?? err ?? '')
    if (/context window limit|prompt[_ ]too[_ ]long|context.*exceed|context[_ ]too[_ ]large|input.*too long|413/i.test(errMsg)) {
      logger.warn({ err: errMsg }, 'runAgent context overflow — signaling caller for auto-compact retry')
      return { text: null, newSessionId, contextOverflow: true }
    }
    // Старая сессия не найдена в Claude CLI (бывает после миграции DB или ребилда CLI).
    // Сигналим caller: сбросить session_id и переотправить fresh — bot.ts реюзает auto-compact ветку.
    if (/No conversation found with session ID/i.test(errMsg)) {
      logger.warn({ err: errMsg }, 'runAgent: session not found in CLI — signaling caller for fresh-session retry')
      return { text: null, newSessionId, contextOverflow: true }
    }
    logger.error({ err }, 'runAgent failed')
    text = formatUserFacingError(errMsg) ?? 'Что-то отвалилось при запросе к модели. Попробуй снова.'
  } finally {
    if (typingInterval !== undefined) clearInterval(typingInterval)
  }

  return { text, newSessionId, inputTokens }
}
