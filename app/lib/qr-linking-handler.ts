import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Claim a rental contract by scanning its QR code.
 * Links the contract to the scanning user in all three tables.
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
  const parts = qrData.split('_');
  if (parts.length !== 3 || parts[0] !== 'rent') {
    return {
      success: false,
      error: 'INVALID_QR_FORMAT',
    };
  }

  const [, bikeId, docSha256] = parts;

  if (!docSha256 || docSha256.length !== 64) {
    return {
      success: false,
      error: 'INVALID_SHA256_FORMAT',
    };
  }

  try {
    // Lookup artifact by SHA256
    const { data: artifact, error: lookupError } = await supabaseAdmin
      .schema('private')
      .from('rental_contract_artifacts')
      .select('*')
      .eq('original_sha256', docSha256)
      .maybeSingle();

    if (lookupError || !artifact) {
      logger.error('[claimRental] Lookup failed:', lookupError);
      return { success: false, error: 'DOCUMENT_NOT_FOUND' };
    }

    // Check if this artifact has a rental_id
    if (!artifact.rental_id) {
      logger.warn('[claimRental] Artifact has no rental_id:', artifact.contract_key);
      return { success: false, error: 'NO_RENTAL_LINKED' };
    }

    // Get the rental to check current user_id
    const { data: rental } = await supabaseAdmin
      .from('rentals')
      .select('user_id, owner_id, status')
      .eq('rental_id', artifact.rental_id)
      .maybeSingle();

    if (!rental) {
      return { success: false, error: 'RENTAL_NOT_FOUND' };
    }

    // Security check: is this still owned by crew owner (unclaimed)?
    // Check if user_id != owner_id means it's already been claimed
    // NOTE: This check is not atomic with the update below. A race condition exists
    // where two concurrent requests could both pass this check and both attempt to
    // update. Proper fix requires a database RPC with row-level locking or transaction.
    if (rental.user_id !== rental.owner_id) {
      logger.warn('[claimRental] Already claimed:', {
        rentalId: artifact.rental_id,
        currentUserId: rental.user_id,
        ownerId: rental.owner_id,
      });
      return { success: false, error: 'ALREADY_CLAIMED' };
    }

    // Perform 3-table update in a transaction-like sequence
    // 1. Update rentals.user_id
    // 2. Update rental_contract_artifacts.telegram_chat_id
    // 3. Update user_rental_secrets.chat_id
    // NOTE: Proper transaction requires database RPC. Rollback implemented for step 2 failure.

    const { error: updateError } = await supabaseAdmin
      .from('rentals')
      .update({ user_id: chatId })
      .eq('rental_id', artifact.rental_id)
      .eq('user_id', rental.owner_id) // Safety: only if still owned by owner
      .select('rental_id')
      .maybeSingle();

    if (updateError) {
      logger.error('[claimRental] Failed to update rentals:', updateError);
      return { success: false, error: 'UPDATE_FAILED' };
    }

    // Update artifact
    const { error: artifactError } = await supabaseAdmin
      .schema('private')
      .from('rental_contract_artifacts')
      .update({ telegram_chat_id: chatId })
      .eq('original_sha256', docSha256)
      .eq('rental_id', artifact.rental_id);

    if (artifactError) {
      logger.error('[claimRental] Failed to update artifact:', artifactError);
      // Rollback: revert rentals.user_id update
      await supabaseAdmin
        .from('rentals')
        .update({ user_id: rental.owner_id })
        .eq('rental_id', artifact.rental_id);
      return { success: false, error: 'ARTIFACT_UPDATE_FAILED' };
    }

    // Update user_rental_secrets with rental_id correlation
    const { error: secretsError } = await supabaseAdmin
      .schema('private')
      .from('user_rental_secrets')
      .update({ chat_id: chatId })
      .eq('doc_sha256', docSha256)
      .eq('rental_id', artifact.rental_id);  // Add rental_id correlation

    if (secretsError) {
      logger.error('[claimRental] Failed to update secrets:', secretsError);
      // Non-critical: don't rollback for secrets update failure, but log it
    }

    logger.info('[claimRental] Successfully claimed:', {
      rentalId: artifact.rental_id,
      chatId,
      bikeId,
    });

    return {
      success: true,
      claimed: true,
      rentalId: artifact.rental_id,
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
  RENTAL_NOT_FOUND: 'Аренда не найдена в системе.',
  UPDATE_FAILED: 'Не удалось обновить данные. Попробуйте позже.',
  INVALID_QR_FORMAT: 'Неверный формат QR-кода.',
  INVALID_SHA256_FORMAT: 'Неверный формат SHA256 в QR-коде.',
  ARTIFACT_UPDATE_FAILED: 'Не удалось обновить метаданные документа.',
  CHAT_ID_MISMATCH: 'Невозможно привязать договор другого пользователя',
  EXCEPTION: 'Произошла ошибка. Попробуйте позже.',
};
