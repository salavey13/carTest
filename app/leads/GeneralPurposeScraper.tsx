"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Textarea } from '@/components/ui/textarea'; // Not used directly in this component
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
// import { scrapePageContent } from './actions'; // Assuming this action will be created

interface GeneralPurposeScraperProps {
  pageTheme: {
    primaryColor: string;
    accentColor: string;
    borderColor: string;
    shadowColor: string;
  };
  t_dynamic_links: Record<string, string>;
  onScrapedData: (data: string) => void; 
}

const predefinedSearchButtons = [
  { label: "TWA (Kwork)", keywords: "telegram web app, twa, mini app", site: "kwork" , siteUrl: "https://kwork.ru/projects?c=all&q="},
  { label: "AI Боты (Kwork)", keywords: "telegram бот нейросеть, ai telegram bot", site: "kwork", siteUrl: "https://kwork.ru/projects?c=all&q=" },
  { label: "Next.js (Kwork)", keywords: "next.js, react, supabase", site: "kwork", siteUrl: "https://kwork.ru/projects?c=all&q=" },
  { label: "TWA (Habr Freelance)", keywords: "telegram web app, twa", site: "habr", siteUrl: "https://freelance.habr.com/tasks?q=" },
  { label: "AI Боты (Habr Freelance)", keywords: "telegram бот ai, нейросеть", site: "habr", siteUrl: "https://freelance.habr.com/tasks?q=" },
];


const GeneralPurposeScraper: React.FC<GeneralPurposeScraperProps> = ({
  pageTheme,
  t_dynamic_links,
  onScrapedData,
}) => {
  const [keywords, setKeywords] = useState('');
  const [targetUrl, setTargetUrl] = useState(''); 
  const [isScraping, setIsScraping] = useState(false);

  const handlePredefinedSearch = (search: typeof predefinedSearchButtons[0]) => {
    setKeywords(search.keywords);
    // Construct search URL if needed, or use a generic placeholder for now
    // For Kwork/Habr, we'd typically form a search query URL.
    // For this example, let's just set the keywords. User can manually put a URL too.
    if (search.siteUrl && search.keywords) {
        setTargetUrl(search.siteUrl + encodeURIComponent(search.keywords));
    } else {
        setTargetUrl(''); // Clear URL if only keywords are set
    }
    toast.info(`Запрос "${search.label}" подготовлен. Нажмите "Запустить Скрейпер".`, {duration: 2000});
  };

  const handleScrape = async () => {
    const urlToScrape = targetUrl.trim();
    if (!urlToScrape && !keywords.trim()) { // Allow scraping by keywords in future, for now URL is primary
      toast.warning("Введите URL для скрейпинга или выберите готовый запрос.");
      return;
    }
    if (!urlToScrape) {
        toast.warning("Пока что скрейпер работает только по прямому URL. Пожалуйста, укажите URL.");
        return;
    }


    setIsScraping(true);
    const toastId = toast.loading(`Запускаю кибер-пауков на ${urlToScrape}...`);

    try {
      // const result = await scrapePageContent(urlToScrape); // SERVER ACTION
      // MOCKUP:
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = { success: true, content: `--- MOCK SCRAPED DATA from "${urlToScrape}" ---\n\nПроект X: ... описание ...\nПроект Y: ... описание ...` };


      if (result.success && result.content) {
        onScrapedData(result.content);
        toast.success("Кибер-пауки вернулись с добычей! Данные добавлены в 'Сбор трофеев'.", { id: toastId });
        setKeywords(''); 
        setTargetUrl(''); 
      } else {
        toast.error(`Ошибка скрейпинга: ${result.error || "Не удалось получить контент."}`, { id: toastId });
      }
    } catch (error: any) {
      toast.error(`Критическая ошибка скрейпера: ${error.message}`, { id: toastId });
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
      <CardHeader>
        <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
          <VibeContentRenderer content="::fasatellitedish className='animate-pulse':: Универсальный Кибер-Скрейпер (WIP)" />
        </CardTitle>
        <CardDescription className="font-mono text-xs sm:text-sm text-gray-400">
          Этот модуль в разработке. Цель: автоматический сбор данных с Kwork, Habr Freelance и других площадок по ключевым словам или URL.
          Собранный текст будет автоматически добавлен в поле &quot;Сбор трофеев&quot; выше для AI-обработки.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 font-mono">
        <div>
            <label className={cn("block text-sm font-medium mb-2", pageTheme.accentColor)}>
                <VibeContentRenderer content="::falistcheck:: Готовые запросы (экспериментально):"/>
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
                {predefinedSearchButtons.map(search => (
                    <Button 
                        key={search.label}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePredefinedSearch(search)}
                        disabled={isScraping}
                        className={cn("text-xs", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20`)}
                    >
                        {search.label}
                    </Button>
                ))}
            </div>
        </div>
        <div>
          <label htmlFor="scraper-keywords" className={cn("block text-sm font-medium mb-1", pageTheme.accentColor)}>
            <VibeContentRenderer content="::fakey:: Ключевые слова (для справки, пока не используются для авто-поиска):"/>
          </label>
          <Input
            id="scraper-keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Например: telegram mini app, next.js, supabase, ai"
            className="w-full p-2 border rounded bg-gray-800/70 border-brand-cyan/50 text-gray-200 focus:ring-2 focus:ring-brand-cyan outline-none placeholder-gray-500 text-xs sm:text-sm"
            disabled={isScraping}
          />
        </div>
        <div>
          <label htmlFor="scraper-url" className={cn("block text-sm font-medium mb-1", pageTheme.accentColor)}>
            <VibeContentRenderer content="::falink:: URL для парсинга (одна страница):"/>
          </label>
          <Input
            id="scraper-url"
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Например: https://kwork.ru/projects?c=114"
            className="w-full p-2 border rounded bg-gray-800/70 border-brand-cyan/50 text-gray-200 focus:ring-2 focus:ring-brand-cyan outline-none placeholder-gray-500 text-xs sm:text-sm"
            disabled={isScraping}
          />
        </div>
        <Button
          onClick={handleScrape}
          disabled={isScraping || !targetUrl.trim()} // Пока кнопка активна только если есть URL
          className={cn(
            "w-full sm:w-auto bg-brand-cyan/80 text-black hover:bg-brand-cyan flex items-center justify-center gap-2 py-2.5 text-sm sm:text-base transform hover:scale-105",
            (isScraping || !targetUrl.trim()) && "opacity-50 cursor-not-allowed"
          )}
        >
          <VibeContentRenderer content={isScraping ? "::faspinner className='animate-spin':: Скрейпинг..." : "::faspider className='text-lg':: Запустить Скрейпер"} />
        </Button>
        <p className="text-xs text-gray-400">
          <VibeContentRenderer content="::fatriangleexclamation className='text-yellow-400 text-sm':: Внимание: Используйте с осторожностью и уважайте `robots.txt` сайтов. Чрезмерный скрейпинг может привести к блокировке IP." />
        </p>
      </CardContent>
    </Card>
  );
};

export default GeneralPurposeScraper;