// /app/leads/GeneralPurposeScraper.tsx
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { scrapePageContent } from './actions';
import { FaBuilding, FaCodeBranch } from 'react-icons/fa6'; // Импортируем явно для использования в логике

interface PredefinedSearchButton {
  id: string;
  label: string;
  site: "kwork" | "habr" | string; // Расширяем для потенциальных будущих сайтов
  keywords: string;
  siteUrlFormat: string;
}

interface GeneralPurposeScraperProps {
  pageTheme: {
    primaryColor: string;
    accentColor: string;
    borderColor: string;
    shadowColor: string;
  };
  predefinedSearchButtons: PredefinedSearchButton[]; // Теперь принимаем как проп
  onScrapedData: (data: string) => void; 
  onSuccessfulScrape?: () => void; 
}

const GeneralPurposeScraper: React.FC<GeneralPurposeScraperProps> = ({
  pageTheme,
  predefinedSearchButtons, // Принимаем как проп
  onScrapedData,
  onSuccessfulScrape,
}) => {
  const [keywordsInput, setKeywordsInput] = useState(''); 
  const [targetUrl, setTargetUrl] = useState(''); 
  const [isScraping, setIsScraping] = useState(false);

  const handlePredefinedSearch = (search: PredefinedSearchButton) => {
    setKeywordsInput(search.keywords); 
    if (search.siteUrlFormat) {
        const encodedKeywords = encodeURIComponent(search.keywords); 
        const searchUrl = search.siteUrlFormat.replace("{keywords}", encodedKeywords);
        setTargetUrl(searchUrl);
        toast.info(`Запрос "${search.label}" подготовлен. URL для скрейпинга: ${searchUrl}. Нажмите "Запустить Зонд".`, {duration: 3000});
    } else {
        setTargetUrl(''); 
        toast.info(`Ключевые слова "${search.keywords}" установлены (для справки). Укажите URL вручную.`, {duration: 3000});
    }
  };

  const handleScrape = async () => {
    const urlToScrape = targetUrl.trim();
    if (!urlToScrape) { 
      toast.warning("Введите URL для скрейпинга в поле 'Целевые Координаты'.");
      return;
    }

    setIsScraping(true);
    const toastId = toast.loading(
      <VibeContentRenderer content={`::FaSpinner className='animate-spin mr-2':: Зонд отправлен на ${urlToScrape}...`} />, 
      { id: `scrape-${Date.now()}` }
    );

    try {
      const result = await scrapePageContent(urlToScrape); 
      
      if (result.success && result.content) {
        onScrapedData(result.content);
        toast.success(<VibeContentRenderer content="::FaCheckCircle:: Разведданные собраны! Информация добавлена в 'Сбор трофеев'." />, { id: toastId, duration: 4000 });
        onSuccessfulScrape?.(); 
      } else {
        toast.error(<VibeContentRenderer content={`::FaTriangleExclamation:: Ошибка скрейпинга: ${result.error || "Не удалось получить контент."}`} />, { id: toastId, duration: 6000 });
      }
    } catch (error: any) {
      toast.error(<VibeContentRenderer content={`::FaBomb:: Критическая ошибка зонда: ${error.message}`} />, { id: toastId, duration: 6000 });
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
      <CardHeader>
        <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
          <VibeContentRenderer content="::FaToolbox className='animate-pulse text-2xl sm:text-3xl':: Универсальный Кибер-Скрейпер" />
        </CardTitle>
        <CardDescription className="font-mono text-xs sm:text-sm text-gray-400">
          <VibeContentRenderer content="::FaCircleInfo:: Выберите **Быстрый Протокол Разведки** (кнопки ниже установят и ключевые слова, и URL) или введите **URL** целевой страницы напрямую для скрейпинга."/>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 font-mono">
        <div>
            <label className={cn("block text-sm font-medium mb-2 font-orbitron", pageTheme.accentColor)}>
                <VibeContentRenderer content="::FaListCheck className='text-base':: Быстрые Протоколы Разведки:"/>
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
                {predefinedSearchButtons.map(search => (
                    <Button 
                        key={search.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePredefinedSearch(search)}
                        disabled={isScraping}
                        className={cn("text-xs px-2.5 py-1.5 font-mono", pageTheme.borderColor, pageTheme.primaryColor, `hover:${pageTheme.primaryColor}/80 hover:bg-black/20 transform hover:scale-105 transition-all duration-150`)}
                    >
                        {/* Используем FaBuilding для Kwork и FaCodeBranch для Habr */}
                        {search.site === 'kwork' && <FaBuilding className='mr-1.5 text-xs' />}
                        {search.site === 'habr' && <FaCodeBranch className='mr-1.5 text-xs' />}
                        {search.label}
                    </Button>
                ))}
            </div>
        </div>
        <div>
          <label htmlFor="scraper-keywords" className={cn("block text-sm font-medium mb-1 font-orbitron", pageTheme.accentColor)}>
            <VibeContentRenderer content="::FaKeyboard className='text-base':: Ключевые Маячки (для информации):"/>
          </label>
          <Input
            id="scraper-keywords"
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="Ключевые слова (заполняются кнопками выше)"
            className="w-full p-2 border rounded bg-gray-800/70 border-brand-cyan/30 text-gray-200 focus:ring-2 focus:ring-brand-cyan outline-none placeholder-gray-500 text-xs sm:text-sm font-mono"
            disabled={isScraping}
          />
           <p className="text-[0.65rem] text-gray-500 mt-1 pl-1">Это поле заполняется при нажатии на кнопки "Быстрых Протоколов" для справки. Для ручного скрейпинга используйте поле URL ниже.</p>
        </div>
        <div>
          <label htmlFor="scraper-url" className={cn("block text-sm font-medium mb-1 font-orbitron", pageTheme.accentColor)}>
            <VibeContentRenderer content="::FaLink className='text-base':: Целевые Координаты (URL для парсинга):"/>
          </label>
          <Input
            id="scraper-url"
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://kwork.ru/projects?c=11&keyword=ключевое_слово&a=1"
            className="w-full p-2 border rounded bg-gray-800/70 border-brand-cyan/50 text-gray-200 focus:ring-2 focus:ring-brand-cyan outline-none placeholder-gray-500 text-xs sm:text-sm font-mono"
            disabled={isScraping}
            required
          />
        </div>
        <Button
          onClick={handleScrape}
          disabled={isScraping || !targetUrl.trim()} 
          className={cn(
            "w-full sm:w-auto bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90 flex items-center justify-center gap-2 py-2.5 text-sm sm:text-base font-semibold font-orbitron transform hover:scale-105 transition-all duration-150 shadow-md hover:shadow-lg",
            (isScraping || !targetUrl.trim()) && "opacity-60 cursor-not-allowed hover:scale-100"
          )}
        >
          <VibeContentRenderer content={isScraping ? "::FaSpinner className='animate-spin text-lg':: Зонд в полёте..." : "::FaSpider className='text-lg':: Запустить Зонд-Охотник!"} />
        </Button>
        <p className="text-xs text-gray-400 font-mono">
          <VibeContentRenderer content="::FaTriangleExclamation className='text-yellow-400 text-sm':: **Этика:** Используйте с уважением к ресурсам. Чрезмерный или агрессивный скрейпинг может нарушать правила площадок и привести к блокировке. Не используйте для массового парсинга без прокси и задержек." />
        </p>
      </CardContent>
    </Card>
  );
};

export default GeneralPurposeScraper;