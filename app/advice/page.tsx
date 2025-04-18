"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { fetchArticles, fetchArticleSections, updateUserMetadata, fetchUserData } from "@/hooks/supabase";
import type { Database } from "@/types/database.types";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faArrowLeft, faSpinner, faCheckCircle, faStopCircle, faPaperPlane, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faTelegram } from "@fortawesome/free-brands-svg-icons";
import { logger } from "@/lib/logger";
import { debugLogger } from "@/lib/debugLogger";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks'; // <-- Import remark-breaks
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
    const { user: tgUser, tg: webApp, dbUser, isLoading: isAuthLoading, isAuthenticated } = useAppContext();
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [sections, setSections] = useState<ArticleSection[]>([]);
    const [isLoadingArticles, setIsLoadingArticles] = useState(true);
    const [isLoadingSections, setIsLoadingSections] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [broadcastEnabled, setBroadcastEnabled] = useState(false);
    const [isUpdatingBroadcast, setIsUpdatingBroadcast] = useState(false);
    const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null);

    const userId = dbUser?.user_id || tgUser?.id?.toString();

    // --- Data Fetching ---
    useEffect(() => {
        const loadInitialMetadata = async () => {
            if (!userId) {
                debugLogger.log("loadInitialMetadata skipped: no userId");
                setUserMetadata({}); // Set to empty object if no user ID
                return;
            };
            // No need to set loading state here, handled by userMetadata === null check
            try {
                debugLogger.log(`loadInitialMetadata fetching for userId: ${userId}`);
                const userData = await fetchUserData(userId);
                const metadata = userData?.metadata as UserMetadata | null;
                setUserMetadata(metadata ?? {}); // Use loaded metadata or empty object
                debugLogger.log("Initial user metadata loaded:", metadata);
            } catch (err) {
                logger.error("Failed to load initial user metadata:", err);
                setError("Не удалось загрузить настройки пользователя.");
                setUserMetadata({}); // Set empty object on error to allow article loading attempt
            }
        };
        if (!isAuthLoading) { // Only run after auth check is complete
           loadInitialMetadata();
        }
    }, [userId, isAuthLoading]);

    useEffect(() => {
        const loadArticles = async () => {
            setIsLoadingArticles(true);
            setError(null);
            debugLogger.log("Starting to load articles...");
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
        // Load articles only when metadata loading is done (userMetadata is not null)
        if (userMetadata !== null) {
            loadArticles();
        } else if (!isAuthLoading && userMetadata === null) {
            // This case might indicate an error during metadata load or just initial state
            // Let the global loading spinner handle this until metadata is resolved or errors out
             debugLogger.log("Waiting for userMetadata before loading articles...");
        }
    }, [userMetadata, isAuthLoading]); // Depend on metadata and auth loading status

    const handleSelectArticle = useCallback(async (article: Article) => {
        setSelectedArticle(article);
        setIsLoadingSections(true);
        setSections([]);
        setError(null);
        setBroadcastEnabled(false);
        debugLogger.log(`Article selected: ${article.title} (${article.id})`);

        if (!userMetadata) {
             debugLogger.warn(`Cannot check broadcast status for ${article.id}: userMetadata not loaded yet.`);
             // Optionally set an error or just wait? Let's wait for metadata.
        }

        const { data, error: fetchError } = await fetchArticleSections(article.id);
        if (fetchError) {
            logger.error(`Failed to fetch sections for article ${article.id}:`, fetchError);
            setError("Не удалось загрузить секции статьи.");
        } else {
            const sortedSections = (data || []).sort((a, b) => a.section_order - b.section_order);
            setSections(sortedSections);
            debugLogger.log(`Loaded ${sortedSections.length || 0} sections for article ${article.id}.`);
            // Check broadcast status *after* sections are loaded, using the most recent metadata
            if (userMetadata?.advice_broadcast?.enabled && userMetadata.advice_broadcast.article_id === article.id) {
                setBroadcastEnabled(true);
                debugLogger.log(`Broadcast is currently ACTIVE for selected article ${article.id}`);
            } else {
                setBroadcastEnabled(false);
                debugLogger.log(`Broadcast is currently INACTIVE for selected article ${article.id}`);
            }
        }
        setIsLoadingSections(false);
    }, [userMetadata]); // Added userMetadata dependency

    // --- Broadcast Logic ---
    const handleToggleBroadcast = async () => {
        if (!userId || !selectedArticle || isUpdatingBroadcast || userMetadata === null) { // Also check if metadata is loaded
            debugLogger.warn("handleToggleBroadcast skipped: Missing userId, selectedArticle, updating, or metadata not loaded.");
            if (userMetadata === null) setError("Настройки пользователя еще не загружены.");
            return;
        }
         if (sections.length === 0 && !broadcastEnabled) {
            webApp?.showPopup({title: "Нет разделов", message: "В этой статье нет разделов для рассылки.", buttons: [{type: 'ok'}]});
            setError("В этой статье нет секций для рассылки.");
            return;
        }

        setIsUpdatingBroadcast(true);
        setError(null);
        let newMetadata: UserMetadata;
        let successMessage: string;
        const currentlyEnabled = broadcastEnabled; // Use component state derived from metadata
        debugLogger.log(`Toggling broadcast. Currently enabled (state): ${currentlyEnabled}`);

        if (currentlyEnabled) {
            // --- Disable ---
            const { advice_broadcast, ...restMetadata } = userMetadata; // Destructure from loaded metadata
            newMetadata = restMetadata;
            successMessage = "Рассылка советов отключена.";
            debugLogger.log(`Disabling broadcast for article ${selectedArticle.id}`);
        } else {
            // --- Enable ---
            const sortedSectionIds = sections.map(s => s.id);
            if (sortedSectionIds.length === 0) {
                setError("В этой статье нет секций для рассылки.");
                setIsUpdatingBroadcast(false);
                return;
            }
            newMetadata = {
                ...userMetadata, // Spread current metadata first
                advice_broadcast: {
                    enabled: true,
                    article_id: selectedArticle.id,
                    remaining_section_ids: sortedSectionIds,
                },
            };
            successMessage = "Рассылка советов включена! Ожидайте первый выпуск.";
            debugLogger.log(`Enabling broadcast for article ${selectedArticle.id} with sections:`, sortedSectionIds);
        }

        // --- Update DB ---
        const { success, error: updateError, data: updatedUserData } = await updateUserMetadata(userId, newMetadata);
        if (success && updatedUserData) {
            setUserMetadata(updatedUserData.metadata as UserMetadata | null ?? {});
            setBroadcastEnabled(!currentlyEnabled);
            webApp?.showPopup({title: "Успех", message: successMessage, buttons: [{type: 'ok'}]});
            debugLogger.log("Metadata update successful.");
        } else {
            logger.error("Failed to update user metadata for broadcast:", updateError);
            const actionText = currentlyEnabled ? 'отключить' : 'включить';
            const errorMsg = `Не удалось ${actionText} рассылку: ${updateError?.message || 'Неизвестная ошибка'}`; // Include error message
            setError(errorMsg);
            webApp?.showPopup({title: "Ошибка", message: errorMsg, buttons: [{type: 'ok'}]});
        }
        setIsUpdatingBroadcast(false);
    };

    // --- Navigation & UI ---
    const handleGoBack = useCallback(() => {
        setSelectedArticle(null);
        setSections([]);
        setError(null);
        setBroadcastEnabled(false);
    }, []);

    useEffect(() => {
        if (!webApp) return;
        const backButtonClickHandler = () => { handleGoBack(); };
        if (selectedArticle) {
            webApp.BackButton?.show();
            webApp.BackButton?.onClick(backButtonClickHandler);
        } else {
            webApp.BackButton?.offClick(backButtonClickHandler);
            webApp.BackButton?.hide();
        }
        return () => {
            if (webApp.BackButton?.isVisible) {
                webApp.BackButton?.offClick(backButtonClickHandler);
                webApp.BackButton?.hide();
            }
        };
    }, [webApp, selectedArticle, handleGoBack]);

    // --- Render Logic ---
    // .. Simplify global loading check: show if auth isn't done or metadata isn't loaded
    const showGlobalLoading = isAuthLoading || userMetadata === null;

    if (showGlobalLoading) {
        return (
            <div className="flex justify-center items-center h-screen pt-36 bg-black">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-brand-green" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // This should ideally be caught by a higher-level auth guard
        return (
            <div className="p-6 pt-32 text-center text-brand-pink">
                <FontAwesomeIcon icon={faTriangleExclamation} size="2x" className="mb-2" />
                <p className="font-semibold text-xl">Ошибка Авторизации</p>
                <p className="text-gray-400">{error || "Не удалось подтвердить пользователя. Попробуйте перезапустить приложение."}</p>
            </div>
        );
    }

    // Show error related to article loading only if in list view and loading is finished
    if (error && !selectedArticle && !isLoadingArticles) {
        return (
            <div className="p-6 pt-32 text-center text-brand-pink bg-black/50 rounded-lg shadow-lg border border-brand-pink/30 mx-4">
                <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 text-2xl" />
                <p className="font-semibold text-xl mt-2">Ошибка загрузки данных</p>
                <p className="text-gray-400 mt-1">{error}</p>
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen pt-36 pb-10 font-mono",
            "bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200"
        )}>
            <div className="relative z-10 container mx-auto px-4 max-w-4xl">
                {!selectedArticle ? (
                    // --- Articles List View ---
                    <div className="space-y-6">
                        <h1 className="text-3xl md:text-4xl font-bold text-center text-brand-green cyber-text glitch" data-text="Мудрые Советы">
                            Мудрые Советы
                        </h1>
                        {/* Display loading spinner specifically for articles if needed */}
                        {isLoadingArticles ? (
                             <div className="flex justify-center items-center pt-16">
                                 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-brand-blue" />
                             </div>
                         ) : articles.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 mt-10 text-lg">Пока нет доступных статей.</p>
                        ) : (
                            <ul className="space-y-4">
                                {articles.map((article) => (
                                    <li key={article.id}>
                                        <button
                                            onClick={() => handleSelectArticle(article)}
                                            className={cn(
                                                "w-full text-left p-4 md:p-5 rounded-lg transition duration-300 ease-in-out",
                                                "bg-black/60 backdrop-blur-sm border border-brand-blue/30 hover:border-brand-blue/70",
                                                "shadow-md hover:shadow-lg hover:shadow-brand-blue/30 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-opacity-50"
                                            )}
                                        >
                                            <h2 className="text-lg md:text-xl font-semibold text-brand-blue flex items-center">
                                                <FontAwesomeIcon icon={faBookOpen} className="mr-3 text-brand-blue/70 w-5 h-5" />
                                                {article.title}
                                            </h2>
                                            {article.description && (
                                                <p className="text-sm md:text-base text-gray-400 mt-1 ml-8">{article.description}</p>
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
                        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-brand-green cyber-text">{selectedArticle.title}</h1>
                        {selectedArticle.description && (
                            <p className="text-base md:text-lg text-gray-400 mb-6 italic">{selectedArticle.description}</p>
                        )}

                        {isLoadingSections ? (
                            <div className="flex justify-center items-center py-16">
                                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-brand-blue" />
                            </div>
                        ) : error && sections.length === 0 ? ( // Show section-specific error
                            <div className="p-4 my-6 text-brand-pink bg-pink-900/20 border border-brand-pink/40 rounded-lg shadow-md text-center">
                                <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 text-xl" />
                                <p className="mt-1">{error}</p>
                            </div>
                        ) : (
                            // --- Sections Loaded ---
                            <div>
                                {/* "Entertain Me" Button Area */}
                                {userId && sections.length > 0 && (
                                    <div className="my-8 p-5 bg-gradient-to-r from-blue-900/30 via-purple-900/20 to-blue-900/30 border border-brand-purple/40 rounded-lg shadow-lg text-center">
                                        <h3 className="text-xl font-semibold mb-3 flex items-center justify-center text-brand-purple">
                                            <FontAwesomeIcon icon={faTelegram} className="mr-2 text-brand-blue" />
                                            Часовая Рассылка
                                        </h3>
                                        <p className="text-sm text-gray-300 mb-4">
                                            {broadcastEnabled
                                                ? "Получайте по одному разделу этой статьи каждый час прямо в Telegram!"
                                                : "Хотите получать эту мудрость порционно? Включите часовую рассылку!"}
                                        </p>
                                        <button
                                            onClick={handleToggleBroadcast}
                                            disabled={isUpdatingBroadcast}
                                            className={cn(
                                                "w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-md font-semibold transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black space-x-2 shadow-md",
                                                isUpdatingBroadcast
                                                    ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                                                    : broadcastEnabled
                                                        ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-red-500/30 hover:shadow-red-500/50'
                                                        : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 shadow-green-500/30 hover:shadow-green-500/50'
                                            )}
                                        >
                                            {isUpdatingBroadcast ? (<FontAwesomeIcon icon={faSpinner} spin />)
                                                : broadcastEnabled ? (<FontAwesomeIcon icon={faStopCircle} />)
                                                    : (<FontAwesomeIcon icon={faPaperPlane} />)}
                                            <span>
                                                {isUpdatingBroadcast ? 'Обновление...' : broadcastEnabled ? 'Отключить рассылку' : 'Развлеки меня'}
                                            </span>
                                        </button>
                                        {broadcastEnabled && !isUpdatingBroadcast && (
                                            <p className="text-xs text-brand-green mt-3 flex items-center justify-center">
                                                <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Рассылка активна для этой статьи.
                                            </p>
                                        )}
                                        {error && !isUpdatingBroadcast && !isLoadingSections && ( // Show error only if NOT updating/loading
                                            <p className="text-xs text-brand-pink mt-2">{error}</p>
                                        )}
                                    </div>
                                )}

                                {/* Sections Content */}
                                <h2 className="text-2xl font-semibold mt-8 mb-4 border-b border-brand-blue/30 pb-2 text-brand-blue">Содержание:</h2>
                                {sections.length === 0 && !isLoadingSections ? (
                                    <p className="text-gray-500">В этой статье пока нет секций.</p>
                                ) : (
                                    <div className="space-y-6">
                                        {sections.map((section) => (
                                            <div key={section.id} className={cn(
                                                "p-5 border rounded-lg transition-shadow duration-300",
                                                "bg-black/50 border-gray-700/50 hover:border-brand-green/50 hover:shadow-md hover:shadow-brand-green/20"
                                            )}>
                                                {section.title && (
                                                    <h3 className="text-lg font-semibold mb-2 text-brand-green flex items-baseline">
                                                        <span className="text-brand-blue mr-2">{section.section_order}.</span> {section.title}
                                                    </h3>
                                                )}
                                                <ReactMarkdown
                                                    // <-- Add remarkBreaks plugin here
                                                    remarkPlugins={[remarkGfm, remarkBreaks]}
                                                    className="prose prose-invert prose-sm md:prose-base max-w-none text-gray-300 prose-headings:text-brand-cyan prose-strong:text-brand-lime prose-a:text-brand-blue hover:prose-a:text-brand-purple prose-code:text-brand-pink prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-brand-purple prose-li:marker:text-brand-blue" // Added list item marker color
                                                    components={{
                                                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="hover:underline" />,
                                                        // .. Ensure lists are styled correctly by prose or add specific list styling if needed
                                                        ul: ({node, ...props}) => <ul {...props} className="list-disc list-outside ml-4" />,
                                                        ol: ({node, ...props}) => <ol {...props} className="list-decimal list-outside ml-4" />,
                                                        li: ({node, ...props}) => <li {...props} className="my-1" />, // Minor spacing for list items
                                                    }}
                                                >
                                                    {section.content ?? ''}
                                                    {/* Use empty string fallback */}
                                                </ReactMarkdown>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}