import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
export const UPLOADS_DIR = path.join(PROJECT_ROOT, 'workspace', 'uploads')

// Связь VPS(РФ) ↔ api.telegram.org нестабильна: периодические ETIMEDOUT/ECONNRESET на коннекте.
// Один голый fetch = один флап роняет скачивание фото. Поэтому ретраим с backoff и per-attempt timeout.
const FETCH_TIMEOUT_MS = 25_000
const FETCH_RETRIES = 6
const RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000, 12000]

function isTransientNetErr(err: unknown): boolean {
  const code = (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code
  const name = (err as { name?: string })?.name
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  )
}

async function fetchWithRetry(url: string, label: string): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      return res
    } catch (err) {
      lastErr = err
      const transient = isTransientNetErr(err)
      const code = (err as { cause?: { code?: string }; name?: string })?.cause?.code
        ?? (err as { name?: string })?.name
      console.error(`[media] ${label} attempt ${attempt}/${FETCH_RETRIES} failed (${code ?? 'unknown'})`)
      if (!transient || attempt === FETCH_RETRIES) break
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1] ?? 1500))
    }
  }
  throw lastErr
}

export async function downloadMedia(botToken: string, fileId: string, originalFilename?: string): Promise<string> {
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  const getFileRes = await fetchWithRetry(getFileUrl, 'getFile')
  if (!getFileRes.ok) {
    throw new Error(`getFile failed (${getFileRes.status}): ${await getFileRes.text()}`)
  }
  const getFileJson = await getFileRes.json() as { result: { file_path: string } }
  const filePath = getFileJson.result.file_path

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`
  const downloadRes = await fetchWithRetry(downloadUrl, 'download')
  if (!downloadRes.ok) {
    throw new Error(`Download failed (${downloadRes.status}): ${await downloadRes.text()}`)
  }

  const rawName = originalFilename ?? path.basename(filePath)
  const sanitized = rawName.replace(/[^a-zA-Z0-9._-]/g, '-')
  const localPath = path.join(UPLOADS_DIR, `${Date.now()}_${sanitized}`)

  mkdirSync(UPLOADS_DIR, { recursive: true })

  const arrayBuffer = await downloadRes.arrayBuffer()
  writeFileSync(localPath, Buffer.from(arrayBuffer))

  return localPath
}

export function buildPhotoMessage(localPath: string, caption?: string): string {
  const captionPart = caption ? `\nПодпись пользователя: ${caption}` : ''
  return `Пользователь прислал фото. Файл скачан (абсолютный путь):\n${localPath}${captionPart}\n\n⛔ Если это документ клиента (паспорт/ВУ/прописка для договора) — НЕ открывай его через Read и НЕ читай зрением (неточно для юр-договора + утечка ПДн в стороннюю модель + раздувает контекст). Распознавай ТОЛЬКО модулем через скилл contract-agent (recognize.ts, gen-api). Чего не хватает для договора — спроси одним сообщением.\nТолько если это НЕ документ (например фото повреждения байка) и реально нужно посмотреть — тогда прочитай через Read tool.`
}

const AUDIO_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.opus', '.flac', '.aac', '.wma', '.amr']
const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.3gp', '.m4v']

function getExt(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i === -1 ? '' : filename.slice(i).toLowerCase()
}

export function isAudioFile(filename: string): boolean {
  return AUDIO_EXTS.includes(getExt(filename))
}
export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTS.includes(getExt(filename))
}

export function buildDocumentMessage(localPath: string, filename: string, caption?: string): string {
  const captionPart = caption ? `\nПодпись пользователя: ${caption}` : ''
  if (isAudioFile(filename) || isVideoFile(filename)) {
    return buildMediaMessage(localPath, filename, caption)
  }
  return `Пользователь прислал документ "${filename}". Прочитай его через Read tool:\n${localPath}${captionPart}\n\nПосле прочтения ответь по сути.`
}

export function buildMediaMessage(localPath: string, filename: string, caption?: string): string {
  const kind = isVideoFile(filename) ? 'видео' : 'аудио'
  const captionPart = caption ? `\nПодпись пользователя: ${caption}` : ''
  return `Пользователь прислал ${kind}-файл "${filename}". Файл скачан: ${localPath}

Это бинарный медиа-файл — Read tool с ним не работает.
Если пользователь хочет транскрипцию (расшифровку, текст из записи) — используй скилл transcribe-file через Bash (он в workspace/skills/transcribe-file.md).
Если просто просит послушать/посмотреть без транскрипции — сообщи что прямого «прослушивания» нет, можешь только транскрибировать.${captionPart}`
}

export function buildVideoMessage(localPath: string, caption?: string): string {
  return buildMediaMessage(localPath, 'video.mp4', caption)
}

export function cleanupOldUploads(maxAgeMs = 86400000): void {
  const now = Date.now()
  let files: string[]
  try {
    files = readdirSync(UPLOADS_DIR)
  } catch {
    return
  }
  for (const file of files) {
    const full = path.join(UPLOADS_DIR, file)
    try {
      const stat = statSync(full)
      if (now - stat.mtimeMs > maxAgeMs) unlinkSync(full)
    } catch {
      // skip files that disappeared between readdir and stat
    }
  }
}
