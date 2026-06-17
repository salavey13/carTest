import { claimRentalByQRCode, QR_ERROR_MESSAGES } from './qr-linking-handler';
import { logger } from './logger';

/**
 * Handle Telegram WebApp startapp parameter.
 * Format: rent_{bikeId}_{docSha256}
 *
 * @param startParam - The startapp parameter from Telegram
 * @param chatId - User's Telegram chat_id
 * @returns Redirect path or null if not handled
 */
export async function handleStartappParam(
  startParam: string | null,
  chatId: string
): Promise<{ redirectPath: string | null; error?: string }> {
  if (!startParam) {
    return { redirectPath: null };
  }

  // Check if it's a rental QR code format: rent_{bikeId}_{docSha256}
  if (startParam.startsWith('rent_')) {
    const result = await claimRentalByQRCode(startParam, chatId);

    if (result.success) {
      logger.info('[startapp] QR claimed successfully:', result.rentalId);

      // Redirect to rental confirmation or catalog
      // For now, redirect to catalog with success message
      const rentalId = result.rentalId || 'unknown';
      return {
        redirectPath: `/franchize/vip-bike?claimed=${encodeURIComponent(rentalId)}`,
      };
    } else {
      const message =
        QR_ERROR_MESSAGES[result.error || 'EXCEPTION'] || 'Не удалось привязать договор';
      logger.warn('[startapp] QR claim failed:', result.error);

      return {
        redirectPath: `/franchize/vip-bike?error=${encodeURIComponent(message)}`,
        error: message,
      };
    }
  }

  // Add other startapp formats here in the future

  return { redirectPath: null };
}
