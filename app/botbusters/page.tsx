"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAnon, createAuthenticatedClient } from "@/hooks/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import BotHuntingToolsSection from "@/components/PurchaseScriptsSection";
import Link from "next/link";

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
          <Link href="#tips" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Tips
          </Link>
          <Link href="#automa-scripts" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Automa Scripts
          </Link>
          <Link href="#stats" className="text-white hover:text-gray-300 whitespace-nowrap transition-colors">
            Stats
          </Link>
        </div>
      </nav>
    </header>
  );
}

// BotBustersHeroSection: Bold, playful introduction
function BotBustersHeroSection() {
  return (
    <section id="home" className="text-center py-16 bg-gray-900">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
        Join the Fight Against Bots on 9GAG!
      </h1>
      <p className="text-lg md:text-xl mb-8 text-gray-300">
        Help us keep 9GAG bot-free with powerful tools and community action.
      </p>
      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white transition-colors">
        Get Started
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

// BotBustersBlocklistFormSection: Form for blocklist submission
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
      for (const username of usernameList) {
        const { error: insertError } = await client.from("blocklist").insert({
          username,
          submitted_by: dbUser.user_id,
        });
        if (insertError) throw insertError;
      }
      setUsernames("");
    } catch (err) {
      setError("Failed to submit blocklist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="submit-blocklist" className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8 text-white">
        Submit Your Blocklist
      </h2>
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

// BotBustersDailyStatsSection: Display daily stats
function BotBustersDailyStatsSection() {
  const [stats, setStats] = useState({ botsBlocked: 0, reportsFiled: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: blocks, error: blocksError } = await supabaseAnon
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "block")
          .gte("created_at", today);
        if (blocksError) throw blocksError;

        const { data: reports, error: reportsError } = await supabaseAnon
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "report")
          .gte("created_at", today);
        if (reportsError) throw reportsError;

        setStats({
          botsBlocked: blocks.length,
          reportsFiled: reports.length,
        });
      } catch (err) {
        setError("Failed to load stats.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) return <p className="text-center py-16 text-white">Loading stats...</p>;
  if (error) return <p className="text-center py-16 text-red-500">{error}</p>;

  return (
    <section id="stats" className="py-16 bg-gray-900 text-center">
      <h2 className="text-3xl font-bold mb-4 text-white">Daily Bot-Hunting Stats</h2>
      <div className="text-gray-300">
        <p>Bots Blocked: {stats.botsBlocked}</p>
        <p>Reports Filed: {stats.reportsFiled}</p>
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
      <Footer />
    </div>
  );
}
