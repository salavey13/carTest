"use client";

import React, { useState, useEffect, useCallback } from "react";
// import { useTelegram } from "@/providers/TelegramProvider"; // Replaced with AppContext
import { useAppContext } from "@/contexts/AppContext"; // Use AppContext
import { fetchArticles, fetchArticleSections, updateUserMetadata, fetchUserData } from "@/hooks/supabase";
import type { Database } from "@/types/database.types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faArrowLeft, faSpinner, faCheckCircle, faStopCircle, faPaperPlane, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons"; // fa6 solid icons (using faTriangleExclamation instead of FaWarning which is not in fa6 solid)
import { faTelegram } from "@fortawesome/free-brands-svg-icons"; // fa6 Brand icon
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";

// Define types based on your database schema
type Article = Database["public"]["Tables"]["articles"]["Row"];
type ArticleSection = Database["public"]["Tables"]["article_sections"]["Row"];

// Define the structure expected in the user's metadata for this feature
type UserMetadata = {
  advice_broadcast?: {
    enabled: boolean;        // Is the broadcast active?
    article_id: string;      // Which article is being broadcast?
    remaining_section_ids: string[]; // Ordered list of section IDs yet to be sent
    last_sent_at?: string; // Optional: Timestamp of the last sent section (for cron logic)
  };
  // Potentially other metadata fields unrelated to advice
};

export default function AdvicePage() {
  // Use AppContext instead of useTelegram directly
  const { user: tgUser, tg: webApp, dbUser, isLoading: isAuthLoading, isAuthenticated } = useAppContext();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true); // Loading state for articles specifically
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcastEnabled, setBroadcastEnabled] = useState(false); // Is broadcast active *for the selected article*?
  const [isUpdatingBroadcast, setIsUpdatingBroadcast] = useState(false);
  const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null); // Store the entire user metadata

  // Use dbUser's ID if available, otherwise fall back to tgUser ID
  const userId = dbUser?.user_id || tgUser?.id?.toString(); // Ensure userId is string for Supabase operations

  // --- Data Fetching ---

  // Fetch initial user metadata on component mount or when userId changes
  // Use dbUser?.user_id as dependency to ensure fetch happens after user is potentially loaded from DB
  useEffect(() => {
    const loadInitialMetadata = async () => {
      if (!userId) {
        debugLogger.log("loadInitialMetadata skipped: no userId");
        setUserMetadata({}); // Reset metadata if userId becomes null
        return;
      };
      // Don't set loading here yet, wait for articles too
      try {
        debugLogger.log(`loadInitialMetadata fetching for userId: ${userId}`);
        // Use fetchUserData which gets full user data including metadata
        const userData = await fetchUserData(userId);
        const metadata = userData?.metadata as UserMetadata | null;
        setUserMetadata(metadata ?? {}); // Initialize with empty object if null/undefined
        debugLogger.log("Initial user metadata loaded:", metadata);
      } catch (err) {
        logger.error("Failed to load initial user metadata:", err);
        setError("Не удалось загрузить настройки пользователя.");
        // Set loading false here if articles won't load due to this error
        setIsLoadingArticles(false); // Stop article loading if metadata fails critically
      }
    };
    // Only fetch if authenticated or potentially authenticated (not explicitly loading auth)
    if (!isAuthLoading) {
      loadInitialMetadata();
    }
  }, [userId, isAuthLoading]); // Depend on userId and auth loading state

  // Fetch articles list after metadata has been attempted
  useEffect(() => {
    const loadArticles = async () => {
      setIsLoadingArticles(true);
      setError(null); // Clear previous errors
      const { data, error: fetchError } = await fetchArticles();
      if (fetchError) {
        logger.error("Failed to fetch articles:", fetchError);
        setError("Не удалось загрузить список статей.");
      } else {
        setArticles(data || []);
        debugLogger.log(`Loaded ${data?.length || 0} articles.`);
      }
      setIsLoadingArticles(false);
    };

    // Load articles only after metadata fetch attempt is done (userMetadata is not null)
    // And ensure user is authenticated to see articles (optional, depends on requirements)
    if (userMetadata !== null /*&& isAuthenticated*/) {
        loadArticles();
    } else if (!isAuthLoading && userMetadata === null) {
        // Handle case where metadata failed to load but auth finished
        setIsLoadingArticles(false); // Stop loading indicator
        setError("Не удалось загрузить данные статей из-за ошибки настроек.");
    }

  }, [userMetadata, isAuthenticated, isAuthLoading]); // Depend on metadata, auth status, and auth loading state

  // Fetch sections when an article is selected
  // useCallback helps prevent re-fetching if userMetadata object reference changes unnecessarily
  const handleSelectArticle = useCallback(async (article: Article) => {
    setSelectedArticle(article);
    setIsLoadingSections(true);
    setSections([]); // Clear previous sections
    setError(null);   // Clear previous errors related to sections
    setBroadcastEnabled(false); // Reset broadcast status assumption for the new article

    debugLogger.log(`Article selected: ${article.title} (${article.id})`);

    const { data, error: fetchError } = await fetchArticleSections(article.id);

    if (fetchError) {
      logger.error(`Failed to fetch sections for article ${article.id}:`, fetchError);
      setError("Не удалось загрузить секции статьи.");
    } else {
      setSections(data || []);
      debugLogger.log(`Loaded ${data?.length || 0} sections for article ${article.id}.`);

      // Now check if broadcast is enabled *for this specific article* using the loaded metadata
      if (userMetadata?.advice_broadcast?.enabled && userMetadata.advice_broadcast.article_id === article.id) {
          setBroadcastEnabled(true);
          debugLogger.log(`Broadcast is currently ACTIVE for selected article ${article.id}`);
      } else {
          setBroadcastEnabled(false);
          debugLogger.log(`Broadcast is currently INACTIVE for selected article ${article.id}`);
      }
    }
    setIsLoadingSections(false);
  }, [userMetadata]); // Re-run this check if userMetadata changes while an article is selected

  // --- Broadcast Logic ---

  const handleToggleBroadcast = async () => {
    // Pre-conditions check
    if (!userId || !selectedArticle || isUpdatingBroadcast) {
        debugLogger.warn("handleToggleBroadcast skipped: Missing userId, selectedArticle, or already updating.");
        return;
    }
     if (sections.length === 0 && !broadcastEnabled) { // Prevent enabling if no sections (check before setting loading state)
        webApp?.showPopup({title: "Нет разделов", message: "В этой статье нет разделов для рассылки.", buttons: [{type: 'ok'}]});
        return;
    }


    setIsUpdatingBroadcast(true);
    setError(null); // Clear section/broadcast specific errors

    let newMetadata: UserMetadata;
    let successMessage: string;
    // Recalculate based on current metadata state right before update
    const currentlyEnabled = userMetadata?.advice_broadcast?.enabled && userMetadata.advice_broadcast.article_id === selectedArticle.id;

    debugLogger.log(`Toggling broadcast. Currently enabled for this article: ${currentlyEnabled}`);

    if (currentlyEnabled) {
      // --- Disable broadcast ---
      const { advice_broadcast, ...restMetadata } = userMetadata || {};
      newMetadata = restMetadata;
      successMessage = "Рассылка советов отключена.";
      debugLogger.log(`Disabling broadcast for article ${selectedArticle.id}`);

    } else {
      // --- Enable broadcast ---
      const sortedSectionIds = sections
        .sort((a, b) => a.section_order - b.section_order)
        .map(s => s.id);

      if (sortedSectionIds.length === 0) {
          // This check is technically redundant due to the check at the start, but good for safety
          setError("В этой статье нет секций для рассылки.");
          setIsUpdatingBroadcast(false);
          return;
      }

      newMetadata = {
        ...userMetadata,
        advice_broadcast: {
          enabled: true,
          article_id: selectedArticle.id,
          remaining_section_ids: sortedSectionIds,
        },
      };
      successMessage = "Рассылка советов включена! Ожидайте первый выпуск.";
      debugLogger.log(`Enabling broadcast for article ${selectedArticle.id} with sections:`, sortedSectionIds);
    }

    // --- Update Supabase ---
    const { success, error: updateError, data: updatedUserData } = await updateUserMetadata(userId, newMetadata);

    if (success && updatedUserData) {
      // Update local metadata state accurately from the response
      setUserMetadata(updatedUserData.metadata as UserMetadata | null ?? {});
      setBroadcastEnabled(!currentlyEnabled); // Toggle button state on success
      webApp?.showPopup({title: "Успех", message: successMessage, buttons: [{type: 'ok'}]});
      debugLogger.log("Metadata update successful.");
    } else {
      logger.error("Failed to update user metadata for broadcast:", updateError);
      const actionText = currentlyEnabled ? 'отключить' : 'включить';
      const errorMsg = `Не удалось ${actionText} рассылку: ${updateError || 'Неизвестная ошибка'}`;
      setError(errorMsg); // Set error state to display near the button
      webApp?.showPopup({title: "Ошибка", message: `Не удалось ${actionText} рассылку.`, buttons: [{type: 'ok'}]});
    }

    setIsUpdatingBroadcast(false);
  };

  // --- Navigation & UI ---

  const handleGoBack = useCallback(() => {
    setSelectedArticle(null);
    setSections([]);
    setError(null); // Clear errors when going back
    setBroadcastEnabled(false); // Reset state when going back
  }, []);

  // Configure Telegram Back Button using the hook's webApp object
  useEffect(() => {
    if (!webApp) return; // Check if webApp object is available from context

    const backButtonClickHandler = () => {
        debugLogger.log("Back button clicked");
        handleGoBack();
    };

    // Ensure webApp methods exist before calling
    if (selectedArticle) {
      if (webApp.BackButton?.show) webApp.BackButton.show();
      if (webApp.BackButton?.onClick) webApp.BackButton.onClick(backButtonClickHandler);
      debugLogger.log("Back button shown and click handler attached.");
    } else {
      if (webApp.BackButton?.offClick) webApp.BackButton.offClick(backButtonClickHandler); // Clean up listener first
      if (webApp.BackButton?.hide) webApp.BackButton.hide();
      debugLogger.log("Back button hidden and click handler removed.");
    }

    // Cleanup function
    return () => {
      // Check visibility before trying to remove/hide
      if (webApp.BackButton?.isVisible) {
          if (webApp.BackButton?.offClick) webApp.BackButton.offClick(backButtonClickHandler);
          if (webApp.BackButton?.hide) webApp.BackButton.hide();
           debugLogger.log("Back button hidden and click handler removed on cleanup.");
      }
    };
  }, [webApp, selectedArticle, handleGoBack]); // Re-run when selection or webApp object changes

  // --- Render Logic ---

  // Combined initial loading state (Auth + Metadata + Articles)
  if (isAuthLoading || isLoadingArticles || userMetadata === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" />
      </div>
    );
  }

   // If not authenticated after loading attempt
  if (!isAuthenticated) {
     return (
       <div className="p-6 text-center text-red-600">
         <FontAwesomeIcon icon={faTriangleExclamation} size="2x" className="mb-2" />
         <p className="font-semibold">Ошибка Авторизации</p>
         <p>{error || "Не удалось подтвердить пользователя. Попробуйте перезапустить приложение."}</p>
       </div>
     );
  }

  // Error loading articles list (show if no article selected and loading finished)
  if (error && !selectedArticle && !isLoadingArticles) {
    return (
      <div className="p-6 text-red-600 bg-red-100 dark:bg-red-900/30 rounded-lg text-center shadow">
         <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 size='lg'" />
         <p className="font-semibold">Ошибка загрузки статей</p>
         <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 font-sans max-w-3xl mx-auto">
      {!selectedArticle ? (
        // --- Articles List View ---
        <div>
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200 border-b pb-2 dark:border-gray-700">
              Мудрые Советы
          </h1>
          {articles.length === 0 && !isLoadingArticles ? ( // Check loading state here too
             <p className="text-center text-gray-500 dark:text-gray-400 mt-10">Пока нет доступных статей.</p>
          ) : (
            <ul className="space-y-3">
              {articles.map((article) => (
                <li key={article.id}>
                  <button
                    onClick={() => handleSelectArticle(article)}
                    className="w-full text-left p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  >
                    <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 flex items-center">
                       <FontAwesomeIcon icon={faBookOpen} className="mr-3 text-gray-500 dark:text-gray-400 w-5 h-5" />
                       {article.title}
                    </h2>
                    {article.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 ml-8">{article.description}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        // --- Single Article View ---
        <div>
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">{selectedArticle.title}</h1>
          {selectedArticle.description && (
            <p className="text-md text-gray-600 dark:text-gray-400 mb-6 italic">{selectedArticle.description}</p>
          )}

          {/* Loading Sections State */}
          {isLoadingSections ? (
             <div className="flex justify-center items-center py-10">
               <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500"/>
             </div>
          ) : error && sections.length === 0 ? ( // Error loading sections (show only if sections failed to load)
             <div className="p-4 my-4 text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40 rounded-lg shadow">
                <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" /> {error}
             </div>
          ) : (
            // --- Sections Loaded ---
            <div>
               {/* "Entertain Me" Button Area */}
               {userId && sections.length > 0 && ( // Only show if user exists and there are sections
                <div className="my-6 p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-800 border dark:border-gray-700 rounded-lg shadow-inner text-center">
                  <h3 className="text-lg font-semibold mb-2 flex items-center justify-center text-gray-800 dark:text-gray-200">
                      <FontAwesomeIcon icon={faTelegram} className="mr-2 text-blue-500" />
                      Часовая Рассылка
                  </h3>
                   <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                       {broadcastEnabled
                         ? "Получайте по одному разделу этой статьи каждый час прямо в Telegram!"
                         : "Хотите получать эту мудрость порционно? Включите часовую рассылку!"}
                   </p>
                  <button
                    onClick={handleToggleBroadcast}
                    disabled={isUpdatingBroadcast}
                    className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 space-x-2 shadow-md
                      ${isUpdatingBroadcast
                        ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-gray-600 dark:text-gray-400'
                        : broadcastEnabled
                          ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400'
                          : 'bg-green-500 hover:bg-green-600 text-white focus:ring-green-400'
                      }`}
                  >
                    {isUpdatingBroadcast ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : broadcastEnabled ? (
                      <FontAwesomeIcon icon={faStopCircle} />
                    ) : (
                      <FontAwesomeIcon icon={faPaperPlane} />
                    )}
                    <span>
                      {isUpdatingBroadcast ? 'Обновление...' : broadcastEnabled ? 'Отключить рассылку' : 'Развлеки меня'}
                    </span>
                  </button>
                  {/* Status Indicator */}
                  {broadcastEnabled && !isUpdatingBroadcast && (
                     <p className="text-xs text-green-700 dark:text-green-400 mt-3 flex items-center justify-center">
                       <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Рассылка активна для этой статьи.
                     </p>
                   )}
                   {/* Display error specific to broadcast update */}
                   {error && !isLoadingSections && ( // Show error message related to broadcast toggle if relevant
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
                    )}
                 </div>
               )}

              {/* Sections Content */}
              <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2 dark:border-gray-700 text-gray-800 dark:text-gray-200">Содержание:</h2>
              {sections.length === 0 && !isLoadingSections ? ( // Check loading state
                <p className="text-gray-500 dark:text-gray-400">В этой статье пока нет секций.</p>
              ) : (
                <div className="space-y-6">
                  {sections.map((section) => (
                    <div key={section.id} className="p-5 border rounded-lg dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-shadow hover:shadow-md">
                      {section.title && (
                        <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-300">
                           {section.section_order}. {section.title}
                        </h3>
                      )}
                       {/* Render content safely - Assuming trusted HTML */}
                       <div
                         className="prose prose-blue dark:prose-invert max-w-none text-gray-800 dark:text-gray-300" // Tailwind prose styles recommended
                         dangerouslySetInnerHTML={{ __html: section.content }} // CAUTION: Use only if HTML is sanitized/trusted!
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