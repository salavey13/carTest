"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GeneralPurposeScraperProps {
  pageTheme: {
    primaryColor: string;
    accentColor: string;
    borderColor: string;
    shadowColor: string;
  };
  t_dynamic_links: Record<string, string>;
  onScrapedData: (data: string) => void; // Callback to pass scraped data to parent
}

const GeneralPurposeScraper: React.FC<GeneralPurposeScraperProps> = ({
  pageTheme,
  t_dynamic_links,
  onScrapedData,
}) => {
  const [keywords, setKeywords] = useState('');
  const [targetUrl, setTargetUrl] = useState(''); // For specific URL scraping
  const [isScraping, setIsScraping] = useState(false);

  const handleScrape = async () => {
    if (!keywords.trim() && !targetUrl.trim()) {
      toast.warning("Введите ключевые слова или URL для скрейпинга.");
      return;
    }
    setIsScraping(true);
    toast.info(`Запускаю кибер-пауков для сбора данных... (${keywords || targetUrl})`);

    // --- MOCK SCRAPING ---
    // In a real scenario, this would involve server-side logic to fetch and parse web content.
    // For now, we'll simulate a delay and return some mock data.
    await new Promise(resolve => setTimeout(resolve, 2500));
    const mockData = `--- SCRAPED MOCK DATA for "${keywords || targetUrl}" ---\n\nПроект 1: Нужен бот для Telegram, React, дизайн есть.\nОписание: Требуется разработать Telegram Mini App для фитнес-клуба. Функционал: запись на тренировки, просмотр расписания, оплата абонемента. Стек: React, Next.js, TypeScript. Дизайн в Figma имеется. Бюджет: 50000 руб. Сроки: 3 недели.\n\nПроект 2: AI-ассистент для интернет-магазина.\nОписание: Ищем разработчика для создания AI-консультанта на базе GPT для нашего сайта. Должен отвечать на вопросы клиентов, помогать с выбором товаров. Интеграция с нашей CRM. Бюджет: договорной. Сроки: гибкие.\n\n--- END MOCK DATA ---`;
    onScrapedData(mockData);
    // --- END MOCK SCRAPING ---

    setIsScraping(false);
    toast.success("Кибер-пауки вернулись с добычей! Данные добавлены в 'Сбор трофеев'.");
    setKeywords('');
    setTargetUrl('');
  };

  return (
    <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
      <CardHeader>
        <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
          <VibeContentRenderer content="::faradar:: Универсальный Кибер-Скрейпер (WIP)" />
        </CardTitle>
        <CardDescription className="font-mono text-xs sm:text-sm text-gray-400">
          Этот модуль в разработке. Цель: автоматический сбор данных с Kwork, Habr Freelance и других площадок по ключевым словам.
          Собранный текст будет автоматически добавлен в поле &quot;Сбор трофеев&quot; выше для AI-обработки.
          Пока можно использовать ручной режим: скопировать текст со страницы Kwork и вставить в поле выше.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 font-mono">
        <div>
          <label htmlFor="scraper-keywords" className={cn("block text-sm font-medium mb-1", pageTheme.accentColor)}>
            Ключевые слова (через запятую):
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
            Или конкретный URL для парсинга (одна страница):
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
          disabled={isScraping || (!keywords.trim() && !targetUrl.trim())}
          className={cn(
            "w-full sm:w-auto bg-brand-cyan/80 text-black hover:bg-brand-cyan flex items-center justify-center gap-2 py-2.5 text-sm sm:text-base transform hover:scale-105",
            (isScraping || (!keywords.trim() && !targetUrl.trim())) && "opacity-50 cursor-not-allowed"
          )}
        >
          <VibeContentRenderer content={isScraping ? "::faspinner className='animate-spin':: Скрейпинг..." : "::faspider:: Запустить Скрейпер"} />
        </Button>
        <p className="text-xs text-gray-400">
          <VibeContentRenderer content="::fawarning:: Внимание: Используйте с осторожностью и уважайте `robots.txt` сайтов. Чрезмерный скрейпинг может привести к блокировке IP." />
        </p>
      </CardContent>
    </Card>
  );
};

export default GeneralPurposeScraper;