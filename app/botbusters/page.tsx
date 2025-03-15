"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAnon, createAuthenticatedClient } from "@/hooks/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
//import BotHuntingToolsSection from "@/components/PurchaseScriptsSection";
import Link from "next/link";
import { toast } from "sonner";
//"use client";
//import { useState, useEffect } from "react";
//import { useTelegram } from "@/hooks/useTelegram"; // Adjust path to your Telegram hook
import { sendTelegramInvoice } from "@/app/actions"; // Adjust path to your invoice actio
//import { createInvoice, supabaseAdmin } from "@/hooks/supabase"; // Adjust path to your Supabase hook
import { motion } from "framer-motion";
//import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
//import Link from "next/link";

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

// BotBustersHeader: Navigation bar with horizontal scrolling
function BotBustersHeader() {
  return (
    <header className="bg-gray-800 p-4 pt-24 sticky top-0 z-10">
      <nav className="flex items-center container mx-auto">
        <div className="text-xl font-bold text-white">BotBusters</div>
        <div className="flex overflow-x-auto space-x-4 ml-4 scrollbar-hide">
          <Link href="#home" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Home
          </Link>
          <Link href="#submit-blocklist" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Submit Blocklist
          </Link>
          <Link href="#stats" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Stats
          </Link>
          <Link
            href="https://grok.com/share/bGVnYWN5_2d4f7c04-f5b5-43d9-a4ee-141b2c6130c2"
            target="_blank"
            className="text-white hover:text-gray-300 whitespace-nowrap transition-colors"
          >
            Dev Chat
          </Link>
        </div>
      </nav>
    </header>
  );
}

// BotBustersHeroSection: Bold introduction with updated CTA
function BotBustersHeroSection() {
  return (
    <section id="home" className="text-center py-16 bg-gray-900">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
        Join the Fight Against Bots on 9GAG!
      </h1>
      <p className="text-lg md:text-xl mb-8 text-gray-300">
        Help us keep 9GAG bot-free with powerful tools and community action.
      </p>
      <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white transition-colors">
        <Link href="https://t.me/OneSitePlsBot/block9gag" target="_blank">
          Get Started
        </Link>
      </Button>
    </section>
  );
}

// BotBustersFeaturesSection: Highlight core tools
function BotBustersFeaturesSection() {
  return (
    <section id="features" className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8 text-white">Our Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 container mx-auto px-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Block'em All</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">Batch-block known bots with one click.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Purge'em All</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">Report and cleanse bot activity in bulk.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Hunter</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-300">Find new bots by tracing their network.</CardContent>
        </Card>
      </div>
    </section>
  );
}

// BotBustersBlocklistFormSection: Improved submission with upsert
function BotBustersBlocklistFormSection({ dbUser }) {
  const [usernames, setUsernames] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const usernameList = usernames.split(",").map((name) => name.trim());
      const client = await createAuthenticatedClient(dbUser.user_id);
      const { error: upsertError } = await client.from("bots").upsert(
        usernameList.map((username) => ({
          user_name: username,
          submitted_by: dbUser.user_id,
          last_updated: new Date().toISOString(),
        })),
        { onConflict: "user_name", ignoreDuplicates: false } // Overwrite existing entries
      );
      if (upsertError) throw upsertError;
      setUsernames("");
      toast.success("Blocklist submitted successfully!");
    } catch (err) {
      setError("Failed to submit blocklist. Please try again.");
      toast.error("Failed to submit blocklist.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="submit-blocklist" className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8 text-white">Submit Your Blocklist</h2>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
        <Input
          placeholder="Enter bot usernames (comma-separated)"
          className="bg-gray-800 border-gray-700 text-white"
          value={usernames}
          onChange={(e) => setUsernames(e.target.value)}
        />
        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </section>
  );
}

// BotBustersDailyStatsSection: Enhanced stats with precise counts and bot list export
function BotBustersDailyStatsSection() {
  const [stats, setStats] = useState({
    botsBlocked: 0,
    reportsFiled: 0,
    totalBots: 0,
    confirmedBots: 0,
  });
  const [botList, setBotList] = useState([]);
  const [selectedList, setSelectedList] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStatsAndBots() {
      try {
        const today = new Date().toISOString().split("T")[0];

        // Daily blocks
        const { data: blocks, error: blocksError } = await supabaseAnon
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "block")
          .gte("created_at", today);
        if (blocksError) throw blocksError;

        // Daily reports
        const { data: reports, error: reportsError } = await supabaseAnon
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "report")
          .gte("created_at", today);
        if (reportsError) throw reportsError;

        // Total bots
        const { count: totalBotsCount, error: totalError } = await supabaseAnon
          .from("bots")
          .select("id", { count: "exact" });
        if (totalError) throw totalError;

        // Confirmed bots
        const { count: confirmedBotsCount, error: confirmedError } = await supabaseAnon
          .from("bots")
          .select("id", { count: "exact" })
          .eq("confirmed", true);
        if (confirmedError) throw confirmedError;

        // Fetch all bot usernames
        const { data: bots, error: botsError } = await supabaseAnon
          .from("bots")
          .select("user_name")
          .order("last_updated", { ascending: false });
        if (botsError) throw botsError;

        setStats({
          botsBlocked: blocks.length,
          reportsFiled: reports.length,
          totalBots: totalBotsCount,
          confirmedBots: confirmedBotsCount,
        });
        setBotList(bots.map((bot) => bot.user_name));
      } catch (err) {
        setError("Failed to load stats.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatsAndBots();
  }, []);

  const getBotList = (limit) => {
    return botList.slice(0, limit).join(",");
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  if (isLoading) return <p className="text-center py-16 text-white">Loading stats...</p>;
  if (error) return <p className="text-center py-16 text-red-500">{error}</p>;

  return (
    <section id="stats" className="py-16 bg-gray-900 text-center">
      <h2 className="text-3xl font-bold mb-4 text-white">Bot-Hunting Stats</h2>
      <div className="text-gray-300 space-y-2">
        <p>Daily Bots Blocked: {stats.botsBlocked}</p>
        <p>Daily Reports Filed: {stats.reportsFiled}</p>
        <p>Total Bots Identified: {stats.totalBots}</p>
        <p>Confirmed Bots: {stats.confirmedBots}</p>
        <Link
          href="https://docs.google.com/spreadsheets/d/1rpSqA9Dh_QSNgocqtpCm9a371pTRldJ-hshUSCyjTmo/edit?pli=1&gid=0#gid=0"
          target="_blank"
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          View Bot List
        </Link>
      </div>

      {/* Bot List Export */}
      <div className="mt-8 max-w-md mx-auto">
        <h3 className="text-xl font-semibold mb-4 text-white">Export Bot List</h3>
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(13))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            Top 13
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(69))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            Top 69
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(146))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            Top 146
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(420))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            Top 420
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(1000))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            Top 1k
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(botList.join(","))}
            className="text-white border-gray-700 hover:bg-gray-700"
          >
            All
          </Button>
        </div>
        {selectedList && (
          <div className="relative">
            <Input
              value={selectedList}
              readOnly
              className="bg-gray-800 border-gray-700 text-white pr-20"
            />
            <Button
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleCopy(selectedList)}
            >
              Copy
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

// Main Home component
export default function BotBustersHome() {
  const { dbUser } = useTelegram();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <BotBustersHeader />
      <BotBustersHeroSection />
      <BotBustersFeaturesSection />
      {dbUser && <BotBustersBlocklistFormSection dbUser={dbUser} />}
      <BotHuntingToolsSection />
      <BotBustersDailyStatsSection />
    </div>
  );
}
