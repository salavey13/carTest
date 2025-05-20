import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_OFFER_V2_CYBERVIBE_OUTREACH } from './prompt_offer';
import { PROMPT_FIND_TWEAKS } from './prompt_find_tweaks';
import { PROMPT_FIND_MISSING_FEATURES } from './prompt_find_missing_features';

export const PROMPT_INTERGALACTIC_PIPELINE = (rawKworksTextBlock: string) => `
**ЗАДАЧА "КИБЕР-КОНВЕЙЕР ЛИДОВ":**

Ты – высокоинтеллектуальный AI-ассистент КиберОтряда Supervibe. Твоя задача – обработать предоставленный ниже блок текста ("Сырые Данные Kwork") и выполнить последовательно ЧЕТЫРЕ ЭТАПА анализа и генерации для КАЖДОГО обнаруженного проекта (лида). В конечном итоге, ты должен предоставить **ТОП-3 наиболее перспективных лида** в виде **ОДНОЙ CSV-СТРОКИ**, включающей заголовок и данные для этих лидов.

**ЭТАП 1: ТРАНСМУТАЦИЯ ХАОСА В JSON (Промпт: PROMPT_KWORKS_TO_CSV)**
*   **Вход:** Блок текста "Сырые Данные Kwork".
*   **Задача:** Используя логику из \`PROMPT_KWORKS_TO_CSV\` (см. ниже), извлеки данные по каждому проекту и представь их в виде **JSON-массива объектов**. Каждый объект – один лид. Этот массив будет твоим основным рабочим набором данных для последующих этапов.
*   **Промежуточный Результат Этапа 1 (для твоего внутреннего использования):** \`leads_stage1_json_array\` (JSON-массив объектов лидов).

---
${PROMPT_KWORKS_TO_CSV.replace("{{RAW_KWORKS_TEXT_BLOCK}}", rawKworksTextBlock)}
---

**ЭТАП 2: ГЕНЕРАЦИЯ УБОЙНЫХ ОФФЕРОВ (Промпт: PROMPT_OFFER_V2_CYBERVIBE_OUTREACH)**
*   **Вход:** \`leads_stage1_json_array\`.
*   **Задача:** Для КАЖДОГО объекта лида (\`current_lead\`) из \`leads_stage1_json_array\`, используя данные из него (например, \`current_lead.client_name\`, \`current_lead.project_description\`, \`current_lead.key_features_requested_list\`) и логику из \`PROMPT_OFFER_V2_CYBERVIBE_OUTREACH\` (см. ниже), сгенерируй персонализированный оффер.
*   **Промежуточный Результат Этапа 2 (для твоего внутреннего использования):** Для каждого лида – \`generated_offer_string\`. Добавь это как новое поле к каждому объекту лида в твоем рабочем массиве.

---
${PROMPT_OFFER_V2_CYBERVIBE_OUTREACH} 
---

**ЭТАП 3: ОПРЕДЕЛЕНИЕ ТВИНКОВ ДЛЯ ТАНКОВ (Промпт: PROMPT_FIND_TWEAKS)**
*   **Вход:** Твой рабочий массив лидов (уже обогащенный офферами). Для каждого лида (\`current_lead\`) используй \`current_lead.project_description\` и \`current_lead.key_features_requested_list\`.
*   **Задача:** Для КАЖДОГО лида, используя логику из \`PROMPT_FIND_TWEAKS\` (см. ниже), определи задачи по кастомизации ("твики") и верни их как **JSON-массив объектов твиков**.
*   **Промежуточный Результат Этапа 3 (для твоего внутреннего использования):** Для каждого лида – \`identified_tweaks_json_array\`. Добавь это как новое поле.

---
${PROMPT_FIND_TWEAKS}
---

**ЭТАП 4: ЗАДАЧИ R&D ДЛЯ КЭРРИ (Промпт: PROMPT_FIND_MISSING_FEATURES)**
*   **Вход:** Твой рабочий массив лидов. Для каждого лида (\`current_lead\`) используй \`current_lead.project_description\`, \`current_lead.key_features_requested_list\` и \`current_lead.identified_tweaks_json_array\`.
*   **Задача:** Для КАЖДОГО лида, используя логику из \`PROMPT_FIND_MISSING_FEATURES\` (см. ниже), определи принципиально новые/сложные фичи и верни их как **JSON-массив объектов фич**.
*   **Промежуточный Результат Этапа 4 (для твоего внутреннего использования):** Для каждого лида – \`missing_features_json_array\`. Добавь это как новое поле.

---
${PROMPT_FIND_MISSING_FEATURES}
---

**ФИНАЛЬНЫЙ ВЫВОД (СТРОГО CSV-СТРОКА):**

1.  **Анализ и Ранжирование:** После выполнения всех четырех этапов для ВСЕХ лидов из "Сырых Данных Kwork", у тебя будет массив обогащенных объектов лидов. Ранжируй эти лиды, используя в первую очередь \`initial_relevance_score\` (из данных Этапа 1), затем количество и сложность твиков и недостающих фич.
2.  **Выбор ТОП-Лидов:** Выбери **ТОП-3 НАИБОЛЕЕ ПЕРСПЕКТИВНЫХ ЛИДА** (или менее, если всего найдено меньше).
3.  **Генерация CSV:** Для каждого выбранного ТОП-лида сформируй строку CSV.
    *   **Заголовок CSV (первая строка вывода):** \`"client_name","kwork_url","project_description","budget_range","deadline_info","client_kwork_history","current_kwork_offers_count","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source"\`
    *   **Строки данных CSV (для каждого ТОП-лида):**
        *   \`client_name\`: из данных Этапа 1 (\`current_lead.client_name\`)
        *   \`kwork_url\`: из данных Этапа 1 (\`current_lead.kwork_url\`)
        *   \`project_description\`: из данных Этапа 1 (\`current_lead.project_description\`)
        *   \`budget_range\`: из данных Этапа 1 (\`current_lead.budget_range\`)
        *   \`deadline_info\`: из данных Этапа 1 (\`current_lead.deadline_info\`)
        *   \`client_kwork_history\`: из данных Этапа 1 (\`current_lead.client_kwork_history\`)
        *   \`current_kwork_offers_count\`: из данных Этапа 1 (\`current_lead.current_kwork_offers_count\`)
        *   \`raw_html_description\`: из данных Этапа 1 (\`current_lead.raw_html_description\`)
        *   \`generated_offer\`: строка оффера из Этапа 2 (\`current_lead.generated_offer_string\`)
        *   \`identified_tweaks\`: **JSON-строка** (stringified) из \`current_lead.identified_tweaks_json_array\` (Этап 3). Если массив пуст, используй \`"[]"\`.
        *   \`missing_features\`: **JSON-строка** (stringified) из \`current_lead.missing_features_json_array\` (Этап 4). Если массив пуст, используй \`"[]"\`.
        *   \`status\`: установи значение \`"analyzed_by_pipeline"\`
        *   \`source\`: установи значение \`"kwork_pipeline_top3"\`
    *   **Форматирование CSV:**
        *   Используй запятую (,) как разделитель.
        *   Все текстовые поля, включая JSON-строки, должны быть заключены в двойные кавычки (\`"\`).
        *   Двойные кавычки внутри текстовых полей экранируются удвоением (\`""\`).
        *   Если значение поля отсутствует (например, \`budget_range\` был \`null\` на Этапе 1), используй пустую строку в CSV (\`""\`).

**Пример финального CSV-вывода (для одного лида):**
\`\`\`csv
"client_name","kwork_url","project_description","budget_range","deadline_info","client_kwork_history","current_kwork_offers_count","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source"
"urik99","https://kwork.ru/projects/2840722","Разработка telegram mini app...","до 10 000 ₽ / до 30 000 ₽","1 д. 17 ч.","Размещено проектов на бирже: 2","Предложений: 5","","Привет, urik99! ... ваш оффер ...","[{""tweak_description"":""Интеграция дизайна..."",""estimated_complexity"":""medium"",...}]","[{""feature_description"":""Новая фича Х..."",""reason_for_carry"":""Сложная логика..."",...}]","analyzed_by_pipeline","kwork_pipeline_top3"
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
