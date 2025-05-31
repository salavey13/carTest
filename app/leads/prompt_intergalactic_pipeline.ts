// /app/leads/prompt_intergalactic_pipeline.ts
import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_OFFER_V4_CYBERVIBE_OUTREACH } from './prompt_offer';
import { PROMPT_FIND_TWEAKS } from './prompt_find_tweaks';
import { PROMPT_FIND_MISSING_FEATURES } from './prompt_find_missing_features';

export const PROMPT_INTERGALACTIC_PIPELINE = (rawKworksTextBlock: string) => `
**ЗАДАЧА "КИБЕР-КОНВЕЙЕР ЛИДОВ":**

Ты – высокоинтеллектуальный AI-ассистент КиберОтряда Supervibe. Твоя задача – обработать предоставленный ниже блок текста ("Сырые Данные Kwork") и выполнить последовательно ЧЕТЫРЕ ЭТАПА анализа и генерации для КАЖДОГО обнаруженного проекта (лида). В конечном итоге, ты должен предоставить **ТОП-3 наиболее перспективных лида** (или меньше, если найдено меньше) в виде **ОДНОЙ CSV-СТРОКИ**, включающей заголовок и данные для этих лидов.

**ЭТАП 1: ТРАНСМУТАЦИЯ ХАОСА В JSON (Промпт: PROMPT_KWORKS_TO_CSV)**
*   **Вход:** Блок текста "Сырые Данные Kwork".
*   **Задача:** Используя логику из \`PROMPT_KWORKS_TO_CSV\` (см. ниже), извлеки данные по каждому проекту и представь их в виде **JSON-массива объектов**. Каждый объект – один лид. Этот массив будет твоим основным рабочим набором данных для последующих этапов. Обязательно включи поля \`initial_relevance_score\` и \`project_type_guess\`.
*   **Промежуточный Результат Этапа 1 (для твоего внутреннего использования):** \`leads_stage1_json_array\` (JSON-массив объектов лидов).

---
${PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksTextBlock)}
---

**ЭТАП 2: ГЕНЕРАЦИЯ УБОЙНЫХ ОФФЕРОВ (Промпт: PROMPT_OFFER_V2_CYBERVIBE_OUTREACH)**
*   **Вход:** \`leads_stage1_json_array\`.
*   **Задача:** Для КАЖДОГО объекта лида (\`current_lead\`) из \`leads_stage1_json_array\`, используя данные из него (включая \`current_lead.project_type_guess\`) и логику из \`PROMPT_OFFER_V2_CYBERVIBE_OUTREACH\` (см. ниже), сгенерируй персонализированный оффер.
*   **Промежуточный Результат Этапа 2 (для твоего внутреннего использования):** Для каждого лида – \`generated_offer_string\`. Добавь это как новое поле к каждому объекту лида в твоем рабочем массиве.

---
${PROMPT_OFFER_V4_CYBERVIBE_OUTREACH} 
---

**ЭТАП 3: ОПРЕДЕЛЕНИЕ ТВИНКОВ ДЛЯ ТАНКОВ (Промпт: PROMPT_FIND_TWEAKS)**
*   **Вход:** Твой рабочий массив лидов (уже обогащенный офферами). Для каждого лида (\`current_lead\`) используй \`current_lead.project_description\`, \`current_lead.key_features_requested_list\` и **\`current_lead.project_type_guess\`**. Передай в промпт \`PROMPT_FIND_TWEAKS\` список известных фич SuperVibe для более точного определения.
*   **Задача:** Для КАЖДОГО лида, используя логику из \`PROMPT_FIND_TWEAKS\` (см. ниже), определи задачи по кастомизации ("твики") и верни их как **JSON-массив объектов твиков**.
*   **Промежуточный Результат Этапа 3 (для твоего внутреннего использования):** Для каждого лида – \`identified_tweaks_json_array\` (массив объектов). Добавь это как новое поле.

---
${PROMPT_FIND_TWEAKS}
---

**ЭТАП 4: ЗАДАЧИ R&D ДЛЯ КЭРРИ (Промпт: PROMPT_FIND_MISSING_FEATURES)**
*   **Вход:** Твой рабочий массив лидов. Для каждого лида (\`current_lead\`) используй \`current_lead.project_description\`, \`current_lead.key_features_requested_list\`, **\`current_lead.project_type_guess\`** и \`current_lead.identified_tweaks_json_array\`. Передай в промпт \`PROMPT_FIND_MISSING_FEATURES\` список известных фич SuperVibe.
*   **Задача:** Для КАЖДОГО лида, используя логику из \`PROMPT_FIND_MISSING_FEATURES\` (см. ниже), определи принципиально новые/сложные фичи и верни их как **JSON-массив объектов фич**.
*   **Промежуточный Результат Этапа 4 (для твоего внутреннего использования):** Для каждого лида – \`missing_features_json_array\` (массив объектов). Добавь это как новое поле.

---
${PROMPT_FIND_MISSING_FEATURES}
---

**ФИНАЛЬНЫЙ ВЫВОД (СТРОГО CSV-СТРОКА):**

1.  **Анализ и Ранжирование:** После выполнения всех четырех этапов для ВСЕХ лидов, ранжируй их по следующим критериям (в порядке убывания важности):
    1.  **Высокий \`initial_relevance_score\` (8-10):** Сильное совпадение со стеком (React, Next.js, TWA, Supabase).
    2.  **Соответствие \`project_type_guess\` известным готовым решениям SuperVibe:** Проекты типа "TWA_Training", "TWA_CarRental", "TWA_WheelOfFortune" и т.д. получают ЗНАЧИТЕЛЬНЫЙ бонус.
    3.  **Ясность требований:** Проекты с четко описанными задачами предпочтительнее.
    4.  **Адекватность бюджета к объему работ:** Оценивается на основе описания и фич. Если бюджет явно мал для всего, но есть четкий MVP, это нормально.
    5.  **Минимальное количество СЛОЖНЫХ \`missing_features\` (задач для "Кэрри"):** Проекты, требующие в основном "твиков" для "Танков", быстрее в реализации.
2.  **Выбор ТОП-Лидов:** Выбери **ТОП-3 НАИБОЛЕЕ ПЕРСПЕКТИВНЫХ ЛИДА** по результатам ранжирования (или менее, если всего найдено меньше).
3.  **Генерация CSV:** Для каждого выбранного ТОП-лида сформируй строку CSV.
    *   **Заголовок CSV (первая строка вывода):** \`"client_name","kwork_url","project_description","budget_range","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source","similarity_score"\`
    *   **Строки данных CSV (для каждого ТОП-лида):**
        *   \`client_name\`: из данных Этапа 1.
        *   \`kwork_url\`: из данных Этапа 1 (будет \`lead_url\` при импорте).
        *   \`project_description\`: из данных Этапа 1.
        *   \`budget_range\`: из данных Этапа 1.
        *   \`raw_html_description\`: из данных Этапа 1.
        *   \`generated_offer\`: строка оффера из Этапа 2.
        *   \`identified_tweaks\`: **JSON-строка** от \`JSON.stringify(current_lead.identified_tweaks_json_array)\`. Если массив пуст, используй \`"[]"\`.
        *   \`missing_features\`: **JSON-строка** от \`JSON.stringify(current_lead.missing_features_json_array)\`. Если массив пуст, используй \`"[]"\`.
        *   \`status\`: установи значение \`"analyzed"\`
        *   \`source\`: установи значение \`"kwork_pipeline_top3"\`
        *   \`similarity_score\`: из данных Этапа 1 (\`current_lead.initial_relevance_score\`).
    *   **Форматирование CSV:**
        *   Разделитель: запятая (,).
        *   Все текстовые поля, включая JSON-строки, должны быть заключены в двойные кавычки (\`"\`).
        *   Двойные кавычки внутри текстовых полей экранируются удвоением (\`""\`).
        *   Отсутствующие значения (null на Этапе 1) -> пустая строка в CSV (\`""\`).

**Пример финального CSV-вывода (для одного лида):**
\`\`\`csv
"client_name","kwork_url","project_description","budget_range","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source","similarity_score"
"urik99","https://kwork.ru/projects/2840722","Разработка telegram mini app...","до 10 000 ₽ / до 30 000 ₽","","Привет, urik99! ... ваш оффер ...","[{""tweak_description"":""Интеграция дизайна..."",""estimated_complexity"":""medium"",...}]","[{""feature_description"":""Новая фича Х..."",""reason_for_carry"":""Сложная логика..."",...}]","analyzed","kwork_pipeline_top3",9
\`\`\`
*(Если несколько ТОП-лидов, каждая новая строка данных будет под заголовком)*

**ВАЖНО:**
*   Весь финальный вывод должен быть **ТОЛЬКО CSV-строкой (или несколькими строками, если >1 лида), НАЧИНАЯ С ЗАГОЛОВКА.**
*   Никаких дополнительных пояснений, JSON-объектов или \`\`\`csv \`\`\` маркеров до или после CSV-данных.
*   Если "Сырые Данные Kwork" содержат менее 3 лидов, выведи CSV-строки для всех найденных. Если лидов 0, выведи только строку заголовка CSV.

**Сырые Данные Kwork для обработки:**
\`\`\`text
${rawKworksTextBlock || "ЗДЕСЬ ДОЛЖЕН БЫТЬ ТЕКСТ С KWORK"}
\`\`\`
`;
