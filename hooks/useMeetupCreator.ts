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
  /** Optional photo — uploaded right after the meetup row is created and
   *  attached as the marker's round picture (photo_url). A failed upload
   *  never rolls the meetup back: the point stays, the photo is skipped. */
  photoFile?: File | null;
}

/**
 * Upload the attached photo to meetup-photo-upload and bind it to the meetup.
 * Returns the public URL on success, null on any failure (already toasted).
 */
async function uploadMeetupPhoto(userId: string, meetupId: string, crewSlug: string, file: File): Promise<string | null> {
  // contentType=false → браузер сам ставит multipart Content-Type с boundary
  const headers = await getMapRidersWriteHeaders(false);
  const form = new FormData();
  form.set("file", file);
  form.set("userId", userId);
  form.set("meetupId", meetupId);
  form.set("crewSlug", crewSlug);
  const response = await fetch("/api/map-riders/meetup-photo-upload", { method: "POST", headers, body: form });
  const json = (await response.json().catch(() => null)) as { success?: boolean; photoUrl?: string; error?: string } | null;
  if (!response.ok || !json?.success || !json.photoUrl) {
    toast.warning(json?.error || "Точка сохранена, но фото загрузить не удалось");
    return null;
  }
  return json.photoUrl;
}

export function useMeetupCreator(crewSlug: string) {
  const { state, dispatch, fetchSnapshot } = useMapRiders();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Returns the created meetup id (null on failure) — callers with photo
   *  attachments need the id; the legacy `if (created)` truthiness contract
   *  keeps working (null is falsy, id string is truthy). */
  const createMeetup = useCallback(
    async ({ userId, title, comment = "", point, successMessage, clearForm, photoFile }: CreateMeetupInput): Promise<string | null> => {
      const selectedPoint = point ?? state.selectedMeetupPoint;
      if (!userId || !selectedPoint) {
        toast.error("Ткни по карте и авторизуйся");
        return null;
      }

      const normalizedTitle = title.trim();
      if (normalizedTitle.length < 2) {
        toast.error("Название точки должно быть минимум 2 символа");
        return null;
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
        const meetupId: string | undefined = json.data?.id;

        if (photoFile && meetupId) {
          await uploadMeetupPhoto(userId, meetupId, crewSlug, photoFile);
        }

        clearForm?.();
        dispatch({ type: "ui/select-meetup-point", payload: null });
        await fetchSnapshot();
        toast.success(successMessage || "Meetup сохранён и опубликован в экипаже");
        return meetupId ?? null;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ошибка meetup");
        return null;
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
