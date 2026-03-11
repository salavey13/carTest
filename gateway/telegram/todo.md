# /gateway/telegram

Purpose
Isolate Telegram delivery & webhook parsing.

Tasks
- [ ] Create /gateway/telegram/sendMessage.ts (simple sendMessage(chatId, text, opts))
- [ ] Move webhook handler to /gateway/telegram/webhook-handler.ts and make it thin (parse -> emit core/event)
- [ ] Subscribe core/events (emit plant_dry -> gateway sends notification)
- [ ] hydration.md documenting rate limits, retry strategy, and allowed templates

Constraints
- Gateway only delivers messages; business logic must live in cores.