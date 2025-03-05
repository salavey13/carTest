"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram"; // Adjust path to your Telegram hook
import { sendTelegramInvoice } from "@/app/actions"; // Adjust path to your invoice action
import { createInvoice } from "@/hooks/supabase"; // Adjust path to your Supabase hook
import { motion } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

// Define the script pack details
const SCRIPT_PACK = {
  id: "automa_scripts",
  name: "Automa Bot-Hunting Scripts",
  price: 100, // Price in XTR (adjust as needed)
  description: "Unlock powerful Automa scripts to automate bot-blocking on 9GAG.",
  color: "from-green-600 to-teal-400",
};

// Bot creation date: 256 days before March 4, 2025
const BOT_CREATION_DATE = "2024-06-22";

export default function BotHuntingToolsSection() {
  const { user, isInTelegramContext } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  // Calculate bot age dynamically
  const creationDate = parseISO(BOT_CREATION_DATE);
  const today = new Date();
  const ageInDays = differenceInDays(today, creationDate);

  // Check if the user already has script access
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const { data, error } = await supabase
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
      }
    };
    checkAccess();
  }, [user]);

  // Handle purchase logic
  const handlePurchase = async () => {
    if (!user) {
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
        SCRIPT_PACK.description,
        payload,
        SCRIPT_PACK.price
      );
      if (!response.success) throw new Error(response.error || "Failed to send invoice");
      setSuccess(true);
      toast.success("Invoice sent to Telegram!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError("Purchase error: " + errMsg);
      toast.error("Purchase error: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-16 bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted">
        <h2 className="text-3xl font-bold text-center mb-8 text-gradient cyber-text">
          Bot-Hunting Tools
        </h2>

        {/* Bot Tips Section */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-4 text-primary">How to Spot a Bot</h3>
          <ul className="list-disc list-inside text-gray-300 font-mono">
            <li>Repetitive comments like "lol nice" on every post.</li>
            <li>Usernames with random numbers (e.g., User12345).</li>
            <li>Accounts with hundreds of posts but no followers.</li>
            <li>
              Accounts are currently{" "}
              <span className="text-primary font-bold">{ageInDays} days old</span>{" "}
              (created on{" "}
              <span className="text-teal-400">{creationDate.toLocaleDateString()}</span>).
            </li>
          </ul>
        </div>

        {/* Purchase Section */}
        <div>
          <h3 className="text-2xl font-bold mb-4 text-primary">Get Automa Scripts</h3>
          <p className="text-muted-foreground mb-4">{SCRIPT_PACK.description}</p>
          <p className="text-3xl font-bold mb-6 font-mono">{SCRIPT_PACK.price} XTR</p>
          {hasAccess ? (
            <p className="text-green-400 font-mono">Access already activated!</p>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={loading}
              className={`w-full p-3 rounded-lg font-mono text-lg ${
                loading
                  ? "bg-muted cursor-not-allowed animate-pulse"
                  : "bg-primary hover:bg-secondary text-primary-foreground"
              } transition-all`}
            >
              {loading ? "Processing..." : "Buy Now"}
            </button>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-destructive text-sm font-mono mt-4 text-center"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
