"use client";

import { useMemo, useState, useTransition } from "react";
import { useAppContext } from "@/contexts/AppContext";

import {
  type FranchizeConfigInput,
  loadFranchizeConfigBySlug,
  saveFranchizeConfig,
} from "@/app/franchize/actions";

type Stage = "palette" | "content" | "map" | "ai";

const TEMPLATE_PAYLOAD = {
  instruction: "Персонализируй этот franchize JSON под владельца и бренд. Сохрани структуру ключей.",
  franchize: {
    version: "2026-02-19-template-v2",
    enabled: true,
    slug: "your-slug",
    branding: { name: "YOUR BRAND", shortName: "YB", tagline: "Короткий слоган", logoUrl: "", centerLogoInHeader: true },
    theme: {
      mode: "pepperolli_dark",
      palette: {
        bgBase: "#0B0C10",
        bgCard: "#111217",
        borderSoft: "#24262E",
        accentMain: "#D99A00",
        accentMainHover: "#E2A812",
        textPrimary: "#F2F2F3",
        textSecondary: "#A7ABB4",
      },
    },
    header: { menuLinks: [] },
    contacts: { phone: "+7 900 000 00 00", telegram: "@oneBikePlsBot", address: "Город / Онлайн", map: { gps: "56.2042,43.7985", imageUrl: "", bounds: { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 } } },
    catalog: { groupOrder: ["Основное", "Дополнительно"] },
    order: { allowPromo: true, deliveryModes: ["pickup", "delivery"], defaultMode: "pickup" },
  },
};

const BOT_PROMPT = `Сделай персональный franchize JSON под владельца.
Сфокусируйся на: стиль, тексты, меню, контакты, tone of voice.
Верни только JSON без пояснений.`;

function toRgb(hex: string) {
  const cleaned = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string) {
  const rgb = toRgb(hex);
  if (!rgb) return null;
  const normalize = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * normalize(rgb.r) + 0.7152 * normalize(rgb.g) + 0.0722 * normalize(rgb.b);
}

function contrastRatio(bg: string, fg: string) {
  const l1 = relativeLuminance(bg);
  const l2 = relativeLuminance(fg);
  if (l1 === null || l2 === null) return null;
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function contrastLabel(ratio: number | null) {
  if (ratio === null) return "Проверьте формат #RRGGBB";
  if (ratio < 3) return "Критично: плохо читается";
  if (ratio < 4.5) return "Предупреждение: слабая читаемость";
  return "Ок: хороший контраст";
}

function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return fallback;
    current = (current as Record<string, unknown>)[key];
  }
  return (current as T) ?? fallback;
}

export default function CreateFranchizeForm() {
  const [form, setForm] = useState<FranchizeConfigInput>({
    slug: "",
    brandName: "VIP BIKE",
    tagline: "Ride the vibe",
    logoUrl: "",
    themeMode: "pepperolli_dark",
    bgBase: "#0B0C10",
    bgCard: "#111217",
    accentMain: "#D99A00",
    accentMainHover: "#E2A812",
    textPrimary: "#F2F2F3",
    textSecondary: "#A7ABB4",
    borderSoft: "#24262E",
    phone: "",
    email: "",
    address: "",
    telegram: "",
    mapGps: "56.20420451632873, 43.798582127051695",
    mapImageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg",
    mapBoundsTop: "56.42",
    mapBoundsBottom: "56.08",
    mapBoundsLeft: "43.66",
    mapBoundsRight: "44.12",
    socialLinksText: "Telegram|https://t.me/oneBikePlsBot",
    menuLinksText: "Каталог|/franchize/{slug}\nО нас|/franchize/{slug}/about\nКонтакты|/franchize/{slug}/contacts\nКорзина|/franchize/{slug}/cart",
    categoryOrderText: "Naked, Supersport, Touring, Neo-retro",
    allowPromo: true,
    deliveryModesText: "pickup, delivery",
    defaultMode: "pickup",
    advancedJson: "",
  });
  const [message, setMessage] = useState("Укажите slug, подберите цвета, проверьте локально и сохраните.");
  const [canEdit, setCanEdit] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("palette");
  const { dbUser, user } = useAppContext();
  const actorUserId = dbUser?.user_id ?? (user?.id ? String(user.id) : "");

  const isDark = useMemo(() => form.themeMode.toLowerCase().includes("dark"), [form.themeMode]);

  const ui = useMemo(
    () => ({
      pageBg: isDark ? form.bgBase : "#F6F8FC",
      cardBg: isDark ? form.bgCard : "#FFFFFF",
      sectionBg: isDark ? `${form.bgCard}CC` : "#F8FAFF",
      border: form.borderSoft,
      text: isDark ? form.textPrimary : "#0F172A",
      muted: isDark ? form.textSecondary : "#475569",
      accent: form.accentMain,
      accentText: isDark ? "#16130A" : "#04140F",
      inputBg: isDark ? "#0B0C10" : "#FFFFFF",
    }),
    [form, isDark],
  );

  const contrastChecks = useMemo(
    () => [
      { label: "Заголовки", ratio: contrastRatio(form.bgCard, form.textPrimary) },
      { label: "Вторичный текст", ratio: contrastRatio(form.bgCard, form.textSecondary) },
      { label: "Кнопка акцента", ratio: contrastRatio(form.accentMain, "#16130A") },
    ],
    [form.bgCard, form.textPrimary, form.textSecondary, form.accentMain],
  );

  const paletteRows: Array<{ label: string; keyName: keyof FranchizeConfigInput }> = [
    { label: "Фон страницы", keyName: "bgBase" },
    { label: "Фон карточек", keyName: "bgCard" },
    { label: "Границы", keyName: "borderSoft" },
    { label: "Основной цвет кнопок", keyName: "accentMain" },
    { label: "Основной цвет кнопок (hover)", keyName: "accentMainHover" },
    { label: "Главный текст", keyName: "textPrimary" },
    { label: "Вторичный текст", keyName: "textSecondary" },
  ];

  const updateField = <K extends keyof FranchizeConfigInput>(key: K, value: FranchizeConfigInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const copyToClipboard = async (value: string, successText: string) => {
    await navigator.clipboard.writeText(value);
    setMessage(successText);
  };

  const applyAdvancedJsonLocally = () => {
    try {
      const parsed = JSON.parse(form.advancedJson || "{}");
      const source = parsed.franchize ?? parsed;
      setForm((prev) => ({
        ...prev,
        brandName: readPath(source, ["branding", "name"], prev.brandName),
        tagline: readPath(source, ["branding", "tagline"], prev.tagline),
        logoUrl: readPath(source, ["branding", "logoUrl"], prev.logoUrl),
        themeMode: readPath(source, ["theme", "mode"], prev.themeMode),
        bgBase: readPath(source, ["theme", "palette", "bgBase"], prev.bgBase),
        bgCard: readPath(source, ["theme", "palette", "bgCard"], prev.bgCard),
        borderSoft: readPath(source, ["theme", "palette", "borderSoft"], prev.borderSoft),
        accentMain: readPath(source, ["theme", "palette", "accentMain"], prev.accentMain),
        accentMainHover: readPath(source, ["theme", "palette", "accentMainHover"], prev.accentMainHover),
        textPrimary: readPath(source, ["theme", "palette", "textPrimary"], prev.textPrimary),
        textSecondary: readPath(source, ["theme", "palette", "textSecondary"], prev.textSecondary),
        phone: readPath(source, ["contacts", "phone"], prev.phone),
        email: readPath(source, ["contacts", "email"], prev.email),
        address: readPath(source, ["contacts", "address"], prev.address),
        telegram: readPath(source, ["contacts", "telegram"], prev.telegram),
        mapGps: readPath(source, ["contacts", "map", "gps"], prev.mapGps),
        mapImageUrl: readPath(source, ["contacts", "map", "imageUrl"], prev.mapImageUrl),
        mapBoundsTop: String(readPath(source, ["contacts", "map", "bounds", "top"], prev.mapBoundsTop)),
        mapBoundsBottom: String(readPath(source, ["contacts", "map", "bounds", "bottom"], prev.mapBoundsBottom)),
        mapBoundsLeft: String(readPath(source, ["contacts", "map", "bounds", "left"], prev.mapBoundsLeft)),
        mapBoundsRight: String(readPath(source, ["contacts", "map", "bounds", "right"], prev.mapBoundsRight)),
        socialLinksText: readPath(source, ["footer", "socialLinks"], [])
          .map((entry: { label?: string; href?: string }) => `${entry.label ?? ""}|${entry.href ?? ""}`)
          .filter(Boolean)
          .join("\n") || prev.socialLinksText,
      }));
      setMessage("JSON применён локально для предпросмотра. Если всё ок — нажимайте сохранить.");
    } catch {
      setMessage("Не удалось применить JSON: проверьте формат.");
    }
  };

  const onLoad = () => {
    startTransition(async () => {
      const result = await loadFranchizeConfigBySlug(form.slug, actorUserId);
      if (!result.ok || !result.data) return setMessage(result.message);
      setForm(result.data);
      setCanEdit(Boolean(result.canEdit));
      setMessage(result.message);
    });
  };

  const onSave = () => {
    startTransition(async () => {
      if (!actorUserId || !canEdit) {
        setMessage("Режим read-only: сохранять могут только owner экипажа или all-admin.");
        return;
      }

      const result = await saveFranchizeConfig(form, actorUserId);
      setMessage(result.message);
      if (result.data) setForm(result.data);
      if (typeof result.canEdit === "boolean") setCanEdit(result.canEdit);
    });
  };

  const sectionClass = "rounded-2xl border p-4";
  const inputClass = "w-full rounded-xl border px-3 py-2 text-sm outline-none transition";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-3xl border p-4 md:p-6" style={{ backgroundColor: ui.cardBg, borderColor: ui.border, color: ui.text }}>
      <div className="rounded-2xl border p-4" style={{ borderColor: ui.border, background: `linear-gradient(120deg, ${ui.pageBg}, ${ui.cardBg})` }}>
        <p className="text-xs uppercase tracking-[0.14em]" style={{ color: ui.accent }}>{form.brandName || "Franchize"}</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: ui.text }}>Брендинг-редактор франшизы</h1>
        <p className="mt-1 text-sm" style={{ color: ui.muted }}>Поток из трёх фаз: цвета → тексты/контакты → AI JSON.</p>
        <p className="mt-2 text-xs" style={{ color: ui.muted }}>Чужие данные доступны в read-only после загрузки. Сохранять может только owner экипажа или all-admin.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["palette", "Фаза 1: Цвета"],
          ["content", "Фаза 2: Контент"],
          ["ai", "Фаза 3: AI JSON"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStage(value as Stage)}
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
            style={{
              borderColor: stage === value ? ui.accent : ui.border,
              backgroundColor: stage === value ? `${ui.accent}22` : ui.sectionBg,
              color: stage === value ? ui.accent : ui.text,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <section className={`${sectionClass} grid gap-3 md:grid-cols-2`} style={{ borderColor: ui.border, backgroundColor: ui.sectionBg }}>
        <label className="text-sm">Slug экипажа
          <input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="vip-bike" />
        </label>
        <div className="flex items-end gap-2"><button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: ui.accent, color: ui.accentText }} onClick={onLoad}>Загрузить по slug</button></div>
      </section>

      {stage === "palette" && (
        <section className={`${sectionClass} grid gap-3`} style={{ borderColor: ui.border, backgroundColor: ui.sectionBg }}>
          <h2 className="text-lg font-medium" style={{ color: ui.text }}>Подбор палитры в реальном времени</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {paletteRows.map((row) => (
              <div key={row.keyName} className="rounded-xl border p-3" style={{ borderColor: ui.border }}>
                <p className="text-sm font-medium">{row.label} <span style={{ color: ui.muted }}>({row.keyName})</span></p>
                <div className="mt-2 flex items-center gap-2">
                  <input type="color" value={String(form[row.keyName])} onChange={(e) => updateField(row.keyName, e.target.value)} className="h-9 w-12 rounded border" style={{ borderColor: ui.border }} />
                  <input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={String(form[row.keyName])} onChange={(e) => updateField(row.keyName, e.target.value)} />
                </div>
                <div className="mt-2 h-8 rounded border" style={{ borderColor: ui.border, backgroundColor: String(form[row.keyName]) }} />
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: ui.border, backgroundColor: ui.inputBg }}>
            <p className="font-semibold">Контраст-предупреждения</p>
            <ul className="mt-2 space-y-1">{contrastChecks.map((check) => <li key={check.label}>{check.label}: {check.ratio ? check.ratio.toFixed(2) : "n/a"} — {contrastLabel(check.ratio)}</li>)}</ul>
          </div>
        </section>
      )}

      {stage === "content" && (
        <section className={`${sectionClass} grid gap-3 md:grid-cols-3`} style={{ borderColor: ui.border, backgroundColor: ui.sectionBg }}>
          <h2 className="md:col-span-3 text-lg font-medium" style={{ color: ui.text }}>Тексты, контакты, меню, заказ</h2>
          <label className="text-sm">Название бренда<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.brandName} onChange={(e) => updateField("brandName", e.target.value)} /></label>
          <label className="text-sm">Слоган<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.tagline} onChange={(e) => updateField("tagline", e.target.value)} /></label>
          <label className="text-sm">Логотип URL<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.logoUrl} onChange={(e) => updateField("logoUrl", e.target.value)} /></label>
          <label className="text-sm">Телефон<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} /></label>
                    <label className="text-sm">Адрес<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.address} onChange={(e) => updateField("address", e.target.value)} /></label>
          <label className="text-sm md:col-span-3">Ссылки меню (`название|ссылка`)
            <textarea className={`${inputClass} min-h-28`} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.menuLinksText} onChange={(e) => updateField("menuLinksText", e.target.value)} />
          </label>
          <label className="text-sm">Категории (CSV)<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.categoryOrderText} onChange={(e) => updateField("categoryOrderText", e.target.value)} /></label>
          <label className="text-sm">Режимы выдачи (CSV)<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.deliveryModesText} onChange={(e) => updateField("deliveryModesText", e.target.value)} /></label>
          <label className="text-sm">Режим по умолчанию<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.defaultMode} onChange={(e) => updateField("defaultMode", e.target.value)} /></label>
        </section>
      )}


      {stage === "map" && (
        <section className={`${sectionClass} grid gap-3 md:grid-cols-2`} style={{ borderColor: ui.border, backgroundColor: ui.sectionBg }}>
          <h2 className="md:col-span-2 text-lg font-medium" style={{ color: ui.text }}>Карта и онлайн-каналы</h2>
          <label className="text-sm">Telegram экипажа<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.telegram} onChange={(e) => updateField("telegram", e.target.value)} placeholder="@oneBikePlsBot" /></label>
          <label className="text-sm">GPS (lat, lon)<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapGps} onChange={(e) => updateField("mapGps", e.target.value)} placeholder="56.2042, 43.7985" /></label>
          <label className="text-sm md:col-span-2">Map image URL (VibeMap)
            <input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapImageUrl} onChange={(e) => updateField("mapImageUrl", e.target.value)} />
          </label>
          <label className="text-sm">Bounds top<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapBoundsTop} onChange={(e) => updateField("mapBoundsTop", e.target.value)} /></label>
          <label className="text-sm">Bounds bottom<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapBoundsBottom} onChange={(e) => updateField("mapBoundsBottom", e.target.value)} /></label>
          <label className="text-sm">Bounds left<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapBoundsLeft} onChange={(e) => updateField("mapBoundsLeft", e.target.value)} /></label>
          <label className="text-sm">Bounds right<input className={inputClass} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.mapBoundsRight} onChange={(e) => updateField("mapBoundsRight", e.target.value)} /></label>
          <label className="text-sm md:col-span-2">Соцсети (`название|ссылка`)
            <textarea className={`${inputClass} min-h-28`} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.socialLinksText} onChange={(e) => updateField("socialLinksText", e.target.value)} />
          </label>
        </section>
      )}
      {stage === "ai" && (
        <section className={`${sectionClass} grid gap-3`} style={{ borderColor: ui.border, backgroundColor: ui.sectionBg }}>
          <h2 className="text-lg font-medium" style={{ color: ui.text }}>AI-фаза: экономим мозговое время</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ backgroundColor: ui.accent, color: ui.accentText }} onClick={() => copyToClipboard(JSON.stringify(TEMPLATE_PAYLOAD, null, 2), "Template скопирован")}>Copy template</button>
            <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: ui.border, color: ui.text }} onClick={() => copyToClipboard(BOT_PROMPT, "Промпт скопирован")}>Copy prompt for bot</button>
            <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: ui.border, color: ui.text }} onClick={applyAdvancedJsonLocally}>Применить JSON локально</button>
          </div>
          <textarea className={`${inputClass} min-h-[420px] font-mono text-xs`} style={{ borderColor: ui.border, backgroundColor: ui.inputBg, color: ui.text }} value={form.advancedJson} onChange={(e) => updateField("advancedJson", e.target.value)} />
          <p className="text-sm" style={{ color: ui.muted }}>Сначала тестируете локально (кнопка выше), потом сохраняете в Supabase.</p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ backgroundColor: ui.accent, color: ui.accentText }} disabled={isPending || !canEdit} onClick={onSave}>{canEdit ? "Сохранить в Supabase" : "Read-only"}</button>
        <p className="text-sm" style={{ color: ui.muted }}>{isPending ? "Обрабатываю..." : message}</p>
      </div>
    </div>
  );
}
