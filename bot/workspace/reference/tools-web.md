# Веб-инструменты (через Z.AI endpoint)

Если в `.env` стоит `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` — встроенные `WebSearch`/`WebFetch` **не работают** (server-side тулы Anthropic, Z.AI их не проксирует). Read картинок работает частично (GLM-vision), Read видео не работает.

Используй MCP вместо встроенных:

| Задача | Инструмент |
|---|---|
| Поиск в интернете | `mcp__zai-search__webSearchPrime` |
| Сайт с JS / SPA / клики / формы | `mcp__playwright__*` |
| Скриншот страницы | `mcp__playwright__browser_take_screenshot` |
| Анализ фото | `mcp__zai-vision__image_analysis` (или `Read` для простого) |
| OCR со скрина | `mcp__zai-vision__extract_text_from_screenshot` |
| Анализ видео (.mp4) | `mcp__zai-vision__video_analysis` |

Прочитать URL → markdown: используй `mcp__zai-search__webSearchPrime` с конкретным запросом, либо `mcp__playwright__browser_navigate` + snapshot. (Отдельный web-reader убран из MCP ради экономии контекста.)

Антипаттерны: не вызывай `WebSearch`/`WebFetch`, не `Bash: curl` для HTML, не `Read` на `.mp4`.

Другой endpoint (Anthropic native / kie.ai) — встроенные `WebSearch`/`WebFetch` могут работать, тогда таблица выше — рекомендация.
