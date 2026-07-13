"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { getCrewForInvite, requestToJoinCrew } from "@/app/rentals/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { logger } from "@/lib/logger";

type JoinState = "loading" | "ready" | "joining" | "success" | "already_member" | "error";

interface CrewInfo {
  id: string;
  name: string;
  slug: string;
}

export function JoinCrewBanner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, userCrewInfo } = useAppContext();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<JoinState>("loading");
  const [crew, setCrew] = useState<CrewInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isJoinIntent = searchParams.get("join_crew") === "true";

  // Fetch crew info and open dialog on mount
  useEffect(() => {
    if (!isJoinIntent) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await getCrewForInvite(slug);
        if (cancelled) return;

        if (!res.success || !res.data) {
          setState("error");
          setErrorMsg(res.error || "Экипаж не найден");
          setOpen(true);
          return;
        }

        setCrew({ id: res.data.id, name: res.data.name, slug: res.data.slug || slug });

        // Check if user is already a member of THIS crew
        if (userCrewInfo?.slug === slug) {
          setState("already_member");
        } else {
          setState("ready");
        }
        setOpen(true);
      } catch (err) {
        if (cancelled) return;
        logger.error("[JoinCrewBanner] Failed to fetch crew:", err);
        setState("error");
        setErrorMsg("Не удалось загрузить информацию об экипаже");
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isJoinIntent, slug, userCrewInfo?.slug]);

  const handleJoin = useCallback(async () => {
    if (!dbUser || !crew) return;
    setState("joining");
    try {
      const res = await requestToJoinCrew(dbUser.user_id, dbUser.username || "rider", crew.id);
      if (res.success) {
        setState("success");
      } else {
        // "already active member of another crew" is also a known state
        if (res.error?.includes("уже являетесь")) {
          setState("already_member");
          setErrorMsg(res.error!);
        } else {
          setState("error");
          setErrorMsg(res.error || "Не удалось отправить заявку");
        }
      }
    } catch (err) {
      logger.error("[JoinCrewBanner] Join failed:", err);
      setState("error");
      setErrorMsg("Ошибка при отправке заявки");
    }
  }, [dbUser, crew]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Clean the URL — remove join_crew param
    const url = new URL(window.location.href);
    url.searchParams.delete("join_crew");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  if (!isJoinIntent) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md border-zinc-800 bg-zinc-950 text-white">
        <DialogHeader>
          {/* LOADING */}
          {state === "loading" && (
            <>
              <DialogTitle className="text-center text-lg font-bold">Загрузка...</DialogTitle>
              <DialogDescription className="text-center text-zinc-400">
                Получаем информацию об экипаже
              </DialogDescription>
            </>
          )}

          {/* READY — show join prompt */}
          {state === "ready" && crew && (
            <>
              <DialogTitle className="text-center text-xl font-bold">
                🏍️ Приглашение в экипаж
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                Вас пригласили в экипаж <span className="font-bold text-white">&laquo;{crew.name}&raquo;</span>!
              </DialogDescription>
            </>
          )}

          {/* JOINING */}
          {state === "joining" && (
            <>
              <DialogTitle className="text-center text-lg font-bold">Отправляем заявку...</DialogTitle>
              <DialogDescription className="text-center text-zinc-400">
                Подождите, идёт подключение к экипажу
              </DialogDescription>
            </>
          )}

          {/* SUCCESS */}
          {state === "success" && crew && (
            <>
              <DialogTitle className="text-center text-xl font-bold text-emerald-400">
                🎉 Добро пожаловать в команду!
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                Вы теперь часть экипажа <span className="font-bold text-white">&laquo;{crew.name}&raquo;</span>.
                <br />Владелец экипажа получит уведомление и подтвердит вашу заявку.
                <br />После подтверждения вам откроется доступ ко всем функциям экипажа.
              </DialogDescription>
            </>
          )}

          {/* ALREADY MEMBER */}
          {state === "already_member" && (
            <>
              <DialogTitle className="text-center text-xl font-bold text-amber-400">
                Вы уже в экипаже!
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                {errorMsg || `Вы уже являетесь участником экипажа «${crew?.name || slug}». Добро пожаловать обратно!`}
              </DialogDescription>
            </>
          )}

          {/* ERROR */}
          {state === "error" && (
            <>
              <DialogTitle className="text-center text-xl font-bold text-red-400">
                Ошибка
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                {errorMsg || "Что-то пошло не так. Попробуйте позже."}
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-4">
          {state === "ready" && (
            <>
              {!dbUser ? (
                <p className="text-center text-sm text-zinc-500">
                  Для вступления в экипаж необходимо авторизоваться через Telegram
                </p>
              ) : (
                <button
                  onClick={handleJoin}
                  className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-emerald-500 active:scale-95"
                >
                  Вступить в экипаж
                </button>
              )}
            </>
          )}

          {(state === "success" || state === "already_member") && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-zinc-800 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-zinc-700 active:scale-95"
            >
              Отлично, каталог!
            </button>
          )}

          {state === "error" && (
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-zinc-800 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-zinc-700 active:scale-95"
            >
              Закрыть
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
