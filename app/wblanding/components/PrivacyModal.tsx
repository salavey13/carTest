"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

const PRIVACY_POLICY_URL = 
  "https://raw.githubusercontent.com/salavey13/carTest/main/docs/PRIVACY_POLICY.md";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal = ({ isOpen, onClose }: PrivacyModalProps) => {
  const [mdContent, setMdContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !mdContent) {
      fetchPrivacyPolicy();
    }
  }, [isOpen]);

  const fetchPrivacyPolicy = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(PRIVACY_POLICY_URL);
      if (!response.ok) throw new Error("Failed to load privacy policy");
      const text = await response.text();
      setMdContent(text);
    } catch (error) {
      setMdContent("# Ошибка загрузки\nНе удалось загрузить политику конфиденциальности. Пожалуйста, попробуйте позже или свяжитесь с @salavey13.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-3xl md:h-[85vh] z-50 bg-zinc-950 border border-brand-cyan/30 rounded-2xl shadow-2xl shadow-brand-cyan/10 flex flex-col overflow-hidden font-mono"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 bg-black/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30">
                  <Shield className="w-5 h-5 text-brand-cyan" />
                </div>
                <div>
                  <h2 className="font-orbitron font-bold text-white text-lg">PRIVACY_POLICY.md</h2>
                  <p className="text-xs text-zinc-500">SOVEREIGN v1.0 // 152-ФЗ COMPLIANT</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-zinc-400 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none 
              prose-headings:font-orbitron prose-headings:text-brand-cyan prose-headings:text-lg
              prose-p:text-zinc-300 prose-p:leading-relaxed
              prose-strong:text-white prose-strong:font-bold
              prose-a:text-brand-cyan hover:prose-a:text-brand-cyan/80 prose-a:no-underline hover:prose-a:underline
              prose-code:text-brand-yellow prose-code:bg-brand-yellow/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-li:text-zinc-400 prose-li:marker:text-brand-cyan
              prose-hr:border-white/10
              prose-blockquote:border-l-brand-cyan prose-blockquote:bg-brand-cyan/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
            ">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-4 text-zinc-500">
                  <div className="w-8 h-8 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
                  <span className="text-xs uppercase tracking-widest">Загрузка манифеста...</span>
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {mdContent}
                </ReactMarkdown>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-black/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <div className="text-[10px] text-zinc-600 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                <span>Расположение: github.com/salavey13/carTest/blob/main/docs/PRIVACY_POLICY.md</span>
              </div>
              <div className="flex gap-3">
                <Link 
                  href="https://github.com/salavey13/carTest/blob/main/docs/PRIVACY_POLICY.md" 
                  target="_blank"
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Открыть в GitHub
                </Link>
                <Button 
                  onClick={onClose}
                  size="sm"
                  className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-bold text-xs px-4"
                >
                  Я ПОНЯЛ(А)
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};