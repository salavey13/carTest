export interface EstimateRequestData {
  fio: string;
  phone: string;
  telegram: string;
  email: string;
  preferredTime: string;
  objectType: string;
  objectTypeOther: string;
  address: string;
  area: string;
  floors: string;
  walls: string[];
  wallOther: string;
  workTypes: string[];
  workOther: string;
  quantity: {
    sockets: string;
    switches: string;
    lights: string;
    cableMeters: string;
    rooms: string;
  };
  automationBrand: string;
  extraRequirements: string;
  startDate: string;
  urgency: string;
  attachments: string[];
  preferredContact: string;
  notes: string;
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  newbuilding: "Новостройка (квартира)",
  renovation: "Ремонт (квартира/дом)",
  cottage: "Коттедж/дом",
  social: "Социальный объект",
  commercial: "Коммерческое помещение",
  production: "Производство",
  other: "Другое",
};

const WALL_LABELS: Record<string, string> = {
  brick: "Кирпич",
  concrete: "Бетон",
  gasblock: "Газобетон",
  drywall: "Гипсокартон",
  other: "Другое",
};

const WORK_TYPE_LABELS: Record<string, string> = {
  "full-wiring": "Полная замена проводки (под ключ)",
  "panel-assembly": "Сборка электрощита",
  "sockets-switches": "Установка розеток/выключателей",
  lighting: "Монтаж освещения (точечные, люстры)",
  shtroba: "Штробление стен",
  "cable-pipes": "Прокладка кабеля в гофре/трубах",
  "metal-trays": "Установка металлических лотков",
  "low-voltage": "Слаботочные системы (СКС, видеонаблюдение, сигнализация)",
  "high-voltage": "Высокое напряжение (до 10 кВ)",
  demolition: "Демонтаж старой проводки",
  other: "Другое",
};

const AUTOMATION_BRAND_LABELS: Record<string, string> = {
  ABB: "ABB",
  Schneider: "Schneider",
  Legrand: "Legrand",
  IEK: "IEK",
  "no-preference": "Без разницы",
};

const URGENCY_LABELS: Record<string, string> = {
  "not-urgent": "Не срочно",
  "within-month": "В течение месяца",
  urgent: "Срочно",
};

const CONTACT_LABELS: Record<string, string> = {
  telegram: "Telegram",
  phone: "Телефон",
  email: "Email",
  any: "Любой способ",
};

function fill(value: string, fallback = "не указано"): string {
  return value?.trim() ? value.trim() : fallback;
}

function checked(value: boolean): string {
  return value ? "[✓]" : "[ ]";
}

export function generateRequestText(data: EstimateRequestData): string {
  const objectTypeText =
    data.objectType === "other"
      ? `Другое: ${fill(data.objectTypeOther)}`
      : OBJECT_TYPE_LABELS[data.objectType] || fill(data.objectType);

  const wallText = data.walls.length
    ? data.walls
        .map((w) => (w === "other" ? `Другое: ${fill(data.wallOther)}` : WALL_LABELS[w] || w))
        .join(", ")
    : "не указаны";

  const workText = data.workTypes.length
    ? data.workTypes
        .map((w) => (w === "other" ? `Другое: ${fill(data.workOther)}` : WORK_TYPE_LABELS[w] || w))
        .join("\n    ")
    : "не выбраны";

  const qty = data.quantity;

  const lines = [
    "╔══════════════════════════════════════════════════════════════════════════════╗",
    "║                     ЗАЯВКА НА РАСЧЁТ СМЕТЫ                                   ║",
    "║                         NN VOLT — Электромонтаж                              ║",
    "╚══════════════════════════════════════════════════════════════════════════════╝",
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 1. КОНТАКТНАЯ ИНФОРМАЦИЯ                                                   │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    ФИО: ${fill(data.fio)}`,
    `    Телефон: ${fill(data.phone)}`,
    `    Telegram: ${data.telegram.trim() ? "@" + data.telegram.trim() : "не указан"}`,
    `    Email: ${fill(data.email)}`,
    `    Удобное время для связи: ${fill(data.preferredTime)}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 2. ИНФОРМАЦИЯ ОБ ОБЪЕКТЕ                                                   │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    Тип объекта: ${objectTypeText}`,
    `    Адрес объекта: ${fill(data.address)}`,
    `    Общая площадь: ${fill(data.area, "не указана")} м²`,
    `    Этажность: ${fill(data.floors, "не указана")} этажей`,
    `    Стены: ${wallText}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 3. ВИДЫ РАБОТ                                                              │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    ${workText}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 4. ПРИМЕРНЫЙ ОБЪЁМ РАБОТ                                                   │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    Количество розеток: ${fill(qty.sockets, "не указано")}`,
    `    Количество выключателей: ${fill(qty.switches, "не указано")}`,
    `    Количество светильников: ${fill(qty.lights, "не указано")}`,
    `    Метраж кабеля (примерно): ${fill(qty.cableMeters, "не указан")} м`,
    `    Количество комнат/помещений: ${fill(qty.rooms, "не указано")}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 5. ДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ                                               │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    Предпочтения по автоматике: ${AUTOMATION_BRAND_LABELS[data.automationBrand] || fill(data.automationBrand)}`,
    "",
    "    Дополнительные требования:",
    data.extraRequirements.trim()
      ? data.extraRequirements
          .trim()
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")
      : "    не указаны",
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 6. СРОКИ                                                                  │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    Желаемая дата начала работ: ${fill(data.startDate, "не указана")}`,
    `    Срочность: ${URGENCY_LABELS[data.urgency] || fill(data.urgency)}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 7. ПРИЛОЖЕНИЯ (названия файлов)                                            │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    data.attachments.length
      ? data.attachments.map((name) => `    • ${name}`).join("\n")
      : "    файлы не прикреплены",
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 8. ПРЕДПОЧТИТЕЛЬНЫЙ СПОСОБ СВЯЗИ                                          │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    `    ${CONTACT_LABELS[data.preferredContact] || fill(data.preferredContact)}`,
    "",
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "│ 9. ДОПОЛНИТЕЛЬНЫЕ ПРИМЕЧАНИЯ                                              │",
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "",
    data.notes.trim()
      ? data.notes
          .trim()
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")
      : "    нет",
    "",
    "╔══════════════════════════════════════════════════════════════════════════════╗",
    "║                                                                              ║",
    "║  Источник: nnvolt.рф / rental.vip-bike.ru/nnvolt/zapros-smeti                ║",
    `║  Дата и время заполнения: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}          ║`,
    "║                                                                              ║",
    "║  Бригадир свяжется с вами в течение 2 часов для уточнения деталей.          ║",
    "║                                                                              ║",
    "╚══════════════════════════════════════════════════════════════════════════════╝",
  ];

  return lines.join("\n");
}

export function generateFileName(data: EstimateRequestData): string {
  const slug = data.fio.trim().replace(/\s+/g, "_").replace(/[^\w\-а-яА-ЯёЁ]/g, "").slice(0, 30) || "zayavka";
  const date = new Date().toLocaleDateString("ru-RU").replace(/\./g, "-");
  return `zapros-smeti-nn-volt_${slug}_${date}.txt`;
}

export function utf8ToBase64(text: string): string {
  // Browser-safe UTF-8 → base64
  const utf8Bytes = new TextEncoder().encode(text);
  const binaryString = Array.from(utf8Bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binaryString);
}
