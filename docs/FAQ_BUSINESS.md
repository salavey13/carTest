# Mini-FAQ для бизнеса — SLA, Integrations, White-label

## SLA / Uptime
- Рекомендуемая SLA: 99.5% для платных клиентов. Для enterprise — обсуждается индивидуально.
- Мониторинг: Sentry (errors), Prometheus/Datadog (metrics), uptime checks (Pingdom / GitHub Actions monitor).
- Incidents: план оповещений (Telegram admin, Email, PagerDuty).

## White-label / Custom integrations
- White-label: можно поставить бренд клиента, удалить/зашифровать ссылки на Supervibe/oneSitePls. Требуется договор и дополнительные деплои (subdomain).
- Custom integrations: ресепшен отеля (API для подтверждения брони), CRM, SMS-шлюзы, бухгалтерия (1C/ERP) — реализуются через edge functions/worker.

## Pricing & Billing (рекомендация)
- Модель: subscription + transaction fee для платёжных операций в Telegram (XTR conversion).
- Дополнительно: white-label deployment — фиксированная плата + поддержка.

## Data ownership & Privacy
- Клиент владеет данными. Мы можем предлагать managed hosting, при котором данные хранятся в их Supabase проекте.
- GDPR/Local compliance: обсудить индивидуально для enterprise.

## Onboarding / SLA for Integration
- Time to live: 1–2 недели для базовой white-label, 4–6 недель для полной интеграции (CRM, ресепшен, custom payment flows).