// page.tsx
"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAnon, createAuthenticatedClient } from "@/hooks/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import BotHuntingToolsSection from "@/components/PurchaseScriptsSection"
// BotBustersHeader: Navigation bar for the app
function BotBustersHeader() {
  return (
    <header className="bg-gray-800 p-4 pt-24 sticky top-0 z-10">
      <nav className="flex justify-between items-center container mx-auto">
        <div className="text-xl font-bold">BotBusters</div>
        <div className="space-x-4">
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Home
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Submit Blocklist
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Tips
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Automa Scripts
          </Button>
          <Button variant="ghost" className="text-white hover:text-gray-300">
            Stats
          </Button>
        </div>
      </nav>
    </header>
  );
}

// BotBustersHeroSection: Bold introduction with CTA
function BotBustersHeroSection() {
  return (
    <section className="text-center py-16 bg-gray-900">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Join the Fight Against Bots on 9GAG!
      </h1>
      <p className="text-lg md:text-xl mb-8 text-gray-300">
        Help us keep 9GAG bot-free with powerful tools and community action.
      </p>
      <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
        Get Started
      </Button>
    </section>
  );
}

// BotBustersFeaturesSection: Showcase core tools
function BotBustersFeaturesSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">Our Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 container mx-auto px-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Block'em All</CardTitle>
          </CardHeader>
          <CardContent>Batch-block known bots with one click.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Purge'em All</CardTitle>
          </CardHeader>
          <CardContent>Report and cleanse bot activity in bulk.</CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle>Hunter</CardTitle>
          </CardHeader>
          <CardContent>Find new bots by tracing their network.</CardContent>
        </Card>
      </div>
    </section>
  );
}

// BotBustersBlocklistFormSection: Form for submitting bot usernames
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
      // Optionally, add a success message here
    } catch (err) {
      setError("Failed to submit blocklist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">
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
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </section>
  );
}

// BotBustersTipsSection: Tips for spotting bots
function BotBustersTipsSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">How to Spot a Bot</h2>
      <ul className="list-disc list-inside max-w-md mx-auto text-gray-300">
        <li>Repetitive comments like "lol nice" on every post.</li>
        <li>Usernames with random numbers (e.g., User12345).</li>
        <li>Accounts with hundreds of posts but no followers.</li>
      </ul>
    </section>
  );
}

// BotBustersAutomaScriptsSection: Automa script downloads and explanation
function BotBustersAutomaScriptsSection() {
  return (
    <section className="py-16 bg-gray-900">
      <h2 className="text-3xl font-bold text-center mb-8">
        Download Automa Scripts
      </h2>
      <p className="text-center mb-8 max-w-2xl mx-auto text-gray-300">
        Our tools are powered by{" "}
        <a
          href="https://www.automa.app/"
          className="text-blue-400 hover:underline"
        >
          Automa
        </a>
        , a browser extension that automates tasks with real clicks and smart
        JavaScript. From scraping bot data to blocking them in bulk, Automa
        handles it all—no complex setups needed. With built-in scheduling, you
        can set it to run daily and keep 9GAG clean!
      </p>
      <div className="flex justify-center space-x-4">
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => window.open("/scripts/blockemall.json", "_blank")}
        >
          Block'em All
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => window.open("/scripts/purgeemall.json", "_blank")}
        >
          Purge'em All
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => window.open("/scripts/hunter.json", "_blank")}
        >
          Hunter
        </Button>
      </div>
    </section>
  );
}

// BotBustersDailyStatsSection: Fetch and display daily bot-hunting stats
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

  if (isLoading) return <p className="text-center py-16">Loading stats...</p>;
  if (error) return <p className="text-center py-16 text-red-500">{error}</p>;

  return (
    <section className="py-16 bg-gray-900 text-center">
      <h2 className="text-3xl font-bold mb-4">Daily Bot-Hunting Stats</h2>
      <div className="text-gray-300">
        <p>Bots Blocked: {stats.botsBlocked}</p>
        <p>Reports Filed: {stats.reportsFiled}</p>
      </div>
    </section>
  );
}

// Main Home component: The default export of page.tsx
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
