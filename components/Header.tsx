"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import UserInfo from "@/components/user-info";
import SemanticSearch from "@/components/SemanticSearch";
import { motion } from "framer-motion";

export default function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-muted shadow-[0_0_15px_rgba(255,107,107,0.3)] backdrop-blur-md"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-3xl md:text-4xl font-bold text-gradient cyber-text glitch hover:text-glow"
            data-text="RuliBeri"
          >
            Ruli<span className="text-accent">Beri</span>
          </Link>

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

