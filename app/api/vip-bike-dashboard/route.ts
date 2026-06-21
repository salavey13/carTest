export const dynamic = 'force-dynamic'  // NEVER try to render this statically
export const runtime = 'nodejs'         // Supabase needs Node runtime (not Edge)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { differenceInHours, differenceInDays, startOfDay, endOfDay, subDays, format } from "date-fns";
import { ru } from "date-fns/locale";

// Helper: Parse DD.MM.YYYY to Date
function parseRuDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
}

// Helper: Format price
function formatPrice(price: number | string): string {
  const num = typeof price === "string" ? parseInt(price, 10) || 0 : price || 0;
  return num.toLocaleString("ru-RU");
}

// Helper: Parse price from sale_price field (handles "420 000 ₽" format)
function parseSalePrice(priceStr: string | null): number {
  if (!priceStr) return 0;
  const numeric = String(priceStr).replace(/[^0-9]/g, "");
  return parseInt(numeric, 10) || 0;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const dateStart = startOfDay(targetDate).toISOString();
    const dateEnd = endOfDay(targetDate).toISOString();

    // Fetch active rentals from public.rentals
    const { data: activeRentals, error: rentalsError } = await supabaseAdmin
      .from("rentals")
      .select(`
        id,
        car_id,
        user_id,
        start_date,
        end_date,
        status,
        metadata,
        cars (
          id,
          make,
          model,
          slug
        )
      `)
      .in("status", ["active", "overdue"])
      .order("start_date", { ascending: false });

    if (rentalsError) {
      console.error("[dashboard] rentals query failed:", rentalsError);
      return NextResponse.json({ error: "Failed to fetch rentals" }, { status: 500 });
    }

    // Fetch rental artifacts for the target date
    const { data: rentalArtifacts, error: artifactsError } = await supabaseAdmin
      .schema("private")
      .from("rental_contract_artifacts")
      .select("*")
      .gte("created_at", dateStart)
      .lte("created_at", dateEnd)
      .order("created_at", { ascending: false });

    if (artifactsError) {
      console.error("[dashboard] rental artifacts query failed:", artifactsError);
    }

    // Deduplicate rental artifacts by resolved_bike_id (keep latest)
    const rentalArtifactsMap = new Map();
    for (const artifact of rentalArtifacts || []) {
      const key = `${artifact.resolved_bike_id}-${artifact.created_at?.slice(0, 13)}`; // Group by bike + hour
      if (!rentalArtifactsMap.has(artifact.resolved_bike_id) ||
        new Date(artifact.created_at) > new Date(rentalArtifactsMap.get(artifact.resolved_bike_id)?.created_at)) {
        rentalArtifactsMap.set(artifact.resolved_bike_id, artifact);
      }
    }
    const deduplicatedRentals = Array.from(rentalArtifactsMap.values());

    // Fetch sale artifacts for the target date
    const { data: saleArtifacts, error: salesError } = await supabaseAdmin
      .schema("private")
      .from("sale_contract_artifacts")
      .select("*")
      .gte("created_at", dateStart)
      .lte("created_at", dateEnd)
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("[dashboard] sale artifacts query failed:", salesError);
    }

    // Deduplicate sale artifacts by resolved_bike_id
    const saleArtifactsMap = new Map();
    for (const artifact of saleArtifacts || []) {
      const key = `${artifact.resolved_bike_id}-${artifact.created_at?.slice(0, 13)}`;
      if (!saleArtifactsMap.has(artifact.resolved_bike_id) ||
        new Date(artifact.created_at) > new Date(saleArtifactsMap.get(artifact.resolved_bike_id)?.created_at)) {
        saleArtifactsMap.set(artifact.resolved_bike_id, artifact);
      }
    }
    const deduplicatedSales = Array.from(saleArtifactsMap.values());

    // Fetch weekly data (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const dayDate = subDays(targetDate, i);
      const dayStart = startOfDay(dayDate).toISOString();
      const dayEnd = endOfDay(dayDate).toISOString();

      const [{ count: rentalCount }] = await supabaseAdmin
        .schema("private")
        .from("rental_contract_artifacts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      const [{ count: saleCount }] = await supabaseAdmin
        .schema("private")
        .from("sale_contract_artifacts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      weeklyData.push({
        date: format(dayDate, "d MMM", { locale: ru }),
        rentals: rentalCount || 0,
        sales: saleCount || 0,
      });
    }

    // Calculate today's totals
    let rentalTotal = 0;
    let salesTotal = 0;
    let depositsTotal = 0;

    for (const rental of deduplicatedRentals) {
      const totalSum = parseSalePrice(rental.total_sum);
      rentalTotal += totalSum;
      const deposit = parseInt(String(rental.deposit_rub || "0"), 10) || 0;
      depositsTotal += deposit;
    }

    for (const sale of deduplicatedSales) {
      salesTotal += parseSalePrice(sale.sale_price);
    }

    // Process active rentals for reminders
    const now = new Date();
    const reminders = activeRentals
      ?.filter((r: any) => r.end_date && new Date(r.end_date) < now)
      .map((r: any) => {
        const hoursOverdue = differenceInHours(now, new Date(r.end_date));
        const daysOverdue = Math.floor(hoursOverdue / 24);
        const hoursRemainder = hoursOverdue % 24;
        const overdueText = daysOverdue > 0
          ? `${daysOverdue}д ${hoursRemainder}ч`
          : `${hoursOverdue}ч`;

        return {
          id: r.id,
          bikeName: `${r.cars?.make || ""} ${r.cars?.model || ""}`.trim() || r.cars?.slug || "Неизвестный байк",
          renterName: r.metadata?.renter_full_name || "(имя не указано)",
          endDate: format(new Date(r.end_date), "dd.MM, HH:mm"),
          overdueText: `Просрочка ${overdueText}`,
        };
      }) || [];

    // Process rentals list for the day
    const rentalsList = deduplicatedRentals.map((r: any) => {
      const startDate = parseRuDate(r.rent_start_date);
      const endDate = parseRuDate(r.rent_end_date);

      return {
        id: r.contract_key,
        bikeName: r.resolved_bike_id || "unknown",
        renterName: r.renter_full_name || "(не указано)",
        dateRange: `${startDate ? format(startDate, "dd.MM") : "Invalid Date"} → ${endDate ? format(endDate, "dd.MM") : "Invalid Date"}`,
        totalSum: parseSalePrice(r.total_sum),
        createdAt: r.created_at ? format(new Date(r.created_at), "HH:mm") : "",
        status: "pending",
      };
    });

    // Process sales list for the day
    const salesList = deduplicatedSales.map((s: any) => {
      return {
        id: s.contract_key,
        bikeName: s.resolved_bike_id || "unknown",
        buyerName: s.buyer_full_name || "(не указано)",
        warranty: s.warranty_months ? `Гарантия: ${s.warranty_months} мес.` : "",
        salePrice: parseSalePrice(s.sale_price),
        createdAt: s.created_at ? format(new Date(s.created_at), "HH:mm") : "",
      };
    });

    return NextResponse.json({
      date: format(targetDate, "yyyy-MM-dd"),
      displayDate: format(targetDate, "dd.MM.yyyy"),
      todayTotal: rentalTotal + salesTotal,
      rentalTotal,
      rentalCount: deduplicatedRentals.length,
      salesTotal,
      salesCount: deduplicatedSales.length,
      depositsTotal,
      reminders,
      rentalsList,
      salesList,
      weeklyData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[dashboard] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
