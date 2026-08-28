"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { debugLogger as logger } from "@/lib/debugLogger";
import { setReferrer } from "@/app/bio30/ref_actions";
import { applyReferralCode } from "@/app/wblanding/actions_view";
import { consumeTempFranchizeCartAction } from "@/contexts/actions";
import { isMockUserModeEnabled } from "@/lib/mockUserMode";
import {
  decodeStartappState,
  isStartappStateFresh,
} from "@/lib/startapp-state";
import { upsertFranchizeLead } from "@/app/franchize/lib/leads";

const START_PARAM_PAGE_MAP: Record<string, string> = {
  elon: "/elon",
  musk_market: "/elon",
  arbitrage_seeker: "/elon",
  topdf_psycho: "/topdf",
  settings: "/settings",
  profile: "/profile",
  sauna: "/sauna-rent",
  streamer: "/streamer",
  demo: "/about_en",
  wb: "/wblanding",
  wb_dashboard: "/wblanding",
  "audit-tool": "/wblanding",
  // Route create_crew deep link directly to the inline "Создать экипаж" tab
  // on /franchize/create. That tab calls createCrew() and then transitions
  // to the customization editor for the new crew. No more /wblanding bounce.
  create_crew: "/franchize/create#create-crew-form",
  reports: "/wblanding",
  crews: "/crews",
  "repo-xml": "/repo-xml",
  "style-guide": "/style-guide",
  "start-training": "/selfdev/gamified",
  paddock: "/paddock",
  leaderboard: "/leaderboard",
  "rent-bike": "/franchize/vip-bike",
};

const BIO30_PRODUCT_PATHS: Record<string, string> = {
  cordyceps: "/bio30/categories/cordyceps-sinensis",
  spirulina: "/bio30/categories/spirulina-chlorella",
  "lions-mane": "/bio30/categories/lion-s-mane",
  "lion-s-mane": "/bio30/categories/lion-s-mane",
  magnesium: "/bio30/categories/magnesium-pyridoxine",
  "cordyceps-sinensis": "/bio30/categories/cordyceps-sinensis",
  "spirulina-chlorella": "/bio30/categories/spirulina-chlorella",
  "magnesium-pyridoxine": "/bio30/categories/magnesium-pyridoxine",
};

/**
 * Parse a rent_ deep-link parameter into its components.
 *
 * Formats:
 *   rent_{bikeId}              → standard rent (no QR, no doc hash)
 *   rent_{bikeId}_{docSha256}  → QR deep-link with doc hash for 1-click next rent
 *
 * Returns null if the param doesn't start with "rent_".
 */
function parseRentDeepLink(param: string): { bikeId: string; docSha256: string | null } | null {
  if (!param.startsWith("rent_")) return null;

  const afterPrefix = param.slice(5); // everything after "rent_"
  if (!afterPrefix) return null;

  // Split on "_" — bike IDs use hyphens, sha256 is hex; neither contains "_"
  // "kawasaki-ex650k_abc123def" → ["kawasaki-ex650k", "abc123def"]
  // "kawasaki-ex650k"          → ["kawasaki-ex650k"]
  const parts = afterPrefix.split("_");
  const bikeId = parts[0].trim().toLowerCase();
  if (!bikeId) return null;

  // SHA256 hex is 64 chars, but accept any non-empty second segment
  const docSha256 = parts.length > 1 && parts[1].trim() ? parts[1].trim() : null;

  return { bikeId, docSha256 };
}

/**
 * Parse a testdrive_ deep-link parameter.
 *
 * Format:
 *   testdrive_{bikeId}_{docSha256}  → QR deep-link from /testdrive command
 *
 * Returns null if the param doesn't start with "testdrive_".
 * Mirrors parseRentDeepLink but for the testdrive flow (separate table +
 * separate claim RPC).
 */
function parseTestdriveDeepLink(param: string): { bikeId: string; docSha256: string | null } | null {
  if (!param.startsWith("testdrive_")) return null;

  const afterPrefix = param.slice(10); // everything after "testdrive_"
  if (!afterPrefix) return null;

  // Split on "_" — bike IDs use hyphens, sha256 is hex; neither contains "_"
  const parts = afterPrefix.split("_");
  const bikeId = parts[0].trim().toLowerCase();
  if (!bikeId) return null;

  const docSha256 = parts.length > 1 && parts[1].trim() ? parts[1].trim() : null;

  return { bikeId, docSha256 };
}

/**
 * Parse a lead_ deep-link parameter.
 *
 * Formats:
 *   lead_{userId}           → open leads page with this lead's detail drawer
 *   leads_{segment}         → open leads page pre-filtered (hot|warm|verified|troubled)
 *
 * Returns null if the param doesn't match.
 */
function parseLeadDeepLink(param: string): { leadId?: string; segment?: string } | null {
  // lead_{userId} — specific lead detail
  if (param.startsWith("lead_") && !param.startsWith("leads_")) {
    const leadId = param.slice(5).trim();
    if (!leadId) return null;
    return { leadId };
  }

  // leads_{segment} — pre-filtered list
  if (param.startsWith("leads_")) {
    const segment = param.slice(6).trim().toLowerCase();
    const validSegments = ["hot", "warm", "verified", "troubled", "all"];
    if (segment && validSegments.includes(segment)) {
      return { segment };
    }
  }

  return null;
}

/**
 * Parse a rental_ deep-link parameter (for analytics page, NOT the rent_ QR link).
 *
 * Formats:
 *   rental_{rentalId}  → open analytics page with this rental's detail drawer
 *
 * Returns null if the param doesn't start with "rental_".
 */
function parseRentalDetailDeepLink(param: string): { rentalId: string } | null {
  if (!param.startsWith("rental_")) return null;
  const rentalId = param.slice(7).trim();
  if (!rentalId) return null;
  return { rentalId };
}

/**
 * Parse an analytics_ deep-link parameter.
 *
 * Formats:
 *   analytics_{tab}              → open analytics on a specific tab (rentals|sales|services)
 *   analytics_{tab}_{date}       → open analytics on a specific tab + date
 *   analytics_rental_{rentalId}  → open analytics rentals tab with rental detail
 *   analytics_sale_{saleId}      → open analytics sales tab with sale detail
 *
 * Returns null if the param doesn't start with "analytics_".
 */
function parseAnalyticsDeepLink(param: string): {
  tab?: string;
  date?: string;
  rentalId?: string;
  saleId?: string;
} | null {
  if (!param.startsWith("analytics_")) return null;
  const rest = param.slice(10); // after "analytics_"

  // analytics_rental_{rentalId}
  if (rest.startsWith("rental_")) {
    return { tab: "rentals", rentalId: rest.slice(7) };
  }

  // analytics_sale_{saleId}
  if (rest.startsWith("sale_")) {
    return { tab: "sales", saleId: rest.slice(5) };
  }

  // analytics_{tab}_{date} — e.g. analytics_rentals_2026-07-24
  const dateMatch = rest.match(/^(rentals|sales|services)_(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return { tab: dateMatch[1], date: dateMatch[2] };
  }

  // analytics_{tab} — e.g. analytics_rentals
  if (["rentals", "sales", "services"].includes(rest)) {
    return { tab: rest };
  }

  return null;
}

export function useStartParamRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    startParamPayload,
    dbUser,
    userCrewInfo,
    refreshDbUser,
    isLoading: isAppLoading,
    isAuthenticating,
    clearStartParam,
  } = useAppContext();
  const { success: showToast } = useAppToast();

  const activeStartParamRef = useRef<string | null>(null);
  const lastHandledStartParamRef = useRef<string | null>(null);
  const startParamRunIdRef = useRef(0);
  const mountedRef = useRef(false);
  const consumedTempCartRef = useRef<string | null>(null);
  const ignoredUrlStartParamRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleBio30Referral = useCallback(
    async (referrerId: string, referrerCode: string) => {
      if (!dbUser?.user_id || dbUser.metadata?.referrer_id) {
        return;
      }

      try {
        const result = await setReferrer({
          userId: dbUser.user_id,
          referrerId,
          referrerCode,
        });

        if (result.success) {
          logger.info(`[ClientLayout] Referral set for user ${dbUser.user_id} to referrer ${referrerId}`);
          await refreshDbUser();
        } else {
          logger.error(`[ClientLayout] Failed to set referrer for user ${dbUser.user_id}: ${result.error}`);
        }
      } catch (error) {
        logger.error("[ClientLayout] Error setting referrer:", error);
      }
    },
    [dbUser, refreshDbUser],
  );

  const handleSyndicateReferral = useCallback(
    async (refCode: string) => {
      if (!dbUser?.user_id || dbUser.metadata?.referrer) {
        return;
      }

      logger.info(`[Syndicate] Attempting to link referrer: ${refCode}`);
      const res = await applyReferralCode(dbUser.user_id, refCode);

      if (res.success) {
        await refreshDbUser();
        showToast("🎁 Реферальный код принят! Скидка 1000₽ активирована.");
      }
    },
    [dbUser, refreshDbUser, showToast],
  );

  /**
   * Claim rental secrets from a QR deep-link.
   *
   * When a renter scans their contract QR, the startParam contains
   * rent_{bikeId}_{docSha256}. We atomically link chat_id to this
   * secret so the checkout form can auto-fill from verified data.
   *
   * Returns crewSlug from the claimed secret (for routing) or null on failure.
   * Also returns rentalId if a rental was created/linked during claim.
   */
  const claimQrRentalSecrets = useCallback(
    async (docSha256: string): Promise<{ crewSlug: string | null; claimedNow: boolean; rentalId?: string }> => {
      if (!dbUser?.user_id) {
        logger.warn("[ClientLayout] Cannot claim rental secrets: no dbUser.user_id");
        return { crewSlug: null, claimedNow: false };
      }

      try {
        const { claimRentalSecretsAction } = await import(
          "@/app/franchize/server-actions/rental-secrets-claim"
        );
        const result = await claimRentalSecretsAction(dbUser.user_id, docSha256);

        if (result.ok) {
          if (result.claimedNow) {
            logger.info(`[ClientLayout] Successfully claimed rental secrets for doc ${docSha256.slice(0, 12)}...`, {
              rentalId: result.rentalId,
            });
            showToast("✅ Ваши данные привязаны! Форма заполнится автоматически.", { duration: 4000 });
          } else {
            logger.info(`[ClientLayout] Rental secrets already linked for doc ${docSha256.slice(0, 12)}...`);
          }
          return { 
            crewSlug: result.crewSlug ?? null, 
            claimedNow: result.claimedNow ?? false,
            rentalId: result.rentalId,
          };
        }

        // Handle specific failure reasons
        switch (result.reason) {
          case "already_claimed_by_other":
            showToast("⚠️ Эта ссылка уже привязана к другому пользователю.", { duration: 5000 });
            logger.warn(`[ClientLayout] QR already claimed by other user: ${docSha256.slice(0, 12)}...`);
            break;
          case "revoked":
            showToast("⚠️ Документ аннулирован. Обратитесь к администратору.", { duration: 5000 });
            logger.warn(`[ClientLayout] Claimed secret is revoked: ${docSha256.slice(0, 12)}...`);
            break;
          case "not_found":
            logger.info(`[ClientLayout] No rental secret found for doc ${docSha256.slice(0, 12)}... — first-time renter flow`);
            break;
          default:
            logger.warn(`[ClientLayout] Claim failed: ${result.reason}`, { error: result.error });
            break;
        }

        return { crewSlug: null, claimedNow: false };
      } catch (error) {
        logger.error("[ClientLayout] Error claiming rental secrets:", error);
        return { crewSlug: null, claimedNow: false };
      }
    },
    [dbUser, showToast],
  );

  const resolveFranchizeVehicleLink = useCallback(
    async (rawParam: string, flow: "rent" | "buy", docSha256?: string | null) => {
      const vehicleId = rawParam.replace(/^(?:rent|buy|sale)_/i, '').trim().toLowerCase();
      if (!vehicleId) return null;
      try {
        const qs = new URLSearchParams({ vehicle: vehicleId, flow });
        if (docSha256) qs.set("docSha256", docSha256);
        const response = await fetch(`/api/startapp/vehicle?${qs.toString()}`, { cache: "no-store" });
        if (!response.ok) return null;
        const data = (await response.json()) as { slug?: string; vehicleId?: string; flow?: string };
        const slug = (data.slug || "vip-bike").trim() || "vip-bike";
        const resolvedVehicle = (data.vehicleId || vehicleId).trim().toLowerCase();
        const resolvedFlow = data.flow === "buy" ? "buy" : "rent";
        if (resolvedFlow === "buy") {
          return `/franchize/${slug}/market/${encodeURIComponent(resolvedVehicle)}/buy`;
        }
        // Rental: include docSha256 as URL param so checkout page can auto-fill
        const rentalQs = new URLSearchParams({ vehicle: resolvedVehicle, flow: resolvedFlow });
        if (docSha256) rentalQs.set("docSha256", docSha256);
        return `/franchize/${slug}?${rentalQs.toString()}`;
      } catch (error) {
        logger.warn("[ClientLayout] failed to resolve vehicle deep-link, using vip-bike fallback", { rawParam, error });
        if (flow === "buy") {
          return `/franchize/vip-bike/market/${encodeURIComponent(vehicleId)}/buy`;
        }
        const fallbackQs = new URLSearchParams({ vehicle: vehicleId, flow });
        if (docSha256) fallbackQs.set("docSha256", docSha256);
        return `/franchize/vip-bike?${fallbackQs.toString()}`;
      }
    },
    [],
  );

  /**
   * Claim testdrive secrets from a QR deep-link.
   *
   * When a renter scans their testdrive contract QR, the startParam contains
   * testdrive_{bikeId}_{docSha256}. We atomically link chat_id to this
   * testdrive artifact so the pre-filled data is available for future rentals.
   *
   * Returns crewSlug from the claimed artifact (for routing) or null on failure.
   */
  const claimQrTestdriveSecrets = useCallback(
    async (docSha256: string): Promise<{ crewSlug: string | null; claimedNow: boolean }> => {
      if (!dbUser?.user_id) {
        logger.warn("[ClientLayout] Cannot claim testdrive secrets: no dbUser.user_id");
        return { crewSlug: null, claimedNow: false };
      }

      try {
        const { claimTestdriveSecretsAction } = await import(
          "@/app/franchize/server-actions/testdrive-secrets-claim"
        );
        const result = await claimTestdriveSecretsAction(dbUser.user_id, docSha256);

        if (result.ok) {
          logger.info(`[ClientLayout] Successfully claimed testdrive secrets for doc ${docSha256.slice(0, 12)}...`);
          showToast("✅ Ваши данные с тест-драйва привязаны! При следующей аренде форма заполнится автоматически.", { duration: 5000 });
          return {
            crewSlug: result.crewSlug ?? null,
            claimedNow: true,
          };
        }

        // Handle specific failure reasons
        switch (result.status) {
          case "already_claimed_by_other":
            showToast("⚠️ Эта ссылка уже привязана к другому пользователю.", { duration: 5000 });
            logger.warn(`[ClientLayout] Testdrive QR already claimed by other user: ${docSha256.slice(0, 12)}...`);
            break;
          case "not_found":
            logger.info(`[ClientLayout] No testdrive artifact found for doc ${docSha256.slice(0, 12)}...`);
            break;
          default:
            logger.warn(`[ClientLayout] Testdrive claim failed: ${result.status}`, { error: result.error });
            break;
        }

        return { crewSlug: null, claimedNow: false };
      } catch (error) {
        logger.error("[ClientLayout] Error claiming testdrive secrets:", error);
        return { crewSlug: null, claimedNow: false };
      }
    },
    [dbUser, showToast],
  );

  useEffect(() => {
    const processStartParam = async () => {
      const urlStartParam = searchParams.get("tgWebAppStartParam") || searchParams.get("startapp");
      const rawStartParam = startParamPayload || urlStartParam;
      const paramToProcess = normalizeStartParamPath(rawStartParam);
      const normalizedUrlStartParam = normalizeStartParamPath(urlStartParam);

      if (normalizedUrlStartParam !== ignoredUrlStartParamRef.current) {
        ignoredUrlStartParamRef.current = null;
      }

      if (!paramToProcess) {
        activeStartParamRef.current = null;
        lastHandledStartParamRef.current = null;
        ignoredUrlStartParamRef.current = null;
        return;
      }

      if (!startParamPayload && normalizedUrlStartParam && ignoredUrlStartParamRef.current === normalizedUrlStartParam) {
        return;
      }

      if (isAppLoading || isAuthenticating) {
        return;
      }

      if (
        activeStartParamRef.current === paramToProcess ||
        lastHandledStartParamRef.current === paramToProcess
      ) {
        return;
      }

      activeStartParamRef.current = paramToProcess;
      const runId = startParamRunIdRef.current + 1;
      startParamRunIdRef.current = runId;
      const isLatestRun = () => (
        mountedRef.current &&
        startParamRunIdRef.current === runId &&
        activeStartParamRef.current === paramToProcess
      );
      let targetPath: string | undefined;

      try {
        logger.info(`[ClientLayout] Processing Start Param: ${paramToProcess}`);

        if (paramToProcess === "wb_dashboard") {
          targetPath = userCrewInfo?.slug ? `/wb/${userCrewInfo.slug}` : "/wblanding";
        } else if (paramToProcess.startsWith("cart_id_")) {
          const mockEnabled = isMockUserModeEnabled();
          const cartId = paramToProcess.slice("cart_id_".length).trim();
          if (!mockEnabled && dbUser?.user_id && cartId && consumedTempCartRef.current !== cartId) {
            consumedTempCartRef.current = cartId;
            const consumed = await consumeTempFranchizeCartAction({ cartId, userId: dbUser.user_id });
            if (consumed.ok && consumed.cartBySlug && typeof window !== "undefined") {
              for (const [slug, cartState] of Object.entries(consumed.cartBySlug)) {
                window.localStorage.setItem(`franchize-cart:${slug}`, JSON.stringify({ updatedAt: Date.now(), cart: cartState }));
              }
              window.dispatchEvent(new CustomEvent("franchize-cart-sync", { detail: { storageKey: "*" } }));
            }
          }
          targetPath = pathname;
        } else if (paramToProcess.startsWith("cart_")) {
          // Structured state from website→Telegram handoff: cart_<base64url(json)>
          // Decode and redirect to catalog with individual query params
          const state = decodeStartappState(paramToProcess);
          if (state) {
            if (!isStartappStateFresh(state)) {
              logger.warn('[ClientLayout] cart_ state expired', { bikeId: state.bikeId });
              targetPath = `/franchize/vip-bike?startapp_expired=1&bikeId=${encodeURIComponent(state.bikeId)}`;
            } else {
              logger.info('[ClientLayout] cart_ state decoded', { type: state.type, bikeId: state.bikeId });

              // Record the website→Telegram handoff as a lead.
              if (dbUser?.user_id) {
                void upsertFranchizeLead({
                  slug: "vip-bike",
                  userId: dbUser.user_id,
                  intentType: state.type === "sale" ? "sale" : "rent",
                  stage: "configured",
                  bikeId: state.bikeId,
                  sourceRoute: "/continue-in-tg",
                  contactChannel: "telegram_bot",
                  urgencyScore: state.type === "sale" ? 85 : 75,
                  metadata: {
                    startDate: state.startDate,
                    endDate: state.endDate,
                    startTime: state.startTime,
                    endTime: state.endTime,
                    helmetCount: state.helmetCount,
                    extrasGloves: state.extrasGloves,
                    extrasNet: state.extrasNet,
                    extrasBag: state.extrasBag,
                    extrasJacket: state.extrasJacket,
                    extrasBoots: state.extrasBoots,
                    extrasBackpack: state.extrasBackpack,
                    extrasCharger: state.extrasCharger,
                    package: state.package,
                    perk: state.perk,
                  },
                });
              }

              const params = new URLSearchParams({
                startappState: paramToProcess,
                startappBikeId: state.bikeId,
              });
              if (state.startDate) params.set('startDate', state.startDate);
              if (state.endDate) params.set('endDate', state.endDate);
              if (state.startTime) params.set('startTime', state.startTime);
              if (state.endTime) params.set('endTime', state.endTime);
              if (state.helmetCount) params.set('helmetCount', String(state.helmetCount));
              if (state.extrasGloves) params.set('extrasGloves', 'true');
              if (state.extrasNet) params.set('extrasNet', 'true');
              if (state.extrasBag) params.set('extrasBag', 'true');
              if (state.extrasJacket) params.set('extrasJacket', 'true');
              if (state.extrasPants) params.set('extrasPants', 'true');
              if (state.extrasBoots) params.set('extrasBoots', 'true');
              if (state.extrasBackpack) params.set('extrasBackpack', 'true');
              if (state.extrasCharger) params.set('extrasCharger', 'true');
              if (state.package) params.set('package', state.package);
              if (state.perk) params.set('perk', state.perk);
              targetPath = `/franchize/vip-bike?${params.toString()}`;
            }
          } else {
            logger.warn('[ClientLayout] failed to decode cart_ state', { paramPreview: paramToProcess.slice(0, 50) });
          }
        } else if (paramToProcess.startsWith("buy_") || paramToProcess.startsWith("sale_")) {
          // ── Sale deep-link: buy_{bikeId} (legacy, CSV exports) or
          //    sale_{bikeId} (share button in the catalog bike modal) ──
          // Both route to the sale landing page.
          targetPath = await resolveFranchizeVehicleLink(paramToProcess, "buy") ?? undefined;
        } else if (paramToProcess.startsWith("rent_")) {
          // ── QR deep-link: rent_{bikeId} or rent_{bikeId}_{docSha256} ──
          const parsed = parseRentDeepLink(paramToProcess);
          if (parsed) {
            let claimResult: { crewSlug: string | null; claimedNow: boolean; rentalId?: string } | null = null;

            // Step 1: If QR includes docSha256, claim rental secrets BEFORE routing
            if (parsed.docSha256 && dbUser?.user_id) {
              claimResult = await claimQrRentalSecrets(parsed.docSha256);
            }

            // Step 2: Check if user is crew owner (for docSha256 links only)
            // Crew owners get routed to contract-draft page, renters to bike page
            if (parsed.docSha256 && dbUser?.user_id) {
              try {
                const { checkRentalOwnershipForQr } = await import("@/app/franchize/server-actions/rentals");
                const ownershipResult = await checkRentalOwnershipForQr({
                  bikeId: parsed.bikeId,
                  docSha256: parsed.docSha256,
                  actorTelegramUserId: dbUser.user_id,
                });

                if (ownershipResult.success && ownershipResult.isOwner && ownershipResult.rentalId && ownershipResult.crewSlug) {
                  // Crew owner: route to contract-draft page
                  targetPath = `/franchize/${ownershipResult.crewSlug}/contract-draft/${ownershipResult.rentalId}`;
                  logger.info(`[ClientLayout] Routing crew owner to contract-draft: ${ownershipResult.crewSlug}/${ownershipResult.rentalId}`);
                }
              } catch (error) {
                logger.warn("[ClientLayout] Failed to check crew ownership, falling back to bike page", { error });
              }
            }

            // Step 3: If not crew owner (or check failed), resolve vehicle → route to bike page
            // Include rentalId in URL params if we got one from the claim
            if (!targetPath) {
              const rentParam = `rent_${parsed.bikeId}`;
              const vehiclePath = await resolveFranchizeVehicleLink(rentParam, "rent", parsed.docSha256);
              
              if (vehiclePath && claimResult?.rentalId) {
                // Append rentalId to the URL for tracking
                const url = new URL(vehiclePath, "https://placeholder.local");
                url.searchParams.set("rentalId", claimResult.rentalId);
                targetPath = url.pathname + url.search;
                logger.info(`[ClientLayout] Routing renter to bike page with rentalId: ${claimResult.rentalId}`);
              } else {
                targetPath = vehiclePath ?? undefined;
              }
            }
          } else {
            // Fallback: couldn't parse, try old behavior
            targetPath = await resolveFranchizeVehicleLink(paramToProcess, "rent") ?? undefined;
          }
        } else if (paramToProcess.startsWith("testdrive_")) {
          // ── Testdrive QR deep-link: testdrive_{bikeId}_{docSha256} ──
          // Claims testdrive secrets (links renter's chat_id to the artifact +
          // user_rental_secrets + franchize_intents) then routes to the bike
          // page so the renter can start a real rental with pre-filled data.
          const parsed = parseTestdriveDeepLink(paramToProcess);
          if (parsed) {
            // Step 1: If QR includes docSha256, claim testdrive secrets BEFORE routing
            if (parsed.docSha256 && dbUser?.user_id) {
              await claimQrTestdriveSecrets(parsed.docSha256);
            }

            // Step 2: Route to the bike page (renter can start a real rental)
            // The bike page will check user_rental_secrets by chat_id and pre-fill
            // the checkout form with the testdrive data.
            const vehiclePath = await resolveFranchizeVehicleLink(`rent_${parsed.bikeId}`, "rent", parsed.docSha256);
            targetPath = vehiclePath ?? undefined;
            logger.info(`[ClientLayout] Routing testdrive QR to bike page: ${targetPath}`);
          }
        } else if (START_PARAM_PAGE_MAP[paramToProcess]) {
          targetPath = START_PARAM_PAGE_MAP[paramToProcess];
        } else if (paramToProcess.startsWith("lead_") || paramToProcess.startsWith("leads_")) {
          // ── Lead deep links: lead_{userId} or leads_{segment} ──
          const parsed = parseLeadDeepLink(paramToProcess);
          if (parsed) {
            const crewSlug = userCrewInfo?.slug || "vip-bike";
            const params = new URLSearchParams();
            if (parsed.leadId) params.set("leadId", parsed.leadId);
            if (parsed.segment) params.set("segment", parsed.segment);
            targetPath = `/franchize/${crewSlug}/leads${params.toString() ? `?${params.toString()}` : ""}`;
            logger.info(`[ClientLayout] Routing to leads: ${targetPath}`);
          }
        } else if (paramToProcess.startsWith("rental_")) {
          // ── Rental detail deep link: rental_{rentalId} ──
          // (NOT "rent_" which is the QR claim link handled above)
          //
          // BUG FIX (was BUG A+H in code review): previously this routed to
          // /franchize/<slug>/rentals-analytics?rentalId=<id> (analytics drawer)
          // — but the analytics drawer has no proper closure UI (no odometer
          // prompt, no deposit-refund checkbox, no damage notes input).
          // The dedicated /franchize/<slug>/rental/<id> page is where
          // FranchizeRentalLifecycleActions + RentalReturnChecklist live, so
          // deep links from boss-commands (returns-reminder.sh, evening-summary.sh)
          // should land operators THERE.
          //
          // If you want the analytics drawer, use `analytics_rental_<id>`
          // (handled by parseAnalyticsDeepLink below).
          const parsed = parseRentalDetailDeepLink(paramToProcess);
          if (parsed) {
            const crewSlug = userCrewInfo?.slug || "vip-bike";
            targetPath = `/franchize/${crewSlug}/rental/${parsed.rentalId}`;
            logger.info(`[ClientLayout] Routing to dedicated rental page: ${targetPath}`);
          }
        } else if (paramToProcess.startsWith("analytics_") || paramToProcess === "rentals_analytics" || paramToProcess.startsWith("rentals_analytics_")) {
          // ── Analytics deep links: analytics_{tab}, analytics_{tab}_{date}, ──
          // ── analytics_rental_{id}, analytics_sale_{id} ──
          // ── rentals_analytics / rentals_analytics_{date} (alias used in notifications) ──
          const analyticsParam = paramToProcess.startsWith("analytics_")
            ? paramToProcess
            : paramToProcess === "rentals_analytics"
              ? "analytics_rentals"
              : `analytics_rentals_${paramToProcess.slice("rentals_analytics_".length)}`;
          const parsed = parseAnalyticsDeepLink(analyticsParam);
          if (parsed) {
            const crewSlug = userCrewInfo?.slug || "vip-bike";
            const params = new URLSearchParams({ ui: "v2" });
            if (parsed.tab) params.set("tab", parsed.tab);
            if (parsed.date) params.set("date", parsed.date);
            if (parsed.rentalId) params.set("rentalId", parsed.rentalId);
            if (parsed.saleId) params.set("saleId", parsed.saleId);
            targetPath = `/franchize/${crewSlug}/rentals-analytics?${params.toString()}`;
            logger.info(`[ClientLayout] Routing to analytics: ${targetPath}`);
          }
        } else if (paramToProcess.startsWith("crew_")) {
          const content = paramToProcess.substring(5);
          if (content.endsWith("_join_crew")) {
            const slug = content.substring(0, content.length - 10);
            targetPath = `/franchize/${slug}?join_crew=true`;
          } else {
            targetPath = `/franchize/${content}`;
          }
        } else if (paramToProcess.startsWith("viz_")) {
          const simId = paramToProcess.substring(4);
          targetPath = `/god-mode-sandbox?simId=${simId}`;
        } else if (paramToProcess.startsWith("bio30_")) {
          const parts = paramToProcess.split("_");
          const productId = parts.length > 1 && parts[1] !== "ref" ? parts[1] : undefined;
          const refIndex = parts.indexOf("ref");
          const referrerId = refIndex !== -1 && refIndex + 1 < parts.length ? parts[refIndex + 1] : undefined;

          if (referrerId) {
            void handleBio30Referral(referrerId, paramToProcess);
          }
          targetPath = productId && BIO30_PRODUCT_PATHS[productId] ? BIO30_PRODUCT_PATHS[productId] : "/bio30";
        } else if (paramToProcess.startsWith("lobby_")) {
          const lobbyId = paramToProcess.substring(6);
          if (lobbyId) {
            targetPath = `/strikeball/lobbies/${lobbyId}`;
          }
        } else if (paramToProcess.startsWith("lead_") || paramToProcess.startsWith("lead-")) {
          // ── Lead deep-link: lead_<leadId> or lead-<leadId> ──
          // Sent by lead-watcher in new-lead Telegram notifications.
          // Opens /franchize/<slug>/leads with ?leadId=… so LeadsClient
          // can auto-focus the row (scrollIntoView + open detail pane).
          const separator = paramToProcess.includes("_") ? "_" : "-";
          const leadId = paramToProcess.split(separator).slice(1).join(separator).trim();
          const slug = searchParams.get("slug") || userCrewInfo?.slug || "vip-bike";
          if (leadId) {
            targetPath = `/franchize/${slug}/leads?leadId=${encodeURIComponent(leadId)}`;
          }
        } else if (paramToProcess.startsWith("rental-") || paramToProcess.startsWith("rentals-") || paramToProcess.startsWith("sale-")) {
          const rentalId = paramToProcess.split("-").at(-1);
          const franchizeSlug = searchParams.get("slug") || "vip-bike";
          if (rentalId) {
            targetPath = `/franchize/${franchizeSlug}/rental/${rentalId}`;
          }
        } else if (paramToProcess.startsWith("mapriders_") || paramToProcess.startsWith("mapriders-")) {
          const separator = paramToProcess.includes("_") ? "_" : "-";
          const slug = paramToProcess.split(separator).slice(1).join(separator) || searchParams.get("slug") || userCrewInfo?.slug || "vip-bike";
          targetPath = `/franchize/${slug}/map-riders`;
        } else if (paramToProcess.startsWith("rental_") || paramToProcess.startsWith("rentals_")) {
          const parts = paramToProcess.split("_");
          const rentalId = parts.at(-1);
          const maybeSlug = parts.length > 2 ? parts[1] : searchParams.get("slug") || "vip-bike";
          if (rentalId) {
            if (parts.length > 2 || searchParams.get("slug")) {
              targetPath = `/franchize/${maybeSlug}/rental/${rentalId}`;
            } else {
              targetPath = `/rentals/${rentalId}`;
            }
          }
        } else if (paramToProcess.startsWith("ref_")) {
          const refCode = paramToProcess.substring(4);
          void handleSyndicateReferral(refCode);
          targetPath = pathname === "/" ? "/wblanding" : pathname;
        } else if (paramToProcess.includes("/")) {
          targetPath = `/${paramToProcess}`;
        } else {
          targetPath = `/${paramToProcess}`;
        }

        if (!isLatestRun()) {
          logger.info(`[ClientLayout] Skipping stale Start Param result: ${paramToProcess}`);
          return;
        }

        lastHandledStartParamRef.current = paramToProcess;
        if (startParamPayload && normalizedUrlStartParam) {
          ignoredUrlStartParamRef.current = normalizedUrlStartParam;
        }

        if (targetPath && targetPath !== pathname) {
          logger.info(`[ClientLayout] Redirecting to ${targetPath}`);
          router.replace(targetPath);
        }

        if (!isLatestRun()) {
          return;
        }

        clearStartParam?.();
      } finally {
        if (activeStartParamRef.current === paramToProcess) {
          activeStartParamRef.current = null;
        }
      }
    };

    void processStartParam();
  }, [
    startParamPayload,
    searchParams,
    dbUser?.user_id,
    isAppLoading,
    isAuthenticating,
    userCrewInfo?.slug,
    pathname,
    router,
    clearStartParam,
    handleBio30Referral,
    handleSyndicateReferral,
    claimQrRentalSecrets,
    claimQrTestdriveSecrets,
    resolveFranchizeVehicleLink,
  ]);
}

const normalizeStartParamPath = (rawParam: string | null) => {
  if (!rawParam) return null;
  const decoded = decodeURIComponent(rawParam).trim();
  if (!decoded) return null;
  return decoded.replace(/^\/+/, "").replace(/\/+/g, "/");
};