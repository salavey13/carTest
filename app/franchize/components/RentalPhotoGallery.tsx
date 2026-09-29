// /app/franchize/components/RentalPhotoGallery.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X, Upload, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reduceImageResolution } from "@/lib/client-image-compress";
import { usePhotoZoomGestures } from "@/hooks/usePhotoZoomGestures";

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
  // FIX (2026-08-29, "photos don't appear"): the old fetch path swallowed
  // EVERY failure silently (401 expired session, network error, non-JSON
  // response) — the gallery just looked empty forever while the upload toast
  // had already said "Фото ДО добавлено". Now a failed fetch shows an explicit
  // error row with a retry button instead of a phantom-empty gallery.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<"start" | "end" | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxList, setLightboxList] = useState<Photo[]>([]);
  // ROBUSTNESS FIX (2026-09-19, "sometimes uploaded photos don't show up"):
  // signed URLs live 15 minutes. The gallery fetched ONCE on mount — a page
  // kept open in the Telegram WebView rendered expired URLs afterwards
  // (broken thumbnails), and any transient object error silently dropped
  // that photo from the list (badge said N, thumbnails showed fewer).
  // Now: <img> errors trigger ONE silent re-fetch (fresh signed URLs), the
  // page re-fetches on visibilitychange after a long idle, photos whose
  // signed URL is missing are counted in hiddenCount and surfaced, and a
  // still-broken thumbnail shows an explicit placeholder instead of a
  // silent blank.
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const [hiddenCount, setHiddenCount] = useState(0);
  const lastFetchedAtRef = useRef<number>(0);
  const silentRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSilentRefreshAtRef = useRef<number>(0);

  const loadPhotos = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const resp = await fetch(
        `/api/franchize/rental-photos?rentalId=${rentalId}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          const all: Photo[] = data.photos || [];
          // CR fix: filter out photos with empty signedUrl (broken storage objects)
          const photos: Photo[] = all.filter((p: Photo) => p.signedUrl);
          setHiddenCount(all.length - photos.length);
          setStartPhotos(photos.filter((p) => p.photoType === "start"));
          setEndPhotos(photos.filter((p) => p.photoType === "end"));
          // Fresh signed URLs — previous load failures are resolved
          setBrokenIds(new Set());
          lastFetchedAtRef.current = Date.now();
        } else {
          if (!silent) setLoadError(String(data.error || "Не удалось загрузить фото."));
        }
      } else if (resp.status === 401) {
        // Session expired — tell the user instead of a silent empty gallery
        if (!silent) setLoadError("Сессия истекла — откройте приложение заново, чтобы увидеть фото.");
      } else {
        if (!silent) setLoadError(`Не удалось загрузить фото (код ${resp.status}).`);
      }
    } catch {
      if (!silent) setLoadError("Сеть недоступна — фото не загрузились.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [rentalId]);

  /** One-shot silent re-fetch with a cooldown — used by <img> onError handlers
   *  (expired/broken signed URL). Silent: no spinner, no error row. */
  const scheduleSilentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshAtRef.current < 10_000) return; // cooldown 10s
    if (silentRefreshTimerRef.current) clearTimeout(silentRefreshTimerRef.current);
    lastSilentRefreshAtRef.current = now;
    silentRefreshTimerRef.current = setTimeout(() => {
      silentRefreshTimerRef.current = null;
      void loadPhotos({ silent: true });
    }, 1500);
  }, [loadPhotos]);

  const markPhotoBroken = useCallback((photoId: string) => {
    setBrokenIds((prev) => {
      if (prev.has(photoId)) return prev;
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
    scheduleSilentRefresh();
  }, [scheduleSilentRefresh]);

  // Re-fetch fresh signed URLs when the page becomes visible after a long
  // idle (Telegram WebView keeps the WebView alive; signed URLs expire in
  // 15 min — by the time the operator switches back they are dead).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchedAtRef.current < 10 * 60 * 1000) return;
      void loadPhotos({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadPhotos]);

  // Clear the pending silent-refresh timer on unmount
  useEffect(() => {
    return () => {
      if (silentRefreshTimerRef.current) clearTimeout(silentRefreshTimerRef.current);
    };
  }, []);

  // Always fetch photos on mount. Previously skipped when both initial counts
  // were 0 — but that caused photos to not display on page load (only showed
  // after the user uploaded a new photo, which triggered loadPhotos). The API
  // call is cheap (one indexed query) and counter columns can drift, so always
  // fetch from the source of truth.
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Keyboard navigation moved INTO RentalPhotoLightbox (hook-based engine):
  // the old duplicate parent-level listener would make every ←/→ skip 2 photos.

  // I4 enhancement: batch upload state — track progress across multiple files
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  const handleUpload = async (photoType: "start" | "end", file: File) => {
    // Single-file upload (wrapper around handleBatchUpload for backward compat)
    await handleBatchUpload(photoType, [file]);
  };

  // I4 enhancement: batch upload — compress + upload multiple files sequentially.
  // Sequential (not parallel) to avoid hammering the server + keep progress accurate.
  // Each file: client compress → POST → toast. At end: refresh photo list + summary toast.
  const handleBatchUpload = async (photoType: "start" | "end", files: File[]) => {
    if (files.length === 0) return;

    setUploadingType(photoType);
    setBatchProgress({ current: 0, total: files.length, fileName: files[0].name });

    let successCount = 0;
    let dedupCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ current: i + 1, total: files.length, fileName: file.name });

      try {
        // 1. Client-side compress (1400px, q70 — I4 enhancement: lowered from 1600/0.80)
        const compressedBlob = await reduceImageResolution(file);
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });

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
          errorCount++;
          errors.push(`${file.name}: ${result.error || "ошибка"}`);
        } else if (result.deduped) {
          dedupCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        errorCount++;
        errors.push(`${file.name}: ${err?.message || "ошибка"}`);
      }
    }

    // Summary toast
    if (files.length === 1) {
      // Single file — keep the original simple toast
      if (successCount === 1) {
        toast.success(photoType === "start" ? "Фото ДО добавлено." : "Фото ПОСЛЕ добавлено.");
      } else if (dedupCount === 1) {
        toast.info("Это фото уже было загружено ранее — дубликат не создан.");
      } else if (errorCount === 1) {
        toast.error(errors[0] || "Не удалось загрузить фото.");
      }
    } else {
      // Batch — show summary
      const parts: string[] = [];
      if (successCount > 0) parts.push(`✅ ${successCount} загружено`);
      if (dedupCount > 0) parts.push(`ℹ️ ${dedupCount} дубликатов пропущено`);
      if (errorCount > 0) parts.push(`❌ ${errorCount} с ошибкой`);
      toast.success(`Готово: ${parts.join(", ")}`, {
        description: errorCount > 0 ? errors.slice(0, 3).join("\n") : undefined,
      });
    }

    // Refresh photo list
    await loadPhotos();
    setBatchProgress(null);
    setUploadingType(null);
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
      {/* FIX (2026-08-29): explicit fetch-failure state with retry — a silent
          empty gallery right after a successful upload toast was reported as
          "photos don't appear". */}
      {loadError && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs"
          role="alert"
        >
          <span className="flex min-w-0 items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span className="min-w-0 truncate" style={{ color: "var(--franchize-text-secondary, #ccc)" }}>{loadError}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadPhotos()}
            className="shrink-0 rounded-md border border-rose-400/40 px-2 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/10"
          >
            Повторить
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {/* ДО column */}
        <PhotoColumn
          label="Фото ДО"
          icon="📸"
          photoType="start"
          photos={startPhotos}
          // FIX (2026-08-29): server-side counter (rentals.start_photo_count)
          // keeps the badge honest while the client list is loading or failed.
          fallbackCount={initialStartCount}
          canUpload={canUpload}
          uploading={uploadingType === "start"}
          onUpload={(files) => handleBatchUpload("start", files)}
          batchProgress={uploadingType === "start" ? batchProgress : null}
          onPhotoClick={(p) => openLightbox(p, startPhotos)}
          brokenIds={brokenIds}
          onImgError={markPhotoBroken}
          onManualRefresh={() => void loadPhotos()}
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
          fallbackCount={initialEndCount}
          canUpload={canUpload}
          uploading={uploadingType === "end"}
          onUpload={(files) => handleBatchUpload("end", files)}
          batchProgress={uploadingType === "end" ? batchProgress : null}
          onPhotoClick={(p) => openLightbox(p, endPhotos)}
          brokenIds={brokenIds}
          onImgError={markPhotoBroken}
          onManualRefresh={() => void loadPhotos()}
          formatSize={formatSize}
          formatDate={formatDate}
          compact={compact}
        />
      </div>

      {/* ROBUSTNESS FIX (2026-09-19): surface photos that exist in the DB but
          whose signed URL could not be produced (missing storage object).
          Previously they were silently filtered out — the badge said N while
          fewer thumbnails rendered, reading as "uploaded photos don't show up". */}
      {!compact && hiddenCount > 0 && (
        <div
          className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs"
          role="status"
        >
          <span style={{ color: "var(--franchize-text-secondary, #999)" }}>
            {hiddenCount} фото не отобразилось (повреждён файл в хранилище).
          </span>
          <button
            type="button"
            onClick={() => void loadPhotos()}
            className="shrink-0 rounded-md border border-amber-400/40 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/10"
          >
            Обновить
          </button>
        </div>
      )}

      {/* Soft warning when both are empty (v1: non-blocking).
          I3 hotfix (M4): hidden in compact mode — analytics drawer can't act on it.
          FIX (2026-08-29): also hidden while a fetch error is shown above. */}
      {!compact && !loadError && startPhotos.length === 0 && endPhotos.length === 0 && (
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

      {/* Lightbox — единый жестовый движок (usePhotoZoomGestures):
          щипок/двойной тап — зум, свайп ← → — навигация, тап мимо фото —
          закрытие, кнопка закрытия ПО ЦЕНТРУ сверху (углы в Telegram заняты
          нативными кнопками WebView), иконки-стрелки вместо текстовых «←→».
          BOSS 2026-09-29: зум теперь есть и у фото ДО/ПОСЛЕ. */}
      {lightboxPhoto && (
        <RentalPhotoLightbox
          photo={lightboxPhoto}
          list={lightboxList}
          index={lightboxIndex}
          onClose={() => setLightboxPhoto(null)}
          onIndexChange={(next) => {
            setLightboxIndex(next);
            setLightboxPhoto(lightboxList[next]);
          }}
          onBroken={markPhotoBroken}
          formatDate={formatDate}
          formatSize={formatSize}
        />
      )}
    </div>
  );
}

// ─── Fullscreen lightbox (ДО/ПОСЛЕ) — hook-based gestures ──────────────────

interface RentalPhotoLightboxProps {
  photo: Photo;
  list: Photo[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
  /** Signed URL expired while open → one silent re-fetch for that photo id. */
  onBroken: (photoId: string) => void;
  formatDate: (iso: string) => string;
  formatSize: (bytes: number) => string;
}

function RentalPhotoLightbox({ photo, list, index, onClose, onIndexChange, onBroken, formatDate, formatSize }: RentalPhotoLightboxProps) {
  const {
    scale,
    offset,
    smooth,
    stageRef,
    imgRef,
    go,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    canPrev,
    canNext,
  } = usePhotoZoomGestures({
    count: list.length,
    index,
    onIndexChange,
    onClose,
    closeOnTapOutside: true,
  });

  // Keyboard navigation (←/→/Esc) — как и раньше, поверх жестового движка.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, go]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      style={{ touchAction: "none" }}
    >
      {/* top bar: счётчик слева + ЗАКРЫТИЕ ПО ЦЕНТРУ (не конфликтует с
          нативными кнопками Telegram в углах WebView) */}
      <div className="relative flex items-center justify-center px-4 py-3 text-white">
        <span className="absolute left-4 rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums text-white/80 backdrop-blur">
          {index + 1} / {list.length}
        </span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
        <span aria-hidden className="absolute right-4 h-11 w-11" />
      </div>

      {/* image stage: жесты — на весь экран (щипок ловится и по полям) */}
      <div ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 flex items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: smooth ? "transform 200ms ease-out" : "none",
            willChange: "transform",
            touchAction: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={photo.signedUrl}
            alt={`Фото ${photo.photoType === "start" ? "ДО" : "ПОСЛЕ"}`}
            draggable={false}
            className="max-h-[80vh] max-w-[92vw] select-none rounded-lg object-contain"
            onError={() => {
              // Signed URL expired while the lightbox was open → one silent re-fetch
              onBroken(photo.photoId);
            }}
          />
        </div>

        {/* improved arrows: иконки, крупная цель 44px, стеклянная подложка,
            видны на всех экранах (свайп ← → остаётся) */}
        {canPrev && (
          <button
            type="button"
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Предыдущее"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {canNext && (
          <button
            type="button"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Следующее"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* metadata overlay (та же строка, что была) */}
      <div className="flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="rounded-lg bg-black/60 px-4 py-2 text-xs text-white">
          <span className="font-semibold">
            {photo.photoType === "start" ? "ДО" : "ПОСЛЕ"}
          </span>{" "}
          · {formatDate(photo.takenAt)} · {formatSize(photo.fileSizeBytes)} ·{" "}
          <span className="opacity-70">
            {photo.uploaderRole} via {photo.source}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: one column (ДО or ПОСЛЕ) ──────────────────────────────────────

interface PhotoColumnProps {
  label: string;
  icon: string;
  photoType: "start" | "end";
  photos: Photo[];
  /** Server-side counter (rentals.start/end_photo_count) shown while the
   * signed list hasn't loaded — keeps the badge honest during load/fail. */
  fallbackCount?: number;
  canUpload: boolean;
  uploading: boolean;
  // I4 enhancement: batch upload — onUpload now receives an array of files
  onUpload: (files: File[]) => void;
  // I4 enhancement: batch progress display
  batchProgress: { current: number; total: number; fileName: string } | null;
  onPhotoClick: (photo: Photo) => void;
  /** ROBUSTNESS 2026-09-19: photo ids whose image failed to load
   *  (expired signed URL / missing object). */
  brokenIds: Set<string>;
  /** Called on <img> error — marks broken + schedules one silent re-fetch. */
  onImgError: (photoId: string) => void;
  /** Manual "Обновить" for still-broken thumbnails. */
  onManualRefresh: () => void;
  formatSize: (bytes: number) => string;
  formatDate: (iso: string) => string;
  compact: boolean;
}

function PhotoColumn({
  label,
  icon,
  photos,
  fallbackCount = 0,
  canUpload,
  uploading,
  onUpload,
  batchProgress,
  onPhotoClick,
  brokenIds,
  onImgError,
  onManualRefresh,
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
              photos.length === 0 && fallbackCount === 0
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(34, 197, 94, 0.15)",
            color: photos.length === 0 && fallbackCount === 0 ? "#f59e0b" : "#22c55e",
          }}
        >
          {photos.length > 0 ? photos.length : fallbackCount}
        </span>
      </div>

      {photos.length === 0 ? (
        fallbackCount > 0 ? (
          <p className="mt-2 text-[10px]" style={{ color: "var(--franchize-text-secondary, #999)" }}>
            {fallbackCount} фото — обновите, чтобы показать
          </p>
        ) : (
          <p className="mt-2 text-[10px]" style={{ color: "var(--franchize-text-secondary, #999)" }}>
            Нет фото
          </p>
        )
      ) : (
        <div className={`mt-2 grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-1.5`}>
          {photos.map((photo) => {
            const isBroken = brokenIds.has(photo.photoId);
            return (
              <button
                key={photo.photoId}
                type="button"
                onClick={() => onPhotoClick(photo)}
                className="relative aspect-square overflow-hidden rounded-md border"
                style={{ borderColor: "var(--franchize-border-soft, #333)" }}
                title={`${formatDate(photo.takenAt)} · ${formatSize(photo.fileSizeBytes)} · ${photo.uploaderRole}`}
              >
                {isBroken ? (
                  // ROBUSTNESS 2026-09-19: explicit placeholder instead of a
                  // silent blank — after the auto re-fetch this thumbnail is
                  // either fixed or clearly marked, with a manual retry.
                  <span
                    className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black/30 p-1 text-center"
                    onClick={(e) => {
                      // Click on a broken thumb retries instead of opening the lightbox
                      e.stopPropagation();
                      onManualRefresh();
                    }}
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="text-[9px] leading-tight" style={{ color: "var(--franchize-text-secondary, #ccc)" }}>
                      не загрузилось — обновить
                    </span>
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo.signedUrl}
                    alt={`${label} ${formatDate(photo.takenAt)}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={() => {
                      // Expired signed URL (15-min TTL) or transient storage error →
                      // mark broken + one silent re-fetch with fresh URLs.
                      onImgError(photo.photoId);
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {canUpload && !compact && (
        <>
          {/* I4 enhancement: multiple — allows selecting multiple photos at once.
              Also raised accepted types to include HEIC (iPhone default). */}
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onUpload(files);
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
                {/* I4 enhancement: show batch progress if uploading multiple files */}
                {batchProgress && batchProgress.total > 1
                  ? `Загрузка ${batchProgress.current}/${batchProgress.total}…`
                  : "Загрузка…"}
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
