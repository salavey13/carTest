// /components/AutomationBuddy.tsx
"use client";
// ... (imports - keep existing, ensure FaCog is imported)
import { /* ... */ FaCog } from "react-icons/fa6";
// ... (Context import, Constants, Types, Variants - keep existing)
import { useRepoXmlPageContext, /* ... */ WorkflowStep } from "@/contexts/RepoXmlPageContext";

// --- Main Component ---
const AutomationBuddy: React.FC = () => {
    // ... (State - keep existing: isOpen, hasAutoOpened)

    // --- Context (Get new modal trigger) ---
    const {
        // ... (Keep existing context state/triggers)
        triggerToggleSettingsModal, // Get modal trigger
        isSettingsModalOpen, // Get modal open state
        // ... (rest of context destructuring)
    } = useRepoXmlPageContext();

    // ... (Memoize repoUrl - Keep existing placeholder/logic)

    // --- Define Suggestions (Updated) ---
    const suggestions = useMemo((): Suggestion[] => {
        const suggestionsList: Suggestion[] = [];
        // ... (Keep existing loading state calculations)
        const isAnyLoading = /* ... */ ;
        const branchInfo = targetBranchName ? ` (${targetBranchName})` : ' (default)';

        const addSuggestion = (id: string, text: string, action: () => any, icon: React.ReactNode, condition = true, disabled = false, tooltip = '') => {
            // ... (Keep existing addSuggestion logic)
        };

        // Add Suggestion to Open/Close Settings Modal
        addSuggestion(
            "toggle-settings",
            isSettingsModalOpen ? "Закрыть Настройки" : "Настройки (URL/Ветка/PR)",
            triggerToggleSettingsModal,
            <FaCog />,
            true, // Always show if available
            isAnyLoading && !isSettingsModalOpen // Disable opening if loading, allow closing
        );


        switch (currentStep) {
            case 'need_repo_url':
                 // Already covered by "toggle-settings"
                 // addSuggestion("goto-fetcher-settings", "Указать URL/Токен/Ветку", triggerToggleSettingsModal, <FaKeyboard />);
                 break;
            case 'ready_to_fetch':
                addSuggestion("fetch", `Извлечь Файлы${branchInfo}`, triggerFetch, <FaDownload />, true, !repoUrlEntered, !repoUrlEntered ? "URL?" : "");
                // "load-prs" is now inside settings modal trigger
                // "goto-fetcher-settings" is covered by toggle-settings
                break;
             // ... (Keep 'fetching', 'loading_prs', 'fetch_failed' logic, adjust text)
            case 'fetching': addSuggestion("loading-indicator", `Загрузка Файлов${branchInfo}...`, () => {}, <FaArrowsRotate className="animate-spin"/>, true, true ); break;
            case 'fetch_failed': addSuggestion("retry-fetch", `Попробовать Снова${branchInfo}?`, () => triggerFetch(true), <FaArrowRotateRight />, true, isAnyLoading); break;

            // --- States after successful fetch ---
            case 'files_fetched':
                 addSuggestion("goto-files", "К Списку Файлов", () => scrollToSection('fetcher'), <FaEye />);
                 addSuggestion("ask-ai-empty", "🤖 Спросить AI", triggerAskAi, <FaRobot />);
                 // Settings modal suggestion already covers PR selection trigger
                 // addSuggestion("goto-pr-selector", "К Выбору PR Ветки", triggerToggleSettingsModal, <FaCodeBranch />);
                 break;
             // ... (Update other steps similarly, remove direct PR selector scroll/load triggers if covered by settings)
            case 'files_fetched_highlights': /* ... */ break;
            case 'files_selected': /* ... */ break;
            case 'request_written': /* ... */ break;
            case 'generating_ai_response': /* ... */ break;
            case 'request_copied': /* ... */ break;
            case 'response_pasted': /* ... */ break;
            case 'parsing_response': /* ... */ break;
            case 'response_parsed':
                 addSuggestion("select-all-parsed", "Выбрать Все", triggerSelectAllParsed, <FaListCheck />, filesParsed);
                 addSuggestion("goto-assistant-files", "К Файлам", () => scrollToSection('assistant'), <FaEye />);
                 // Logic changes based on targetBranchName
                 if (targetBranchName) {
                      addSuggestion("update-pr", `Обновить Ветку (${targetBranchName.substring(0,10)}...)`, triggerCreatePR, <FaCodeBranch />, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, "Выбери файлы");
                 } else {
                      addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />, selectedAssistantFiles.size > 0, selectedAssistantFiles.size === 0, "Выбери файлы");
                 }
                 break;
             case 'pr_ready':
                 if (targetBranchName) {
                     addSuggestion("update-pr", `Обновить Ветку (${targetBranchName.substring(0,10)}...)`, triggerCreatePR, <FaCodeBranch />);
                 } else {
                     addSuggestion("create-pr", "Создать PR", triggerCreatePR, <FaGithub />);
                 }
                 addSuggestion("goto-pr-form", "К Форме", () => scrollToSection('prSection'), <FaRocket />);
                 break;
            default: /* ... */ break;
        }

        // Add Clear All (Keep existing logic)
         if (fetcherRef?.current?.clearAll && (selectedFetcherFiles.size > 0 || kworkInputHasContent || aiResponseHasContent)) { /* ... */ }

        // Final check on disabled state (Keep existing logic)
        return suggestionsList.map(s => ({ ...s, disabled: s.disabled || (isAnyLoading && !['retry-fetch', 'loading-indicator', 'load-prs-indicator', 'toggle-settings'].includes(s.id)) }));

    }, [ /* ... Keep ALL existing dependencies, add triggerToggleSettingsModal, isSettingsModalOpen ... */
        currentStep, fetchStatus, repoUrlEntered, filesFetched, /* ... */
        triggerToggleSettingsModal, isSettingsModalOpen, /* ... rest ... */
    ]);

    // ... (Keep rest of component: activeMessage, auto-open, escape key, event handlers, render logic)
};
export default AutomationBuddy;