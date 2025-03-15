"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin, createAuthenticatedClient } from "@/hooks/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import BotHuntingToolsSection from "@/components/PurchaseScriptsSection"; 

// Define translations for English and Russian
const translations = {
  en: {
    title: "Join the Fight Against Bots on 9GAG!",
    description: "Help us keep 9GAG bot-free with powerful tools and community action.",
    welcome: "Welcome, 9GAG users! Tired of bots ruining your experience? Our tools help you block and report bots efficiently. Join the community effort to keep 9GAG clean and fun!",
    share: "Share with 9GAG Community",
    statsTitle: "Bot-Hunting Stats",
    submitTitle: "Submit Your Blocklist",
    dailyBotsBlocked: "Daily Bots Blocked",
    dailyReportsFiled: "Daily Reports Filed",
    totalBots: "Total Bots Identified",
    confirmedBots: "Confirmed Bots",
    viewBotList: "View Bot List",
    exportBotList: "Export Bot List",
    placeholder: "Enter bot usernames (comma-separated)",
    submitting: "Submitting...",
    submit: "Submit",
    getStarted: "Get Started",
  },
  ru: {
    title: "Присоединяйтесь к борьбе с ботами на 9GAG!",
    description: "Помогите нам очистить 9GAG от ботов с помощью мощных инструментов и действий сообщества.",
    welcome: "Добро пожаловать, пользователи 9GAG! Устали от ботов, портящих ваш опыт? Наши инструменты помогут вам эффективно блокировать и сообщать о ботах. Присоединяйтесь к усилиям сообщества, чтобы сохранить 9GAG чистым и веселым! Кремлеботы, сдавайтесь и добавляйте свои никнеймы!",
    share: "Поделиться с сообществом 9GAG",
    statsTitle: "Статистика борьбы с ботами",
    submitTitle: "Отправьте свой список блокировки",
    dailyBotsBlocked: "Ботов заблокировано за день",
    dailyReportsFiled: "Жалоб подано за день",
    totalBots: "Всего обнаружено ботов",
    confirmedBots: "Подтвержденные боты",
    viewBotList: "Посмотреть список ботов",
    exportBotList: "Экспортировать список ботов",
    placeholder: "Введите имена ботов (через запятую)",
    submitting: "Отправка...",
    submit: "Отправить",
    getStarted: "Начать",
  },
};

// BotBustersHeader: Updated with cyberpunk styling
function BotBustersHeader({ language, toggleLanguage }) {
  return (
    <header className="bg-gray-900 p-4 pt-24 sticky top-0 z-10 border-b border-gray-700">
      <nav className="flex items-center container mx-auto">
        <div className="text-xl font-bold text-cyan-400 font-orbitron">BotBusters</div>
        <div className="flex overflow-x-auto space-x-4 ml-4 scrollbar-hide">
          <Link href="#home" className="text-white hover:text-cyan-300 whitespace-nowrap transition-colors">
            Home
          </Link>
          <Link
            href="#submit-blocklist"
            className="text-white hover:text-cyan-300 whitespace-nowrap transition-colors"
          >
            {translations[language].submitTitle}
          </Link>
          <Link href="#stats" className="text-white hover:text-cyan-300 whitespace-nowrap transition-colors">
            {translations[language].statsTitle}
          </Link>
          <Link
            href="https://grok.com/share/bGVnYWN5_2d4f7c04-f5b5-43d9-a4ee-141b2c6130c2"
            target="_blank"
            className="text-white hover:text-cyan-300 whitespace-nowrap transition-colors"
          >
            Dev Chat
          </Link>
        </div>
        <Button onClick={toggleLanguage} className="ml-4 bg-gray-800 hover:bg-gray-700 text-white">
          {language === "en" ? "RU" : "EN"}
        </Button>
      </nav>
    </header>
  );
}

// BotBustersHeroSection: Welcoming 9GAG users
function BotBustersHeroSection({ language }) {
  return (
    <section id="home" className="text-center py-16 bg-gray-900">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white font-orbitron">
        {translations[language].title}
      </h1>
      <p className="text-lg md:text-xl mb-8 text-gray-300">{translations[language].welcome}</p>
      <Button asChild size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white transition-colors shadow-glow">
        <Link href="https://t.me/OneSitePlsBot/block9gag" target="_blank">
          {translations[language].getStarted}
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        className="ml-4 bg-green-600 hover:bg-green-700 text-white transition-colors shadow-glow"
      >
        <Link href="https://9gag.com" target="_blank">
          {translations[language].share}
        </Link>
      </Button>
    </section>
  );
}

// BotBustersBlocklistFormSection: Multilingual submission form
function BotBustersBlocklistFormSection({ dbUser, language }) {
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
        { onConflict: "user_name", ignoreDuplicates: false }
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
      <h2 className="text-3xl font-bold text-center mb-8 text-white font-orbitron">
        {translations[language].submitTitle}
      </h2>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
        <Input
          placeholder={translations[language].placeholder}
          className="bg-gray-800 border-gray-700 text-white"
          value={usernames}
          onChange={(e) => setUsernames(e.target.value)}
        />
        <Button
          type="submit"
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white transition-colors shadow-glow"
          disabled={isSubmitting}
        >
          {isSubmitting ? translations[language].submitting : translations[language].submit}
        </Button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </section>
  );
}

// BotBustersDailyStatsSection: Fixed Supabase limit with pagination
function BotBustersDailyStatsSection({ language }) {
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
        const { data: blocks, error: blocksError } = await supabaseAdmin
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "block")
          .gte("created_at", today);
        if (blocksError) throw blocksError;

        const { data: reports, error: reportsError } = await supabaseAdmin
          .from("actions")
          .select("id", { count: "exact" })
          .eq("action_type", "report")
          .gte("created_at", today);
        if (reportsError) throw reportsError;

        const { count: totalBotsCount, error: totalError } = await supabaseAdmin
          .from("bots")
          .select("id", { count: "exact" });
        if (totalError) throw totalError;

        const { count: confirmedBotsCount, error: confirmedError } = await supabaseAdmin
          .from("bots")
          .select("id", { count: "exact" })
          .eq("confirmed", true);
        if (confirmedError) throw confirmedError;

        let allBots = [];
        let offset = 0;
        const limit = 1000;
        while (true) {
          const { data, error } = await supabaseAdmin
            .from("bots")
            .select("user_name")
            .order("last_updated", { ascending: false })
            .range(offset, offset + limit - 1);
          if (error) throw error;
          allBots = allBots.concat(data);
          if (data.length < limit) break;
          offset += limit;
        }

        setStats({
          botsBlocked: blocks.length,
          reportsFiled: reports.length,
          totalBots: totalBotsCount,
          confirmedBots: confirmedBotsCount,
        });
        setBotList(allBots.map((bot) => bot.user_name));
      } catch (err) {
        setError("Failed to load stats.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatsAndBots();
  }, []);

  const getBotList = (limit) => botList.slice(0, limit).join(",");

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  if (isLoading) return <p className="text-center py-16 text-white">Loading stats...</p>;
  if (error) return <p className="text-center py-16 text-red-500">{error}</p>;

  return (
    <section id="stats" className="py-16 bg-gray-900 text-center">
      <h2 className="text-3xl font-bold mb-4 text-white font-orbitron">
        {translations[language].statsTitle}
      </h2>
      <div className="text-gray-300 space-y-2">
        <p>{translations[language].dailyBotsBlocked}: {stats.botsBlocked}</p>
        <p>{translations[language].dailyReportsFiled}: {stats.reportsFiled}</p>
        <p>{translations[language].totalBots}: {stats.totalBots}</p>
        <p>{translations[language].confirmedBots}: {stats.confirmedBots}</p>
        <Link
          href="https://docs.google.com/spreadsheets/d/1rpSqA9Dh_QSNgocqtpCm9a371pTRldJ-hshUSCyjTmo/edit?pli=1&gid=0#gid=0"
          target="_blank"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {translations[language].viewBotList}
        </Link>
      </div>
      <div className="mt-8 max-w-md mx-auto">
        <h3 className="text-xl font-semibold mb-4 text-white">
          {translations[language].exportBotList}
        </h3>
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(13))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
          >
            Top 13
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(69))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
          >
            Top 69
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(146))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
          >
            Top 146
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(420))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
          >
            Top 420
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(getBotList(1000))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
          >
            Top 1k
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedList(botList.join(","))}
            className="text-white border-gray-700 hover:bg-gray-700 shadow-glow"
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
              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 shadow-glow"
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

// Main BotBustersHome component
export default function BotBustersHome() {
  const { dbUser } = useTelegram();
  const [language, setLanguage] = useState("en");

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "ru" : "en"));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <BotBustersHeader language={language} toggleLanguage={toggleLanguage} />
      <BotBustersHeroSection language={language} />
      {dbUser && <BotBustersBlocklistFormSection dbUser={dbUser} language={language} />}
      <BotHuntingToolsSection language={language} />
      <BotBustersDailyStatsSection language={language} />
    </div>
  );
}
