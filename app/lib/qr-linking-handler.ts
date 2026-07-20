import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Extract docSha256 from a QR deep-link.
 * Supports: rent_{bikeId}_{docSha256}
 */
function extractDocSha256(qrData: string): string | null {
  const parts = qrData.split('_');
  if (parts.length !== 3 || parts[0] !== 'rent') return null;
  const docSha256 = parts[2];
  if (!docSha256 || docSha256.length !== 64) return null;
  return docSha256;
}

/**
 * Claim a rental contract by scanning its QR code.
 * Uses the consolidated RPC `claim_rental_by_qr` for atomic 6-table propagation.
 *
 * QR format: rent_{bikeId}_{docSha256}
 *
 * @param qrData - The startapp parameter after "rent_"
 * @param chatId - The Telegram user's chat_id
 * @returns Result with success status or error
 */
export async function claimRentalByQRCode(
  qrData: string,
  chatId: string
): Promise<{
  success: boolean;
  error?: string;
  claimed?: boolean;
  rentalId?: string;
}> {
  // Validate QR format: rent_{bikeId}_{docSha256}
  const docSha256 = extractDocSha256(qrData);
  if (!docSha256) {
    return { success: false, error: 'INVALID_QR_FORMAT' };
  }

  try {
    // Single atomic RPC call replaces the old manual 3-table update
    const { data, error: rpcError } = await supabaseAdmin.rpc(
      'claim_rental_by_qr',
      {
        p_doc_sha256: docSha256,
        p_renter_chat_id: chatId,
      }
    );

    if (rpcError) {
      logger.error('[claimRental] RPC error:', rpcError);
      return { success: false, error: 'UPDATE_FAILED' };
    }

    const result = data as {
      success: boolean;
      rental_id: string | null;
      error: string | null;
      claimed_now: boolean;
    };

    if (!result.success) {
      logger.warn('[claimRental] RPC returned error:', result.error);
      return { success: false, error: result.error || 'EXCEPTION' };
    }

    logger.info('[claimRental] Successfully claimed:', {
      rentalId: result.rental_id,
      chatId,
      claimedNow: result.claimed_now,
    });

    return {
      success: true,
      claimed: result.claimed_now,
      rentalId: result.rental_id || undefined,
    };
  } catch (error) {
    logger.error('[claimRental] Exception:', error);
    return { success: false, error: 'EXCEPTION' };
  }
}

/**
 * Error code to Russian message mapping for UI display.
 */
export const QR_ERROR_MESSAGES: Record<string, string> = {
  DOCUMENT_NOT_FOUND: 'Документ не найден. Возможно, QR-код устарел.',
  NO_RENTAL_LINKED: 'Связь с арендой потеряна. Обратитесь к поддержке.',
  ALREADY_CLAIMED: 'Этот договор уже привязан к другому пользователю.',
  ALREADY_CLAIMED_BY_OTHER: 'Этот договор уже привязан к другому пользователю.',
  RENTAL_NOT_FOUND: 'Аренда не найдена в системе.',
  UPDATE_FAILED: 'Не удалось обновить данные. Попробуйте позже.',
  INVALID_QR_FORMAT: 'Неверный формат QR-кода.',
  INVALID_SHA256_FORMAT: 'Неверный формат SHA256 в QR-коде.',
  ARTIFACT_UPDATE_FAILED: 'Не удалось обновить метаданные документа.',
  MULTIPLE_DOCUMENTS: 'Найдено несколько документов с одинаковым хешем.',
  INVALID_RENTAL_ID: 'Неверный идентификатор аренды в документе.',
  CHAT_ID_MISMATCH: 'Невозможно привязать договор другого пользователя',
  EXCEPTION: 'Произошла ошибка. Попробуйте позже.',
};
