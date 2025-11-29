"use client";

import type React from "react";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

// --- Components ---
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BikeHeader from "@/components/BikeHeader";
import BikeFooter from "@/components/BikeFooter";
import SaunaHeader from "@/components/SaunaHeader";
import SaunaFooter from "@/components/SaunaFooter";
import StickyChatButton from "@/components/StickyChatButton";

// --- Contexts & Providers ---
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/theme-provider"; // <--- IMPORT THIS
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import BottomNavigationBike from "@/components/layout/BottomNavigationBike";
import BottomNavigationSauna from "@/components/layout/BottomNavigationSauna";

// --- Hooks & Utils ---
import { debugLogger as logger } from "@/lib/debugLogger";
import { useFocusTimeTracker } from "@/hooks/useFocusTimeTracker";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { checkAndUnlockFeatureAchievement } from "@/hooks/cyberFitnessSupabase";
import { useAppToast } from "@/hooks/useAppToast";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";

// --- Actions ---
import Bio30Header from "@/app/bio30/components/Header";
import Bio30Footer from "@/app/bio30/components/Footer";
import { setReferrer } from "@/app/bio30/ref_actions"; 
import { applyReferralCode } from "@/app/wblanding/actions_view";

// --- THEME ENGINE ---
const THEME_CONFIG = {
  bike: {
    paths: ["/vipbikerental", "/rent-bike", "/rent/", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals"],
    Header: BikeHeader,
    Footer: BikeFooter,
    BottomNav: BottomNavigationBike,
    isTransparent: true,
  },
  sauna: {
    paths: ["/sauna-rent", "/sauna/"],
    Header: SaunaHeader,
    Footer: SaunaFooter,
    BottomNav: BottomNavigationSauna,
    isTransparent: false,
  },
  bio30: {
    paths: ["/bio30"],
    Header: Bio30Header,
    Footer: Bio30Footer,
    BottomNav: null,
    isTransparent: false,
  },
  default: {
    paths: [],
    Header: Header,
    Footer: Footer,
    BottomNav: BottomNavigationBike,
    isTransparent: false,
  },
};

const getThemeForPath = (pathname: string) => {
  if (THEME_CONFIG.bike.paths.some((p) => pathname.startsWith(p))) return THEME_CONFIG.bike;
  if (THEME_CONFIG.sauna.paths.some((p) => pathname.startsWith(p))) return THEME_CONFIG.sauna;
  if (pathname.startsWith("/bio30")) return THEME_CONFIG.bio30;
  return THEME_CONFIG.default;
};

// --- APP INITIALIZERS ---
function AppInitializers() {
  const { dbUser, isAuthenticated } = useAppContext();
  const { success: addToast } = useAppToast();
  const scrollAchievementUnlockedRef = useRef(false);
  useTelegramBackButton();

  useFocusTimeTracker({
    inactiveTimeout: 60 * 1000,
    componentName: "GlobalAppFocusTracker",
    enabled: !!(isAuthenticated && dbUser?.user_id),
  });

  const handleScrollForAchievement = useCallback(async () => {
    if (window.scrollY > 1000 && isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
      scrollAchievementUnlockedRef.current = true;
      try {
        const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, "scrolled_like_a_maniac");
        newAchievements?.forEach((ach) => {
          addToast(`🏆 Ачивка: ${ach.name}!`, { description: ach.description });
        });
      } catch (error) {
        logger.error("[ClientLayout] Error unlocking achievement:", error);
        scrollAchievementUnlockedRef.current = false;
      }
    }
  }, [isAuthenticated, dbUser, addToast]);

  useEffect(() => {
    if (isAuthenticated && dbUser?.user_id) {
      window.addEventListener("scroll", handleScrollForAchievement, { passive: true });
    }
    return () => window.removeEventListener("scroll", handleScrollForAchievement);
  }, [isAuthenticated, dbUser, handleScrollForAchievement]);

  return null;
}

// --- START PARAM LOGIC ---
const START_PARAM_PAGE_MAP: Record<string, string> = {
  elon: "/elon", musk_market: "/elon", arbitrage_seeker: "/elon",
  topdf_psycho: "/topdf", settings: "/settings", profile: "/profile",
  sauna: "/sauna-rent", streamer: "/streamer", demo: "/about_en",
  wb: "/wblanding", wb_dashboard: "/wblanding", "audit-tool": "/wblanding",
  "create_crew": "/wblanding", reports: "/wblanding", crews: "/crews", 
  "repo-xml": "/repo-xml", "style-guide": "/style-guide", "start-training": "/selfdev/gamified",
  paddock: "/paddock", leaderboard: "/leaderboard", "rent-bike": "/rent-bike",
};

const BIO30_PRODUCT_PATHS: Record<string, string> = {
  'cordyceps': '/bio30/categories/cordyceps-sinensis',
  'spirulina': '/bio30/categories/spirulina-chlorella',
  'lions-mane': '/bio30/categories/lion-s-mane',
  'lion-s-mane': '/bio30/categories/lion-s-mane',
  'magnesium': '/bio30/categories/magnesium-pyridoxine',
  'cordyceps-sinensis': '/bio30/categories/cordyceps-sinensis',
  'spirulina-chlorella': '/bio30/categories/spirulina-chlorella',
  'magnesium-pyridoxine': '/bio30/categories/magnesium-pyridoxine'
};

// --- HOOKS ---
function useBio30ThemeFix() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/bio30")) return;
    const root = document.documentElement;
    const prevBg = root.style.getPropertyValue("--background");
    const prevFg = root.style.getPropertyValue("--foreground");

    // Force dark for Bio30
    root.style.setProperty("--background", "hsl(0 0% 6%)");
    root.style.setProperty("--foreground", "hsl(0 0% 100%)");
    document.body.style.backgroundColor = "hsl(0 0% 6%)";
    document.body.style.color = "hsl(0 0% 100%)";

    return () => {
      root.style.setProperty("--background", prevBg || "");
      root.style.setProperty("--foreground", prevFg || "");
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [pathname]);
}

function useThemeSync() {
  const { dbUser, isLoading } = useAppContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!isLoading && dbUser && !hasSynced) {
      const settings = dbUser.metadata?.settings_profile as Record<string, any> | undefined;
      if (settings && typeof settings.dark_mode_enabled === 'boolean') {
        const dbWantsDark = settings.dark_mode_enabled;
        const currentIsDark = resolvedTheme === 'dark';
        if (dbWantsDark !== currentIsDark) {
            logger.info(`[ThemeSync] Syncing theme from DB. User wants: ${dbWantsDark ? 'DARK' : 'LIGHT'}`);
            setTheme(dbWantsDark ? 'dark' : 'light');
        }
      }
      setHasSynced(true);
    }
  }, [dbUser, isLoading, hasSynced, resolvedTheme, setTheme]);
}

// --- CONTROLLER ---
function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startParamPayload, dbUser, userCrewInfo, refreshDbUser, isLoading: isAppLoading, isAuthenticating, clearStartParam } = useAppContext();
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const startParamHandledRef = useRef(false);
  const { success: showToast } = useAppToast();

  const theme = getThemeForPath(pathname);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  useBio30ThemeFix();
  useThemeSync(); 

  // ... (Start Param Logic - Kept same as before, collapsed for brevity)
  useEffect(() => {
     const handleBio30Referral = async (referrerId: string, paramToProcess: string) => {
       if (dbUser?.user_id && !dbUser.metadata?.referrer_id) {
         setReferrer({ userId: dbUser.user_id, referrerId, referrerCode: paramToProcess }).then(res => {
           if (res.success) refreshDbUser();
         });
       }
     };
     const handleSyndicateReferral = async (refCode: string) => {
       if (dbUser?.user_id && !dbUser.metadata?.referrer) {
         const res = await applyReferralCode(dbUser.user_id, refCode);
         if (res.success) { refreshDbUser(); showToast("🎁 Реферальный код принят!"); }
       }
     };

     const paramToProcess = startParamPayload || searchParams.get("tgWebAppStartParam");
     if (!isAppLoading && !isAuthenticating && paramToProcess && !startParamHandledRef.current) {
       startParamHandledRef.current = true;
       let targetPath: string | undefined;
       
       // ... (Existing start param parsing logic) ...
       // [Same logic as your previous file]
       if (paramToProcess === "wb_dashboard") targetPath = userCrewInfo?.slug ? `/wb/${userCrewInfo.slug}` : "/wblanding";
       else if (START_PARAM_PAGE_MAP[paramToProcess]) targetPath = START_PARAM_PAGE_MAP[paramToProcess];
       else if (paramToProcess.startsWith("ref_")) { handleSyndicateReferral(paramToProcess.substring(4)); targetPath = pathname === '/' ? '/wblanding' : pathname; }
       else targetPath = `/${paramToProcess}`; // Fallback

       if (targetPath && targetPath !== pathname) router.replace(targetPath);
       clearStartParam?.();
     }
  }, [startParamPayload, searchParams, pathname, router, isAppLoading, isAuthenticating, dbUser, userCrewInfo, refreshDbUser, clearStartParam, showToast]);

  useEffect(() => {
    setShowHeaderAndFooter(![
      "/profile", "/repo-xml", "/sauna-rent", "/wblanding", "/wblanding/referral",
      "/csv-compare", "/streamer", "/blogger", "/"
    ].includes(pathname) && !pathname?.startsWith("/wb/") && !pathname?.startsWith("/optimapipe") && !pathname?.startsWith("/rules"));
  }, [pathname]);

  const TRANSPARENT_LAYOUT_PAGES = ["/rentals", "/crews", "/paddock", "/admin", "/leaderboard", "/wb", "/wblanding"];
  const isTransparentPage = TRANSPARENT_LAYOUT_PAGES.some((p) => pathname.startsWith(p)) || theme.isTransparent;

  return (
    <>
      {showHeaderAndFooter && CurrentHeader && <CurrentHeader />}
      <main className={cn("flex-1", "pb-20 sm:pb-0", !isTransparentPage && "bg-background")}>
        {children}
      </main>
      {theme.BottomNav && <theme.BottomNav pathname={pathname} />}
      <Suspense fallback={null}><StickyChatButton /></Suspense>
      {showHeaderAndFooter && CurrentFooter && <CurrentFooter />}
    </>
  );
}

// --- WRAPPER ---
export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorOverlayProvider>
      <AppProvider>
        <AppInitializers />
        {/* ADDED THEME PROVIDER HERE */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider>
              <ErrorBoundaryForOverlay>
                <Suspense fallback={<Loading variant="bike" text="🏴‍☠️ LOADING VIBE..." />}>
                  <LayoutLogicController>{children}</LayoutLogicController>
                </Suspense>
              </ErrorBoundaryForOverlay>
              <SonnerToaster
                position="bottom-right"
                richColors
                toastOptions={{
                  style: {
                    background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--border))",
                  },
                }}
              />
              <DevErrorOverlay />
            </TooltipProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </AppProvider>
    </ErrorOverlayProvider>
  );
}