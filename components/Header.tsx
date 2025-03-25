"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";
import UserInfo from "@/components/user-info";
import SemanticSearch from "@/components/SemanticSearch";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Define the list of pages with their special logo texts
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
  "/rent/[id]": "RuliBeri", // Note: Dynamic routes might need special handling
  "/repo-xml": "Dev",
  "/selfdev": "Dev",
  "/shadow-fleet-admin": "RuliBeri",
  "/style-guide": "Dev",
  "/supercar-test": "RuliBeri",
  "/tasks": "YT",
  "/wheel-of-fortune": "Gifts",
  "/youtubeAdmin": "YT",
};

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();

  // Determine the current logo text based on the pathname
  const currentLogoText = pageLogos[pathname] || "RuliBeri";

  // Handle scroll events and auto-hide header after 2 seconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        // Scrolling down
        setIsHeaderVisible(false);
      } else {
        // Scrolling up
        setIsHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);

      // Reset the timer on scroll
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsHeaderVisible(false);
      }, 2000);
    };

    window.addEventListener("scroll", handleScroll);

    // Initial timer to hide header after 2 seconds
    timeoutId = setTimeout(() => {
      setIsHeaderVisible(false);
    }, 2000);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [lastScrollY]);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-muted shadow-[0_0_15px_rgba(255,107,107,0.3)] backdrop-blur-md transition-transform duration-300 ${
        isHeaderVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo with dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-xl md:text-3xl font-bold text-gradient cyber-text glitch hover:text-glow"
              data-text={currentLogoText}
            >
              {currentLogoText}
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-muted rounded shadow-lg">
                <ul className="py-2">
                  {Object.entries(pageLogos).map(([path, logoText]) => (
                    <li key={path}>
                      <Link
                        href={path}
                        className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        {logoText}
                      </Link>
                    </li>
                  ))}
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