'use server';

import { claimRentalByQRCode, QR_ERROR_MESSAGES } from '@/app/lib/qr-linking-handler';
import { logger } from '@/lib/logger';

/**
 * Server action to claim a rental by QR code.
 * Called from the client when a user scans a QR code.
 */
export async function claimRentalByQRAction(qrData: string, chatId: string, actorUserId?: string) {
  // Authorization check: verify chatId matches the authenticated user
  if (actorUserId && chatId !== actorUserId) {
    return {
      success: false,
      error: 'CHAT_ID_MISMATCH',
      message: 'Невозможно привязать договор другого пользователя',
      redirectPath: '/franchize/vip-bike?error=auth_mismatch',
    };
  }

  try {
    const result = await claimRentalByQRCode(qrData, chatId);

    if (result.success) {
      // Add null check for rentalId
      const rentalId = result.rentalId || 'unknown';
      return {
        success: true,
        claimed: true,
        rentalId,
        redirectPath: `/franchize/vip-bike?claimed=${encodeURIComponent(rentalId)}`,
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
    const exceptionMessage = QR_ERROR_MESSAGES.EXCEPTION;
    return {
      success: false,
      error: 'EXCEPTION',
      message: exceptionMessage,
      redirectPath: `/franchize/vip-bike?error=${encodeURIComponent(exceptionMessage)}`,
    };
  }
}
