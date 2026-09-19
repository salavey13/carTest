import { supabaseAdmin } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from '@/lib/telegram-actor-cookie';

// Query-param driven GET (reads request.url) → never statically prerender.
export const dynamic = "force-dynamic";

/**
 * GET /api/my/bookings — бронирования ТЕКУЩЕГО пользователя.
 *
 * SECURITY (fix 2026-09-20, wall v5 codereview): the previous version took a
 * client-supplied `?userId=` and ran a SECURITY DEFINER RPC with it — any
 * anonymous caller could read ANY user's rentals (costs, statuses, delivery
 * address). Identity now comes ONLY from the server-verified Telegram actor
 * cookie (the same signed HMAC cookie the franchize wall uses; issued by
 * /api/validate-telegram-auth after initData verification). The `userId`
 * query param is accepted for URL compatibility but IGNORED unless it matches
 * the verified identity. An `initData` fallback keeps parity with the wall's
 * other endpoints for browsers that block third-party cookies.
 *
 * The RPC itself is locked to service_role since migration
 * 20260920050000_rpc_lockdown_anon.sql — hence the admin client here.
 */
export async function GET(request: Request) {
  // ── Identity: signed cookie first, initData fallback (wall parity) ──
  const cookieJar = request.headers.get('cookie') || '';
  const cookieMatch = cookieJar
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${TELEGRAM_ACTOR_COOKIE}=`));
  let cookieValue: string | undefined;
  if (cookieMatch) {
    const raw = cookieMatch.slice(TELEGRAM_ACTOR_COOKIE.length + 1);
    try {
      // Next sets cookies with the `cookie` serializer (encodeURIComponent) —
      // decode back; a malformed value must 401, not crash with a 500.
      cookieValue = decodeURIComponent(raw);
    } catch {
      cookieValue = raw;
    }
  }
  const callerUserId = verifyTelegramActorCookieValue(cookieValue);

  let userId = callerUserId;

  if (!userId) {
    const { searchParams } = new URL(request.url);
    const initData = searchParams.get('initData');
    if (initData && initData.trim().length > 0) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        try {
          const { computeTelegramWebAppHash, isTelegramInitDataFresh } = await import(
            '@/lib/telegram-webapp-auth'
          );
          const validation = await computeTelegramWebAppHash(initData, botToken);
          const parsed =
            validation.isValid && isTelegramInitDataFresh(initData)
              ? (await import('@/app/franchize/lib/community-wall')).parseTelegramInitDataUser(initData)
              : null;
          if (parsed) userId = parsed.id;
        } catch (err) {
          logger.warn('[GET /api/my/bookings] initData resolution failed:', err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  if (!userId) {
    logger.warn('[GET /api/my/bookings] Unauthenticated request rejected.');
    return NextResponse.json({ error: 'Unauthorized — нужен вход через Telegram WebApp.' }, { status: 401 });
  }

  // URL-compat: a client-passed userId is allowed ONLY when it matches the
  // verified identity (it can only ever narrow, never widen, the result).
  const requested = new URL(request.url).searchParams.get('userId');
  if (requested && requested !== userId) {
    logger.warn('[GET /api/my/bookings] userId param does not match verified identity — rejected.');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_user_rentals_dashboard_new', {
      p_user_id: userId,
      p_minimal: false,
    });

    if (error) {
      logger.error('[GET /api/my/bookings] RPC error:', error.message);
      // Generic message to the client; details stay in the logs.
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('[GET /api/my/bookings] Unexpected error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
