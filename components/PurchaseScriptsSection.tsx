// /components/PurchaseScriptsSection.tsx
"use client";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin, createInvoice } from "@/hooks/supabase";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { translations } from "./translations"; // Adjust path if needed

const SCRIPT_PACK = {
  id: "automa_scripts",
  name: "Automa Bot-Hunting Scripts",
  price: 100,
  color: "from-green-600 to-teal-400",
};

const BOT_CREATION_DATE = "2024-06-22";

export default function PurchaseScriptsSection({ language }: { language: "en" | "ru" }) {
  const { user, isInTelegramContext, tg } = useAppContext(); // Added tg
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const creationDate = parseISO(BOT_CREATION_DATE);
  const today = new Date();
  const ageInDays = differenceInDays(today, creationDate);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("has_script_access")
        .eq("user_id", user.id.toString())
        .single();
      if (error) {
        toast.error("Error checking access");
      } else {
        setHasAccess(data?.has_script_access || false);
        if (data?.has_script_access) toast.success("You already have script access!");
      }
    };
    checkAccess();
  }, [user]);

  const handlePurchase = async () => {
    if (!user?.id) {
      setError("Please log in via Telegram");
      toast.error("Please log in via Telegram");
      return;
    }
    if (hasAccess) {
      setError("You already have access");
      toast.error("Access already granted");
      return;
    }
    setLoading(true);
    setError(null);

    if (!isInTelegramContext) {
      setSuccess(true);
      setError("Demo mode: Invoice created!");
      toast.success("Demo: Invoice created!");
      setLoading(false);
      return;
    }

    try {
      const metadata = { type: "script_access" };
      const payload = `script_access_${user.id}_${Date.now()}`;
      await createInvoice("script_access", payload, user.id.toString(), SCRIPT_PACK.price, metadata);
      const response = await sendTelegramInvoice(
        user.id.toString(),
        SCRIPT_PACK.name,
        translations[language].automaDesc,
        payload,
        SCRIPT_PACK.price
      );
      if (!response.success) throw new Error(response.error || "Failed to send invoice");
      setSuccess(true);
      toast.success("Invoice sent to Telegram!");
      await notifyAdmin(`User ${user.id} purchased ${SCRIPT_PACK.name} for ${SCRIPT_PACK.price} XTR`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError(`Purchase error: ${errMsg}`);
      toast.error(`Purchase error: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScriptLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isInTelegramContext && tg) {
      e.preventDefault();
      tg.openLink("https://automa.site/workflow/16rZppoNhrm7HCJSncPJV");
    }
    // Outside Telegram, the href will open in a new tab as usual
  };

  return (
    <section className="py-16 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-4xl mx-auto p-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30">
        <h2 className="text-4xl font-extrabold text-center mb-8 text-cyan-300 tracking-widest font-orbitron uppercase">
          {translations[language].toolsTitle}
        </h2>

        {/* Bot Tips Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-4 text-teal-400 font-orbitron">
            {translations[language].howToSpot}
          </h3>
          <ul className="list-disc list-inside text-gray-200 font-mono text-sm space-y-2">
            <li>{translations[language].repetitiveComments}</li>
            <li>{translations[language].randomUsernames}</li>
            <li>{translations[language].noFollowers}</li>
            <li>
              {translations[language].accountAge
                ? translations[language].accountAge
                    .replace("{age}", ageInDays.toString())
                    .replace("{date}", creationDate.toLocaleDateString())
                : translations[language].accountAgeUnavailable}
            </li>
          </ul>
        </div>

        {/* Purchase and Preorder Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Automa Scripts */}
          <div className="p-4 bg-gray-900/60 rounded-lg border border-cyan-500/40 hover:border-cyan-500 transition-all duration-300">
            <h3 className="text-2xl font-bold mb-3 text-teal-400 font-orbitron">Get Automa Scripts</h3>
            <p className="text-gray-300 mb-4 font-mono text-sm">{translations[language].automaDesc}</p>
            <p className="text-3xl font-bold mb-6 text-white font-mono tracking-tight">
              {SCRIPT_PACK.price} <span className="text-teal-400">XTR</span>
            </p>
            {hasAccess && (
              <div className="space-y-3">
                <p className="text-green-400 font-mono text-sm tracking-wide">
                  {translations[language].accessActivated}
                </p>
                <a
                  href="https://automa.site/workflow/16rZppoNhrm7HCJSncPJV"
                  onClick={handleScriptLinkClick}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 font-mono text-sm underline transition-colors duration-200"
                >
                  {translations[language].viewScript}
                </a>
              </div>
            )}
            {!hasAccess && (
              <div className="space-y-4">
                <Button
                  onClick={handlePurchase}
                  disabled={loading}
                  className="w-full py-3 font-mono text-lg bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/50 transition-all duration-300"
                >
                  {loading ? translations[language].processing : translations[language].buyNow}
                </Button>
                <p className="text-yellow-300 font-mono text-sm animate-pulse tracking-wide">
                  {translations[language].firstHunter}
                </p>
              </div>
            )}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm font-mono mt-4 text-center tracking-wide"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Preorder Block'em All */}
          <div className="p-4 bg-gray-900/60 rounded-lg border border-cyan-500/40 hover:border-cyan-500 transition-all duration-300">
            <h3 className="text-2xl font-bold mb-3 text-teal-400 font-orbitron">Block'em All</h3>
            <p className="text-gray-300 mb-4 font-mono text-sm">{translations[language].blockEmAllDesc}</p>
            {/* Note: This link might be a placeholder; consider restricting or removing until available */}
            <a
              href="https://automa.site/workflow/16rZppoNhrm7HCJSncPJV"
              onClick={handleScriptLinkClick}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm underline transition-colors duration-200"
            >
              {translations[language].viewScript}
            </a>
          </div>

          {/* Preorder Purge'em All */}
          <div className="p-4 bg-gray-900/60 rounded-lg border border-cyan-500/40 hover:border-cyan-500 transition-all duration-300">
            <h3 className="text-2xl font-bold mb-3 text-teal-400 font-orbitron">Purge'em All</h3>
            <p className="text-gray-300 mb-4 font-mono text-sm">{translations[language].purgeEmAllDesc}</p>
            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-3 font-mono text-lg bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/50 transition-all duration-300"
            >
              {translations[language].preorder}
            </Button>
          </div>

          {/* Preorder Hunter */}
          <div className="p-4 bg-gray-900/60 rounded-lg border border-cyan-500/40 hover:border-cyan-500 transition-all duration-300">
            <h3 className="text-2xl font-bold mb-3 text-teal-400 font-orbitron">Hunter</h3>
            <p className="text-gray-300 mb-4 font-mono text-sm">{translations[language].hunterDesc}</p>
            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-3 font-mono text-lg bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/50 transition-all duration-300"
            >
              {translations[language].preorder}
            </Button>
            <p className="text-yellow-300 font-mono text-sm animate-pulse tracking-wide">
              {translations[language].firstHunter}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
