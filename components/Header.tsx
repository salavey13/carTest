"use client";

import Link from "next/link";
import { LayoutGrid, X, Search } from "lucide-react"; // Keep lucide icons used here
import React, { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FaCar, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck, FaNetworkWired // Added FaNetworkWired
} from "react-icons/fa6"; // Use specific icons from Fa6

// --- Page Definitions ---
interface PageInfo {
  path: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
  isImportant?: boolean;
  isAdminOnly?: boolean;
  color?: 'purple' | 'blue' | 'yellow' | 'lime' | 'green' | 'pink' | 'cyan' | 'red';
}

// .. Updated allPages array
const allPages: PageInfo[] = [
  { path: "/", name: "Cyber Garage", icon: FaCar, isImportant: true, color: "cyan" },
  { path: "/about", name: "About Me", icon: FaCircleUser, isImportant: true, color: "blue" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, isImportant: true, color: "yellow" },
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, isImportant: true, color: "lime" },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, isImportant: true, color: "green" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, color: "purple" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, color: "pink" },
  // .. Added new page link and marked as important:
  { path: "/ai-work-future", name: "AI & Future of Work", icon: FaNetworkWired, color: "cyan", isImportant: true },
  { path: "/botbusters", name: "Bot Busters", icon: FaRobot },
  { path: "/bullshitdetector", name: "BS Detector", icon: FaMagnifyingGlass },
  { path: "/wheel-of-fortune", name: "Wheel of Fortune", icon: FaGift },
  { path: "/admin", name: "Admin Panel", icon: FaUserShield, isAdminOnly: true, color: "red" },
  { path: "/shadow-fleet-admin", name: "Fleet Admin", icon: FaCarOn, isAdminOnly: true, color: "red" },
  { path: "/youtubeAdmin", name: "YT Admin", icon: FaYoutube, isAdminOnly: true, color: "red" },
  { path: "/invoices", name: "My Invoices", icon: FaFileInvoiceDollar },
  { path: "/buy-subscription", name: "Subscribe", icon: FaCreditCard },
  { path: "/donate", name: "Donate", icon: FaHeart, color: "red" },
  { path: "/style-guide", name: "Style Guide", icon: FaPalette },
  { path: "/onesitepls", name: "oneSitePls Info", icon: FaCircleInfo },
  { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: FaListCheck },
  { path: "/rent-car", name: "Rent a Car", icon: FaCar },
  // { path: "/tasks", name: "Tasks", icon: FaListCheck },
];


// --- Header Component ---
export default function Header() {
  const { isAdmin } = useAppContext();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();

  // .. Memoize current logo text based on pathname
  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    return currentPage?.name.split(' ')[0] || "VIBE";
  }, [pathname]);

  // .. Memoize filtered pages based on search term and admin status
  const filteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allPages.filter(page => {
      const isAdminPage = page.isAdminOnly === true;
      if (isAdminPage && !isAdmin) {
        return false;
      }
      return page.name.toLowerCase().includes(lowerSearchTerm);
    });
  }, [searchTerm, isAdmin]);

  // .. Callback to handle scroll events for showing/hiding the header
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    if (isNavOpen) {
      setIsHeaderVisible(true);
      setLastScrollY(currentScrollY);
      return;
    }
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsHeaderVisible(false);
    } else if (currentScrollY < lastScrollY) {
      setIsHeaderVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen]);

  // .. Effect to add/remove scroll listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // .. Effect to close nav and clear search when route changes
  useEffect(() => {
    setIsNavOpen(false);
    setSearchTerm("");
  }, [pathname]);

   // .. Effect to prevent body scroll when nav overlay is open
  useEffect(() => {
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isNavOpen]);

  // .. Define tile colors map - Tailwind classes
  const tileColorClasses: Record<Required<PageInfo>['color'] | 'default', string> = {
    purple: "border-brand-purple/50 hover:border-brand-purple hover:shadow-[0_0_15px_rgba(157,0,255,0.5)] text-brand-purple",
    blue: "border-brand-blue/50 hover:border-brand-blue hover:shadow-[0_0_15px_rgba(0,194,255,0.5)] text-brand-blue",
    yellow: "border-brand-yellow/50 hover:border-brand-yellow hover:shadow-[0_0_15px_rgba(255,193,7,0.5)] text-brand-yellow", // Assuming brand-yellow exists
    lime: "border-neon-lime/50 hover:border-neon-lime hover:shadow-[0_0_15px_rgba(174,255,0,0.5)] text-neon-lime", // Adjusted to neon-lime
    green: "border-brand-green/50 hover:border-brand-green hover:shadow-[0_0_15px_rgba(0,255,157,0.5)] text-brand-green",
    pink: "border-brand-pink/50 hover:border-brand-pink hover:shadow-[0_0_15px_rgba(255,0,122,0.5)] text-brand-pink",
    cyan: "border-brand-cyan/50 hover:border-brand-cyan hover:shadow-[0_0_15px_rgba(0,224,255,0.5)] text-brand-cyan", // Assuming brand-cyan exists
    red: "border-red-500/50 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] text-red-500",
    default: "border-gray-700/80 hover:border-brand-green/70 text-gray-400 hover:text-brand-green" // Default styling - adjusted text colors
  };


  return (
    <>
      {/* Header Bar */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-40 bg-black/70 border-b border-brand-purple/30 shadow-lg backdrop-blur-md transition-transform duration-300 ease-in-out`}
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : "-100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl md:text-3xl font-bold text-brand-purple cyber-text glitch hover:text-glow" data-text={currentLogoText}>
              {currentLogoText}
            </Link>
            <div className="flex items-center gap-4">
              <UserInfo />
              {/* .. Navigation Toggle Button - Increased Z-index */}
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md relative z-60" // Increased z-index to 60
                aria-label={isNavOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={isNavOpen}
              >
                {isNavOpen ? <X className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Navigation Overlay */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            key="nav-overlay"
            initial={{ opacity: 0, clipPath: 'circle(0% at 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at 100% 0)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at 100% 0)' }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24" // Kept z-50 (below button)
          >
            <div className="container mx-auto max-w-3xl xl:max-w-4xl">
              {/* Search Input */}
              <div className="relative mb-6 md:mb-8">
                <input
                  type="search"
                  placeholder="Search pages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/60 border border-brand-green/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent text-sm md:text-base" // Smaller py and text size
                  aria-label="Search pages"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Page Tiles Grid */}
              {filteredPages.length > 0 ? (
                // --- UPDATED GRID DEFINITION FOR DENSITY ---
                // 4 columns base (mobile), 6 on sm, 8 on md+
                // Smaller gaps
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
                  {filteredPages.map((page) => {
                    const PageIcon = page.icon;
                    const isCurrentPage = page.path === pathname;
                    const tileColorClass = tileColorClasses[page.color || 'default'];

                    // --- ADJUSTED TILE STYLING FOR DENSITY ---
                    return (
                      <Link
                        key={page.path}
                        href={page.path}
                        onClick={() => setIsNavOpen(false)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center rounded-md border transition-all duration-300 aspect-square text-center hover:scale-[1.03]", // smaller radius
                          // Responsive padding - smallest on base
                          "p-1.5 sm:p-2 md:p-1.5",
                          // Important tile styling: spans 2 cols on sm+, 1 col base
                          page.isImportant
                            ? "bg-gradient-to-br from-purple-900/30 via-black/50 to-blue-900/30 col-span-2 sm:col-span-2 md:col-span-2" // Keep span 2 for important on all sizes for visibility
                            : "bg-gray-800/70 hover:bg-gray-700/90 col-span-1", // Regular tile styling
                          tileColorClass, // Apply color-specific border/text/shadow
                          // Current page indicator - thinner ring
                          isCurrentPage ? 'ring-1 ring-offset-1 ring-offset-black ring-brand-green' : ''
                        )}
                      >
                        {PageIcon && (
                            <PageIcon className={cn(
                                // Responsive icon sizes - smallest on base
                                "h-4 w-4 sm:h-5 sm:w-5 md:h-4 md:w-4 mb-0.5 transition-transform duration-300 group-hover:scale-110", // Tighter margin
                                // Special size for important icons
                                page.isImportant ? "text-brand-yellow h-5 w-5 sm:h-6 sm:w-6 md:h-5 md:w-5" : "inherit"
                            )} />
                        )}
                        <span className={cn(
                            "font-semibold transition-colors leading-tight", // Base text style
                            // Responsive text sizes - smallest on base
                            "text-[0.6rem] sm:text-xs md:text-[0.6rem] md:leading-none",
                            // Special size for important text
                            page.isImportant ? "text-white text-[0.7rem] sm:text-sm md:text-xs" : "text-gray-300 group-hover:text-white"
                        )}>
                          {page.name}
                        </span>
                        {page.isAdminOnly && ( // Admin badge indicator
                           <span title="Admin Only" className="absolute top-0.5 right-0.5 text-[0.5rem] text-red-400 bg-black/60 rounded-full px-1 py-0 leading-none">🛡️</span> // Adjusted size/position
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                 // Message when no search results found
                <p className="text-center text-gray-500 text-sm md:text-base mt-6 md:mt-8">No pages found matching "{searchTerm}"</p> // Adjusted text size/margin
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}