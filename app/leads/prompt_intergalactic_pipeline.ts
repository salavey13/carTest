import { PROMPT_KWORKS_TO_CSV } from './prompt_kworks_to_csv';
import { PROMPT_OFFER_V2_CYBERVIBE_OUTREACH } from './prompt_offer';
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
${PROMPT_OFFER_V2_CYBERVIBE_OUTREACH} 
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
    *   **Заголовок CSV (первая строка вывода):** \`"client_name","kwork_url","project_description","budget_range","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source","initial_relevance_score","project_type_guess"\`
    *   **Строки данных CSV (для каждого ТОП-лида):**
        *   \`client_name\`: из данных Этапа 1.
        *   \`kwork_url\`: из данных Этапа 1 (будет \`lead_url\` при импорте).
        *   \`project_description\`: из данных Этапа 1.
        *   \`budget_range\`: из данных Этапа 1.
        *   \`raw_html_description\`: из данных Этапа 1.
        *   \`generated_offer\`: строка оффера из Этапа 2.
        *   \`identified_tweaks\`: **JSON-строка** (см. правила форматирования ниже).
        *   \`missing_features\`: **JSON-строка** (см. правила форматирования ниже).
        *   \`status\`: установи значение \`"analyzed_by_pipeline"\`
        *   \`source\`: установи значение \`"kwork_pipeline_top3"\`
        *   \`initial_relevance_score\`: из данных Этапа 1.
        *   \`project_type_guess\`: из данных Этапа 1.
    *   **Форматирование CSV (НЕУКОСНИТЕЛЬНО СЛЕДОВАТЬ!):**
        *   **Разделитель:** Запятая (\`,\`).
        *   **Общее правило для всех полей:** Каждое поле в CSV-строке ДОЛЖНО быть заключено в двойные кавычки (например, \`"значение поля"\`).
        *   **Экранирование двойных кавычек ВНУТРИ ПОЛЕЙ:** Если внутри оригинального значения поля (например, в тексте \`project_description\`, \`generated_offer\`, или в JSON-строках для \`identified_tweaks\`/\`missing_features\`) встречается символ двойной кавычки (\`"\`), этот символ ДОЛЖЕН быть ЗАМЕНЕН на ДВЕ двойные кавычки (\`""\`). Это КРИТИЧЕСКИ ВАЖНО для корректного парсинга.
        *   **Форматирование полей \`identified_tweaks\` и \`missing_features\` (JSON-строки):**
            1.  Возьми соответствующий JSON-массив из результатов этапа (например, \`current_lead.identified_tweaks_json_array\`).
            2.  Преобразуй этот массив в JSON-строку. Например, с помощью \`JSON.stringify()\`. Если массив пуст, результатом будет строка \`"[]"\`.
            3.  В этой ПОЛУЧЕННОЙ JSON-строке (результат шага 2), ЗАМЕНИ КАЖДУЮ ВНУТРЕННЮЮ ДВОЙНУЮ КАВЫЧКУ (\`"\`) на ДВЕ ДВОЙНЫЕ КАВЫЧКИ (\`""\`).
            4.  Наконец, заключи эту ОБРАБОТАННУЮ JSON-строку (результат шага 3) в ОДНУ ПАРУ ВНЕШНИХ ДВОЙНЫХ КАВЫЧЕК для формирования CSV-поля.
            *   **Пример для \`identified_tweaks\`:**
                *   JSON-массив: \`[{ "tweak_description": "Fix \"the\" button" }]\`
                *   После \`JSON.stringify()\`: \`[{"tweak_description":"Fix \\"the\\" button"}]\` (обрати внимание, что \`JSON.stringify\` сам экранирует кавычки внутри строк JSON)
                *   **Корректное CSV-поле после твоего экранирования для CSV:** \`"[{\\""tweak_description\\"":\""Fix \\\\\""the\\\\\"" button\\""}]"\` (Сложно для LLM, давай упростим)

                **УПРОЩЕННОЕ ПРАВИЛО ДЛЯ JSON-ПОЛЕЙ (\`identified_tweaks\`, \`missing_features\`):**
                1.  JSON-массив (например, \`current_lead.identified_tweaks_json_array\`).
                2.  Преобразуй в JSON-строку: \`let jsonString = JSON.stringify(current_lead.identified_tweaks_json_array);\`
                3.  Замени ВСЕ двойные кавычки в \`jsonString\` на ДВЕ двойные кавычки: \`jsonString = jsonString.replace(/"/g, '""');\`
                4.  Итоговое CSV-поле: \`\`"\${jsonString}\`\` (т.е. \`"\` + результат шага 3 + \`"\`)
                *   **Пример для \`identified_tweaks\` (УПРОЩЕННЫЙ):**
                    *   JSON-массив: \`[{ "name": "Tweak \"Alpha\"" }]\`
                    *   Шаг 2 (\`JSON.stringify\`): \`[{"name":"Tweak \\"Alpha\\""}]\`
                    *   Шаг 3 (замена \`"\` на \`""\`): \`[[{""name"":""Tweak \""Alpha\""""_}]\` (Здесь ошибка в примере, так как `\` не экранируется. JSON.stringify уже это делает. Нам нужно экранировать кавычки *самой JSON-строки*)
                    *   **ПРАВИЛЬНЫЙ УПРОЩЕННЫЙ ПРИМЕР для \`identified_tweaks\`:**
                        *   JSON-массив: \`[{ "feature": "Button text with \"quotes\"" }]\`
                        *   Результат \`JSON.stringify()\`: \`[{"feature":"Button text with \\"quotes\\""}]\`
                        *   **Твое CSV-поле должно быть:** \`"[{\\""feature\\"":\""Button text with \\\\\""quotes\\\\\""\""}]"\` 
                            (Это очень сложно объяснить LLM. Ключ в том, что JSON.stringify уже создает валидную JSON строку. Эту *строку* нужно поместить в CSV поле. Если эта строка содержит кавычки, их надо удвоить)

                **ПЕРЕСМОТРЕННОЕ И СУПЕР-ЧЕТКОЕ УПРОЩЕННОЕ ПРАВИЛО ДЛЯ JSON-ПОЛЕЙ (\`identified_tweaks\`, \`missing_features\`):**
                1.  Получи JSON-массив, например, \`arr = current_lead.identified_tweaks_json_array\`.
                2.  Преобразуй его в JSON-строку: \`json_string_representation = JSON.stringify(arr)\`.
                3.  Теперь, чтобы подготовить \`json_string_representation\` для CSV: замени каждую двойную кавычку (\`"\`) ВНУТРИ \`json_string_representation\` на две двойные кавычки (\`""\`). Пусть это будет \`escaped_json_string_representation\`.
                4.  Итоговое значение для CSV-поля будет: \`"\` + \`escaped_json_string_representation\` + \`"\`.
                *   **Пример:**
                    *   \`arr = [{ "id": 1, "task": "Fix \"Login\" button" }]\`
                    *   \`json_string_representation = JSON.stringify(arr)\` даст строку: \`[{"id":1,"task":"Fix \\"Login\\" button"}]\`
                    *   \`escaped_json_string_representation\` (после замены \`"\` на \`""\` в предыдущей строке): \`[[{""id"":1,""task"":""Fix \""Login\"" button""}]]\` (Опять же, пример экранирования сложен для LLM, т.к. `JSON.stringify` уже экранирует для JSON. LLM должен экранировать для CSV.)
                    *   **ЛУЧШЕ ТАК:**
                        *   \`arr = [{ "id": 1, "task": "Fix \"Login\" button" }]\`
                        *   \`json_as_string = JSON.stringify(arr)\` (результат: \`[{"id":1,"task":"Fix \\"Login\\" button"}]\`)
                        *   Теперь, для CSV, возьми эту строку \`json_as_string\` и, если она содержит символ \`"\`, замени его на \`""\`.
                        *   **Итоговое поле в CSV:** \`"[{\""id\"":1,\""task\"":\""Fix \\\""Login\\\"" button\""}]"\` (Здесь сам `JSON.stringify` уже создал строку. Эту строку нужно обернуть в кавычки. Если в этой строке есть кавычки, их нужно удвоить.)

                **ОКОНЧАТЕЛЬНОЕ СУПЕР-ЧЕТКОЕ ПРАВИЛО ДЛЯ JSON-ПОЛЕЙ (\`identified_tweaks\`, \`missing_features\`):**
                1. Пусть \`json_array\` это твой массив объектов (например, \`current_lead.identified_tweaks_json_array\`).
                2. Преобразуй его в СТРОКУ: \`let S = JSON.stringify(json_array);\`. Если массив пустой, \`S\` будет \`"[]"\`.
                3. Теперь создай CSV-значение для этого поля: \`"\` + (строка \`S\` в которой все символы \`"\` заменены на \`""\`) + \`"\`.
                *   **Пример:** \`json_array = [{name: "Feature X", details: "Has \"quotes\""}]\`
                *   \`S = JSON.stringify(json_array)\` даст строку: \`[{"name":"Feature X","details":"Has \\"quotes\\""}]\`
                *   Заменяем \`"\` на \`""\` в строке \`S\`: \`[[{""name"":""Feature X"",""details"":""Has \""quotes\""""_}]]\` (Все еще проблема с пониманием LLM, что JSON.stringify уже создал строку.)
                *   **ФИНАЛЬНЫЙ ПРОСТОЙ ПОДХОД ДЛЯ LLM:**
                    1.  `json_data = current_lead.identified_tweaks_json_array` (или `missing_features_json_array`)
                    2.  `json_string = JSON.stringify(json_data)` (эта строка уже корректна как JSON)
                    3.  `csv_escaped_json_string = json_string.replace(/"/g, '""')` (УДВОЙ ВСЕ КАВЫЧКИ ВНУТРИ ЭТОЙ JSON-СТРОКИ)
                    4.  Финальное CSV поле: `"\` + `csv_escaped_json_string` + `\""`

        *   **Форматирование текстовых полей (\`project_description\`, \`generated_offer\` и др.):**
            1.  Возьми текстовое значение поля.
            2.  Замени КАЖДУЮ ВНУТРЕННЮЮ ДВОЙНУЮ КАВЫЧКУ (\`"\`) на ДВЕ ДВОЙНЫЕ КАВЫЧКИ (\`""\`).
            3.  Заключи результат в ОДНУ ПАРУ ВНЕШНИХ ДВОЙНЫХ КАВЫЧЕК.
            *   Пример: Если \`generated_offer\` = \`Наш "Супер" оффер!\`, то CSV-поле будет \`"Наш ""Супер"" оффер!"\`.
        *   **Отсутствующие значения:** Если значение поля на Этапе 1 было \`null\` (например, для \`raw_html_description\`, \`budget_range\`), в CSV это должно быть представлено как пустая строка, заключенная в двойные кавычки: \`""\`.

**Пример финального CSV-вывода (для одного лида):**
\`\`\`csv
"client_name","kwork_url","project_description","budget_range","raw_html_description","generated_offer","identified_tweaks","missing_features","status","source","initial_relevance_score","project_type_guess"
"urik99","https://kwork.ru/projects/2840722","Описание с ""цитатой"" внутри.","до 10 000 ₽ / до 30 000 ₽","","Привет, urik99! Наш ""специальный"" оффер...","[{""tweak_description"":""Интеграция дизайна с \""спецэффектами\""..."",""estimated_complexity"":""medium"",...}]","[{""feature_description"":""Новая фича \""X\""..."",""reason_for_carry"":""Сложная логика..."",...}]","analyzed_by_pipeline","kwork_pipeline_top3",9,"TWA_Training"
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