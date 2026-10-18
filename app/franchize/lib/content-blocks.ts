export interface CommunityEventBlock {
  title: string;
  time: string;
  place: string;
  text: string;
}

export interface PartnerCardBlock {
  name: string;
  role: string;
  perk: string;
}

export interface CityRiderTipBlock {
  text: string;
}

export interface SalesVerticalCopyBlock {
  id: string;
  title: string;
  pitch: string;
  cta: string;
}

export interface OnboardingChecklistBlock {
  title: string;
  text: string;
  icon?: string;
}

export interface OnboardingReadinessRowBlock {
  label: string;
  text: string;
}


export interface AboutCapabilityBlock {
  title: string;
  text: string;
  icon?: string;
}

export interface AboutWorkStepBlock {
  title: string;
  text: string;
}

export interface FranchizeContentBlocks {
  communityEvents: CommunityEventBlock[];
  partnerCards: PartnerCardBlock[];
  cityRiderTips: CityRiderTipBlock[];
  salesVerticals: SalesVerticalCopyBlock[];
  onboardingChecklist: OnboardingChecklistBlock[];
  onboardingReadinessRows: OnboardingReadinessRowBlock[];
  aboutCapabilities: AboutCapabilityBlock[];
  aboutWorkSteps: AboutWorkStepBlock[];
  /** Optional «О нас» hero override from metadata (about.heroTitle).
   *  Empty string = page keeps its own generic hero line. */
  aboutHeroTitle: string;
}

type UnknownRecord = Record<string, unknown>;

export const DEFAULT_COMMUNITY_EVENTS: CommunityEventBlock[] = [
  {
    title: "Вечерний сбор новичков",
    time: "Пт • 19:30",
    place: "Старт у базы экипажа",
    text: "Короткий городской круг с брифингом: экипировка, жесты колонны и безопасный темп для первого доверия.",
  },
  {
    title: "MapRiders city loop",
    time: "Сб • 12:00",
    place: "Маршрут через набережную и тихие улицы",
    text: "Открываем карту в реальном времени, фиксируем точки встречи и ведём группу в темпе самого спокойного райдера.",
  },
  {
    title: "Техно-час перед покатушкой",
    time: "Вс • 11:00",
    place: "Партнёрская сервис-зона",
    text: "Давление, цепь, свет, тормоза и быстрый чек — клиент видит, что техника готова до старта.",
  },
];

export const DEFAULT_PARTNER_CARDS: PartnerCardBlock[] = [
  { name: "VIP BIKE сервис", role: "осмотр и подготовка", perk: "Предвыездной контроль, который снижает риск отмен и повышает доверие" },
  { name: "Кофе-точка райдеров", role: "место встречи", perk: "Комфортная точка старта, зарядка телефона и быстрый райдер-брифинг" },
  { name: "Экипировка рядом", role: "перчатки / дождевик / защита", perk: "Подбор защиты для новичка без давления и лишнего пафоса" },
];

export const DEFAULT_CITY_RIDER_TIPS: CityRiderTipBlock[] = [
  { text: "Первый выезд на незнакомом байке лучше делать через экипажный сценарий, а не в одиночку." },
  { text: "Включайте MapRiders до старта: экипаж видит скорость, актуальность геопозиции и точку встречи." },
  { text: "Для новичков держим приватность «только экипаж» и автоматическую остановку геошеринга." },
  { text: "Точку встречи ставим долгим нажатием на карте или тапом по месту через кнопку «+»." },
];

export const DEFAULT_SALES_VERTICALS: SalesVerticalCopyBlock[] = [
  {
    id: "new",
    title: "Новые байки",
    pitch: "Премиальная витрина под заказ: расчёт, тест-драйв и уверенный следующий шаг в одну заявку.",
    cta: "Заявка на новый",
  },
  {
    id: "electric",
    title: "Электро и кастом",
    pitch: "Электроэндуро без угадывания: батарея, мощность, подвеска и сборка под реальный стиль езды.",
    cta: "Собрать электро",
  },
  {
    id: "used",
    title: "Б/у и проверенные",
    pitch: "Проверенные сделки на технику с историей аренды, диагностикой и понятным состоянием.",
    cta: "Подобрать б/у",
  },
  {
    id: "trade-in",
    title: "Trade-in",
    pitch: "Быстрый сценарий оценки старого байка и перехода в аренду, новый заказ или электроапгрейд.",
    cta: "Оценить байк",
  },
];

export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistBlock[] = [
  {
    title: "Заявка и контакт",
    text: "Фиксируем Telegram/телефон, город, формат партнёрства, парк и коммерческий потенциал.",
    icon: "message-circle",
  },
  {
    title: "Парк и роли",
    text: "Описываем модели, статусы аренды/продажи, ответственных за выдачу, сервис и контент-поток.",
    icon: "clipboard-check",
  },
  {
    title: "Документы и правила",
    text: "Согласуем договор, депозит, чеклист выдачи, геозоны, страховочные сценарии и правила возврата.",
    icon: "file-text",
  },
  {
    title: "Пилотный запуск",
    text: "Запускаем витрину, тестовый заказ, MapRiders-сценарий и проверку в Telegram WebApp до первого трафика.",
    icon: "shield-check",
  },
];

export const DEFAULT_ONBOARDING_READINESS_ROWS: OnboardingReadinessRowBlock[] = [
  { label: "Брендинг", text: "лого, цвета, оффер, адрес и рабочие часы" },
  { label: "Каталог", text: "аренда, продажа, электробайки, аксессуары" },
  { label: "Операции", text: "выдача, возврат, сервис, SLA и админ-доступы" },
  { label: "Продажи", text: "новые/электро/б/у/trade-in лиды, тест-драйв и закрытие сделки" },
  { label: "Комьюнити", text: "MapRiders, события, партнёры, Telegram-канал и повторные поездки" },
];

const DEFAULT_ABOUT_CAPABILITIES: AboutCapabilityBlock[] = [
  { title: "Аренды без лишнего трения", text: "Помогаем быстро выбрать байк, дату и формат поездки — от короткого теста до полноценного маршрута.", icon: "bike" },
  { title: "Продажи и конфигуратор", text: "Собираем заявку на покупку, custom/electric сценарии, trade-in и консультацию по модели.", icon: "shopping-bag" },
  { title: "MapRiders и комьюнити", text: "Подключаем райдеров, meetup-точки и локальные маршруты для живого сообщества.", icon: "map" },
  { title: "Сервис и помощь", text: "Выдача, подсказки, возврат и сопровождение после поездки.", icon: "wrench" },
];

const DEFAULT_ABOUT_WORK_STEPS: AboutWorkStepBlock[] = [
  { title: "Выберите байк", text: "Откройте каталог, сравните доступные позиции и добавьте вариант в заявку." },
  { title: "Подтвердите в Telegram", text: "Оператор уточнит время, документы и оплату прямо в чате." },
  { title: "Заберите и катайтесь", text: "На точке выдачи проверяем состояние и передаём экипировку/инструкции." },
  { title: "Верните и оставьте отзыв", text: "Закрываем поездку и улучшаем витрину по обратной связи." },
];

export const DEFAULT_FRANCHIZE_CONTENT_BLOCKS: FranchizeContentBlocks = {
  communityEvents: DEFAULT_COMMUNITY_EVENTS,
  partnerCards: DEFAULT_PARTNER_CARDS,
  cityRiderTips: DEFAULT_CITY_RIDER_TIPS,
  salesVerticals: DEFAULT_SALES_VERTICALS,
  onboardingChecklist: DEFAULT_ONBOARDING_CHECKLIST,
  onboardingReadinessRows: DEFAULT_ONBOARDING_READINESS_ROWS,
  aboutCapabilities: DEFAULT_ABOUT_CAPABILITIES,
  aboutWorkSteps: DEFAULT_ABOUT_WORK_STEPS,
  aboutHeroTitle: "",
};

// ── vip-bike-gated defaults (2026-10-18) ────────────────────────────────────
// Every DEFAULT_* block below was written for the FIRST crew (vip-bike:
// rental + sales + configurator wording like «Выберите байк», «Продажи и
// конфигуратор»). vip-bike hydrates its OWN contentBlocks in metadata, so
// these literals only ever surface through the fallback path — and until
// 2026-10-18 that fallback leaked them onto OTHER crews' pages (moto-selection
// about page showed «Выберите байк» ride flow). The fallback rule now mirrors
// storage-config's legacy rule: defaults apply to vip-bike ONLY; any other
// crew without hydrated blocks gets EMPTY arrays and the pages hide those
// sections (boss 2026-10-18: «add guard around this hardcode to be shown only
// for vip-bike, or ditch ungeneral text»). A crew opts into its own copy via
// metadata.franchize.contentBlocks (see docs/crewDocs hydration SQLs).
const DEFAULTS_ONLY_FOR_SLUG = "vip-bike";

function nonEmptyGated<T extends object>(items: T[], fallback: T[], slug: string): T[] {
  if (items.length > 0) return items.map((item) => ({ ...item }));
  return slug.trim() === DEFAULTS_ONLY_FOR_SLUG ? fallback.map((item) => ({ ...item })) : [];
}

export function cloneFranchizeContentBlocks(blocks: FranchizeContentBlocks = DEFAULT_FRANCHIZE_CONTENT_BLOCKS, slug = DEFAULTS_ONLY_FOR_SLUG): FranchizeContentBlocks {
  return {
    communityEvents: blocks.communityEvents.map((item) => ({ ...item })),
    partnerCards: blocks.partnerCards.map((item) => ({ ...item })),
    cityRiderTips: blocks.cityRiderTips.map((item) => ({ ...item })),
    salesVerticals: blocks.salesVerticals.map((item) => ({ ...item })),
    onboardingChecklist: blocks.onboardingChecklist.map((item) => ({ ...item })),
    onboardingReadinessRows: blocks.onboardingReadinessRows.map((item) => ({ ...item })),
    aboutCapabilities: blocks.aboutCapabilities.map((item) => ({ ...item })),
    aboutWorkSteps: blocks.aboutWorkSteps.map((item) => ({ ...item })),
    aboutHeroTitle: blocks.aboutHeroTitle,
  };
}

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {}
);

const readString = (record: UnknownRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return fallback;
};

const readArray = (source: UnknownRecord, paths: string[][]): unknown[] => {
  for (const path of paths) {
    let cursor: unknown = source;
    for (const segment of path) {
      cursor = asRecord(cursor)[segment];
    }
    if (Array.isArray(cursor) && cursor.length > 0) return cursor;
  }

  return [];
};

const readContentSource = (metadata: unknown): UnknownRecord => {
  const source = asRecord(metadata);
  const nested = asRecord(source.franchize);
  const franchize = Object.keys(nested).length > 0 ? nested : source;
  const contentBlocks = asRecord(franchize.contentBlocks);
  const content = asRecord(franchize.content);

  return {
    ...franchize,
    ...content,
    ...contentBlocks,
  };
};

const nonEmpty = <T extends object>(items: T[], fallback: T[]) => (items.length > 0 ? items : fallback.map((item) => ({ ...item })));
void nonEmpty; // kept for reference; the gated variant below replaced all uses

const readCommunityEvents = (source: UnknownRecord, slug: string): CommunityEventBlock[] => nonEmptyGated(
  readArray(source, [["communityEvents"], ["community", "events"]])
    .map((item) => {
      const event = asRecord(item);
      return {
        title: readString(event, ["title", "name"]),
        time: readString(event, ["time", "schedule", "date"]),
        place: readString(event, ["place", "location", "address"]),
        text: readString(event, ["text", "description", "body"]),
      };
    })
    .filter((event) => event.title && event.text),
  DEFAULT_COMMUNITY_EVENTS,
  slug,
);

const readPartnerCards = (source: UnknownRecord, slug: string): PartnerCardBlock[] => nonEmptyGated(
  readArray(source, [["partnerCards"], ["community", "partnerCards"], ["community", "partners"]])
    .map((item) => {
      const partner = asRecord(item);
      return {
        name: readString(partner, ["name", "title"]),
        role: readString(partner, ["role", "type", "badge"]),
        perk: readString(partner, ["perk", "text", "description"]),
      };
    })
    .filter((partner) => partner.name && partner.perk),
  DEFAULT_PARTNER_CARDS,
  slug,
);

const readCityRiderTips = (source: UnknownRecord, slug: string): CityRiderTipBlock[] => nonEmptyGated(
  readArray(source, [["cityRiderTips"], ["cityTips"], ["community", "cityRiderTips"], ["community", "cityTips"], ["community", "tips"]])
    .map((item) => (typeof item === "string" ? { text: item.trim() } : { text: readString(asRecord(item), ["text", "tip", "title"]) }))
    .filter((tip) => tip.text),
  DEFAULT_CITY_RIDER_TIPS,
  slug,
);

const readSalesVerticals = (source: UnknownRecord, slug: string): SalesVerticalCopyBlock[] => nonEmptyGated(
  readArray(source, [["salesVerticals"], ["sales", "verticals"], ["sales", "verticalCopy"]])
    .map((item) => {
      const vertical = asRecord(item);
      const title = readString(vertical, ["title", "name"]);
      return {
        id: readString(vertical, ["id", "key", "slug"], title.toLowerCase().replace(/\s+/g, "-")),
        title,
        pitch: readString(vertical, ["pitch", "text", "description"]),
        cta: readString(vertical, ["cta", "ctaLabel", "buttonLabel"], "Оставить заявку"),
      };
    })
    .filter((vertical) => vertical.id && vertical.title && vertical.pitch),
  DEFAULT_SALES_VERTICALS,
  slug,
);

const readOnboardingChecklist = (source: UnknownRecord, slug: string): OnboardingChecklistBlock[] => nonEmptyGated(
  readArray(source, [["onboardingChecklist"], ["onboarding", "checklist"]])
    .map((item) => {
      const checklistItem = asRecord(item);
      return {
        title: readString(checklistItem, ["title", "label"]),
        text: readString(checklistItem, ["text", "description", "body"]),
        icon: readString(checklistItem, ["icon", "iconName"]),
      };
    })
    .filter((item) => item.title && item.text),
  DEFAULT_ONBOARDING_CHECKLIST,
  slug,
);

const readReadinessRows = (source: UnknownRecord, slug: string): OnboardingReadinessRowBlock[] => nonEmptyGated(
  readArray(source, [["onboardingReadinessRows"], ["readinessRows"], ["onboarding", "readinessRows"], ["onboarding", "readiness"]])
    .map((item) => {
      if (Array.isArray(item)) {
        return {
          label: typeof item[0] === "string" ? item[0].trim() : "",
          text: typeof item[1] === "string" ? item[1].trim() : "",
        };
      }

      const row = asRecord(item);
      return {
        label: readString(row, ["label", "title", "name"]),
        text: readString(row, ["text", "description", "body"]),
      };
    })
    .filter((row) => row.label && row.text),
  DEFAULT_ONBOARDING_READINESS_ROWS,
  slug,
);


const readAboutCapabilities = (source: UnknownRecord, slug: string): AboutCapabilityBlock[] => nonEmptyGated(
  readArray(source, [["aboutCapabilities"], ["about", "capabilities"]])
    .map((item) => {
      const capability = asRecord(item);
      return {
        title: readString(capability, ["title", "label"]),
        text: readString(capability, ["text", "description", "pitch"]),
        icon: readString(capability, ["icon"], ""),
      };
    })
    .filter((item) => item.title && item.text),
  DEFAULT_ABOUT_CAPABILITIES,
  slug,
);

const readAboutWorkSteps = (source: UnknownRecord, slug: string): AboutWorkStepBlock[] => nonEmptyGated(
  readArray(source, [["aboutWorkSteps"], ["about", "workSteps"], ["about", "steps"]])
    .map((item) => {
      const step = asRecord(item);
      return {
        title: readString(step, ["title", "label"]),
        text: readString(step, ["text", "description"]),
      };
    })
    .filter((item) => item.title && item.text),
  DEFAULT_ABOUT_WORK_STEPS,
  slug,
);

export function readFranchizeContentBlocks(metadata: unknown, slug = DEFAULTS_ONLY_FOR_SLUG): FranchizeContentBlocks {
  const source = readContentSource(metadata);

  return {
    communityEvents: readCommunityEvents(source, slug),
    partnerCards: readPartnerCards(source, slug),
    cityRiderTips: readCityRiderTips(source, slug),
    salesVerticals: readSalesVerticals(source, slug),
    onboardingChecklist: readOnboardingChecklist(source, slug),
    onboardingReadinessRows: readReadinessRows(source, slug),
    aboutCapabilities: readAboutCapabilities(source, slug),
    aboutWorkSteps: readAboutWorkSteps(source, slug),
    // «О нас» hero override — any crew may set about.heroTitle (hydration
    // metadata shape) or contentBlocks.aboutHeroTitle directly. No default:
    // empty = the page keeps its own hero line (vip-bike's about hero is the
    // page-level legacy literal, untouched).
    aboutHeroTitle:
      readString(asRecord(source.about), ["heroTitle", "tagline"])
      || readString(source, ["aboutHeroTitle"], ""),
  };
}
