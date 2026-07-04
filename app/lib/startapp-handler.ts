import { claimRentalByQRCode, QR_ERROR_MESSAGES } from './qr-linking-handler';
import { logger } from './logger';
import {
  decodeStartappState,
  isStartappStateFresh,
  type StartappState,
} from './startapp-state';

/**
 * Result of handling a startapp param — tells the caller what to do next.
 */
export interface StartappResult {
  /** Where to redirect the user, or null if the param should be ignored. */
  redirectPath: string | null;
  /** Optional structured state (for cart_ prefix payloads). */
  state?: StartappState;
  /** Human-readable error if something went wrong. */
  error?: string;
}

/**
 * Handle Telegram WebApp startapp parameter.
 *
 * Supported formats:
 *  - `rent_{bikeId}_{docSha256}` — legacy QR-claim format
 *  - `cart_<base64url(json)>` — new structured state (see startapp-state.ts)
 *
 * @param startParam - The startapp parameter from Telegram
 * @param chatId - User's Telegram chat_id (unused for state payloads, kept for
 *                 backwards-compat with the legacy `rent_` flow)
 */
export async function handleStartappParam(
  startParam: string | null,
  chatId: string
): Promise<StartappResult> {
  if (!startParam) {
    return { redirectPath: null };
  }

  // ── New: structured state payload from the bot ─────────────────────────
  // Format: `cart_<base64url(JSON)>` — see app/lib/startapp-state.ts
  const state = decodeStartappState(startParam);
  if (state) {
    if (!isStartappStateFresh(state)) {
      logger.warn('[startapp] state payload expired', { bikeId: state.bikeId });
      return {
        redirectPath: `/franchize/vip-bike?startapp_expired=1&bikeId=${encodeURIComponent(state.bikeId)}`,
        error: 'Сессия истекла — выберите параметры заново',
      };
    }
    logger.info('[startapp] structured state received', { type: state.type, bikeId: state.bikeId });

    // Redirect to the catalog with the state as a query param so the
    // client can consume it. The catalog will then pre-fill the cart and
    // skip steps the bot already covered.
    const params = new URLSearchParams({
      startappState: startParam,
      startappBikeId: state.bikeId,
    });
    if (state.startDate) params.set('startDate', state.startDate);
    if (state.endDate) params.set('endDate', state.endDate);
    if (state.startTime) params.set('startTime', state.startTime);
    if (state.endTime) params.set('endTime', state.endTime);
    if (state.helmetCount) params.set('helmetCount', String(state.helmetCount));
    if (state.package) params.set('package', state.package);
    if (state.perk) params.set('perk', state.perk);
    if (state.color) params.set('color', state.color);
    if (state.optionId) params.set('optionId', state.optionId);
    return {
      redirectPath: `/franchize/vip-bike?${params.toString()}`,
      state,
    };
  }

  // ── Legacy: rental QR code format: rent_{bikeId}_{docSha256} ───────────
  if (startParam.startsWith('rent_')) {
    const result = await claimRentalByQRCode(startParam, chatId);

    if (result.success) {
      logger.info('[startapp] QR claimed successfully:', result.rentalId);
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

  return { redirectPath: null };
}
