import { readFileSync, copyFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readEnvFile } from './env.js'

const env = readEnvFile(['DEEPGRAM_API_KEY', 'DEEPGRAM_MODEL', 'DEEPGRAM_LANGUAGE', 'OPENAI_API_KEY', 'GROQ_API_KEY', 'GROQ_STT_MODEL', 'GROQ_PROXY'])
const DEEPGRAM_API_KEY = env['DEEPGRAM_API_KEY'] ?? ''
const DEEPGRAM_MODEL = env['DEEPGRAM_MODEL'] ?? 'nova-3'
const DEEPGRAM_LANGUAGE = env['DEEPGRAM_LANGUAGE'] ?? 'ru'
const OPENAI_API_KEY = env['OPENAI_API_KEY'] ?? ''
// Groq Whisper (бесплатный tier, тот же ключ что и OCR) — приоритетный STT.
const GROQ_API_KEY = env['GROQ_API_KEY'] ?? ''
const GROQ_STT_MODEL = env['GROQ_STT_MODEL'] ?? 'whisper-large-v3-turbo'
// MED: Groq геоблокирован из РФ-серверов — используем только если настроен прокси (GROQ_PROXY).
const GROQ_PROXY = env['GROQ_PROXY'] ?? ''

export async function transcribeAudio(filePath: string): Promise<string> {
  // Приоритет: Groq Whisper (только через прокси, РФ-геоблок) → Deepgram → OpenAI Whisper
  if (GROQ_API_KEY && GROQ_PROXY) {
    return transcribeWithGroq(filePath)
  }
  if (DEEPGRAM_API_KEY) {
    return transcribeWithDeepgram(filePath)
  }
  if (OPENAI_API_KEY) {
    return transcribeWithWhisper(filePath)
  }
  throw new Error('Не задан ни GROQ_API_KEY, ни DEEPGRAM_API_KEY, ни OPENAI_API_KEY')
}

/** Groq Whisper — OpenAI-совместимый аудио-эндпоинт (whisper-large-v3-turbo). */
async function transcribeWithGroq(filePath: string): Promise<string> {
  const audio = readFileSync(filePath)
  // Telegram voice = .oga (ogg/opus); Groq распознаёт по расширению — отдаём как .ogg
  let filename = path.basename(filePath)
  if (filename.endsWith('.oga')) filename = filename.replace(/\.oga$/, '.ogg')

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio)]), filename)
  form.append('model', GROQ_STT_MODEL)
  form.append('language', DEEPGRAM_LANGUAGE) // 'ru' по умолчанию (общая переменная языка)
  form.append('response_format', 'text')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: form,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq transcription failed (${response.status}): ${err}`)
  }
  const transcript = (await response.text()).trim()
  fs.unlink(filePath).catch(() => {}) // чистим аудио после расшифровки
  return transcript
}

async function transcribeWithDeepgram(filePath: string): Promise<string> {
  let audioPath = filePath
  let contentType = 'audio/ogg'

  if (filePath.endsWith('.oga')) {
    const oggPath = filePath.replace(/\.oga$/, '.ogg')
    copyFileSync(filePath, oggPath)
    audioPath = oggPath
  } else if (filePath.endsWith('.mp3')) {
    contentType = 'audio/mpeg'
  } else if (filePath.endsWith('.wav')) {
    contentType = 'audio/wav'
  } else if (filePath.endsWith('.m4a')) {
    contentType = 'audio/mp4'
  }

  const audio = readFileSync(audioPath)
  const url = new URL('https://api.deepgram.com/v1/listen')
  url.searchParams.set('model', DEEPGRAM_MODEL)
  url.searchParams.set('language', DEEPGRAM_LANGUAGE)
  url.searchParams.set('smart_format', 'true')
  url.searchParams.set('punctuate', 'true')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Token ${DEEPGRAM_API_KEY}`, 'Content-Type': contentType },
    body: audio,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Deepgram transcription failed (${response.status}): ${err}`)
  }

  const json = await response.json() as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> }
  }
  const transcript = json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  // Auto-delete original file (and .ogg copy if created) on success
  fs.unlink(filePath).catch(() => {})
  if (audioPath !== filePath) fs.unlink(audioPath).catch(() => {})
  return transcript
}

async function transcribeWithWhisper(filePath: string): Promise<string> {
  // OpenAI Whisper API supports ogg/mp3/wav/m4a/webm/mp4 directly
  const audio = readFileSync(filePath)
  const filename = path.basename(filePath)
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(audio)]), filename)
  form.append('model', 'whisper-1')
  form.append('language', DEEPGRAM_LANGUAGE)
  form.append('response_format', 'text')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: form,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Whisper transcription failed (${response.status}): ${err}`)
  }
  return (await response.text()).trim()
}

export function voiceCapabilities(): { stt: boolean; tts: boolean } {
  return {
    stt: !!GROQ_API_KEY || !!DEEPGRAM_API_KEY || !!OPENAI_API_KEY,
    tts: false,
  }
}
