// /app/franchize/components/RentalPhotoGallery.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, X, Upload, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reduceImageResolution } from "@/lib/client-image-compress";

/**
 * I3 — RentalPhotoGallery
 *
 * Two-column layout: ДО (start) | ПОСЛЕ (end).
 * Each column shows a grid of thumbnails. Click thumbnail → fullscreen lightbox
 * with keyboard navigation (←/→) and metadata overlay.
 *
 * Upload flow:
 *   1. Operator/renter clicks "Добавить фото" → file picker
 *   2. Client-side compression via reduceImageResolution (1600px, q80)
 *   3. POST /api/franchize/rental-photo-upload with compressed file
 *   4. Server action compresses again (sharp, 1280px, q75) + SHA-256 dedup + upload
 *   5. On success: refresh photo list, toast.success
 *   6. On dedup: toast.info "Фото уже было загружено ранее"
 *
 * v1 decision (PRD §4.1, §4.2): photos are PREFERABLE but NOT MANDATORY.
 * The gallery shows a yellow warning when count=0 but does not block closure.
 */

interface RentalPhotoGalleryProps {
  rentalId: string;
  /** Initial counts (from server-side render of rentals.start_photo_count/end_photo_count). */
  initialStartCount?: number;
  initialEndCount?: number;
  /** Whether to show the upload buttons (operator/admin/owner only). */
  canUpload: boolean;
  /** Compact mode: just show counts + thumbnails, no upload UI (for analytics drawer). */
  compact?: boolean;
}

interface Photo {
  photoId: string;
  photoType: "start" | "end";
  signedUrl: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  uploadedBy: string;
  uploaderRole: string;
  source: string;
  takenAt: string;
}

export function RentalPhotoGallery({
  rentalId,
  initialStartCount = 0,
  initialEndCount = 0,
  canUpload,
  compact = false,
}: RentalPhotoGalleryProps) {
  // I3 hotfix (C3): no longer use useAppContext/dbUser — caller identity is
  // verified server-side via the signed `cartest_tg_actor` cookie.
  const [startPhotos, setStartPhotos] = useState<Photo[]>([]);
  const [endPhotos, setEndPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<"start" | "end" | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxList, setLightboxList] = useState<Photo[]>([]);

  const loadPhotos = useCallback(async () => {
    // I3 hotfix (C3): no longer send requesterUserId — the API route reads
    // caller identity from the signed `cartest_tg_actor` cookie.
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/franchize/rental-photos?rentalId=${rentalId}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          const photos: Photo[] = data.photos || [];
          setStartPhotos(photos.filter((p) => p.photoType === "start"));
          setEndPhotos(photos.filter((p) => p.photoType === "end"));
        }
      }
    } catch {
      // silent fail — gallery is non-critical
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  // I3 hotfix (M5): only fetch the full photo list if there are photos to fetch.
  // The initial counts come from server-side render (rental.start_photo_count /
  // rental.end_photo_count). If both are 0, skip the API call entirely.
  useEffect(() => {
    if (initialStartCount === 0 && initialEndCount === 0) {
      setLoading(false);
      return;
    }
    loadPhotos();
  }, [loadPhotos, initialStartCount, initialEndCount]);

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!lightboxPhoto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxPhoto(null);
      else if (e.key === "ArrowLeft" && lightboxIndex > 0) {
        setLightboxIndex(lightboxIndex - 1);
        setLightboxPhoto(lightboxList[lightboxIndex - 1]);
      } else if (e.key === "ArrowRight" && lightboxIndex < lightboxList.length - 1) {
        setLightboxIndex(lightboxIndex + 1);
        setLightboxPhoto(lightboxList[lightboxIndex + 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxPhoto, lightboxIndex, lightboxList]);

  const handleUpload = async (photoType: "start" | "end", file: File) => {
    // I3 hotfix (C3): no longer check dbUser here — the API route reads caller
    // identity from the signed cookie. If the cookie is missing/invalid, the
    // API returns 401 and we show the error toast.
    setUploadingType(photoType);
    try {
      // 1. Client-side compress (1600px, q80) — keeps upload payload small
      const compressedBlob = await reduceImageResolution(file);
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
      });

      // I3 hotfix (C4): uploaderRole is NOT sent — server derives it in validateUpload.
      // I3 hotfix (C3): uploaderUserId is NOT sent — server reads it from signed cookie.

      // 2. Upload
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("rentalId", rentalId);
      formData.append("photoType", photoType);
      formData.append("source", "webapp");

      const resp = await fetch("/api/franchize/rental-photo-upload", {
        method: "POST",
        body: formData,
      });
      const result = await resp.json();

      if (!resp.ok || !result.success) {
        toast.error(result.error || "Не удалось загрузить фото.");
        return;
      }

      if (result.deduped) {
        toast.info("Это фото уже было загружено ранее — дубликат не создан.");
      } else {
        toast.success(
          photoType === "start"
            ? "Фото ДО добавлено."
            : "Фото ПОСЛЕ добавлено.",
        );
      }

      // Refresh photo list
      await loadPhotos();
    } catch (err: any) {
      toast.error(err?.message || "Ошибка при загрузке фото.");
    } finally {
      setUploadingType(null);
    }
  };

  const openLightbox = (photo: Photo, list: Photo[]) => {
    const idx = list.findIndex((p) => p.photoId === photo.photoId);
    setLightboxList(list);
    setLightboxIndex(idx);
    setLightboxPhoto(photo);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-sm" style={{ color: "var(--franchize-text-secondary, #999)" }}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Загрузка фото…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* ДО column */}
        <PhotoColumn
          label="Фото ДО"
          icon="📸"
          photoType="start"
          photos={startPhotos}
          canUpload={canUpload}
          uploading={uploadingType === "start"}
          onUpload={(file) => handleUpload("start", file)}
          onPhotoClick={(p) => openLightbox(p, startPhotos)}
          formatSize={formatSize}
          formatDate={formatDate}
          compact={compact}
        />

        {/* ПОСЛЕ column */}
        <PhotoColumn
          label="Фото ПОСЛЕ"
          icon="📷"
          photoType="end"
          photos={endPhotos}
          canUpload={canUpload}
          uploading={uploadingType === "end"}
          onUpload={(file) => handleUpload("end", file)}
          onPhotoClick={(p) => openLightbox(p, endPhotos)}
          formatSize={formatSize}
          formatDate={formatDate}
          compact={compact}
        />
      </div>

      {/* Soft warning when both are empty (v1: non-blocking).
          I3 hotfix (M4): hidden in compact mode — analytics drawer can't act on it. */}
      {!compact && startPhotos.length === 0 && endPhotos.length === 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
          style={{ color: "var(--franchize-text-secondary, #999)" }}
        >
          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
          <span>
            Фото не добавлены. Рекомендуется добавить хотя бы одно фото ДО и одно ПОСЛЕ
            для защиты от спорных ситуаций.
          </span>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxPhoto(null);
            }}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightboxIndex - 1;
                setLightboxIndex(newIdx);
                setLightboxPhoto(lightboxList[newIdx]);
              }}
              aria-label="Предыдущее"
            >
              ←
            </button>
          )}

          {lightboxIndex < lightboxList.length - 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                const newIdx = lightboxIndex + 1;
                setLightboxIndex(newIdx);
                setLightboxPhoto(lightboxList[newIdx]);
              }}
              aria-label="Следующее"
            >
              →
            </button>
          )}

          <div
            className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.signedUrl}
              alt={`Фото ${lightboxPhoto.photoType === "start" ? "ДО" : "ПОСЛЕ"}`}
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            />
            <div className="mt-3 rounded-lg bg-black/60 px-4 py-2 text-xs text-white">
              <span className="font-semibold">
                {lightboxPhoto.photoType === "start" ? "ДО" : "ПОСЛЕ"}
              </span>{" "}
              · {formatDate(lightboxPhoto.takenAt)} · {formatSize(lightboxPhoto.fileSizeBytes)} ·{" "}
              <span className="opacity-70">
                {lightboxPhoto.uploaderRole} via {lightboxPhoto.source}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: one column (ДО or ПОСЛЕ) ──────────────────────────────────────

interface PhotoColumnProps {
  label: string;
  icon: string;
  photoType: "start" | "end";
  photos: Photo[];
  canUpload: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onPhotoClick: (photo: Photo) => void;
  formatSize: (bytes: number) => string;
  formatDate: (iso: string) => string;
  compact: boolean;
}

function PhotoColumn({
  label,
  icon,
  photos,
  canUpload,
  uploading,
  onUpload,
  onPhotoClick,
  formatSize,
  formatDate,
  compact,
}: PhotoColumnProps) {
  const fileInputId = `photo-upload-${label.replace(/\s/g, "-").toLowerCase()}`;

  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        borderColor: photos.length === 0 ? "rgba(245, 158, 11, 0.3)" : "var(--franchize-border-soft, #333)",
        backgroundColor: photos.length === 0 ? "rgba(245, 158, 11, 0.03)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: "var(--franchize-text-primary, #fff)" }}>
          {icon} {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor:
              photos.length === 0
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(34, 197, 94, 0.15)",
            color: photos.length === 0 ? "#f59e0b" : "#22c55e",
          }}
        >
          {photos.length}
        </span>
      </div>

      {photos.length === 0 ? (
        <p className="mt-2 text-[10px]" style={{ color: "var(--franchize-text-secondary, #999)" }}>
          Нет фото
        </p>
      ) : (
        <div className={`mt-2 grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-1.5`}>
          {photos.map((photo) => (
            <button
              key={photo.photoId}
              type="button"
              onClick={() => onPhotoClick(photo)}
              className="relative aspect-square overflow-hidden rounded-md border"
              style={{ borderColor: "var(--franchize-border-soft, #333)" }}
              title={`${formatDate(photo.takenAt)} · ${formatSize(photo.fileSizeBytes)} · ${photo.uploaderRole}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl}
                alt={`${label} ${formatDate(photo.takenAt)}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {canUpload && !compact && (
        <>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = ""; // reset so same file can be re-selected
            }}
          />
          <label
            htmlFor={fileInputId}
            className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-xs font-medium transition hover:opacity-80"
            style={{
              borderColor: "var(--franchize-border-soft, #555)",
              color: uploading ? "var(--franchize-text-secondary, #999)" : "var(--franchize-text-primary, #fff)",
              opacity: uploading ? 0.5 : 1,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Загрузка…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Добавить фото
              </>
            )}
          </label>
        </>
      )}
    </div>
  );
}
