import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from './config.js'
import {
  getOnboardingRow,
  upsertOnboardingRow,
  deleteOnboardingRow,
} from './db.js'

// ─── Workspace dir (overridable via env for tests) ───────────────────────────

function getWorkspaceDir(): string {
  return process.env['KLOD_WORKSPACE_DIR'] ?? path.join(PROJECT_ROOT, 'workspace')
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OnboardingAnswers = {
  ownerName?: string
  assistantName?: string
  clientRole?: string
  clientDesc?: string
  connectedServices?: string[]
}

export type OnboardingState = {
  chatId: number
  currentStep: number
  answers: OnboardingAnswers
  updatedAt: number
}

// ─── FSM steps ───────────────────────────────────────────────────────────────

type StepField = keyof OnboardingAnswers

interface StepDef {
  field: StepField
  question: string
}

const STEPS: StepDef[] = [
  {
    field: 'ownerName',
    question: 'Как тебя зовут? (имя или псевдоним)',
  },
  {
    field: 'assistantName',
    question: 'Как будет зваться твой ассистент? (придумай имя)',
  },
  {
    field: 'clientRole',
    question: 'Чем ты занимаешься? (роль или сфера, кратко)',
  },
  {
    field: 'clientDesc',
    question: 'Что хочешь автоматизировать в первую очередь? (вкратце)',
  },
  {
    field: 'connectedServices',
    question:
      'Какие сервисы подключить?\n' +
      'Доступные: notion, gdrive, calendar, gmail\n' +
      'Введи через запятую или напиши "пропустить".',
  },
]

const VALID_SERVICES = new Set(['notion', 'googledrive', 'googlecalendar', 'gmail', 'googlesheets', 'googledocs'])
const MAX_SHORT_LEN = 50 // для имён

// ─── Validation ──────────────────────────────────────────────────────────────

type ValidationResult =
  | { valid: true; stringValue: string }
  | { valid: true; arrayValue: string[] }
  | { valid: false; error: string }

function validateStep(step: number, text: string): ValidationResult {
  const def = STEPS[step - 1]
  if (!def) return { valid: false, error: 'Неверный шаг.' }

  const trimmed = text.trim()

  if (def.field === 'connectedServices') {
    const lower = trimmed.toLowerCase()
    if (!trimmed || lower === 'пропустить' || lower === 'пропусти' || lower === '-') {
      return { valid: true, arrayValue: [] }
    }
    const parts = trimmed
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
    const unknown = parts.filter(s => !VALID_SERVICES.has(s))
    if (unknown.length > 0) {
      return {
        valid: false,
        error:
          `Неизвестные сервисы: ${unknown.join(', ')}.\n` +
          'Доступные: notion, gdrive, calendar, gmail - или напиши "пропустить".',
      }
    }
    return { valid: true, arrayValue: parts }
  }

  if (!trimmed) {
    return { valid: false, error: 'Ответ не может быть пустым - напиши что-нибудь.' }
  }

  if (
    (def.field === 'ownerName' || def.field === 'assistantName') &&
    trimmed.length > MAX_SHORT_LEN
  ) {
    return {
      valid: false,
      error: `Слишком длинное - максимум ${MAX_SHORT_LEN} символов. Напиши покороче.`,
    }
  }

  return { valid: true, stringValue: trimmed }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Текущее состояние онбординга для чата, или null если не начат. */
export function getOnboardingState(chatId: number): OnboardingState | null {
  const row = getOnboardingRow(chatId)
  if (!row) return null
  return {
    chatId,
    currentStep: row.current_step,
    answers: JSON.parse(row.answers) as OnboardingAnswers,
    updatedAt: row.updated_at,
  }
}

/** Начать онбординг - сбросить state и вернуть первый вопрос. */
export async function startOnboarding(chatId: number): Promise<string> {
  upsertOnboardingRow(chatId, 1, '{}')
  return STEPS[0]!.question
}

/**
 * Обработать ответ пользователя.
 * Если ответ невалиден - возвращает подсказку без продвижения шага.
 * Если все шаги пройдены - генерирует workspace/CLAUDE.md и .onboarded.
 */
export async function handleOnboardingMessage(
  chatId: number,
  text: string,
): Promise<{ reply: string; done: boolean }> {
  let state = getOnboardingState(chatId)

  // Если онбординг не начат - инициализируем и возвращаем первый вопрос
  if (!state) {
    const firstQ = await startOnboarding(chatId)
    return { reply: firstQ, done: false }
  }

  const { currentStep, answers } = state
  const validation = validateStep(currentStep, text)

  if (!validation.valid) {
    return { reply: validation.error, done: false }
  }

  // Применить ответ к текущему шагу
  const field = STEPS[currentStep - 1]!.field
  const newAnswers: OnboardingAnswers = { ...answers }

  if ('arrayValue' in validation) {
    newAnswers.connectedServices = validation.arrayValue
  } else {
    ;(newAnswers as Record<string, unknown>)[field] = validation.stringValue
  }

  const nextStep = currentStep + 1

  if (nextStep > STEPS.length) {
    // Все шаги пройдены
    upsertOnboardingRow(chatId, nextStep, JSON.stringify(newAnswers))
    generateClaudeMd(newAnswers)
    createOnboardedMarker(chatId)
    return { reply: 'Готово! Я готов работать.', done: true }
  }

  upsertOnboardingRow(chatId, nextStep, JSON.stringify(newAnswers))
  return { reply: STEPS[nextStep - 1]!.question, done: false }
}

/** Сбросить онбординг: удалить state из БД и удалить .onboarded. */
export function resetOnboarding(chatId: number): void {
  deleteOnboardingRow(chatId)
  const onboardedPath = path.join(getWorkspaceDir(), '.onboarded')
  try {
    fs.unlinkSync(onboardedPath)
  } catch {
    // файла не было - нормально
  }
}

/** Проверить, завершён ли онбординг (наличие флага .onboarded в workspace/). */
export function isOnboarded(): boolean {
  return fs.existsSync(path.join(getWorkspaceDir(), '.onboarded'))
}

// ─── Internal ────────────────────────────────────────────────────────────────

function generateClaudeMd(answers: OnboardingAnswers): void {
  const workspaceDir = getWorkspaceDir()
  const templatePath = path.join(workspaceDir, 'CLAUDE.template.md')
  const outPath = path.join(workspaceDir, 'CLAUDE.md')

  let content: string
  try {
    content = fs.readFileSync(templatePath, 'utf-8')
  } catch {
    // Шаблон не найден - пропустить генерацию CLAUDE.md
    return
  }

  const replacements: Record<string, string> = {
    '{{ASSISTANT_NAME}}': answers.assistantName ?? 'Ассистент',
    // Оба варианта именования владельца (текущий шаблон + возможный будущий)
    '{{CLIENT_NAME}}': answers.ownerName ?? 'Пользователь',
    '{{OWNER_NAME}}': answers.ownerName ?? 'Пользователь',
    '{{CLIENT_ROLE}}': answers.clientRole ?? '',
    '{{OWNER_ROLE}}': answers.clientRole ?? '',
    '{{CLIENT_DESCRIPTION}}': answers.clientDesc ?? '',
    '{{AUTOMATION_FOCUS}}': answers.clientDesc ?? '',
    '{{WORKSPACE_PATH}}': workspaceDir,
    '{{PROJECT_PATH}}': path.dirname(workspaceDir),
  }

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value)
  }

  fs.mkdirSync(workspaceDir, { recursive: true })
  fs.writeFileSync(outPath, content, 'utf-8')
}

function createOnboardedMarker(chatId: number): void {
  const workspaceDir = getWorkspaceDir()
  fs.mkdirSync(workspaceDir, { recursive: true })
  const data = JSON.stringify({ completedAt: new Date().toISOString(), chatId })
  fs.writeFileSync(path.join(workspaceDir, '.onboarded'), data, 'utf-8')
}
