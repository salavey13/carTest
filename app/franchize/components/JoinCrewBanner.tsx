"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { getCrewForInvite, autoJoinCrew } from "@/app/rentals/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { logger } from "@/lib/logger";

type JoinState = "joining" | "success" | "already_member" | "need_auth" | "error";

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
  const [state, setState] = useState<JoinState>("joining");
  const [crew, setCrew] = useState<CrewInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isJoinIntent = searchParams.get("join_crew") === "true";

  // Auto-join on mount — no button, fully automatic
  useEffect(() => {
    if (!isJoinIntent) return;

    // Wait for AppContext to load (dbUser may be null initially)
    if (dbUser === undefined) return;

    let cancelled = false;

    (async () => {
      // Not authenticated — can't auto-join
      if (!dbUser) {
        setState("need_auth");
        setOpen(true);
        return;
      }

      // Already a member of this crew (from AppContext)
      if (userCrewInfo?.slug === slug) {
        setState("already_member");
        setOpen(true);
        return;
      }

      // Fetch crew info
      try {
        const res = await getCrewForInvite(slug);
        if (cancelled) return;

        if (!res.success || !res.data) {
          setState("error");
          setErrorMsg(res.error || "Экипаж не найден");
          setOpen(true);
          return;
        }

        const crewInfo = { id: res.data.id, name: res.data.name, slug: res.data.slug || slug };
        setCrew(crewInfo);

        // Auto-join — direct active membership, no confirmation needed
        const joinRes = await autoJoinCrew(dbUser.user_id, dbUser.username || "rider", crewInfo.id, slug);
        if (cancelled) return;

        if (joinRes.success) {
          setState(joinRes.alreadyMember ? "already_member" : "success");
        } else {
          if (joinRes.error?.includes("уже являетесь")) {
            setState("already_member");
            setErrorMsg(joinRes.error);
          } else {
            setState("error");
            setErrorMsg(joinRes.error || "Не удалось присоединиться к экипажу");
          }
        }
        setOpen(true);
      } catch (err) {
        if (cancelled) return;
        logger.error("[JoinCrewBanner] Failed:", err);
        setState("error");
        setErrorMsg("Что-то пошло не так. Попробуйте позже.");
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isJoinIntent, slug, dbUser, userCrewInfo?.slug]);

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
          {/* JOINING — auto in progress */}
          {state === "joining" && (
            <>
              <DialogTitle className="text-center text-lg font-bold">Подключаем к экипажу...</DialogTitle>
              <DialogDescription className="text-center text-zinc-400">
                Подождите, идёт подключение
              </DialogDescription>
            </>
          )}

          {/* SUCCESS — auto-joined! */}
          {state === "success" && crew && (
            <>
              <DialogTitle className="text-center text-xl font-bold text-emerald-400">
                Добро пожаловать в команду!
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                Вы добавлены в экипаж <span className="font-bold text-white">&laquo;{crew.name}&raquo;</span>.
                Теперь вам доступны все функции экипажа.
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
                {errorMsg || `Вы уже участник экипажа «${crew?.name || slug}». Добро пожаловать обратно!`}
              </DialogDescription>
            </>
          )}

          {/* NEED AUTH */}
          {state === "need_auth" && (
            <>
              <DialogTitle className="text-center text-xl font-bold">
                Приглашение в экипаж
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-300 text-base">
                Откройте эту ссылку в Telegram, чтобы присоединиться к экипажу.
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

        {/* Close button for terminal states */}
        {state !== "joining" && (
          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-zinc-800 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-zinc-700 active:scale-95"
            >
              {state === "success" ? "К каталогу" : "Закрыть"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
