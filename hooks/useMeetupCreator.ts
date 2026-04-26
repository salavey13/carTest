"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getMapRidersWriteHeaders } from "@/lib/map-riders-client-auth";
import { useMapRiders } from "@/hooks/useMapRidersContext";

interface CreateMeetupInput {
  userId: string;
  title: string;
  comment?: string;
  point?: [number, number] | null;
  successMessage?: string;
  clearForm?: () => void;
}

export function useMeetupCreator(crewSlug: string) {
  const { state, dispatch, fetchSnapshot } = useMapRiders();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMeetup = useCallback(
    async ({ userId, title, comment = "", point, successMessage, clearForm }: CreateMeetupInput) => {
      const selectedPoint = point ?? state.selectedMeetupPoint;
      if (!userId || !selectedPoint) {
        toast.error("Ткни по карте и авторизуйся");
        return false;
      }

      const normalizedTitle = title.trim();
      if (normalizedTitle.length < 2) {
        toast.error("Название точки должно быть минимум 2 символа");
        return false;
      }

      setIsSubmitting(true);
      try {
        const headers = await getMapRidersWriteHeaders();
        const response = await fetch("/api/map-riders/meetups", {
          method: "POST",
          headers,
          body: JSON.stringify({
            crewSlug,
            userId,
            title: normalizedTitle,
            comment,
            lat: selectedPoint[0],
            lon: selectedPoint[1],
          }),
        });

        const json = await response.json();
        if (!response.ok || !json.success) {
          throw new Error(json.error || "Ошибка meetup");
        }

        clearForm?.();
        dispatch({ type: "ui/select-meetup-point", payload: null });
        await fetchSnapshot();
        toast.success(successMessage || "Meetup сохранён и опубликован в экипаже");
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка meetup");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [crewSlug, dispatch, fetchSnapshot, state.selectedMeetupPoint],
  );

  return {
    createMeetup,
    isSubmitting,
  };
}
