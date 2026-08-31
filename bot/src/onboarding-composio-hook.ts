import { logger } from './logger.js'
import { getOAuthUrl, isValidService, type ComposioService } from './composio.js'

/**
 * Добавляет OAuth-ссылки к финальному сообщению онбординга.
 *
 * Вызывается из bot.ts ПОСЛЕ того как handleOnboardingMessage вернул done=true
 * и если answers.connectedServices не пустой.
 *
 * Пример использования в bot.ts:
 *   const { reply, done } = await handleOnboardingMessage(chatId, text)
 *   if (done) {
 *     const finalReply = await appendOAuthLinks(chatId, reply, state.answers.connectedServices ?? [])
 *     await ctx.reply(finalReply)
 *   }
 */
export async function appendOAuthLinks(
  chatId: number,
  baseReply: string,
  services: string[],
): Promise<string> {
  if (!services.length) return baseReply

  const lines: string[] = []
  for (const svc of services) {
    if (!isValidService(svc)) {
      logger.warn({ chatId, svc }, 'appendOAuthLinks: unknown service, skipping')
      continue
    }
    try {
      const url = await getOAuthUrl(svc as ComposioService, chatId)
      lines.push(`${svc}: ${url}`)
    } catch (err) {
      logger.warn({ err, chatId, svc }, 'getOAuthUrl failed during onboarding — skipping service')
    }
  }

  if (!lines.length) return baseReply
  return `${baseReply}\n\nПодключить сервисы:\n${lines.join('\n')}`
}
