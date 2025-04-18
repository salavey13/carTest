"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTelegram } from "@/providers/TelegramProvider";
import { fetchArticles, fetchArticleSections, updateUserMetadata, fetchUserData } from "@/hooks/supabase";
import type { Database } from "@/types/database.types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faArrowLeft, faSpinner, faCheckCircle, faHourglassHalf, faStopCircle, faPaperPlane, faWarning } from "@fortawesome/free-solid-svg-icons"; // fa6
import { faTelegram } from "@fortawesome/free-brands-svg-icons"; // fa6 Brand icon
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";

type Article = Database["public"]["Tables"]["articles"]["Row"];
type ArticleSection = Database["public"]["Tables"]["article_sections"]["Row"];
type UserMetadata = {
  advice_broadcast?: {
    enabled: boolean;
    article_id: string;
    remaining_section_ids: string[];
    last_sent_at?: string; // Optional
  };
  // other metadata fields...
};

export default function AdvicePage() {
  const { user: tgUser, webApp } = useTelegram();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcastEnabled, setBroadcastEnabled] = useState(false);
  const [isUpdatingBroadcast, setIsUpdatingBroadcast] = useState(false);
  const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null);

  const userId = tgUser?.id?.toString(); // Ensure userId is string

  // Fetch initial user metadata
  useEffect(() => {
    const loadInitialMetadata = async () => {
        if (!userId) return;
        setIsLoadingArticles(true); // Use main loader
        try {
            const userData = await fetchUserData(userId);
            const metadata = userData?.metadata as UserMetadata | null;
            setUserMetadata(metadata ?? {}); // Initialize with empty object if null
            debugLogger.log("Initial user metadata loaded:", metadata);

            // Check current broadcast status after loading metadata
            if (metadata?.advice_broadcast?.enabled && metadata?.advice_broadcast?.article_id) {
                // If a broadcast is active, potentially load that article automatically?
                // For now, just set the state. The user needs to select the article again to see the button status.
                // OR: We could fetch the specific article title here if needed.
                // Let's keep it simple: button status updates when an article is selected.
            }
        } catch (err) {
            logger.error("Failed to load initial user metadata:", err);
            setError("Не удалось загрузить настройки пользователя.");
        } finally {
            // Keep setIsLoadingArticles = true until articles are also loaded
        }
    };
    loadInitialMetadata();
  }, [userId]);


  // Fetch articles list
  useEffect(() => {
    const loadArticles = async () => {
      setIsLoadingArticles(true);
      setError(null);
      const { data, error: fetchError } = await fetchArticles();
      if (fetchError) {
        logger.error("Failed to fetch articles:", fetchError);
        setError("Не удалось загрузить список статей.");
      } else {
        setArticles(data || []);
      }
      setIsLoadingArticles(false);
    };
    loadArticles();
  }, []);

  // Fetch sections when an article is selected
  const handleSelectArticle = useCallback(async (article: Article) => {
    setSelectedArticle(article);
    setIsLoadingSections(true);
    setSections([]);
    setError(null);
    setBroadcastEnabled(false); // Reset broadcast status for the new article

    const { data, error: fetchError } = await fetchArticleSections(article.id);
    if (fetchError) {
      logger.error(`Failed to fetch sections for article ${article.id}:`, fetchError);
      setError("Не удалось загрузить секции статьи.");
      setSelectedArticle(null); // Go back if sections fail? Or show error in place?
    } else {
      setSections(data || []);
      // Check if broadcast is enabled *for this specific article*
      if (userMetadata?.advice_broadcast?.enabled && userMetadata.advice_broadcast.article_id === article.id) {
          setBroadcastEnabled(true);
          debugLogger.log(`Broadcast is active for selected article ${article.id}`);
      } else {
          setBroadcastEnabled(false);
          debugLogger.log(`Broadcast is inactive for selected article ${article.id}`);
      }
    }
    setIsLoadingSections(false);
  }, [userMetadata]); // Re-run if userMetadata changes while an article is selected


  const handleToggleBroadcast = async () => {
    if (!userId || !selectedArticle || isUpdatingBroadcast) return;

    setIsUpdatingBroadcast(true);
    setError(null);

    let newMetadata: UserMetadata;
    let successMessage: string;

    if (broadcastEnabled) {
      // Disable broadcast
      newMetadata = {
        ...userMetadata,
        advice_broadcast: undefined, // Remove the advice_broadcast key
      };
      successMessage = "Рассылка советов отключена.";
      debugLogger.log(`Disabling broadcast for article ${selectedArticle.id}`);

    } else {
      // Enable broadcast
      const sectionIds = sections.map(s => s.id).sort((a, b) => {
          const sectionA = sections.find(s => s.id === a);
          const sectionB = sections.find(s => s.id === b);
          return (sectionA?.section_order ?? 0) - (sectionB?.section_order ?? 0);
      }); // Ensure correct order

      if (sectionIds.length === 0) {
          setError("В этой статье нет секций для рассылки.");
          setIsUpdatingBroadcast(false);
          return;
      }

      newMetadata = {
        ...userMetadata,
        advice_broadcast: {
          enabled: true,
          article_id: selectedArticle.id,
          remaining_section_ids: sectionIds,
        },
      };
      successMessage = "Рассылка советов включена! Ожидайте первый выпуск в течение часа.";
      debugLogger.log(`Enabling broadcast for article ${selectedArticle.id} with sections:`, sectionIds);
    }

    const { success, error: updateError, data: updatedUserData } = await updateUserMetadata(userId, newMetadata);

    if (success && updatedUserData) {
      setUserMetadata(updatedUserData.metadata as UserMetadata | null ?? {}); // Update local metadata state
      setBroadcastEnabled(!broadcastEnabled); // Toggle state on success
      webApp?.showAlert(successMessage);
    } else {
      logger.error("Failed to update user metadata for broadcast:", updateError);
      setError(`Не удалось ${broadcastEnabled ? 'отключить' : 'включить'} рассылку: ${updateError || 'Неизвестная ошибка'}`);
      webApp?.showAlert(`Ошибка: Не удалось ${broadcastEnabled ? 'отключить' : 'включить'} рассылку.`);
    }

    setIsUpdatingBroadcast(false);
  };

  const handleGoBack = () => {
    setSelectedArticle(null);
    setSections([]);
    setError(null);
    setBroadcastEnabled(false);
  };

  // Header logic
  useEffect(() => {
    if (webApp) {
      webApp.BackButton.onClick(handleGoBack);
      if (selectedArticle) {
        webApp.BackButton.show();
      } else {
        webApp.BackButton.hide();
      }
    }
    // Cleanup function
    return () => {
      if (webApp) {
        webApp.BackButton.offClick(handleGoBack);
        webApp.BackButton.hide();
      }
    };
  }, [webApp, selectedArticle, handleGoBack]); // Dependencies for header logic


  if (isLoadingArticles && !userMetadata) { // Show loader only during initial metadata + article load
    return (
      <div className="flex justify-center items-center h-screen">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" />
      </div>
    );
  }

   if (error && !selectedArticle) { // Show main error if loading articles failed
    return (
      <div className="p-4 text-red-600 text-center">
         <FontAwesomeIcon icon={faWarning} className="mr-2" /> {error}
      </div>
    );
  }

  return (
    <div className="p-4 font-sans">
      {!selectedArticle ? (
        // Articles List View
        <div>
          <h1 className="text-2xl font-bold mb-4 text-center">Мудрые Советы</h1>
          {isLoadingArticles ? (
             <div className="flex justify-center items-center py-10">
               <FontAwesomeIcon icon={faSpinner} spin size="2x" />
             </div>
          ) : articles.length === 0 && !error ? (
             <p className="text-center text-gray-500">Пока нет доступных статей.</p>
          ) : (
            <ul className="space-y-3">
              {articles.map((article) => (
                <li key={article.id}>
                  <button
                    onClick={() => handleSelectArticle(article)}
                    className="w-full text-left p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow hover:bg-blue-100 dark:hover:bg-blue-900 transition duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 flex items-center">
                       <FontAwesomeIcon icon={faBookOpen} className="mr-3 text-gray-500 dark:text-gray-400" />
                       {article.title}
                    </h2>
                    {article.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 ml-7">{article.description}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // Single Article View
        <div>
          <button onClick={handleGoBack} className="mb-4 text-blue-600 dark:text-blue-400 hover:underline flex items-center">
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Назад к списку
          </button>
          <h1 className="text-3xl font-bold mb-2">{selectedArticle.title}</h1>
          {selectedArticle.description && (
            <p className="text-md text-gray-600 dark:text-gray-400 mb-6">{selectedArticle.description}</p>
          )}

          {isLoadingSections ? (
             <div className="flex justify-center items-center py-10">
               <FontAwesomeIcon icon={faSpinner} spin size="2x" />
             </div>
          ) : error ? (
             <div className="p-4 text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <FontAwesomeIcon icon={faWarning} className="mr-2" /> {error}
             </div>
          ) : (
            <div>
               {/* Entertain Me Button */}
               {sections.length > 0 && userId && ( // Only show if there are sections and user is identified
                <div className="my-6 p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 rounded-lg shadow-md text-center">
                  <h3 className="text-lg font-semibold mb-3 flex items-center justify-center">
                      <FontAwesomeIcon icon={faTelegram} className="mr-2 text-blue-500" />
                      Авто-рассылка советов
                  </h3>
                   <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                       {broadcastEnabled
                         ? "Получайте по одному разделу этой статьи каждый час прямо в Telegram!"
                         : "Хотите получать эту статью по частям? Включите часовую рассылку!"}
                   </p>
                  <button
                    onClick={handleToggleBroadcast}
                    disabled={isUpdatingBroadcast}
                    className={`w-full md:w-auto px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out flex items-center justify-center space-x-2
                      ${isUpdatingBroadcast ? 'bg-gray-400 cursor-not-allowed' :
                        broadcastEnabled
                          ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-2 focus:ring-red-400'
                          : 'bg-green-500 hover:bg-green-600 text-white focus:ring-2 focus:ring-green-400'
                      }`}
                  >
                    {isUpdatingBroadcast ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : broadcastEnabled ? (
                      <FontAwesomeIcon icon={faStopCircle} />
                    ) : (
                      <FontAwesomeIcon icon={faPaperPlane} /> // Changed from FaRegClock to be more action-oriented
                    )}
                    <span>
                      {isUpdatingBroadcast ? 'Обновление...' : broadcastEnabled ? 'Отключить рассылку' : 'Развлеки меня (Включить рассылку)'}
                    </span>
                  </button>
                  {broadcastEnabled && (
                     <p className="text-xs text-green-700 dark:text-green-400 mt-3 flex items-center justify-center">
                       <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Рассылка активна для этой статьи.
                     </p>
                   )}
                 </div>
               )}

              <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-700">Содержание:</h2>
              {sections.length === 0 ? (
                <p className="text-gray-500">В этой статье пока нет секций.</p>
              ) : (
                <div className="space-y-6">
                  {sections.map((section, index) => (
                    <div key={section.id} className="p-4 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                      {section.title && (
                        <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-300">
                           {index + 1}. {section.title}
                        </h3>
                      )}
                      {/* Render content safely - assumes content is safe HTML or Markdown */}
                      {/* For Markdown, you'd use a library like react-markdown */}
                      <div
                        className="prose dark:prose-invert max-w-none" // Use Tailwind typography if installed
                        dangerouslySetInnerHTML={{ __html: section.content }} // WARNING: Only if content is trusted HTML
                        // Or use a safe rendering method: <p>{section.content}</p>
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}