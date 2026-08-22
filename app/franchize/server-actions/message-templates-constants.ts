// /app/franchize/server-actions/message-templates-constants.ts
//
// Constants and types for message templates.
// Extracted from message-templates.ts to avoid "use server" export restrictions
// (a "use server" file can only export async functions — no const objects).

export interface MessageTemplate {
  id: string;
  crew_id: string | null;
  template_key: string;
  name: string;
  subject: string | null;
  body: string;
  channel: "telegram" | "email" | "sms";
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
}

// Available variables for different template contexts
export const TEMPLATE_VARIABLES: Record<string, TemplateVariable[]> = {
  rental: [
    { key: "customer_name", label: "Имя клиента", description: "Полное имя клиента" },
    { key: "customer_phone", label: "Телефон клиента", description: "Номер телефона" },
    { key: "bike", label: "Мотоцикл", description: "Марка и модель" },
    { key: "start_date", label: "Дата начала", description: "Дата начала аренды" },
    { key: "start_time", label: "Время начала", description: "Время начала аренды" },
    { key: "return_date", label: "Дата возврата", description: "Дата окончания аренды" },
    { key: "return_time", label: "Время возврата", description: "Время окончания аренды" },
    { key: "pickup_location", label: "Место выдачи", description: "Адрес выдачи" },
    { key: "return_location", label: "Место возврата", description: "Адрес возврата" },
    { key: "total_price", label: "Стоимость", description: "Общая стоимость аренды" },
    { key: "deposit_amount", label: "Депозит", description: "Сумма депозита" },
    { key: "payment_method", label: "Способ оплаты", description: "Способ оплаты" },
    { key: "contact_phone", label: "Контактный телефон", description: "Телефон для связи" },
  ],
  review: [
    { key: "customer_name", label: "Имя клиента", description: "Полное имя клиента" },
    { key: "bike", label: "Мотоцикл", description: "Марка и модель" },
    { key: "review_link", label: "Ссылка на отзыв", description: "Ссылка для оставления отзыва" },
  ],
};
