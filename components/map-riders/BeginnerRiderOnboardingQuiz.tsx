"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { useMapRiders } from "@/hooks/useMapRidersContext";

type ExperienceLevel = "new" | "city" | "crew";
type BikeGoal = "rental" | "personal";
type RideIntent = "learn" | "meetup" | "route";

const steps = ["Опыт", "Байк", "Цель"] as const;

const EXPERIENCE_OPTIONS: Array<{ id: ExperienceLevel; label: string; helper: string }> = [
  { id: "new", label: "Я новичок", helper: "Нужны спокойные маршруты, экипаж и подсказки по безопасности." },
  { id: "city", label: "Езжу по городу", helper: "Хочу быстро найти точки встречи и живых райдеров рядом." },
  { id: "crew", label: "Уже в тусовке", helper: "Нужен режим для группового выезда и публичного маршрута." },
];

const BIKE_OPTIONS: Array<{ id: BikeGoal; label: string; helper: string }> = [
  { id: "rental", label: "Беру байк в аренду", helper: "Карта подпишет заезд как VIP rental и оставит видимость внутри экипажа." },
  { id: "personal", label: "На своём байке", helper: "Карта подготовит личный режим и короткий автостоп геошеринга." },
];

const INTENT_OPTIONS: Array<{ id: RideIntent; label: string; helper: string }> = [
  { id: "learn", label: "Понять что делать", helper: "Сначала безопасный режим: экипаж, размытие дома, 15 минут." },
  { id: "meetup", label: "Найти встречу", helper: "Фокус на meetup-точках: тап по карте и кнопка +." },
  { id: "route", label: "Катнуть маршрут", helper: "Подготовим название заезда и публичный crew-сигнал." },
];

function optionClass(isActive: boolean) {
  return `rounded-2xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
    isActive ? "border-[var(--mr-accent)] bg-[var(--mr-accent)]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25 hover:bg-white/[0.07]"
  }`;
}

export function BeginnerRiderOnboardingQuiz({ crew }: { crew: FranchizeCrewVM }) {
  const { dispatch, crewSlug } = useMapRiders();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<ExperienceLevel>("new");
  const [bikeGoal, setBikeGoal] = useState<BikeGoal>("rental");
  const [intent, setIntent] = useState<RideIntent>("learn");
  const [applied, setApplied] = useState(false);

  const recommendation = useMemo(() => {
    const isNewbie = experience === "new" || intent === "learn";
    const rideName = intent === "meetup" ? "Meetup с экипажем" : intent === "route" ? "Городской выезд" : "Первый безопасный выезд";
    const vehicleLabel = bikeGoal === "rental" ? `${crew.header.brandName || "VIP BIKE"} rental` : "Личный байк";
    const visibilityMode = experience === "crew" && intent === "route" ? "public" : "crew";
    const autoExpireMinutes = isNewbie ? 15 : intent === "route" ? 60 : 5;

    return {
      rideName,
      vehicleLabel,
      rideMode: bikeGoal,
      visibilityMode,
      autoExpireMinutes,
      homeBlurLabel: isNewbie ? "Дом размыт, позиция только для экипажа" : visibilityMode === "public" ? "Публичный сигнал для маршрута" : "Короткий crew-сигнал",
    } as const;
  }, [bikeGoal, crew.header.brandName, experience, intent]);

  const applyRecommendation = () => {
    dispatch({ type: "ui/set-ride-name", payload: recommendation.rideName });
    dispatch({ type: "ui/set-vehicle-label", payload: recommendation.vehicleLabel });
    dispatch({ type: "ui/set-ride-mode", payload: recommendation.rideMode });
    dispatch({ type: "privacy/set-visibility", payload: recommendation.visibilityMode });
    dispatch({ type: "privacy/set-auto-expire", payload: recommendation.autoExpireMinutes });
    setApplied(true);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-4 text-white shadow-2xl shadow-black/25 backdrop-blur-xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="border border-[var(--mr-accent)]/45 bg-[var(--mr-accent)]/15 text-[var(--mr-accent)]">RENT-P1.1 • newbie gate</Badge>
          <h2 className="mt-3 font-orbitron text-2xl">Быстрый старт райдера</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Три вопроса — и MapRiders сам подготовит название заезда, тип байка, приватность и автостоп геошеринга для <span className="text-white">/{crewSlug}</span>.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full px-3 py-1 text-xs transition ${step === index ? "bg-[var(--mr-accent)] text-black" : "text-white/60 hover:text-white"}`}
              aria-current={step === index ? "step" : undefined}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr,0.72fr]">
        <div className="space-y-3">
          {step === 0 ? (
            EXPERIENCE_OPTIONS.map((option) => (
              <button key={option.id} type="button" className={optionClass(experience === option.id)} onClick={() => setExperience(option.id)}>
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs text-white/55">{option.helper}</span>
              </button>
            ))
          ) : step === 1 ? (
            BIKE_OPTIONS.map((option) => (
              <button key={option.id} type="button" className={optionClass(bikeGoal === option.id)} onClick={() => setBikeGoal(option.id)}>
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs text-white/55">{option.helper}</span>
              </button>
            ))
          ) : (
            INTENT_OPTIONS.map((option) => (
              <button key={option.id} type="button" className={optionClass(intent === option.id)} onClick={() => setIntent(option.id)}>
                <span className="block font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs text-white/55">{option.helper}</span>
              </button>
            ))
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <VibeContentRenderer content="::FaShieldAlt::" /> Рекомендация
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-white/45">Заезд</dt><dd>{recommendation.rideName}</dd></div>
            <div><dt className="text-white/45">Байк</dt><dd>{recommendation.vehicleLabel}</dd></div>
            <div><dt className="text-white/45">Видимость</dt><dd>{recommendation.visibilityMode === "public" ? "Все авторизованные" : "Только экипаж"}</dd></div>
            <div><dt className="text-white/45">Автостоп</dt><dd>{recommendation.autoExpireMinutes} мин • {recommendation.homeBlurLabel}</dd></div>
          </dl>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Назад</Button>
            {step < 2 ? (
              <Button type="button" className="flex-1 text-black" style={{ backgroundColor: crew.theme.palette.accentMain }} onClick={() => setStep((value) => Math.min(2, value + 1))}>Дальше</Button>
            ) : (
              <Button type="button" className="flex-1 text-black" style={{ backgroundColor: crew.theme.palette.accentMain }} onClick={applyRecommendation}>{applied ? "Применено" : "Настроить карту"}</Button>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
