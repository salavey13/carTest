'use server';

import { claimRentalByQRCode, QR_ERROR_MESSAGES } from '@/app/lib/qr-linking-handler';
import { logger } from '@/lib/logger';

/**
 * Server action to claim a rental by QR code.
 * Called from the client when a user scans a QR code.
 */
export async function claimRentalByQRAction(qrData: string, chatId: string) {
  try {
    const result = await claimRentalByQRCode(qrData, chatId);

    if (result.success) {
      return {
        success: true,
        claimed: true,
        rentalId: result.rentalId,
        redirectPath: `/franchize/vip-bike?claimed=${result.rentalId}`,
      };
    } else {
      const message =
        QR_ERROR_MESSAGES[result.error || 'EXCEPTION'] || 'Не удалось привязать договор';
      return {
        success: false,
        error: result.error,
        message,
        redirectPath: `/franchize/vip-bike?error=${encodeURIComponent(message)}`,
      };
    }
  } catch (error) {
    logger.error('[claimRentalByQRAction] Exception:', error);
    return {
      success: false,
      error: 'EXCEPTION',
      message: QR_ERROR_MESSAGES.EXCEPTION,
      redirectPath: `/franchize/vip-bike?error=${encodeURIComponent(QR_ERROR_MESSAGES.EXCEPTION)}`,
    };
  }
}
