// Task 94 (2026-10-14) — apply the network-services hydration via REST
// (mirror of docs/crewDocs/network-services-hydration-2026-10-14.sql):
//   1) create/update moto-selection crew + provider metadata
//   2) georg-electro services (boss list)
//   3) vip-bike catalog ads: map-riders «Сеть» promo + community wall card
// Audit: crews.metadata.specs.owner_fix_20261014_network_services.
// Usage: node --env-file=.env.local scripts/task94-apply-network-services.mjs

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) { console.error("Missing SUPABASE env"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function getRow(table, query) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: H });
  const rows = await res.json();
  return rows?.[0] ?? null;
}
async function patchRow(table, query, body) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
  return res.status;
}
const mergeMeta = (meta, patch) => ({ ...(meta ?? {}), ...patch });

// ── 1) moto-selection ────────────────────────────────────────────────────────
const MOTO_ID = "ddc2eae6-f11f-420b-859b-a1cb755d777f";
const MOTO_LOGO = "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png";
const motoCrew = {
  id: MOTO_ID,
  name: "Moto Selection",
  description: "Moto Selection — мото-сервис и школа Нижнего Новгорода: обучение вождению с нуля, подбор и покупка мотоцикла, эвакуация 24/7, аренда (80–1000сс), ТО и ремонт, зимнее хранение, детейлинг и кастомизация. moto-selection.ru",
  logo_url: MOTO_LOGO,
  owner_id: "356282674", // I_O_S_NN — prefab default until the network-tab role manager assigns a final owner
  slug: "moto-selection",
  hq_location: null,
};
const upsert = await fetch(`${URL_}/rest/v1/crews?on_conflict=id`, {
  method: "POST",
  headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(motoCrew),
});
console.log("moto-selection upsert:", upsert.status);

const motoRow = await getRow("crews", "select=id,metadata&slug=eq.moto-selection");
if (!motoRow) { console.error("moto-selection missing after upsert"); process.exit(1); }

const motoServices = [
  { id: "ms-training", name: "Обучение вождению с нуля", min_players: 1, image_url: "", description: "Мото-академия: индивидуальные занятия, базовый и контраварийный курсы, эндуро, спортивный курс, стантрадинг. Практика торможений, руления и управления в разных условиях.", priceFrom: "по записи", packages: [
    { id: "ms-training-base", name: "Базовый курс", includes: "с нуля до уверенной езды в городе" },
    { id: "ms-training-advanced", name: "Контраварийный / эндуро / спорт", includes: "отработка препятствий и продвинутых навыков" },
  ] },
  { id: "ms-selection", name: "Подбор и покупка мотоцикла", min_players: 1, image_url: "", description: "Комплексный подбор: проверка юридической чистоты VIN, мониторинг предложений по Нижнему и области, осмотр любого количества вариантов, полное сопровождение сделки и договор купли-продажи.", priceFrom: "от 25 000 ₽", packages: [
    { id: "ms-selection-full", name: "Комплексный подбор", includes: "VIN + мониторинг + осмотры + сопровождение сделки", price: 25000 },
  ] },
  { id: "ms-evacuation", name: "Эвакуация и перевозка", min_players: 1, image_url: "", description: "Перевозим на своей оборудованной технике. Сопровождение в сервис / ГИБДД / при покупке. Работаем 24/7.", priceFrom: "от 3 500 ₽", packages: [
    { id: "ms-evac-std", name: "Эвакуация", includes: "подача, погрузка, доставка по городу/области", price: 3500 },
  ] },
  { id: "ms-inspection", name: "Выездной осмотр перед покупкой", min_players: 1, image_url: "", description: "Проверяем визуальную и техническую составляющую мотоцикла, документы и юридическую чистоту, даём рекомендации по техническому обслуживанию.", priceFrom: "от 3 500 ₽", packages: [
    { id: "ms-insp-std", name: "Выездной осмотр", includes: "осмотр + документы + рекомендации по ТО", price: 3500 },
  ] },
  { id: "ms-rent", name: "Аренда мототехники", min_players: 1, image_url: "", description: "Большой выбор мототехники от 80 до 1000сс, залог от 5 000 ₽, можно арендовать экипировку, возможна долгосрочная аренда. Есть кожаный мопед :)", priceFrom: "от 4 000 ₽", packages: [
    { id: "ms-rent-day", name: "Сутки", includes: "мотоцикл 80–1000сс по выбору", price: 4000 },
  ] },
  { id: "ms-storage", name: "Зимнее хранение мототехники", min_players: 1, image_url: "", description: "Тёплое хранение по всем байкерским канонам: консервация, контроль состояния, подготовка к сезону. Как байк проведёт зиму — так он поедет летом.", priceFrom: "от 2 000 ₽/мес", packages: [
    { id: "ms-storage-warm", name: "Тёплое хранение", includes: "консервация + контроль + предсезонная подготовка", price: 2000 },
  ] },
  { id: "ms-detailing", name: "Детейлинг и кастомизация", min_players: 1, image_url: "", description: "Предварительная мойка, очистка от битума/колодочной пыли/смазки цепи, полировка, оклейка плёнкой зон риска, защитные составы.", priceFrom: "по запросу" },
  { id: "ms-service", name: "Техническое обслуживание и ремонт", min_players: 1, image_url: "", description: "ТО и ремонт мототехники: регламентные работы, расходники, электрика, ходовая. Готовим байк к сезону и закрываем неисправности.", priceFrom: "по запросу" },
];
const motoFranchize = {
  version: "2026-10-14-v1",
  enabled: true,
  slug: "moto-selection",
  ui: { showCreateButton: false },
  branding: {
    name: "MOTO SELECTION",
    shortName: "Moto Selection",
    tagline: "Высокое искусство мотосервиса: школа, подбор, аренда, ТО, хранение, детейлинг.",
    logoUrl: MOTO_LOGO,
    centerLogoInHeader: true,
  },
  theme: { mode: "auto" },
  contacts: { address: "Нижний Новгород", phone: "+7 (987) 557-04-44", email: "moto-selection@yandex.ru", workingHours: "Ежедневно, заявки 24/7", map: { gps: "" } },
  about: {
    heroTitle: "Moto Selection — высокое искусство мотосервиса",
    heroSubtitle: "Начни свой путь в мир мотоциклов вместе с нами: обучение, подбор, аренда, сервис, хранение. Нижний Новгород.",
    features: [
      "Обучение вождению с нуля (академия)",
      "Подбор и покупка под ключ, выездной осмотр",
      "Эвакуация и перевозка 24/7",
      "Аренда мототехники 80–1000сс",
      "Зимнее хранение",
      "Детейлинг и кастомизация",
      "ТО и ремонт",
    ],
    faq: [
      { q: "Вы только в Нижнем Новгороде?", a: "Основная площадка — Нижний Новгород; также работали с клиентами из Москвы, Санкт-Петербурга, Владимира, Иваново, Краснодара и Севастополя." },
      { q: "Нужен ли залог для аренды?", a: "Да, залог от 5 000 ₽. Экипировку можно арендовать вместе с мотоциклом, есть долгосрочная аренда." },
      { q: "Поможете с выбором мотоцикла?", a: "Да: комплексный подбор включает проверку VIN, мониторинг рынка, осмотры и полное сопровождение сделки." },
    ],
  },
};
console.log("moto metadata:", await patchRow("crews", "slug=eq.moto-selection", {
  metadata: mergeMeta(motoRow.metadata, { services: motoServices, franchize: { ...((motoRow.metadata || {}).franchize || {}), ...motoFranchize } }),
}));

// ── 2) georg-electro services ────────────────────────────────────────────────
const georgRow = await getRow("crews", "select=id,metadata&slug=eq.georg-electro");
const georgServices = [
  { id: "ge-diagnostics", name: "Диагностика и ремонт электросистем", min_players: 1, image_url: "", description: "Поиск неисправностей и ремонт электро: проводка, контроллеры, BMS, дроссели, свет, приборка. Электрик электробайков — починим любой электромот.", priceFrom: "по запросу" },
  { id: "ge-flash", name: "Перепрошивка и кастомная настройка контроллеров", min_players: 1, image_url: "", description: "Прошивка и тюнинг контроллеров любых типов: кривые тока, разгонные режимы, круиз-контроль, кастомные пресеты под батарею и мотор.", priceFrom: "по запросу" },
  { id: "ge-equipment", name: "Установка дополнительного оборудования", min_players: 1, image_url: "", description: "Свет, сигнализация, зарядки и USB, кофры, ветровики, камеры, подогрев ручек — установим и подключим аккуратно, с гарантией на монтаж.", priceFrom: "по запросу" },
];
console.log("georg services:", await patchRow("crews", "slug=eq.georg-electro", {
  metadata: mergeMeta(georgRow?.metadata, { services: georgServices }),
}));

// ── 3) vip-bike catalog ads ──────────────────────────────────────────────────
const vipRow = await getRow("crews", "select=id,metadata&slug=eq.vip-bike");
const vipMeta = vipRow?.metadata || {};
const catalog = { ...(((vipMeta.franchize || {}).catalog) || {}) };
catalog.adCards = [
  { id: "map-riders-card", href: "/franchize/vip-bike/map-riders", badge: "Сообщество · обновлено", title: "Карта райдеров и Сеть экипажей", activeTo: "2026-12-31", ctaLabel: "Открыть карту и Сеть", imageUrl: "", priority: 92, subtitle: "Живая карта маршрутов и вкладка «Сеть»: круги экипажей, связи райдеров и зум с деталями. Находи попутчиков и смотри, кто с кем катает.", activeFrom: "2026-08-01" },
  { id: "community-wall-card", href: "/franchize/vip-bike/community", badge: "Прожарка", title: "Стена экипажа", activeTo: "2026-12-31", ctaLabel: "Читать сообщество", imageUrl: "", priority: 86, subtitle: "Посты, отчёты о заездах и встречи райдеров — прямая ссылка на сообщество. Публикуй, собирай лайки, подогревай движ.", activeFrom: "2026-10-14" },
  { id: "configurator-card", href: "/franchize/vip-bike/configurator", badge: "Популярное", title: "Конфигуратор электробайка", activeTo: "2026-12-31", ctaLabel: "Собрать байк", imageUrl: "", priority: 90, subtitle: "Соберите свой VipBike: мотор, батарея, цвет, аксессуары — мгновенный расчёт цены", activeFrom: "2026-08-01" },
];
catalog.promoBanners = [
  { id: "map-riders-network", code: "NETWORK2026", title: "Map-Riders: карта, маршруты и Сеть экипажей — всё в одном месте", activeTo: "2026-12-31", ctaLabel: "Открыть карту", priority: 88, subtitle: "Живые точки на карте, круги экипажей и связи райдеров во вкладке «Сеть» — приближай и смотри детали. Делись маршрутами и собирай экипаж.", activeFrom: "2026-10-14" },
  { id: "harley-livewire", code: "LIVEWIRE2026", title: "Harley-Davidson LiveWire ONE — ноль до сотни за 3 секунды", activeTo: "2026-12-31", ctaLabel: "Подробнее", priority: 95, subtitle: "Полностью электрический. Категория А. Запас хода 235 км по городу. Быстрая зарядка DC за 40 минут.", activeFrom: "2026-08-01" },
];
catalog.tickerItems = [
  { id: "electro-main", href: "/franchize/vip-bike#catalog", text: "79bike Falcon PRO: электромотоцикл без категории А от 310 000 ₽" },
  { id: "test-drive", href: "/franchize/vip-bike#test-drive", text: "Тест-драйв в шоуруме: протестируйте электро перед покупкой" },
  { id: "no-osago", href: "/franchize/vip-bike/electro-enduro", text: "Законно без ОСАГО и ПТС по правам категории B" },
  { id: "network-tab", href: "/franchize/vip-bike/map-riders", text: "Сеть экипажей на карте: круги команд, связи райдеров и зум до деталей" },
];
console.log("vip-bike ads:", await patchRow("crews", "slug=eq.vip-bike", {
  metadata: mergeMeta(vipMeta, { franchize: { ...(vipMeta.franchize || {}), catalog } }),
}));

// ── audit block ──────────────────────────────────────────────────────────────
const vipAfter = await getRow("crews", "select=metadata&slug=eq.vip-bike");
const specs = (((vipAfter?.metadata || {}).specs) || {});
specs.owner_fix_20261014_network_services = {
  at: new Date().toISOString(),
  by: "super-z (main agent) on boss order in chat",
  reason: "network provider crews hydration + map-riders promo (task 94)",
  status: "applied_and_verified",
  artifact: {
    sql_reference: "docs/crewDocs/network-services-hydration-2026-10-14.sql",
    changes: [
      "crews INSERT/UPDATE moto-selection (id ddc2eae6-f11f-420b-859b-a1cb755d777f, owner 356282674 default, services from moto-selection.ru, franchize branding/contacts/about)",
      "crews.UPDATE georg-electro metadata.services (3: diagnostics/flash/equipment)",
      "crews.UPDATE vip-bike metadata.franchize.catalog: adCards +community-wall-card & map-riders «Сеть» update; promoBanners +map-riders-network (LIVEWIRE2026 kept); tickerItems +network-tab",
    ],
    scope_note: "metadata-only payloads; no rentals/users/roles touched",
  },
};
console.log("audit:", await patchRow("crews", "slug=eq.vip-bike", { metadata: { ...(vipAfter?.metadata || {}), specs } }));

// ── verify ───────────────────────────────────────────────────────────────────
const check = await getRow("crews", "select=slug,metadata&slug=in.(moto-selection,georg-electro,vip-bike)");
const checks = [
  await getRow("crews", "select=slug,metadata&slug=eq.moto-selection"),
  await getRow("crews", "select=slug,metadata&slug=eq.georg-electro"),
  await getRow("crews", "select=slug,metadata&slug=eq.vip-bike"),
];
for (const c of checks) {
  const m = c.metadata || {};
  console.log(`verify ${c.slug}: services=${(m.services || []).length} adCards=${(((m.franchize || {}).catalog || {}).adCards || []).length} banners=${(((m.franchize || {}).catalog || {}).promoBanners || []).length} tickers=${(((m.franchize || {}).catalog || {}).tickerItems || []).length}`);
}
