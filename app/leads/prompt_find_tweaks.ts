export const PROMPT_FIND_TWEAKS = `
**Задача:** Проанализировать описание проекта клиента и определить, какие конкретные задачи по кастомизации или доработке ("твики") потребуются от команды "Танков". Сопоставь эти задачи с возможностями Supervibe Studio и Jumpstart Kit, включая известные готовые компоненты/страницы.

**Контекст Supervibe Studio & Jumpstart Kit & Известные Компоненты/Страницы:**
*   **Jumpstart Kit:** Базовый TWA (React/Next.js/Supabase) с авторизацией TG, UI-китом, CRUD-операциями, профилями, каталогами, формами.
*   **SUPERVIBE Studio:** AI-инструменты для быстрой модификации кода React/Next.js, TailwindCSS, интеграции с Supabase.
*   **Известные готовые или легко адаптируемые решения (страницы/компоненты):**
    *   **TWA_Training / TWA_Fitness:** Компоненты для отображения тренировок (карточки, списки), профили пользователей, отслеживание прогресса. (например, \`/app/start-training/page.tsx\`, \`/components/cards/TrainingCard.tsx\`)
    *   **TWA_CarRental:** Компоненты для каталога авто, фильтры, система бронирования, личные кабинеты. (например, \`/app/rent-car/page.tsx\`)
    *   **TWA_WheelOfFortune:** Компонент "Колесо Фортуны". (например, \`/app/wheel-of-fortune/page.tsx\`)
    *   **TWA_Captcha:** Компонент для верификации Captcha. (например, \`/components/CaptchaVerification.tsx\`)
    *   **TWA_ArticleFromYouTube:** Генерация статей из видео YouTube. (например, \`/app/yt/page.tsx\`)
    *   **TWA_VPRTests:** Система тестирования для школьников (ВПР). (например, \`/app/vpr-tests/page.tsx\`, \`/app/vpr-test/[subjectId]/page.tsx\`)
    *   **TWA_Ecommerce_Basic:** Базовые e-commerce функции: каталог товаров, корзина.
    *   **TWA_SemanticSearch:** Поиск по текстовым данным.
    *   **Прочее:** Страницы \`/app/donate/page.tsx\`, \`/app/buy-subscription/page.tsx\`, \`/app/admin/page.tsx\` (базовая админка).
*   **Стек:** React, Next.js, TypeScript, Supabase.

**Входные данные (JSON-объект лида \`lead_data\`):**
1.  **\`lead_data.project_description\`:** Описание проекта от клиента.
2.  **\`lead_data.key_features_requested_list\`:** (Из Этапа 1 конвейера) JSON-массив строк с ключевыми фичами, запрошенными клиентом.
3.  **\`lead_data.project_type_guess\`**: (Из Этапа 1 конвейера) Классификация проекта (например, "TWA_Training").

**Формат вывода (СТРОГО JSON-массив объектов):**
Каждый объект в массиве должен представлять один "твик" и иметь следующую структуру:
*   **\`tweak_description\`:** (String) Краткое описание задачи для "Танка".
*   **\`estimated_complexity\`:** (String: "low" | "medium" | "high")
    *   "low": в основном конфигурация, небольшие UI правки существующего, простые запросы Supabase.
    *   "medium": требует AI-модификации кода существующих компонентов, добавление новых простых полей/логики.
    *   "high": требует значительной AI-модификации нескольких компонентов, возможно, создание простого нового компонента на основе существующих.
*   **\`relevant_supervibe_capability\`:** (String) Какая возможность Supervibe Studio/Jumpstart Kit/Известный компонент может быть использована. Будь конкретен.
*   **\`target_file_guess\`:** (String | null) Примерный путь к файлу/компоненту для модификации (например, "\`/components/cards/TrainingCard.tsx\`", "\`/app/profile/edit/page.tsx\`"). Используй обратные кавычки для путей.
*   **\`generated_repo_xml_link_idea\`:** (String | null) Идея для параметра 'idea' в ссылке на /repo-xml (CamelCase, короткая фраза, например, "StyleWorkoutCards", "AddUserPreferencesForm").

**Пример вывода для одной задачи (если \`project_type_guess\` = "TWA_Training"):**
\`\`\`json
{
  "tweak_description": "Изменить цветовую схему и шрифты для карточек тренировок согласно предоставленному Figma-макету.",
  "estimated_complexity": "low",
  "relevant_supervibe_capability": "Кастомизация стилей существующего компонента TrainingCard.tsx с помощью AI-инструментов SUPERVIBE Studio (Tailwind/SCSS).",
  "target_file_guess": "`/components/cards/TrainingCard.tsx`, `/app/globals.css`",
  "generated_repo_xml_link_idea": "UpdateTrainingCardStylesFromFigma"
}
\`\`\`
**Если твики не найдены, верни пустой JSON-массив \`[]\`**.

**Инструкции:**
*   Сосредоточься на задачах, которые являются доработкой, адаптацией, стилизацией, интеграцией готовых частей, а НЕ созданием *принципиально нового* функционала с нуля.
*   Если \`project_type_guess\` совпадает с одним из наших "Известных готовых решений", то большинство запрошенных клиентом фич, скорее всего, будут "твиками" этих решений.
*   Учитывай, что "Танки" работают с AI-инструментами.
*   Анализируй \`lead_data.project_description\` и \`lead_data.key_features_requested_list\`.
*   Типовые "твики" для TWA: изменение UI (цвета, шрифты, верстка), добавление/изменение полей в формах, настройка фильтров/сортировок в списках, небольшие изменения в логике существующих Supabase-запросов.

Проанализируй предоставленные данные лида и выдели задачи по кастомизации в формате JSON-массива:
\`\`\`json
// Объект lead_data будет здесь при реальном вызове. 
// Для тестирования этого промпта, можешь представить его структуру так:
/*
lead_data = {
  "project_description": "{{project_description}}", 
  "key_features_requested_list": ["фича1 из описания", "фича2 из описания"],
  "project_type_guess": "{{project_type_guess}}" 
}
*/
\`\`\`
Данные лида для анализа:
Project Description: {{project_description}}
Key Features Requested: {{key_features_requested_list_json_string}}
Project Type Guess: {{project_type_guess}}
`;