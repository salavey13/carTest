export const PROMPT_FIND_TWEAKS = `
**Задача:** Проанализировать описание проекта клиента и определить, какие конкретные задачи по кастомизации или доработке ("твики") потребуются от команды "Танков". Сопоставь эти задачи с возможностями Supervibe Studio и Jumpstart Kit.

**Контекст Supervibe Studio & Jumpstart Kit:**
*   **Jumpstart Kit:** Готовые модули (авторизация TG, базовый UI, CRUD операции, профили, каталоги, формы).
*   **Готовые компоненты:** Для проектов типа "сервис онлайн тренировок" (TWA_Training) или "агрегатор аренды авто" (TWA_CarRental) у нас есть почти готовые UI-киты и базовая логика (например, компоненты `TrainingCard.tsx`, `CarRentalFilters.tsx`).
*   **SUPERVIBE Studio:** AI-инструменты для быстрой модификации кода React/Next.js, SCSS/Tailwind, интеграции с Supabase.
*   **Стек:** React, Next.js, TypeScript, Supabase.

**Входные данные (JSON-объект лида \`lead_data\`):**
1.  **\`lead_data.project_description\`:** Описание проекта от клиента.
2.  **\`lead_data.key_features_requested_list\`:** (Из Этапа 1 конвейера) JSON-массив строк с ключевыми фичами, запрошенными клиентом.
3.  **\`lead_data.project_type_guess\`**: (Из Этапа 1 конвейера) Классификация проекта (например, "TWA_Training").

**Формат вывода (СТРОГО JSON-массив объектов):**
Каждый объект в массиве должен представлять один "твик" и иметь следующую структуру:
*   **\`tweak_description\`:** (String) Краткое описание задачи для "Танка".
*   **\`estimated_complexity\`:** (String: "low" | "medium" | "high") Субъективная оценка сложности.
*   **\`relevant_supervibe_capability\`:** (String) Какая возможность Supervibe Studio/Jumpstart Kit/Готовый компонент может быть использована.
    *   _Пример для \`project_type_guess\` = "TWA_Training": "Кастомизация существующего компонента TrainingCard.tsx", "Добавление нового поля в форму профиля пользователя (стандартный CRUD)"._
*   **\`target_file_guess\`:** (String | null) Примерный путь к файлу/компоненту для модификации (например, "/components/TrainingCard.tsx", "/app/profile/edit/page.tsx").
*   **\`generated_repo_xml_link_idea\`:** (String | null) Идея для параметра 'idea' в ссылке на /repo-xml (CamelCase, короткая фраза, например, "StyleWorkoutCards", "AddUserPreferencesForm").

**Пример вывода для одной задачи (если \`project_type_guess\` = "TWA_Training"):**
\`\`\`json
{
  "tweak_description": "Изменить цветовую схему и шрифты для карточек тренировок согласно предоставленному Figma-макету.",
  "estimated_complexity": "low",
  "relevant_supervibe_capability": "Кастомизация стилей существующего компонента TrainingCard.tsx с помощью AI-инструментов SUPERVIBE Studio (Tailwind/SCSS).",
  "target_file_guess": "/components/cards/TrainingCard.tsx, /app/globals.css",
  "generated_repo_xml_link_idea": "UpdateTrainingCardStylesFromFigma"
}
\`\`\`
**Если твики не найдены, верни пустой JSON-массив \`[]\`**.

**Инструкции:**
*   Сосредоточься на задачах, которые являются доработкой, адаптацией, стилизацией, интеграцией готовых частей, а НЕ созданием *принципиально нового* функционала с нуля.
*   Учитывай, что "Танки" работают с AI-инструментами.
*   Анализируй \`lead_data.project_description\` и \`lead_data.key_features_requested_list\`.
*   **Особое внимание на \`lead_data.project_type_guess\`**: если это "TWA_Training" или "TWA_CarRental", многие "фичи" клиента могут быть просто "твиками" наших существующих компонентов.
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