"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

interface FranchizeAdminClientProps {
  initialSlug: string;
  editId?: string;
}

export function FranchizeAdminClient({ initialSlug, editId }: FranchizeAdminClientProps) {
  const { dbUser, isLoading } = useAppContext();
  const [crew, setCrew] = useState<FranchizeCrewVM>(fallbackCrew);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<"all" | "bike" | "car">("all");
  const [loadingFleet, setLoadingFleet] = useState(false);

  const slug = initialSlug?.trim() || "vip-bike";

  const loadCrewTheme = useCallback(async () => {
    const { crew: loaded } = await getFranchizeBySlug(slug);
    setCrew(loaded || fallbackCrew);
  }, [slug]);

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingFleet(true);
    const res = await getEditableVehiclesForUser(dbUser.user_id);
    setLoadingFleet(false);

    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter(
      (item) =>
        (item.type === "bike" || item.type === "car") &&
        (!crew.id || item.crew_id === crew.id || item.owner_id === dbUser.user_id),
    );

    setFleet(scoped);

    if (editId) {
      const found = scoped.find((item) => item.id === editId) || null;
      setSelectedVehicle(found);
      if (!found) {
        toast.info("Карточка из edit-параметра не найдена в текущем crew scope.");
      }
    }
  }, [crew.id, dbUser?.user_id, editId]);

  useEffect(() => {
    loadCrewTheme();
  }, [loadCrewTheme]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const visible = useMemo(
    () => fleet.filter((item) => (filterType === "all" ? true : item.type === filterType)),
    [fleet, filterType],
  );

  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = "#16130A";

  if (isLoading) return <Loading text="FRANCHIZE ADMIN INIT..." />;

  return (
    <section
      className="min-h-screen px-3 pb-10 pt-24 sm:px-4"
      style={{
        ...surface.page,
        ["--fr-admin-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-admin-accent-hover" as string]: crew.theme.palette.accentMainHover,
        ["--fr-admin-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-admin-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-admin-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <div className="mx-auto max-w-5xl rounded-3xl border p-4 sm:p-6" style={surface.card}>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--fr-admin-accent)]">crew owner console</p>
        <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-admin-text)]">
          {(crew.header.brandName || crew.name || slug).toUpperCase()} — ADMIN GARAGE
        </h1>
        <p className="mt-2 max-w-3xl break-words text-sm leading-relaxed text-[var(--fr-admin-muted)]">
          Переключатель экипажа: <span className="font-semibold text-[var(--fr-admin-accent)]">{slug}</span>. Редактируй bike/car карточки,
          добавляй VIN и формируй корректные checkout документы без контрастных артефактов темы.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { id: "all", label: `Все (${fleet.length})` },
            { id: "bike", label: `Байки (${fleet.filter((v) => v.type === "bike").length})` },
            { id: "car", label: `Авто (${fleet.filter((v) => v.type === "car").length})` },
          ].map((filter) => {
            const active = filterType === filter.id;
            return (
              <Button
                key={filter.id}
                type="button"
                onClick={() => setFilterType(filter.id as "all" | "bike" | "car")}
                className="h-10 border text-sm font-semibold"
                style={{
                  borderColor: "var(--fr-admin-border)",
                  color: active ? accentOn : "var(--fr-admin-text)",
                  backgroundColor: active ? "var(--fr-admin-accent)" : "transparent",
                  ...buttonFocus,
                }}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border p-3 text-sm leading-relaxed" style={{ ...surface.subtleCard, borderColor: "var(--fr-admin-border)" }}>
          <p className="break-words text-[var(--fr-admin-text)]">
            Для doc-шаблона используй specs: <code>vin</code>, <code>plate</code>, <code>frame</code>.
          </p>
          <p className="mt-1 text-xs text-[var(--fr-admin-muted)]">
            Доступно записей по фильтру: <span className="font-semibold text-[var(--fr-admin-accent)]">{visible.length}</span>.
            {loadingFleet ? " Обновляем список..." : ""}
          </p>
        </div>

        <div className="mt-4 rounded-2xl border p-3" style={{ ...surface.subtleCard, borderColor: "var(--fr-admin-border)" }}>
          <CarSubmissionForm ownerId={dbUser?.user_id} vehicleToEdit={selectedVehicle} onSuccess={() => loadFleet()} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4 text-[var(--fr-admin-accent)]" href="/admin">
            ← Общий admin
          </Link>
          <Link className="underline underline-offset-4 text-[var(--fr-admin-accent)]" href={`/franchize/${slug}`}>
            Открыть storefront
          </Link>
        </div>
      </div>
    </section>
  );
}
