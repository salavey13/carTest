export const PROMPT_FIND_MISSING_FEATURES = `
**Задача:** Проанализировать описание проекта клиента и определить, какие принципиально НОВЫЕ, сложные или нетиповые функции требуются, которые выходят за рамки стандартных возможностей Supervibe Studio / Jumpstart Kit и простой кастомизации "Танками". Это задачи для "Кэрри" (главного разработчика).

**Контекст Supervibe Studio & Jumpstart Kit:**
*   TWA/Mini Apps на React, Next.js, TypeScript, Supabase.
*   CRUD операции, формы, списки, профили, каталоги.
*   Авторизация Telegram, базовые интеграции с Telegram Bot API.

**Входные данные (JSON-объект лида \`lead_data\` и JSON-массив \`identified_tweaks_json\`):**
1.  **\`lead_data.project_description\`:** Описание проекта от клиента.
2.  **\`lead_data.key_features_requested_list\`:** (Из предыдущего AI-анализа) JSON-массив строк с ключевыми фичами.
3.  **\`identified_tweaks_json\`:** (Из предыдущего AI-анализа) JSON-массив объектов с задачами по кастомизации, уже определенными для "Танков".

**Формат вывода (СТРОГО JSON-массив объектов):**
Каждый объект в массиве должен представлять одну НОВУЮ/СЛОЖНУЮ фичу и иметь следующую структуру:
*   **\`feature_description\`:** (String) Четкое описание фичи.
*   **\`reason_for_carry\`:** (String) Почему эта задача для "Кэрри".
*   **\`potential_impact_on_supervibe\`:** (String | null) Может ли разработка этой фичи улучшить Supervibe Studio.

**Пример вывода для одной фичи:**
\`\`\`json
{
  "feature_description": "Разработка бэкенд-логики для real-time синхронизации прогресса тренировок.",
  "reason_for_carry": "Требует кастомной WebSocket-архитектуры и сложной логики синхронизации.",
  "potential_impact_on_supervibe": "Может стать основой для модуля 'Real-time Sync' в Supervibe Studio."
}
\`\`\`
**Если новые/сложные фичи не найдены, верни пустой JSON-массив \`[]\`**.

**Инструкции:**
*   Исключи фичи, которые уже покрываются Jumpstart Kit или являются простой кастомизацией (те, что в \`identified_tweaks_json\`).
*   Ищи запросы на уникальную бизнес-логику, сложные алгоритмы, интеграции со специфичными API, высокие требования к производительности/безопасности.
*   Анализируй \`lead_data.project_description\`, \`lead_data.key_features_requested_list\` и ИСКЛЮЧАЙ то, что есть в \`identified_tweaks_json\`.

Проанализируй предоставленные данные и выдели НОВЫЕ/СЛОЖНЫЕ фичи для "Кэрри" в формате JSON-массива:
\`\`\`json
// Объекты lead_data и identified_tweaks_json будут здесь при реальном вызове.
// Для тестирования этого промпта, можешь представить их структуру так:
/*
lead_data = {
  "project_description": "{{project_description}}",
  "key_features_requested_list": ["фича1", "фича2", "сложная фича Х"]
};
identified_tweaks_json = [
  {"tweak_description": "Кастомизация фичи1", ...},
  {"tweak_description": "Адаптация фичи2", ...}
];
*/
\`\`\`
Данные лида для анализа:
Project Description: {{project_description}}
Key Features Requested: {{key_features_requested_list_json_string}}
Identified Tweaks (for Tanks, to EXCLUDE from your list): {{identified_tweaks_list_or_json_string_optional}}
`;