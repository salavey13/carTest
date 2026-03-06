"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import { getFranchizeBySlug, type FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface, focusRingOutlineStyle } from "@/app/franchize/lib/theme";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import type { Database } from "@/types/database.types";

type Vehicle = Database["public"]["Tables"]["cars"]["Row"];

const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Crew admin panel",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: {
    mode: "pepperolli_dark",
    palette: {
      bgBase: "#0B0C10",
      bgCard: "#111217",
      accentMain: "#D99A00",
      accentMainHover: "#E2A812",
      textPrimary: "#F2F2F3",
      textSecondary: "#A7ABB4",
      borderSoft: "#24262E",
    },
  },
  header: { brandName: "VIP BIKE", tagline: "Ride the vibe", logoUrl: "", menuLinks: [] },
  contacts: {
    phone: "",
    email: "",
    address: "",
    telegram: "",
    workingHours: "",
    map: {
      gps: "",
      publicTransport: "",
      carDirections: "",
      imageUrl: "",
      bounds: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  catalog: { categories: [], quickLinks: [], tickerItems: [], showcaseGroups: [] },
  footer: { socialLinks: [], textColor: "#16130A" },
};

function FranchizeAdminContent() {
  const { dbUser, userCrewInfo, isLoading } = useAppContext();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const initialSlug = searchParams.get("slug") || userCrewInfo?.slug || "vip-bike";

  const [slug, setSlug] = useState(initialSlug);
  const [crew, setCrew] = useState<FranchizeCrewVM>(fallbackCrew);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<"all" | "bike" | "car">("all");
  const [loadingFleet, setLoadingFleet] = useState(false);

  const loadCrewTheme = useCallback(async (targetSlug: string) => {
    const { crew: loaded } = await getFranchizeBySlug(targetSlug);
    setCrew(loaded || fallbackCrew);
  }, []);

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingFleet(true);
    const res = await getEditableVehiclesForUser(dbUser.user_id);
    setLoadingFleet(false);
    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter((item) => (item.type === "bike" || item.type === "car") && (!slug || item.crew_id === crew.id || item.owner_id === dbUser.user_id));
    setFleet(scoped);

    if (editId) {
      const found = scoped.find((item) => item.id === editId) || null;
      setSelectedVehicle(found);
      if (!found) {
        toast.info("Карточка из edit-параметра не найдена в текущем crew scope.");
      }
    }
  }, [crew.id, dbUser?.user_id, editId, slug]);

  useEffect(() => {
    loadCrewTheme(slug);
  }, [loadCrewTheme, slug]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const visible = useMemo(
    () => fleet.filter((item) => (filterType === "all" ? true : item.type === filterType)),
    [fleet, filterType],
  );

  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);

  if (isLoading) return <Loading text="FRANCHIZE ADMIN INIT..." />;

  return (
    <section className="min-h-screen px-3 pb-10 pt-24 sm:px-4" style={surface.page}>
      <div className="mx-auto max-w-5xl rounded-3xl border p-4 sm:p-6" style={surface.card}>
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>crew owner console</p>
        <h1 className="mt-2 text-2xl font-semibold break-words" style={{ color: crew.theme.palette.textPrimary }}>
          {crew.header.brandName || crew.name || "Franchize"} — Admin Garage
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed break-words" style={{ color: crew.theme.palette.textSecondary }}>
          Адаптивный crew-admin: редактируй bike/car карточки, добавляй VIN и запускай checkout-документы без оффскрина текста.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="text-xs uppercase tracking-[0.16em]" style={{ color: crew.theme.palette.textSecondary }}>
            Crew slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value.trim())}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              style={{
                backgroundColor: `${crew.theme.palette.bgBase}b3`,
                borderColor: crew.theme.palette.borderSoft,
                color: crew.theme.palette.textPrimary,
                ...buttonFocus,
              }}
              placeholder="vip-bike"
            />
          </label>
          <Button
            type="button"
            onClick={() => {
              loadCrewTheme(slug || "vip-bike");
              loadFleet();
            }}
            className="h-10 self-end"
            style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
          >
            Обновить crew
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" variant={filterType === "all" ? "default" : "outline"} onClick={() => setFilterType("all")}>Все ({fleet.length})</Button>
          <Button type="button" variant={filterType === "bike" ? "default" : "outline"} onClick={() => setFilterType("bike")}>Байки ({fleet.filter((v) => v.type === "bike").length})</Button>
          <Button type="button" variant={filterType === "car" ? "default" : "outline"} onClick={() => setFilterType("car")}>Авто ({fleet.filter((v) => v.type === "car").length})</Button>
        </div>

        <div className="mt-4 rounded-2xl border p-3 text-sm leading-relaxed" style={surface.subtleCard}>
          <p className="break-words">
            Для doc-шаблона используй specs: <code>vin</code>, <code>plate</code>, <code>frame</code>. Теперь они корректно подхватываются в checkout DOC.
          </p>
          <p className="mt-1 text-xs" style={{ color: crew.theme.palette.textSecondary }}>
            Доступно записей по фильтру: <span className="font-semibold" style={{ color: crew.theme.palette.accentMain }}>{visible.length}</span>.
            {loadingFleet ? " Обновляем список..." : ""}
          </p>
        </div>

        <div className="mt-4">
          <CarSubmissionForm ownerId={dbUser?.user_id} vehicleToEdit={selectedVehicle} onSuccess={() => loadFleet()} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4" style={{ color: crew.theme.palette.accentMain }} href="/admin">← Общий admin</Link>
          <Link className="underline underline-offset-4" style={{ color: crew.theme.palette.accentMain }} href={`/franchize/${crew.slug || slug || "vip-bike"}`}>Открыть storefront</Link>
        </div>
      </div>
    </section>
  );
}

export default function FranchizeAdminPage() {
  return (
    <Suspense fallback={<Loading text="Загрузка Franchize admin..." />}>
      <FranchizeAdminContent />
    </Suspense>
  );
}
