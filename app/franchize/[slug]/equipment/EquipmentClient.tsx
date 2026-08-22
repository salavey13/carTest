// app/franchize/[slug]/equipment/EquipmentClient.tsx
"use client";

import { useState, useEffect } from "react";
import { Calendar, DollarSign, Package, CheckCircle, Shield, Star } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { catalogCardVariantStyles, interactionRingStyle } from "@/app/franchize/lib/theme";
import { formatDateRu } from "@/app/franchize/components/DateInputRu";

interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  description: string | null;
  daily_price: number;
  type: string;
  specs: Record<string, unknown>;
}

interface EquipmentRental {
  id: string;
  equipmentId: string;
  equipmentLabel: string;
  status: string;
  dailyPrice: number;
  totalCost: number;
  startDate: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  renterUserId: string | null;
  primaryRentalId: string | null;
}

interface EquipmentClientProps {
  slug: string;
  crew: any;
}

const CATEGORIES = [
  { key: "helmet", label: "Шлемы", icon: "🪖", color: "#3b82f6" },
  { key: "jacket", label: "Куртки", icon: "🧥", color: "#8b5cf6" },
  { key: "pants", label: "Штаны", icon: "👖", color: "#f97316" },
  { key: "gloves", label: "Перчатки", icon: "🧤", color: "#22c55e" },
  { key: "boots", label: "Ботинки", icon: "👢", color: "#f59e0b" },
  { key: "security", label: "Замки", icon: "🔒", color: "#ef4444" },
  { key: "electronics", label: "Электроника", icon: "📱", color: "#ec4899" },
];

const BADGE_MAP: Record<string, { label: string; emoji: string }> = {
  bestseller: { label: "Хит", emoji: "🔥" },
  premium: { label: "Премиум", emoji: "💎" },
  essential: { label: "Нужно", emoji: "✓" },
  versatile: { label: "Универсальный", emoji: "🔄" },
  summer: { label: "Лето", emoji: "☀️" },
  winter: { label: "Зима", emoji: "❄️" },
  lightweight: { label: "Лёгкий", emoji: "🪶" },
  urban: { label: "Город", emoji: "🏙️" },
  security: { label: "Защита", emoji: "🔒" },
  tech: { label: "Технологии", emoji: "📱" },
};

export function EquipmentClient({ slug, crew }: EquipmentClientProps) {
  const { dbUser } = useAppContext();
  const [catalog, setCatalog] = useState<EquipmentItem[]>([]);
  const [rentals, setRentals] = useState<EquipmentRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem | null>(null);
  const [rentalForm, setRentalForm] = useState({
    renterUserId: "",
    expectedReturnDate: "",
    dailyPrice: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const theme = crew?.theme || { isAuto: true, palette: {} };
  const T = crew?.theme?.palette || {
    bg: "#0B0C10",
    bgCard: "#111217",
    borderSoft: "#24262E",
    text: "#F2F2F3",
    textMuted: "#A7ABB4",
    accent: "#D99A00",
    accentContrast: "#16130A",
  };

  useEffect(() => {
    loadCatalog();
    loadRentals();
  }, [slug, dbUser?.user_id]);

  const loadCatalog = async () => {
    try {
      const { getEquipmentCatalog } = await import("../../server-actions/equipment-rentals");
      const result = await getEquipmentCatalog({
        slug,
        actorUserId: dbUser?.user_id || "",
      });
      if (result.success?.data) {
        setCatalog(result.data);
      }
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  const loadRentals = async () => {
    try {
      const { listEquipmentRentals } = await import("../../server-actions/equipment-rentals");
      const result = await listEquipmentRentals({
        slug,
        actorUserId: dbUser?.user_id || "",
      });
      if (result.success?.data) {
        setRentals(result.data);
      }
    } catch (err) {
      console.error("Failed to load rentals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !dbUser?.user_id) return;

    try {
      const { createEquipmentRental } = await import("../../server-actions/equipment-rentals");
      const result = await createEquipmentRental({
        slug,
        actorUserId: dbUser.user_id,
        equipmentId: selectedEquipment.id,
        renterUserId: rentalForm.renterUserId || undefined,
        expectedReturnDate: rentalForm.expectedReturnDate || undefined,
        dailyPrice: rentalForm.dailyPrice,
      });

      if (result.success) {
        setShowRentalForm(false);
        setSelectedEquipment(null);
        loadRentals();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleReturn = async (id: string, condition: "returned" | "damaged" | "lost") => {
    if (!dbUser?.user_id) return;

    try {
      const { returnEquipmentRental } = await import("../../server-actions/equipment-rentals");
      const result = await returnEquipmentRental({
        slug,
        actorUserId: dbUser.user_id,
        id,
        condition,
      });

      if (result.success) {
        loadRentals();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  // Group catalog by category
  const groupedCatalog = catalog.reduce((acc, item) => {
    const category = (item.specs?.category as string) || "other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, EquipmentItem[]>);

  const activeRentals = rentals.filter((r) => r.status === "active");

  const getBadge = (specs: Record<string, unknown>) => {
    const badge = specs.badge as string | undefined;
    if (!badge) return null;

    const info = BADGE_MAP[badge] || { label: badge, emoji: "⭐" };
    return {
      ...info,
      color: (specs.badge_color as string | undefined) || "#D99A00",
    };
  };

  return (
    <div
      className="space-y-8"
      style={{ background: "var(--franchize-shell-bg, transparent)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ color: "var(--franchize-shell-text, #F2F2F3)" }}
          >
            Каталог экипировки
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--franchize-shell-muted, #A7ABB4)" }}
          >
            Премиум защита и комфорт
          </p>
        </div>
        {activeRentals.length > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: `color-mix(in srgb, ${T.accent} 10%, transparent)`,
              border: `1px solid ${T.borderSoft}`,
            }}
          >
            <Package className="w-4 h-4" style={{ color: T.accent }} />
            <span className="text-sm font-medium" style={{ color: T.text }}>
              {activeRentals.length} в аренде
            </span>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedCategory === "all" ? "ring-2 ring-offset-2" : "opacity-70 hover:opacity-100"
          }`}
          style={{
            background: selectedCategory === "all" ? T.accent : T.bgCard,
            color: selectedCategory === "all" ? T.accentContrast : T.text,
            borderColor: selectedCategory === "all" ? "transparent" : T.borderSoft,
            borderWidth: "1px",
            ringColor: T.accent,
          }}
        >
          Все
        </button>
        {CATEGORIES.map((cat) => {
          const hasItems = groupedCatalog[cat.key]?.length > 0;
          if (!hasItems) return null;

          const isActive = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isActive ? "ring-2 ring-offset-2" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                background: isActive ? cat.color : T.bgCard,
                color: isActive ? "#fff" : T.text,
                borderColor: isActive ? "transparent" : T.borderSoft,
                borderWidth: "1px",
                ringColor: cat.color,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="opacity-60">({groupedCatalog[cat.key]?.length || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div
            className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent"
            style={{ borderColor: T.accent }}
          />
        </div>
      ) : catalog.length === 0 ? (
        <div
          className="text-center py-12 rounded-2xl border"
          style={{ background: T.bgCard, borderColor: T.borderSoft }}
        >
          <Package
            className="w-12 h-12 mx-auto mb-4 opacity-50"
            style={{ color: T.textMuted }}
          />
          <p className="text-lg font-medium" style={{ color: T.text }}>
            Каталог пуст
          </p>
          <p className="text-sm mt-1" style={{ color: T.textMuted }}>
            Экипировка скоро появится
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Catalog Grid by Category */}
          {(Object.keys(groupedCatalog) as string[]).map((category) => {
            if (selectedCategory !== "all" && selectedCategory !== category) {
              return null;
            }

            const items = groupedCatalog[category];
            const catInfo =
              CATEGORIES.find((c) => c.key === category) || {
                label: category,
                icon: "📦",
                color: T.accent,
              };

            return (
              <section key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{catInfo.icon}</span>
                  <h3 className="text-xl font-semibold" style={{ color: T.text }}>
                    {catInfo.label}
                  </h3>
                  <span
                    className="text-sm px-2 py-1 rounded-full"
                    style={{
                      background: `${catInfo.color}20`,
                      color: catInfo.color,
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item, index) => {
                    const badge = getBadge(item.specs);
                    const features = (item.specs?.features as string[])?.slice(0, 3) || [];
                    const cardStyles = catalogCardVariantStyles(theme, index);

                    return (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer"
                        style={{
                          backgroundColor: cardStyles.backgroundColor,
                          borderColor: cardStyles.borderColor,
                          backgroundImage: cardStyles.backgroundImage,
                          boxShadow: cardStyles.boxShadow,
                        }}
                        onClick={() => {
                          setSelectedEquipment(item);
                          setRentalForm({ ...rentalForm, dailyPrice: item.daily_price });
                          setShowRentalForm(true);
                        }}
                        onFocusVisible={(e) => {
                          Object.assign(e.currentTarget.style, interactionRingStyle(theme));
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = cardStyles.boxShadow || "";
                        }}
                      >
                        {/* Badge */}
                        {badge && (
                          <div
                            className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                            style={{ background: badge.color, color: "#fff" }}
                          >
                            <span>{badge.emoji}</span>
                            <span>{badge.label}</span>
                          </div>
                        )}

                        {/* Content */}
                        <div className="p-4 space-y-3">
                          {/* Header */}
                          <div>
                            <div
                              className="flex items-center gap-2 text-xs"
                              style={{ color: T.textMuted }}
                            >
                              <span
                                className="px-2 py-0.5 rounded-full"
                                style={{
                                  background: `color-mix(in srgb, ${T.accent} 10%, transparent)`,
                                  color: T.accent,
                                }}
                              >
                                {item.make}
                              </span>
                              {item.specs?.collection && (
                                <span>{item.specs.collection as string}</span>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold mt-1" style={{ color: T.text }}>
                              {item.model}
                            </h4>
                            {item.description && (
                              <p
                                className="text-sm mt-1 line-clamp-2"
                                style={{ color: T.textMuted }}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Materials */}
                          {item.specs?.materials && (
                            <div className="text-xs" style={{ color: T.textMuted }}>
                              {item.specs.materials as string}
                            </div>
                          )}

                          {/* Features */}
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {features.map((feature, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 rounded-full"
                                  style={{
                                    background: `color-mix(in srgb, ${T.borderSoft} 50%, transparent)`,
                                    color: T.textMuted,
                                  }}
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Specs Preview */}
                          <div
                            className="flex items-center gap-3 text-xs"
                            style={{ color: T.textMuted }}
                          >
                            {item.specs?.safety && (
                              <span className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {Array.isArray(item.specs.safety) &&
                                  (item.specs.safety as string[])[0]?.split?.(" ")?.[0] || "ECE"}
                              </span>
                            )}
                            {item.specs?.sizes && (
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {Array.isArray(item.specs.sizes) &&
                                  `${item.specs.sizes.length} разм.`}
                              </span>
                            )}
                          </div>

                          {/* Price & CTA */}
                          <div
                            className="flex items-center justify-between pt-3 border-t"
                            style={{ borderColor: T.borderSoft }}
                          >
                            <div className="flex items-center gap-1" style={{ color: T.accent }}>
                              <DollarSign className="w-4 h-4" />
                              <span className="text-lg font-bold">{item.daily_price}</span>
                              <span className="text-xs" style={{ color: T.textMuted }}>
                                ₽/день
                              </span>
                            </div>
                            <button
                              className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                              style={{
                                background: T.accent,
                                color: T.accentContrast,
                              }}
                            >
                              Арендовать
                            </button>
                          </div>
                        </div>

                        {/* Hover Glow */}
                        <div
                          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{
                            background: `radial-gradient(circle at center, color-mix(in srgb, ${T.accent} 10%, transparent) 0%, transparent 70%)`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Active Rentals Section */}
      {activeRentals.length > 0 && (
        <section
          className="rounded-2xl border p-6"
          style={{ background: T.bgCard, borderColor: T.borderSoft }}
        >
          <h3
            className="flex items-center gap-2 text-lg font-semibold mb-4"
            style={{ color: T.text }}
          >
            <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />
            Активные аренды
          </h3>
          <div className="space-y-3">
            {activeRentals.map((rental) => (
              <div
                key={rental.id}
                className="flex items-center justify-between rounded-xl border p-4"
                style={{ borderColor: T.borderSoft }}
              >
                <div className="flex-1">
                  <h4 className="font-medium" style={{ color: T.text }}>
                    {rental.equipmentLabel}
                  </h4>
                  <div
                    className="flex items-center gap-4 mt-1 text-sm"
                    style={{ color: T.textMuted }}
                  >
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {rental.dailyPrice} ₽/день (всего: {rental.totalCost} ₽)
                    </div>
                    {rental.expectedReturnDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        До: {new Date(rental.expectedReturnDate).toLocaleDateString("ru-RU")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReturn(rental.id, "returned")}
                    className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
                    style={{ background: "#10b981", color: "#fff" }}
                  >
                    Возвращён
                  </button>
                  <button
                    onClick={() => handleReturn(rental.id, "damaged")}
                    className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
                    style={{ background: "#f59e0b", color: "#fff" }}
                  >
                    Повреждён
                  </button>
                  <button
                    onClick={() => handleReturn(rental.id, "lost")}
                    className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    Утерян
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rental Form Modal */}
      {showRentalForm && selectedEquipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl border max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{ background: T.bgCard, borderColor: T.borderSoft }}
          >
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: T.text }}>
                    Сдача в аренду
                  </h3>
                  <p className="text-sm" style={{ color: T.textMuted }}>
                    {selectedEquipment.make} {selectedEquipment.model}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRentalForm(false);
                    setSelectedEquipment(null);
                  }}
                  className="p-2 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: T.textMuted }}
                >
                  ✕
                </button>
              </div>

              {/* Specs Display */}
              <div
                className="space-y-3 text-sm rounded-xl p-4"
                style={{ background: `color-mix(in srgb, ${T.borderSoft} 30%, transparent)` }}
              >
                {selectedEquipment.specs?.sizes && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color: T.accent }} />
                    <span style={{ color: T.textMuted }}>Размеры:</span>
                    <span style={{ color: T.text }}>
                      {Array.isArray(selectedEquipment.specs.sizes) &&
                        selectedEquipment.specs.sizes.slice(0, 3).join(", ")}
                      {selectedEquipment.specs.sizes.length > 3 && "..."}
                    </span>
                  </div>
                )}
                {selectedEquipment.specs?.colors && (
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4" style={{ color: T.accent }} />
                    <span style={{ color: T.textMuted }}>Цвета:</span>
                    <span style={{ color: T.text }}>
                      {Array.isArray(selectedEquipment.specs.colors) &&
                        selectedEquipment.specs.colors.slice(0, 3).join(", ")}
                      {selectedEquipment.specs.colors.length > 3 && "..."}
                    </span>
                  </div>
                )}
                {selectedEquipment.specs?.safety && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: "#10b981" }} />
                    <span style={{ color: T.textMuted }}>Сертификация:</span>
                    <span style={{ color: T.text }}>
                      {Array.isArray(selectedEquipment.specs.safety) &&
                        selectedEquipment.specs.safety.join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleCreateRental} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>
                    ID арендатора (опционально)
                  </label>
                  <input
                    type="text"
                    value={rentalForm.renterUserId}
                    onChange={(e) => setRentalForm({ ...rentalForm, renterUserId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border"
                    placeholder="user-123"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>
                    Дата возврата (опционально)
                  </label>
                  <input
                    type="date"
                    value={rentalForm.expectedReturnDate}
                    onChange={(e) =>
                      setRentalForm({ ...rentalForm, expectedReturnDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  />
                  {/* 2026-08-19 review: Russian-format display hint */}
                  {rentalForm.expectedReturnDate && (
                    <p className="mt-1 text-[10px] tabular-nums" style={{ color: T.textMuted }}>
                      ({formatDateRu(rentalForm.expectedReturnDate)})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>
                    Цена за день (₽)
                  </label>
                  <input
                    type="number"
                    value={rentalForm.dailyPrice}
                    onChange={(e) =>
                      setRentalForm({ ...rentalForm, dailyPrice: Number(e.target.value) })
                    }
                    min="0"
                    className="w-full px-3 py-2 rounded-xl border font-mono"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl font-semibold transition-colors"
                    style={{ background: T.accent, color: T.accentContrast }}
                  >
                    Создать аренду
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRentalForm(false);
                      setSelectedEquipment(null);
                    }}
                    className="px-4 py-2 rounded-xl font-semibold border transition-colors"
                    style={{ borderColor: T.borderSoft, color: T.text, background: "transparent" }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
