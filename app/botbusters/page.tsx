"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin, createAuthenticatedClient } from "@/hooks/supabase";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { differenceInDays, parseISO } from "date-fns";

// Define translations for English and Russian
const translations = {
  en: {
    title: "Join the Fight Against Bots on 9GAG!",
    description: "Help us keep 9GAG bot-free with powerful tools and community action.",
    welcome: "Welcome, 9GAG users! Tired of bots ruining your experience? Our tools help you block and report bots efficiently. Join the community effort to keep 9GAG clean and fun!",
    share: "Share with 9GAG Community",
    toolsTitle: "Our Bot-Hunting Tools",
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
    howToSpot: "How to Spot a Bot",
    repetitiveComments: "Repetitive comments like 'lol nice' on every post.",
    randomUsernames: "Usernames with random numbers (e.g., User12345).",
    noFollowers: "Accounts with hundreds of posts but no followers.",
    accountAge: "Accounts are currently {age} days old (created on {date}).",
    getStarted: "Get Started",
    buyNow: "Buy Now",
    processing: "Processing...",
    preorder: "Preorder (Coming Soon)",
    blockEmAllDesc: "Batch-block known bots with one click.",
    purgeEmAllDesc: "Report and cleanse bot activity in bulk.",
    hunterDesc: "Find new bots by tracing their network.",
    automaDesc: "Unlock powerful Automa scripts to automate bot-blocking on 9GAG.",
  },
  ru: {
    title: "Присоединяйтесь к борьбе с ботами на 9GAG!",
    description: "Помогите нам очистить 9GAG от ботов с помощью мощных инструментов и действий сообщества.",
    welcome: "Добро пожаловать, пользователи 9GAG! Устали от ботов, портящих ваш опыт? Наши инструменты помогут вам эффективно блокировать и сообщать о ботах. Присоединяйтесь к усилиям сообщества, чтобы сохранить 9GAG чистым и веселым! Кремлеботы, сдавайтесь и добавляйте свои никнеймы!",
    share: "Поделиться с сообществом 9GAG",
    toolsTitle: "Наши инструменты для борьбы с ботами",
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
    howToSpot: "Как распознать бота",
    repetitiveComments: "Повторяющиеся комментарии, такие как 'лол круто' под каждым постом.",
    randomUsernames: "Имена пользователей с случайными числами (например, User12345).",
    noFollowers: "Аккаунты с сотнями постов, но без подписчиков.",
    accountAge: "Аккаунты существуют уже {age} дней (созданы {date}).",
    getStarted: "Начать",
    buyNow: "Купить сейчас",
    processing: "Обработка...",
    preorder: "Предзаказ (Скоро будет)",
    blockEmAllDesc: "Блокируйте известных ботов одним кликом.",
    purgeEmAllDesc: "Сообщайте и очищайте активность ботов массово.",
    hunterDesc: "Находите новых ботов, отслеживая их сеть.",
    automaDesc: "Разблокируйте мощные скрипты Automa для автоматической блокировки ботов на 9GAG.",
  },
};

// Script pack details
const SCRIPT_PACK = {
  id: "automa_scripts",
  name: "Automa Bot-Hunting Scripts",
  price: 100, // Price in XTR
  color: "from-green-600 to-teal-400",
};

// Bot creation date
const BOT_CREATION_DATE = "2024-06-22";

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

function BotHuntingToolsSection({ language }) {
  const { user, isInTelegramContext } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null); // Simplified type to avoid TS issues
  const [hasAccess, setHasAccess] = useState(false); // Simplified type

  const creationDate = parseISO(BOT_CREATION_DATE);
  const today = new Date();
  const ageInDays = differenceInDays(today, creationDate);
/*
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return; // Guard against undefined user
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
  
  return (
    <section className="py-16 bg-gray-900">
      <div>Hello, {translations[language].toolsTitle}</div>
    </section>
  );
}


// BotHuntingToolsSection: Purchase and preorder section
function BotHuntingToolsSection({ language }) {
  const { user, isInTelegramContext } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null); // Simplified type to avoid TS issues
  const [hasAccess, setHasAccess] = useState(false); // Simplified type

  const creationDate = parseISO(BOT_CREATION_DATE);
  const today = new Date();
  const ageInDays = differenceInDays(today, creationDate);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return; // Guard against undefined user
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
*/
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
      const { error: insertError } = await createAuthenticatedClient(user.id.toString())
        .from("invoices")
        .insert({
          type: "script_access",
          payload,
          user_id: user.id.toString(),
          price: SCRIPT_PACK.price,
          metadata,
        });
      if (insertError) throw insertError;

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
      setError("Purchase error: " + errMsg);
      toast.error("Purchase error: " + errMsg);
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
            <li>
              {translations[language].accountAge
                .replace("{age}", ageInDays.toString())
                .replace("{date}", creationDate.toLocaleDateString())}
            </li>
          </ul>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">Get Automa Scripts</h3>
            <p className="text-gray-300 mb-4">{translations[language].automaDesc}</p>
            <p className="text-3xl font-bold mb-6 font-mono text-white">{SCRIPT_PACK.price} XTR</p>
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
              <>
                <Button
                  onClick={handlePurchase}
                  disabled={loading}
                  className="w-full p-3 rounded-lg font-mono text-lg bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white transition-all shadow-glow"
                >
                  {loading ? translations[language].processing : translations[language].buyNow]}
                </Button>
                <p className="text-yellow-400 font-bold mt-4 font-mono animate-pulse">
                  Be the FIRST Bot Hunter! Use code <span className="text-white">FIRSTHUNTER</span> for 20% off – limited time only!
                </p>
              </>
            )}
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
