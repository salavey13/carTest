"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { debugLogger as logger } from "@/lib/debugLogger";
import { setReferrer } from "@/app/bio30/ref_actions";
import { applyReferralCode } from "@/app/wblanding/actions_view";

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
  create_crew: "/wblanding",
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

  const handledRef = useRef(false);

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

  const resolveFranchizeVehicleLink = useCallback(
    async (rawParam: string, flow: "rent" | "buy") => {
      const vehicleId = rawParam.slice(4).trim().toLowerCase();
      if (!vehicleId) return null;
      try {
        const response = await fetch(`/api/startapp/vehicle?vehicle=${encodeURIComponent(vehicleId)}&flow=${flow}`, { cache: "no-store" });
        if (!response.ok) return null;
        const data = (await response.json()) as { slug?: string; vehicleId?: string; flow?: string };
        const slug = (data.slug || "vip-bike").trim() || "vip-bike";
        const resolvedVehicle = (data.vehicleId || vehicleId).trim().toLowerCase();
        const resolvedFlow = data.flow === "buy" ? "buy" : "rent";
        const saleAvailable = Boolean((data as { saleAvailable?: boolean }).saleAvailable);
        if (resolvedFlow === "buy") {
          return `/franchize/${slug}/market/${encodeURIComponent(resolvedVehicle)}/buy`;
        }
        return `/franchize/${slug}?vehicle=${encodeURIComponent(resolvedVehicle)}&flow=${resolvedFlow}`;
      } catch (error) {
        logger.warn("[ClientLayout] failed to resolve vehicle deep-link, using vip-bike fallback", { rawParam, error });
        if (flow === "buy") {
          return `/franchize/vip-bike/market/${encodeURIComponent(vehicleId)}/buy`;
        }
        return `/franchize/vip-bike?vehicle=${encodeURIComponent(vehicleId)}&flow=${flow}`;
      }
    },
    [],
  );

  useEffect(() => {
    const processStartParam = async () => {
      const rawStartParam = startParamPayload || searchParams.get("tgWebAppStartParam");
      const paramToProcess = normalizeStartParamPath(rawStartParam);

      if (isAppLoading || isAuthenticating || !paramToProcess || handledRef.current) {
        return;
      }

      handledRef.current = true;
      let targetPath: string | undefined;

      logger.info(`[ClientLayout] Processing Start Param: ${paramToProcess}`);

      if (paramToProcess === "wb_dashboard") {
        targetPath = userCrewInfo?.slug ? `/wb/${userCrewInfo.slug}` : "/wblanding";
      } else if (paramToProcess.startsWith("buy_")) {
        targetPath = await resolveFranchizeVehicleLink(paramToProcess, "buy") ?? undefined;
      } else if (paramToProcess.startsWith("rent_")) {
        targetPath = await resolveFranchizeVehicleLink(paramToProcess, "rent") ?? undefined;
      } else if (START_PARAM_PAGE_MAP[paramToProcess]) {
        targetPath = START_PARAM_PAGE_MAP[paramToProcess];
      } else if (paramToProcess.startsWith("crew_")) {
      const content = paramToProcess.substring(5);
      if (content.endsWith("_join_crew")) {
        const slug = content.substring(0, content.length - 10);
        targetPath = `/wb/${slug}?join_crew=true`;
      } else {
        targetPath = `/wb/${content}`;
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

      if (targetPath && targetPath !== pathname) {
        logger.info(`[ClientLayout] Redirecting to ${targetPath}`);
        router.replace(targetPath);
      }

      clearStartParam?.();
    };

    void processStartParam();
  }, [
    startParamPayload,
    searchParams,
    isAppLoading,
    isAuthenticating,
    userCrewInfo?.slug,
    pathname,
    router,
    clearStartParam,
    handleBio30Referral,
    handleSyndicateReferral,
    resolveFranchizeVehicleLink,
  ]);
}

const normalizeStartParamPath = (rawParam: string | null) => {
  if (!rawParam) return null;
  const decoded = decodeURIComponent(rawParam).trim();
  if (!decoded) return null;
  return decoded.replace(/^\/+/, "").replace(/\/+/g, "/");
};
