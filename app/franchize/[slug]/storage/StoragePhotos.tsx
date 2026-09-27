"use client";

// /app/franchize/[slug]/storage/StoragePhotos.tsx
// 2026-09-27 — shared фотофиксация pieces for the storage wall + story.
//
// Pipeline is the community-wall composer's, retargeted at storage bikes:
//   1. useStoragePhotoUpload — client compress (lib/client-image-compress,
//      1280px / q0.70) → POST /api/franchize/storage-photo-upload (sharp on
//      the server, ≤ 300 KB, storagepix bucket, bikes/<bikeId>/<32hex>.jpg).
//   2. StoragePhotoStrip — editable thumbnail row (remove / uploading state).
//   3. StorageEventPhotoGrid — read-only thumbnails for timeline events
//      (tap opens the full-size public URL in a new tab — TG WebView safe).
//
// The server action re-validates every path against THIS bike's folder
// (sanitizeStoragePhotoPaths), so the client can only reference what the
// identity-checked route actually stored.

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { reduceImageResolution } from "@/lib/client-image-compress";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { STORAGE_PHOTOS_MAX, storagePhotoPublicUrl } from "@/app/franchize/lib/storage";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";

export interface StoragePhotoDraft {
  /** Stable per-draft id — keys survive the preview swap mid-upload. */
  id: string;
  previewUrl: string;
  /** storagepix path once the upload route accepted the file (null while in flight). */
  path: string | null;
  uploading: boolean;
}

type CrewTokens = ReturnType<typeof useCrewTokens>;

interface UploadJson {
  success?: boolean;
  path?: string;
  width?: number;
  height?: number;
  bytes?: number;
  error?: string;
}

export function useStoragePhotoUpload(slug: string, bikeId: string) {
  const [photos, setPhotos] = useState<StoragePhotoDraft[]>([]);
  const photosRef = useRef<StoragePhotoDraft[]>([]);
  const draftSeq = useRef(0);
  const setSync = useCallback((next: StoragePhotoDraft[]) => {
    photosRef.current = next;
    setPhotos(next);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = [...files].filter((f) => f.type.startsWith("image/"));
      if (incoming.length === 0) return;

      const slotsLeft = STORAGE_PHOTOS_MAX - photosRef.current.length;
      if (slotsLeft <= 0) {
        throw new Error(`Максимум ${STORAGE_PHOTOS_MAX} фото на событие.`);
      }
      const accepted = incoming.slice(0, slotsLeft);
      // Wall-composer parity: over-cap selections are announced, not silently
      // dropped (boss review R3 nit).
      if (incoming.length > accepted.length) {
        toast.warning(`Максимум ${STORAGE_PHOTOS_MAX} фото на событие — лишние отброшены.`);
      }

      // Parallel uploads (per-file placeholder keeps object identity for the
      // state updates; the ref-based cap above makes the race safe).
      const uploadOne = async (file: File) => {
        draftSeq.current += 1;
        const placeholder: StoragePhotoDraft = {
          id: `draft-${draftSeq.current}`,
          previewUrl: URL.createObjectURL(file),
          path: null,
          uploading: true,
        };
        setSync([...photosRef.current, placeholder]);

        try {
          // 1. Client-side compression — the wall composer's recipe.
          const blob = await reduceImageResolution(file, { maxSize: 1280, quality: 0.7 });
          const compressedFile = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
          // swap the preview to the compressed variant (revoke the original
          // blob — a 10–25 MB source must not stay retained in the session)
          URL.revokeObjectURL(placeholder.previewUrl);
          placeholder.previewUrl = URL.createObjectURL(compressedFile);

          // 2. Upload into the bike's folder via the storage-photo-upload route.
          const form = new FormData();
          form.set("file", compressedFile);
          form.set("slug", slug);
          form.set("bikeId", bikeId);
          const initData = getTelegramInitData();
          if (initData) form.set("initData", initData);
          const res = await fetch("/api/franchize/storage-photo-upload", { method: "POST", body: form });
          const json = (await res.json().catch(() => null)) as UploadJson | null;
          if (!res.ok || !json?.success || !json.path) {
            throw new Error(json?.error || "Не удалось загрузить фото.");
          }

          setSync(
            photosRef.current.map((p) =>
              p === placeholder ? { ...placeholder, path: json.path!, uploading: false } : p,
            ),
          );
        } catch (err) {
          // Failed drafts self-remove: they must never block the 6-photo cap
          // and the toast carries the reason (boss review R1 finding #9).
          URL.revokeObjectURL(placeholder.previewUrl);
          setSync(photosRef.current.filter((p) => p !== placeholder));
          throw err instanceof Error ? err : new Error("Не удалось загрузить фото.");
        }
      };

      await Promise.all(accepted.map((file) => uploadOne(file)));
    },
    [slug, bikeId, setSync],
  );

  const removePhoto = useCallback(
    (target: StoragePhotoDraft) => {
      URL.revokeObjectURL(target.previewUrl);
      setSync(photosRef.current.filter((p) => p !== target));
    },
    [setSync],
  );

  const reset = useCallback(() => {
    for (const p of photosRef.current) URL.revokeObjectURL(p.previewUrl);
    setSync([]);
  }, [setSync]);

  /** Storagepix paths of the finished uploads (used as the action payload). */
  const paths = photos.flatMap((p) => (p.path ? [p.path] : []));
  const hasPending = photos.some((p) => p.uploading);

  return { photos, addFiles, removePhoto, reset, paths, hasPending };
}

/** Editable thumbnail row for the composer panels (accept/return/photo). */
export function StoragePhotoStrip({
  photos,
  onRemove,
  onAdd,
  T,
}: {
  photos: StoragePhotoDraft[];
  onRemove: (photo: StoragePhotoDraft) => void;
  onAdd: () => void;
  T: CrewTokens;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="relative h-14 w-14 overflow-hidden rounded-lg border" style={{ borderColor: T.borderSoft }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt="Фото" className="h-full w-full object-cover" />
          {photo.uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden="true" />
            </div>
          ) : null}
          {!photo.uploading ? (
            <button
              type="button"
              onClick={() => onRemove(photo)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition active:scale-90"
              aria-label="Убрать фото"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
      {photos.length < STORAGE_PHOTOS_MAX ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-dashed text-[10px] font-semibold transition active:scale-95"
          style={{ borderColor: T.borderSoft, color: T.textMuted }}
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {photos.length === 0 ? "Фото" : `${photos.length}/${STORAGE_PHOTOS_MAX}`}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Read-only thumbnails for a timeline event (tap → full size in a new tab).
 * Takes raw storagepix PATHS (builds public URLs itself); when `onDelete` is
 * provided a small ✕ appears per thumb — staff/owner photo management
 * (boss review R1 finding #3: otherwise storagepix could never free quota).
 */
export function StorageEventPhotoGrid({
  paths,
  T,
  size = 56,
  onDelete,
}: {
  paths: string[];
  T: CrewTokens;
  /** Thumbnail side in px — wall uses a smaller grid than the story. */
  size?: number;
  /** Present → deletable: ✕ overlay, confirm handled by the caller. */
  onDelete?: (photoPath: string) => void;
}) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {paths.map((path, i) => {
        const url = storagePhotoPublicUrl(path);
        if (!url) return null;
        return (
          <div key={path} className="relative" style={{ width: size, height: size }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full w-full overflow-hidden rounded-lg border transition active:scale-[0.97]"
              style={{ borderColor: T.borderSoft }}
              aria-label={`Фото ${i + 1} — открыть`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Фотофиксация ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </a>
            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(path)}
                className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-black/70 text-white transition active:scale-90"
                style={{ width: 18, height: 18 }}
                aria-label={`Фото ${i + 1} — удалить`}
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
