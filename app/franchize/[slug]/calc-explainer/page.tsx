// app/franchize/[slug]/calc-explainer/page.tsx
import type { Metadata } from "next";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { buildFranchizeSectionMetadata } from "../metadata";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Как считаются деньги",
  sectionDescription: "Объяснение всех расчётов: аренда, экипировка, депозиты, комиссия, зарплата",
});

export default async function CalcExplainerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
  const callerUserId = verifyTelegramActorCookieValue(actorCookie);

  let isCrewMember = false;
  if (callerUserId) {
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", callerUserId)
      .eq("membership_status", "active")
      .maybeSingle();
    if (membership && ["owner", "admin", "co_owner", "member"].includes(membership.role)) {
      isCrewMember = true;
    }
  }

  if (!isCrewMember) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={surface.page}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold" style={{ color: surface.card.color }}>
            Доступ только для участников экипажа
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/calc-explainer`} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-6 max-w-3xl mx-auto">
        <CalcExplainer />
      </FranchizePageShell>
    </main>
  );
}

function CalcExplainer() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">💰 Как считаются деньги</h1>
      <p className="text-sm text-muted-foreground">
        Полное объяснение всех расчётов в системе: аренда, экипировка, депозиты,
        комиссия, зарплата. С примерами и формулами.
      </p>

      <Section title="1. Расчёт аренды" icon="🏍️">
        <p>Цена аренды зависит от длительности и определяется по тирам (ступенчатая шкала):</p>
        <Table headers={["Длительность", "Формула", "Пример"]}>
          <Row cells={["≤ 1 часа", "price_per_hour × часы", "1.5ч × 1000₽ = 1500₽"]} />
          <Row cells={["1–3 часа", "Линейная интерполяция", "2ч между 1000₽ и 3000₽ = 2000₽"]} />
          <Row cells={["Точно 3 часа", "price_per_3h", "3000₽"]} />
          <Row cells={["3–6 часов", "Интерполяция", "4.5ч между 3000₽ и 4500₽ = 3750₽"]} />
          <Row cells={["Точно 6 часов", "price_per_6h", "4500₽"]} />
          <Row cells={["Точно 12 часов", "price_per_12h", "—"]} />
          <Row cells={["1 день (будни)", "rent_weekday", "6000₽"]} />
          <Row cells={["1 день (выходной)", "rent_weekend", "8000₽"]} />
          <Row cells={["2–4 дня", "rent_2_4d × дни", "5000 × 3 = 15000₽"]} />
          <Row cells={["5–10 дней", "rent_5_10d × дни", "4000 × 7 = 28000₽"]} />
          <Row cells={["11–30 дней", "rent_11_30d × дни", "3000 × 14 = 42000₽"]} />
        </Table>
        <Formula title="Линейная интерполяция">
          price = нижнийТир + (верхнийТир − нижнийТир) × (часы − нижняяГраница) / (верхняяГраница − нижняяГраница)
        </Formula>
        <p className="text-xs text-muted-foreground">
          ⚠️ Многодневные тиры — цена за день × количество дней. Скидка будни/выходные только при days=1.
        </p>
      </Section>

      <Section title="2. Стоимость экипировки" icon="🪖">
        <Table headers={["Предмет", "Цена", "Примечание"]}>
          <Row cells={["Шлем", "500₽ (&lt;24ч) или 1000₽ (≥24ч)", "До 2 штук"]} />
          <Row cells={["Перчатки", "500₽", "До 2 пар"]} />
          <Row cells={["Куртка", "500₽", "0/1"]} />
          <Row cells={["Ботинки", "500₽", "0/1"]} />
          <Row cells={["Сетка", "500₽", "0/1"]} />
          <Row cells={["Рюкзак", "500₽", "0/1"]} />
          <Row cells={["Сумка", "500₽", "0/1"]} />
          <Row cells={["Зарядка", "Бесплатно", "Возвратная"]} />
        </Table>
        <Formula title="Итог экипировки">
          equipmentCost = шлемы × getHelmetPrice(часы) + (перчатки + куртка + боты + сетка + рюкзак + сумка) × 500
        </Formula>
        <Example>
          6-часовая аренда, 2 шлема + перчатки + куртка: = 2×500 + 500 + 500 = 2000₽
        </Example>
      </Section>

      <Section title="3. Итоговая цена аренды" icon="💰">
        <Formula title="Без переопределения">
          totalCost = baseRentalCost + equipmentCost
        </Formula>
        <Example>
          6 часов (4500₽) + 2 шлема + перчатки + куртка (2000₽) = 6500₽
        </Example>
        <p>Оператор может переопределить цену кнопкой «✏️ Изменить цену»:</p>
        <Formula title="С переопределением">
          totalCost = cashAmount + bankAmount (priceOverridden защищает от пересчёта)
        </Formula>
      </Section>

      <Section title="4. Сплит оплаты" icon="💵">
        <Formula title="Распределение">
          bankAmount = totalAmount − cashAmount (cashAmount ≤ totalAmount)
        </Formula>
        <Example>
          Итого 6500₽. 4000 налом + 2500 на Тинькофф. card_destination = "tbank"
        </Example>
      </Section>

      <Section title="5. Депозиты" icon="🏦">
        <Table headers={["Тип", "Поток", "Когда"]}>
          <Row cells={["deposit_collected", "in", "При выдаче (cash/tbank/sber)"]} />
          <Row cells={["deposit_returned", "out", "Авто при status→completed"]} />
          <Row cells={["penalty", "out", "Удержание за повреждения"]} />
        </Table>
        <Formula title="Баланс">
          balance = collected − returned − penalty
        </Formula>
        <Example>
          20000 собрано − 20000 возвращено − 3000 штраф = −3000₽ (3000₽ на руках)
        </Example>
      </Section>

      <Section title="6. Кассовая книга" icon="📊">
        <Table headers={["Тип", "Поток", "Источник"]}>
          <Row cells={["income_rental", "in", "Авто при завершении аренды"]} />
          <Row cells={["income_sale", "in", "Авто при продаже"]} />
          <Row cells={["income_equipment", "in", "Авто при возврате экипировки"]} />
          <Row cells={["expense_commission", "out", "Авто: комиссия"]} />
          <Row cells={["expense_salary", "out", "При выплате зарплаты"]} />
        </Table>
        <Formula title="Сальдо">
          net = Σ(in) − Σ(out)
        </Formula>
        <Example>
          6500 + 120000 − 1300 − 25000 = 100200₽
        </Example>
      </Section>

      <Section title="7. Комиссии" icon="📈">
        <Formula title="Процент">
          комиссия = total_cost × процент / 100
        </Formula>
        <Example>Ставка 20%, аренда 6500₽ → 1300₽</Example>
        <Formula title="Фиксированная">
          комиссия = фикс (не зависит от суммы)
        </Formula>
        <Example>Ставка 500₽ за продажу → 500₽</Example>
      </Section>

      <Section title="8. Зарплата" icon="💵">
        <Formula title="За период">
          totalIncome = shiftIncome + commissionIncome + bonusIncome(0)
        </Formula>
        <Example>
          15 смен × 1500₽ + 8 комиссий × 1300₽ + 0 = 22500 + 10400 = 32900₽
        </Example>
      </Section>

      <Section title="9. Карта зависимостей" icon="🗺️">
        <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
{`calculatePriceForDuration → baseRentalCost
        │
        + equipmentCost (helmets + 500×items)
        ▼
   totalCost (или override)
        │
        ├──► rentals.total_cost ──► [trigger] income_rental
        │                              └──► [trigger] expense_commission
        │                                     ↑ commission_rates
        │
        ├──► deposit_entries (collected → returned → penalty)
        │
        └──► payment_split {cash, bank, card}

shifts + commissions ──► salary ──► expense_salary`}
        </pre>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--franchize-border-soft, #333)" }}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--franchize-border-soft, #333)" }}>
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ cells }: { cells: string[] }) {
  return (
    <tr className="border-b" style={{ borderColor: "var(--franchize-border-soft, #1a1a1a)" }}>
      {cells.map((c, i) => (
        <td key={i} className="py-2 px-3 text-xs" style={{ color: "var(--franchize-text-primary, #fff)" }} dangerouslySetInnerHTML={{ __html: c }} />
      ))}
    </tr>
  );
}

function Formula({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold text-amber-400 mb-1">{title}</p>
      <code className="text-sm font-mono" style={{ color: "var(--franchize-text-primary, #fff)" }}>
        {children}
      </code>
    </div>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
      <p className="text-xs font-semibold text-green-400 mb-1">Пример</p>
      <p className="text-sm" style={{ color: "var(--franchize-text-primary, #fff)" }}>
        {children}
      </p>
    </div>
  );
}
