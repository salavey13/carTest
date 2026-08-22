"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useTelegram } from "@/hooks/useTelegram";
import { debugLogger } from "@/lib/debugLogger";
import { useAppToast } from "@/hooks/useAppToast";
import { supabaseAnon } from "@/hooks/supabase";
import type { Database } from "@/types/database.types";
import { refreshDbUserAction, fetchActiveGameAction, fetchUserRuntimeSnapshotAction, fetchUserCrewMembershipsAction } from "./actions";
import { IS_VPS_DEPLOYMENT } from "@/lib/feature-flags";

export type UserCrewInfo = {
  id: string;
  slug: string;
  name: string;
  logo_url: string;
  is_owner: boolean;
  role?: string;           // 'owner', 'admin', 'member', 'co_owner', 'mechanic'
};

export type CrewMembership = {
  crewId: string;
  slug: string;
  name: string;
  role: string;
};

export type ActiveLobbyInfo = {
  id: string;
  name: string;
  start_at: string | null;
  actual_start_at: string | null;
  status: string;
};

type TelegramData = ReturnType<typeof useTelegram>;

interface AppAuthContextData extends Omit<TelegramData, "dbUser" | "isLoading" | "isAuthenticating" | "error"> {
  user: TelegramData["user"];
  dbUser: Database["public"]["Tables"]["users"]["Row"] | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: TelegramData["error"];
  refreshDbUser: () => Promise<void>;
}

interface AppRuntimeContextData {
  startParamPayload: string | null;
  clearStartParam: () => void;
  userCrewInfo: UserCrewInfo | null;
  userCrewMemberships: CrewMembership[];
  userMetadataSlices: {
    cyberFitness: Record<string, unknown> | null;
    strikeball: Record<string, unknown> | null;
    franchizeProfiles: Record<string, unknown> | null;
  };
}

interface AppCartContextData {
  cartScopeVersion: number;
}

interface StrikeballLobbyContextData {
  activeLobby: ActiveLobbyInfo | null;
}

export interface AppContextData extends AppAuthContextData, AppRuntimeContextData, AppCartContextData, StrikeballLobbyContextData {}

const AppAuthContext = createContext<AppAuthContextData | null>(null);
const AppRuntimeContext = createContext<AppRuntimeContextData | null>(null);
const AppCartContext = createContext<AppCartContextData | null>(null);
const StrikeballLobbyContext = createContext<StrikeballLobbyContextData | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const telegramHookData = useTelegram();
  const { user, dbUser: initialDbUser, isLoading: isTelegramLoading, isAuthenticating: isTelegramAuthenticating, error: telegramError, ...restTelegramData } = telegramHookData;

  // ── FIX: Race condition eliminated ──
  // Old code used useState(initialDbUser) + useEffect to sync. This created
  // a one-render gap where isAuthenticated=true but dbUser=null (the effect
  // hadn't run yet). On Safari/WKWebView (slower JS engine), this gap was
  // wide enough for SvarProfiOrderSheet to read isAuth=false even when the
  // user was properly authenticated.
  //
  // New approach: derive dbUser from initialDbUser directly, with an override
  // slot for refreshDbUser. No useEffect sync = no race condition.
  const [dbUserOverride, setDbUserOverride] = useState<Database["public"]["Tables"]["users"]["Row"] | null>(null);

  // dbUser is always in sync with initialDbUser unless refreshDbUser
  // has provided a newer version via dbUserOverride.
  const dbUser = dbUserOverride ?? initialDbUser;

  const refreshDbUser = useCallback(async () => {
    const userId = user?.id || dbUser?.user_id;
    if (!userId) return;

    try {
      const freshDbUser = await refreshDbUserAction(String(userId));
      if (freshDbUser) {
        setDbUserOverride(freshDbUser);
      }
    } catch (err) {
      debugLogger.error(`[AppContext] Refresh failed:`, err);
    }
  }, [user?.id, dbUser?.user_id]);

  // --- Runtime boundary ---
  const [startParamPayload, setStartParamPayload] = useState<string | null>(null);
  const [userCrewInfo, setUserCrewInfo] = useState<UserCrewInfo | null>(null);
  const [userCrewMemberships, setUserCrewMemberships] = useState<CrewMembership[]>([]);
  const [userMetadataSlices, setUserMetadataSlices] = useState<AppRuntimeContextData["userMetadataSlices"]>({
    cyberFitness: null,
    strikeball: null,
    franchizeProfiles: null,
  });
  const processedStartParam = useRef(false);

  useEffect(() => {
    const fetchRuntimeSnapshot = async () => {
      if (!dbUser?.user_id) {
        setUserCrewInfo(null);
        setUserCrewMemberships([]);
        setUserMetadataSlices({ cyberFitness: null, strikeball: null, franchizeProfiles: null });
        return;
      }
      const [snapshot, memberships] = await Promise.all([
        fetchUserRuntimeSnapshotAction(dbUser.user_id),
        fetchUserCrewMembershipsAction(dbUser.user_id),
      ]);
      setUserCrewInfo(snapshot.crewInfo);
      setUserCrewMemberships(memberships);
      setUserMetadataSlices(snapshot.metadataSlices);
    };
    fetchRuntimeSnapshot();
  }, [dbUser?.user_id]);

  const clearStartParam = useCallback(() => {
    setStartParamPayload(null);
  }, []);

  useEffect(() => {
    const startParam = telegramHookData.tg?.initDataUnsafe?.start_param;
    if (telegramHookData.tg && startParam) {
      if (processedStartParam.current) return;
      processedStartParam.current = true;

      debugLogger.info(`[AppContext] Received start_param: ${startParam}`);
      setStartParamPayload(startParam);
      return;
    }

    if (startParamPayload !== null) {
      setStartParamPayload(null);
      processedStartParam.current = false;
    }
  }, [telegramHookData.tg, telegramHookData.tg?.initDataUnsafe?.start_param, startParamPayload]);

  // --- Strikeball boundary: event-driven lobby updates, no timer-only pseudo-realtime ---
  const [activeLobby, setActiveLobby] = useState<ActiveLobbyInfo | null>(null);

  const refreshActiveLobby = useCallback(async () => {
    if (!dbUser?.user_id) {
      setActiveLobby(null);
      return;
    }
    try {
      const lobbyInfo = await fetchActiveGameAction(dbUser.user_id);
      setActiveLobby(lobbyInfo);
    } catch (error) {
      debugLogger.warn("[AppContext] Failed to refresh active lobby", error);
    }
  }, [dbUser?.user_id]);

  useEffect(() => {
    refreshActiveLobby();
  }, [refreshActiveLobby]);

  useEffect(() => {
    if (!dbUser?.user_id) return;

    const channel = supabaseAnon
      .channel(`appctx-active-lobby:${dbUser.user_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_members", filter: `user_id=eq.${dbUser.user_id}` }, () => {
        refreshActiveLobby();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () => {
        refreshActiveLobby();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          debugLogger.info(`[AppContext] Strikeball realtime ready for ${dbUser.user_id}`);
        }
      });

    return () => {
      supabaseAnon.removeChannel(channel);
    };
  }, [dbUser?.user_id, refreshActiveLobby]);

  // --- UX toast side-effects stay isolated from data providers ---
  const appToast = useAppToast();
  useEffect(() => {
    // VPS has no Telegram by design (blocked in RF) — TG auth is EXPECTED to
    // be unavailable there, so the "Авторизация..." (15s) + "Ошибка: Telegram
    // authentication failed" (5s) toasts are pure noise. Worse, because the
    // WebApp SDK load + auth flow can take a few seconds before resolving to
    // the no-context state, the toasts lingered for what looked like a ~30s
    // timeout. Suppress the whole auth-toast flow on VPS deployments.
    if (IS_VPS_DEPLOYMENT) {
      appToast.dismiss("auth-loading-toast");
      appToast.dismiss("auth-error-toast");
      appToast.dismiss("auth-success-toast");
      return;
    }

    let loadingTimer: NodeJS.Timeout | null = null;
    const shouldShowLoading = (isTelegramLoading || isTelegramAuthenticating) && !dbUser;

    if (shouldShowLoading) {
      appToast.dismiss("auth-success-toast");
      appToast.dismiss("auth-error-toast");
      loadingTimer = setTimeout(() => {
        if ((isTelegramLoading || isTelegramAuthenticating) && !dbUser) {
          appToast.loading("Авторизация...", { id: "auth-loading-toast", duration: 15000 });
        }
      }, 500);
    } else {
      if (loadingTimer) clearTimeout(loadingTimer);
      appToast.dismiss("auth-loading-toast");
      // Skip telegram error toast on nnvolt pages (regular web page, not Telegram WebApp)
      if (telegramError && !pathname?.startsWith("/nnvolt")) {
        appToast.error(`Ошибка: ${telegramError.message}`, { id: "auth-error-toast", duration: 5000 });
      }
    }

    return () => {
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [isTelegramLoading, isTelegramAuthenticating, telegramError, dbUser, appToast]);

  // ── FIX: Ensure isAdmin is always a callable function ──
  // The old `safeAuth` guard checked `typeof auth.isAdmin !== "function"`,
  // but since useTelegram() always returns isAdmin as () => boolean,
  // the guard never triggered (dead code). Now we explicitly ensure
  // isAdmin is a function regardless of auth state.
  const isAdminFn = useCallback((): boolean => {
    if (!dbUser) return false;
    return dbUser.status === "admin" || dbUser.role === "vprAdmin" || dbUser.role === "admin";
  }, [dbUser]);

  const authValue = useMemo<AppAuthContextData>(() => ({
    ...restTelegramData,
    user,
    dbUser,
    isLoading: isTelegramLoading,
    isAuthenticating: isTelegramAuthenticating,
    error: telegramError,
    isAdmin: isAdminFn,
    refreshDbUser,
  }), [restTelegramData, user, dbUser, isTelegramLoading, isTelegramAuthenticating, telegramError, isAdminFn, refreshDbUser]);

  const runtimeValue = useMemo<AppRuntimeContextData>(() => ({
    startParamPayload,
    clearStartParam,
    userCrewInfo,
    userCrewMemberships,
    userMetadataSlices,
  }), [startParamPayload, clearStartParam, userCrewInfo, userCrewMemberships, userMetadataSlices]);

  const cartValue = useMemo<AppCartContextData>(() => ({
    cartScopeVersion: 1,
  }), []);

  const strikeballValue = useMemo<StrikeballLobbyContextData>(() => ({
    activeLobby,
  }), [activeLobby]);

  return (
    <AppAuthContext.Provider value={authValue}>
      <AppRuntimeContext.Provider value={runtimeValue}>
        <AppCartContext.Provider value={cartValue}>
          <StrikeballLobbyContext.Provider value={strikeballValue}>
            {children}
          </StrikeballLobbyContext.Provider>
        </AppCartContext.Provider>
      </AppRuntimeContext.Provider>
    </AppAuthContext.Provider>
  );
};

export const useStrikeballLobbyContext = (): StrikeballLobbyContextData => {
  return useContext(StrikeballLobbyContext) ?? { activeLobby: null };
};

export const useAppContext = (): AppContextData => {
  const auth = useContext(AppAuthContext);
  const runtime = useContext(AppRuntimeContext);
  const cart = useContext(AppCartContext);
  const strikeball = useContext(StrikeballLobbyContext);

  const defaultRefreshDbUser = useCallback(async () => {}, []);
  const defaultClearStartParam = useCallback(() => {}, []);
  const defaultIsAdmin = useCallback(() => false, []);

  if (!auth) {
    return {
      tg: null,
      user: null,
      dbUser: null,
      isInTelegramContext: false,
      isAuthenticated: false,
      isLoading: true,
      isAuthenticating: true,
      error: null,
      isAdmin: defaultIsAdmin,
      openLink: () => {},
      close: () => {},
      showPopup: () => {},
      sendData: () => {},
      getInitData: () => null,
      expand: () => {},
      setHeaderColor: () => {},
      setBackgroundColor: () => {},
      platform: "unknown",
      themeParams: {},
      initData: undefined,
      initDataUnsafe: undefined,
      startParam: null,
      startParamPayload: null,
      refreshDbUser: defaultRefreshDbUser,
      clearStartParam: defaultClearStartParam,
      userCrewInfo: null,
      userCrewMemberships: [],
      userMetadataSlices: { cyberFitness: null, strikeball: null, franchizeProfiles: null },
      activeLobby: null,
      cartScopeVersion: 1,
    } as unknown as AppContextData;
  }

  // ── FIX: No more safeAuth guard — isAdmin is guaranteed to be a function ──
  // The old code had a dead-code guard:
  //   const safeAuth = auth.isLoading === false && typeof auth.isAdmin !== "function" ? ... : auth;
  // Since auth.isAdmin is always a function (set by the provider), this never
  // triggered. Removed the guard entirely — if auth is non-null, it's valid.

  return {
    ...auth,
    ...(runtime ?? {
      startParamPayload: null,
      clearStartParam: defaultClearStartParam,
      userCrewInfo: null,
      userCrewMemberships: [],
      userMetadataSlices: { cyberFitness: null, strikeball: null, franchizeProfiles: null },
    }),
    ...(strikeball ?? { activeLobby: null }),
    ...(cart ?? { cartScopeVersion: 1 }),
  } as AppContextData;
};
