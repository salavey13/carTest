"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import UserInfo from "@/components/user-info";
import SemanticSearch from "@/components/SemanticSearch";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Define groups (feature packs) with display names, icons, and colors
const groups = {
  "SLY13": { displayName: "SLY13", icon: "🚀", color: "bg-blue-500" },
  "RuliBeri": { displayName: "RuliBeri", icon: "🏎️", color: "bg-red-500" },
  "9GAG": { displayName: "9GAG", icon: "😂", color: "bg-green-500" },
  "YT": { displayName: "YT", icon: "🎥", color: "bg-yellow-500" },
  "Tips": { displayName: "Tips", icon: "💡", color: "bg-purple-500" },
  "CRM": { displayName: "CRM", icon: "📊", color: "bg-orange-500" },
  "Dev": { displayName: "Dev", icon: "💻", color: "bg-pink-500" },
  "Gifts": { displayName: "Gifts", icon: "🎁", color: "bg-teal-500" },
};

// Map pages to their groups and define display names
const pageGroups: Record<string, string> = {
  "/about": "SLY13",
  "/admin": "RuliBeri",
  "/botbusters": "9GAG",
  "/bullshitdetector": "YT",
  "/buy-subscription": "RuliBeri",
  "/cyber-garage": "RuliBeri",
  "/donate": "Tips",
  "/invoices": "RuliBeri",
  "/": "RuliBeri",
  "/pavele0903": "CRM",
  "/rent-car": "RuliBeri",
  "/rent/[id]": "RuliBeri",
  "/repo-xml": "Dev",
  "/selfdev": "Dev",
  "/shadow-fleet-admin": "RuliBeri",
  "/style-guide": "Dev",
  "/supercar-test": "RuliBeri",
  "/tasks": "YT",
  "/wheel-of-fortune": "Gifts",
  "/youtubeAdmin": "YT",
};

const pageLogos: Record<string, string> = {
  "/about": "SLY13",
  "/admin": "RuliBeri",
  "/botbusters": "9GAG",
  "/bullshitdetector": "YT",
  "/buy-subscription": "RuliBeri",
  "/cyber-garage": "RuliBeri",
  "/donate": "Tips",
  "/invoices": "RuliBeri",
  "/": "RuliBeri",
  "/pavele0903": "CRM",
  "/rent-car": "RuliBeri",
  "/rent/[id]": "RuliBeri",
  "/repo-xml": "Dev",
  "/selfdev": "Dev",
  "/shadow-fleet-admin": "RuliBeri",
  "/style-guide": "Dev",
  "/supercar-test": "RuliBeri",
  "/tasks": "YT",
  "/wheel-of-fortune": "Gifts",
  "/youtubeAdmin": "YT",
};

const pageDisplayNames: Record<string, string> = {
  "/about": "About",
  "/admin": "Admin Panel",
  "/botbusters": "Bot Busters",
  "/bullshitdetector": "BS Detector",
  "/buy-subscription": "Subscribe",
  "/cyber-garage": "Cyber Garage",
  "/donate": "Donate",
  "/invoices": "Invoices",
  "/": "Home",
  "/pavele0903": "CRM Dashboard",
  "/rent-car": "Rent a Car",
  "/rent/[id]": "Car Details",
  "/repo-xml": "XML Repo",
  "/selfdev": "Self Dev",
  "/shadow-fleet-admin": "Fleet Admin",
  "/style-guide": "Style Guide",
  "/supercar-test": "Supercar Test",
  "/tasks": "Tasks",
  "/wheel-of-fortune": "Wheel of Fortune",
  "/youtubeAdmin": "YT Admin",
};

// Tooltip description for Dev pages
const devTooltip = "These pages are the hidden pearls of the Vibe Coding Template—showcasing innovative dev tools and style guides that power our creative chaos!";

// Organize pages into grouped and ungrouped
const uniqueGroups = Array.from(new Set(Object.values(pageGroups)));
const groupedPages: Record<string, string[]> = {};
uniqueGroups.forEach((group) => {
  groupedPages[group] = Object.entries(pageGroups)
    .filter(([_, g]) => g === group)
    .map(([path]) => path);
});
const ungroupedPages = Object.keys(pageLogos).filter((path) => !pageGroups[path]);

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();

  // Determine the current logo text based on the pathname
  const currentLogoText = pageLogos[pathname] || "RuliBeri";

  // Handle scroll events and auto-hide header after 2 seconds, unless dropdown or search is open
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 50 && !isDropdownOpen && !isSearchOpen) {
        // Scrolling down, hide only if past threshold and no dropdown/search
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);

      // Reset the timer on scroll, but only if dropdown/search isn’t active
      if (!isDropdownOpen && !isSearchOpen) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setIsHeaderVisible(false);
        }, 2000);
      }
    };

    window.addEventListener("scroll", handleScroll);

    // Initial timer to hide header after 2 seconds, unless dropdown/search is active
    if (!isDropdownOpen && !isSearchOpen) {
      timeoutId = setTimeout(() => {
        setIsHeaderVisible(false);
      }, 2000);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [lastScrollY, isDropdownOpen, isSearchOpen]);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 bg-card bg-opacity-80 border-b border-muted shadow-[0_0_15px_rgba(255,107,107,0.3)] backdrop-blur-md transition-transform duration-300 rounded-b-lg m-2 ${
        isHeaderVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo with enhanced dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-xl md:text-3xl font-bold text-gradient cyber-text glitch hover:text-glow"
              data-text={currentLogoText}
            >
              {currentLogoText}
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-muted rounded shadow-lg max-h-[80vh] overflow-y-auto">
                <ul className="py-2">
                  {/* Grouped pages */}
                  {uniqueGroups.map((group) => (
                    <li key={group} className="mb-2">
                      <div className={`px-4 py-2 text-sm font-bold text-white ${groups[group].color}`}>
                        {groups[group].icon} {groups[group].displayName}
                      </div>
                      <ul>
                        {groupedPages[group].map((path) => (
                          <li key={path} className="relative group">
                            <Link
                              href={path}
                              className="block px-4 py-2 text-sm text-foreground hover:bg-muted flex items-center"
                              onClick={() => setIsDropdownOpen(false)}
                            >
                              {pageDisplayNames[path]}
                              {group === "Dev" && (
                                <span className="ml-2 text-pink-400">ℹ️</span>
                              )}
                            </Link>
                            {group === "Dev" && (
                              <div className="absolute left-full top-0 mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {devTooltip}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                  {/* Ungrouped pages */}
                  {ungroupedPages.length > 0 && (
                    <li className="mt-4">
                      <div className="px-4 py-2 text-sm font-bold text-white bg-gray-500">
                        Other
                      </div>
                      <ul>
                        {ungroupedPages.map((path) => (
                          <li key={path}>
                            <Link
                              href={path}
                              className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                              onClick={() => setIsDropdownOpen(false)}
                            >
                              {pageDisplayNames[path]}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div className="hidden md:flex flex-1 max-w-xl px-6">
            <SemanticSearch />
          </div>

          <div className="flex items-center gap-4">
            <UserInfo />
            <button
              className="md:hidden flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-mono transition-colors text-glow"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
            >
              {isSearchOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span>{isSearchOpen ? "Закрыть" : "Поиск"}</span>
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4"
          >
            <SemanticSearch compact />
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}