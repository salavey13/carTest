"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin, createInvoice } from "@/hooks/supabase";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import Link from "next/link";
import { translations } from "@/components/translations";

const SCRIPT_PACK = {
  id: "automa_scripts",
  name: "Automa Bot-Hunting Scripts",
  price: 100,
  color: "from-green-600 to-teal-400",
};

const BOT_CREATION_DATE = "2024-06-22";

export default function PurchaseScriptsSection({ language }: { language: "en" | "ru" }) {
  const { user, isInTelegramContext } = useTelegram();
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

  return (
    <section className="py-16 bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-8 text-white font-orbitron">
          {translations[language].toolsTitle}
        </h2>

        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-4 text-cyan-400">{translations[language].howToSpot}</h3>
          <ul className="list-disc list-inside text-gray-300 font-mono">
            <li>{translations[language].repetitiveComments}</li>
            <li>{translations[language].randomUsernames}</li>
            <li>{translations[language].noFollowers}</li>
            {/*<li>
              {translations[language].accountAge
                .replace("{age}", ageInDays.toString())
                .replace("{date}", creationDate.toLocaleDateString())}
            </li>*/}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">Get Automa Scripts</h3>
            <p className="text-gray-300 mb-4">{translations[language].automaDesc}</p>
            <p className="text-3xl font-bold mb-6 font-mono text-white">{SCRIPT_PACK.price} XTR</p>
            {/*hasAccess ? (
              <>
                <p className="text-green-400 font-mono">Access already activated!</p>
                <Link
                  href="https://automa.site/workflow/16rZppoNhrm7HCJSncPJV"
                  target="_blank"
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View Automa Block Script
                </Link>
              </>
            ) : (
              <>
                <Button
                  onClick={handlePurchase}
                  disabled={loading}
                  className={`w-full p-3 rounded-lg font-mono text-lg bg-gradient-to-r ${SCRIPT_PACK.color} hover:from-green-700 hover:to-teal-500 text-white transition-all shadow-glow`}
                >
                  {loading ? translations[language].processing : translations[language].buyNow]}
                </Button>
                <p className="text-yellow-400 font-bold mt-4 font-mono animate-pulse">
                  Be the FIRST Bot Hunter! Use code <span className="text-white">FIRSTHUNTER</span> for 20%
                  off – limited time only!
                </p>
              </>
            )*/}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-mono mt-4 text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">Preorder Block'em All</h3>
            <p className="text-gray-300 mb-4">{translations[language].blockEmAllDesc}</p>
            <Button
              disabled
              className="w-full p-3 rounded-lg font-mono text-lg bg-gray-600 text-white shadow-glow"
            >
              {translations[language].preorder}
            </Button>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">Preorder Purge'em All</h3>
            <p className="text-gray-300 mb-4">{translations[language].purgeEmAllDesc}</p>
            <Button
              disabled
              className="w-full p-3 rounded-lg font-mono text-lg bg-gray-600 text-white shadow-glow"
            >
              {translations[language].preorder}
            </Button>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">Preorder Hunter</h3>
            <p className="text-gray-300 mb-4">{translations[language].hunterDesc}</p>
            <Button
              disabled
              className="w-full p-3 rounded-lg font-mono text-lg bg-gray-600 text-white shadow-glow"
            >
              {translations[language].preorder}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
