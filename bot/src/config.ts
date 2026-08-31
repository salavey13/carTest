import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readEnvFile } from './env.js'

const __filename = fileURLToPath(import.meta.url)
export const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..')
export const STORE_DIR = path.join(PROJECT_ROOT, 'store')
export const UPLOADS_DIR = path.join(PROJECT_ROOT, 'workspace', 'uploads')

const env = readEnvFile()

export const TELEGRAM_BOT_TOKEN = env['TELEGRAM_BOT_TOKEN'] ?? ''
export const ALLOWED_CHAT_ID = env['ALLOWED_CHAT_ID'] ?? ''
export const ANTHROPIC_API_KEY = env['ANTHROPIC_API_KEY'] ?? ''
export const ANTHROPIC_AUTH_TOKEN = env['ANTHROPIC_AUTH_TOKEN'] ?? ''
export const ANTHROPIC_BASE_URL = env['ANTHROPIC_BASE_URL'] ?? ''
export const ANTHROPIC_MODEL = env['ANTHROPIC_MODEL'] ?? 'glm-5.1'
export const ANTHROPIC_DEFAULT_SONNET_MODEL = env['ANTHROPIC_DEFAULT_SONNET_MODEL'] ?? ''
export const ANTHROPIC_DEFAULT_OPUS_MODEL = env['ANTHROPIC_DEFAULT_OPUS_MODEL'] ?? ''
export const ANTHROPIC_DEFAULT_HAIKU_MODEL = env['ANTHROPIC_DEFAULT_HAIKU_MODEL'] ?? ''
export const CLAUDE_CODE_PATH = env['CLAUDE_CODE_PATH'] ?? ''
export const NOTES_DIR_NAME = env['NOTES_DIR_NAME'] ?? 'notes'
export const GROQ_API_KEY = env['GROQ_API_KEY'] ?? ''
export const COMPOSIO_API_KEY = env['COMPOSIO_API_KEY'] ?? ''
export const COMPOSIO_USER_ID = env['COMPOSIO_USER_ID'] ?? 'default'
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000
// Превентивный сброс сессии: если суммарный input окна (input + cache_read + cache_creation)
// превысил порог — после успешного ответа делаем clearSession.
// Memories DB + workspace/active-context.md + sticky-rules сохраняют домен и стиль речи.
// Для 200K моделей разумно 150K (75%), для 1M — 800K. Переопределяется через .env.
export const PRECOMPACT_INPUT_TOKENS = Number(env['PRECOMPACT_INPUT_TOKENS'] ?? 150000)

// Model registry — what users can switch between via /model.
// `provider: claude` works directly through claude-agent-sdk + ANTHROPIC_BASE_URL.
// `provider: openai` is NOT supported yet (kie.ai gpt uses /codex/v1/responses, different protocol).
export type ModelEntry = {
  id: string          // exact name to pass to claude CLI
  label: string       // human-readable
  provider: 'claude' | 'openai'
  supported: boolean
}

export const MODELS: ModelEntry[] = [
  { id: 'glm-5.1',     label: 'GLM 5.1 (умный, дефолт)',        provider: 'claude', supported: true },
  { id: 'glm-5-turbo', label: 'GLM 5 Turbo (быстрый)',          provider: 'claude', supported: true },
  { id: 'glm-4.5-air', label: 'GLM 4.5 Air (лёгкий, дешёвый)',  provider: 'claude', supported: true },
]

export function findModel(id: string): ModelEntry | undefined {
  return MODELS.find(m => m.id === id)
}

export const NOTION_TARGETS = {
  root:      env['NOTION_ROOT_PAGE_ID']       ?? '',
  posts:     env['NOTION_POSTS_PAGE_ID']      ?? '',
  carousels: env['NOTION_CAROUSELS_PAGE_ID']  ?? '',
  reports:   env['NOTION_REPORTS_PAGE_ID']    ?? '',
  notes:     env['NOTION_NOTES_PAGE_ID']      ?? '',
}

export const DRIVE_TARGETS = {
  root:      env['DRIVE_ROOT_FOLDER_ID']      ?? '',
  posts:     env['DRIVE_POSTS_FOLDER_ID']     ?? '',
  carousels: env['DRIVE_CAROUSELS_FOLDER_ID'] ?? '',
  images:    env['DRIVE_IMAGES_FOLDER_ID']    ?? '',
  videos:    env['DRIVE_VIDEOS_FOLDER_ID']    ?? '',
  reports:   env['DRIVE_REPORTS_FOLDER_ID']   ?? '',
  notes:     env['DRIVE_NOTES_FOLDER_ID']     ?? '',
}
