"use client";

import Link from "next/link";
import { LuLayoutGrid, LuX, LuSearch } from "lucide-react"; // Use Lucide icons
import { useState, useEffect, useMemo, useCallback } from "react";
import UserInfo from "@/components/user-info";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FaCar, FaCircleUser, FaWandMagicSparkles, FaRocket, FaRoad, FaBookOpen,
  FaBrain, FaRobot, FaMagnifyingGlass, FaGift, FaUserShield, FaCarOn,
  FaYoutube, FaFileInvoiceDollar, FaCreditCard, FaHeart, FaPalette,
  FaCircleInfo, FaListCheck
} from "react-icons/fa6"; // Use specific icons from Fa6

// --- Page Definitions ---
interface PageInfo {
  path: string;
  name: string;
  icon?: React.ComponentType<any>; // Icon component
  isImportant?: boolean;
  isAdminOnly?: boolean;
  color?: string; // Optional color for tile accent
}

const allPages: PageInfo[] = [
  { path: "/", name: "Cyber Garage", icon: FaCar, isImportant: true, color: "cyan" },
  { path: "/about", name: "About Me", icon: FaCircleUser, isImportant: true, color: "blue" },
  { path: "/repo-xml", name: "SUPERVIBE Studio", icon: FaWandMagicSparkles, isImportant: true, color: "yellow" },
  { path: "/jumpstart", name: "Jumpstart Kit", icon: FaRocket, isImportant: true, color: "lime" },
  { path: "/selfdev", name: "SelfDev Path", icon: FaRoad, isImportant: true, color: "green" },
  { path: "/purpose-profit", name: "Purpose & Profit", icon: FaBookOpen, color: "purple" },
  { path: "/expmind", name: "Experimental Mindset", icon: FaBrain, color: "pink" },
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
  // Add other pages as needed, ensure paths are correct
  // { path: "/onesitepls", name: "oneSitePls Info", icon: FaCircleInfo },
  // { path: "/onesiteplsinstructions", name: "oneSitePls How-To", icon: FaListCheck },
];

// --- Header Component ---
export default function Header() {
  const { user, dbUser, isAdmin } = useAppContext(); // Get isAdmin status
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const pathname = usePathname();

  // Determine the current logo text based on the pathname or default
  const currentLogoText = useMemo(() => {
    const currentPage = allPages.find(p => p.path === pathname);
    return currentPage?.name.split(' ')[0] || "VIBE"; // Use first word or default
  }, [pathname]);

  // Filter pages based on search term and admin status
  const filteredPages = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allPages.filter(page => {
      const isAdminPage = page.isAdminOnly === true;
      // Show admin pages only if the user is admin
      if (isAdminPage && !isAdmin) {
        return false;
      }
      // Filter by search term
      return page.name.toLowerCase().includes(lowerSearchTerm);
    });
  }, [searchTerm, isAdmin]); // Depend on searchTerm and isAdmin status

  // Handle scroll to hide/show header
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    // Don't hide if nav is open
    if (isNavOpen) {
      setIsHeaderVisible(true);
    } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
      setIsHeaderVisible(false); // Hide on scroll down
    } else if (currentScrollY < lastScrollY) {
      setIsHeaderVisible(true); // Show on scroll up
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY, isNavOpen]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Close nav when pathname changes
  useEffect(() => {
    setIsNavOpen(false);
  }, [pathname]);

  // Prevent body scroll when nav is open
  useEffect(() => {
    if (isNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Cleanup function
    return () => {
      document.body.style.overflow = '';
    };
  }, [isNavOpen]);

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 bg-black/70 border-b border-brand-purple/30 shadow-lg backdrop-blur-md transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        }`}
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : "-100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="text-2xl md:text-3xl font-bold text-brand-purple cyber-text glitch hover:text-glow" data-text={currentLogoText}>
              {currentLogoText}
            </Link>

            {/* Right side: User Info and Nav Toggle */}
            <div className="flex items-center gap-4">
              <UserInfo />
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="p-2 text-brand-green hover:text-brand-green/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 focus:ring-offset-black rounded-md"
                aria-label={isNavOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={isNavOpen}
              >
                {isNavOpen ? <LuX className="h-6 w-6" /> : <LuLayoutGrid className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Navigation Overlay */}
      <AnimatePresence>
        {isNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: "-50%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.4 }}
            className="fixed inset-0 z-40 bg-black/90 backdrop-blur-xl overflow-y-auto pt-20 pb-10 px-4 md:pt-24" // Added padding top matching header potential height
          >
            <div className="container mx-auto max-w-4xl">
              {/* Search Input */}
              <div className="relative mb-8">
                <input
                  type="search"
                  placeholder="Search pages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/60 border border-brand-green/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent text-lg"
                />
                <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500" />
              </div>

              {/* Page Tiles Grid */}
              {filteredPages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                  {filteredPages.map((page) => {
                    const Icon = page.icon;
                    const isCurrentPage = page.path === pathname;
                    return (
                      <Link
                        key={page.path}
                        href={page.path}
                        onClick={() => setIsNavOpen(false)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-300 aspect-square text-center",
                          page.isImportant
                            ? "col-span-2 sm:col-span-1 md:col-span-1 bg-gradient-to-br from-brand-purple/20 to-brand-blue/20 border-brand-purple/50 hover:border-brand-purple hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] scale-105" // Important style
                            : "bg-gray-800/70 border-gray-700/80 hover:bg-gray-700/90 hover:border-brand-green/70", // Regular style
                           isCurrentPage ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-black' : ''
                        )}
                        style={page.color ? { '--tile-color': `var(--color-brand-${page.color})` } as React.CSSProperties : {}} // Example for color usage later
                      >
                        {Icon && <Icon className={cn(
                            "h-6 w-6 md:h-8 md:h-8 mb-2 transition-transform duration-300 group-hover:scale-110",
                            page.isImportant ? "text-brand-yellow" : "text-brand-cyan" // Different icon colors
                        )} />}
                        <span className={cn(
                            "text-xs md:text-sm font-semibold transition-colors",
                            page.isImportant ? "text-white" : "text-gray-300 group-hover:text-brand-green"
                        )}>
                          {page.name}
                        </span>
                        {page.isAdminOnly && (
                           <span title="Admin Only" className="absolute top-1 right-1 text-xs text-red-500">🛡️</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 text-lg mt-10">No pages found matching "{searchTerm}"</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}