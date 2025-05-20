export const PROMPT_FIND_TWEAKS = `
**Задача:** Проанализировать описание проекта клиента и определить, какие конкретные задачи по кастомизации или доработке ("твики") потребуются от команды "Танков". Сопоставь эти задачи с возможностями Supervibe Studio и Jumpstart Kit.

**Контекст Supervibe Studio & Jumpstart Kit:**
*   **Jumpstart Kit:** Готовые модули (авторизация TG, базовый UI, CRUD операции, профили, каталоги, формы).
*   **SUPERVIBE Studio:** AI-инструменты для быстрой модификации кода React/Next.js, SCSS/Tailwind, интеграции с Supabase.
*   **Стек:** React, Next.js, TypeScript, Supabase.

**Входные данные (JSON-объект лида \`lead_data\`):**
1.  **\`lead_data.project_description\`:** Описание проекта от клиента.
2.  **\`lead_data.key_features_requested_list\`:** (Из Этапа 1 конвейера) JSON-массив строк с ключевыми фичами, запрошенными клиентом.

**Формат вывода (СТРОГО JSON-массив объектов):**
Каждый объект в массиве должен представлять один "твик" и иметь следующую структуру:
*   **\`tweak_description\`:** (String) Краткое описание задачи для "Танка".
*   **\`estimated_complexity\`:** (String: "low" | "medium" | "high") Субъективная оценка сложности.
*   **\`relevant_supervibe_capability\`:** (String) Какая возможность Supervibe Studio/Jumpstart Kit может быть использована.
*   **\`target_file_guess\`:** (String | null) Примерный путь к файлу/компоненту для модификации.
*   **\`generated_repo_xml_link_idea\`:** (String | null) Идея для параметра 'idea' в ссылке на /repo-xml.

**Пример вывода для одной задачи:**
\`\`\`json
{
  "tweak_description": "Интегрировать существующий дизайн Figma для главной страницы и карточек тренировок в React-компоненты.",
  "estimated_complexity": "medium",
  "relevant_supervibe_capability": "AI-генерация React/SCSS кода по описанию/скриншотам Figma, адаптация UI-кита.",
  "target_file_guess": "/app/page.tsx, /components/TrainingCard.tsx",
  "generated_repo_xml_link_idea": "ImplementMainPageAndTrainingCardsFromFigma"
}
\`\`\`
**Если твики не найдены, верни пустой JSON-массив \`[]\`**.

**Инструкции:**
*   Сосредоточься на задачах, которые являются доработкой, адаптацией, стилизацией, интеграцией готовых частей, а НЕ созданием *принципиально нового* функционала с нуля.
*   Учитывай, что "Танки" работают с AI-инструментами.
*   Анализируй \`lead_data.project_description\` и \`lead_data.key_features_requested_list\`.

Проанализируй предоставленные данные лида и выдели задачи по кастомизации в формате JSON-массива:
\`\`\`json
// Объект lead_data будет здесь при реальном вызове. 
// Для тестирования этого промпта, можешь представить его структуру так:
/*
lead_data = {
  "project_description": "{{project_description}}", // Сюда будет подставлено описание проекта
  "key_features_requested_list": ["фича1 из описания", "фича2 из описания"] // Сюда будет подставлен список ключевых фич
}
*/
\`\`\`
Данные лида для анализа:
Project Description: {{project_description}}
Key Features Requested: {{key_features_requested_list_json_string}}
`;