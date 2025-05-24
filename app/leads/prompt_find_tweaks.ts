export const PROMPT_FIND_TWEAKS = `
**Задача:** Проанализировать описание проекта клиента и определить, какие конкретные задачи по кастомизации или доработке ("твики") потребуются от команды "Танков". Сопоставь эти задачи с возможностями Supervibe Studio и Jumpstart Kit, включая известные готовые компоненты/страницы.

**Контекст Supervibe Studio & Jumpstart Kit & Известные Компоненты/Страницы:**
*   **Jumpstart Kit:** Базовый TWA (React/Next.js/Supabase) с авторизацией TG, UI-китом, CRUD-операциями, профилями, каталогами, формами.
*   **SUPERVIBE Studio:** AI-инструменты для быстрой модификации кода React/Next.js, TailwindCSS, интеграции с Supabase.
*   **Известные готовые или легко адаптируемые решения (страницы/компоненты):**
    *   **TWA_Training / TWA_Fitness:** Компоненты для отображения тренировок (карточки, списки), профили пользователей, отслеживание прогресса. (например, \`/app/start-training/page.tsx\`, \`/components/cards/TrainingCard.tsx\`)
    *   **TWA_CarRental:** Компоненты для каталога авто, фильтры, система бронирования, личные кабинеты. **Если \`project_type_guess\` == "TWA_CarRental", то создание каталога, фильтров, системы бронирования и личных кабинетов является "твиком" к существующей базовой логике, а не новой фичей с нуля.** (например, \`/app/rent-car/page.tsx\`)
    *   **TWA_WheelOfFortune:** Компонент "Колесо Фортуны". (например, \`/app/wheel-of-fortune/page.tsx\`)
    *   **TWA_Captcha:** Компонент для верификации Captcha. (например, \`/components/CaptchaVerification.tsx\`)
    *   **TWA_ArticleFromYouTube:** Генерация статей из видео YouTube. (например, \`/app/yt/page.tsx\`)
    *   **TWA_VPRTests:** Система тестирования для школьников (ВПР). (например, \`/app/vpr-tests/page.tsx\`, \`/app/vpr-test/[subjectId]/page.tsx\`)
    *   **TWA_Ecommerce_Basic:** Базовые e-commerce функции: каталог товаров, корзина.
    *   **TWA_SemanticSearch:** Поиск по текстовым данным.
    *   **TWA_Admin_Basic:** Базовая админ-панель для управления контентом и пользователями. (например, \`/app/admin/page.tsx\`)
    *   **Прочее:** Страницы \`/app/donate/page.tsx\`, \`/app/buy-subscription/page.tsx\`. Базовая интеграция платежных систем (Telegram Stars, простые API).
*   **Стек:** React, Next.js, TypeScript, Supabase.

**Входные данные (JSON-объект лида \`lead_data\`):**
1.  **\`lead_data.project_description\`:** Описание проекта от клиента.
2.  **\`lead_data.key_features_requested_list\`:** (Из Этапа 1 конвейера) JSON-массив строк с ключевыми фичами, запрошенными клиентом.
3.  **\`lead_data.project_type_guess\`**: (Из Этапа 1 конвейера) Классификация проекта (например, "TWA_Training", "TWA_CarRental").

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

**Пример вывода для одной задачи (если \`project_type_guess\` = "TWA_CarRental", и клиент запрашивает "каталог, фильтры, корзина, личные кабинеты, админка, платежка"):**
\`\`\`json
[
  {
    "tweak_description": "Кастомизация UI и функционала каталога авто (отображение, фильтры, сортировка) под дизайн клиента на базе `TWA_CarRental` модуля.",
    "estimated_complexity": "medium",
    "relevant_supervibe_capability": "Адаптация компонента `TWA_CarRental` Catalog/Filters с помощью AI-инструментов SUPERVIBE Studio.",
    "target_file_guess": "\`/app/rent-car/page.tsx\`, \`/components/car/CarCatalog.tsx\`",
    "generated_repo_xml_link_idea": "CustomizeCarCatalogUI"
  },
  {
    "tweak_description": "Доработка системы бронирования и корзины для аренды авто, включая специфические поля и логику на базе `TWA_CarRental` модуля.",
    "estimated_complexity": "medium",
    "relevant_supervibe_capability": "Расширение функционала `TWA_CarRental` Booking/Cart с помощью AI-инструментов SUPERVIBE Studio.",
    "target_file_guess": "\`/components/car/BookingForm.tsx\`, \`/app/cart/page.tsx\`",
    "generated_repo_xml_link_idea": "EnhanceCarRentalBooking"
  },
  {
    "tweak_description": "Адаптация существующих личных кабинетов для пользователей и владельцев авто в рамках `TWA_CarRental` модуля.",
    "estimated_complexity": "low",
    "relevant_supervibe_capability": "Кастомизация `Profile` и `Admin` страниц с помощью AI-инструментов SUPERVIBE Studio.",
    "target_file_guess": "\`/app/profile/page.tsx\`, \`/app/admin/page.tsx\`",
    "generated_repo_xml_link_idea": "AdjustUserOwnerProfiles"
  },
  {
    "tweak_description": "Интеграция указанной платежной системы в TWA (если это простой API) и адаптация существующего админ-панели для управления платежами.",
    "estimated_complexity": "medium",
    "relevant_supervibe_capability": "Интеграция платежной системы и адаптация `TWA_Admin_Basic`.",
    "target_file_guess": "\`/lib/payment/paymentProcessor.ts\`, \`/app/admin/payments/page.tsx\`",
    "generated_repo_xml_link_idea": "IntegrateCustomPaymentGateway"
  }
]
\`\`\`
**Если твики не найдены, верни пустой JSON-массив \`[]\`**.

**Инструкции:**
*   Сосредоточься на задачах, которые являются доработкой, адаптацией, стилизацией, интеграцией готовых частей, а НЕ созданием *принципиально нового* функционала с нуля.
*   **КЛЮЧЕВОЕ ПРАВИЛО:** Если \`project_type_guess\` совпадает с одним из наших "Известных готовых решений" (например, "TWA_CarRental", "TWA_Training"), то БОЛЬШИНСТВО запрошенных клиентом фич, характерных для этого типа проекта, должны быть классифицированы как "твики" этих готовых решений. То есть, наши AI-ассистенты уже имеют базу, и нужно лишь адаптировать её под клиента.
*   Учитывай, что "Танки" работают с AI-инструментами и могут быстро модифицировать существующий код.
*   Анализируй \`lead_data.project_description\` и \`lead_data.key_features_requested_list\`.
*   Типовые "твики" для TWA: изменение UI (цвета, шрифты, верстка), добавление/изменение полей в формах, настройка фильтров/сортировок в списках, небольшие изменения в логике существующих Supabase-запросов, базовая интеграция простых API.

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