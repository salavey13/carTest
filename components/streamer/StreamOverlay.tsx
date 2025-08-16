"use client";
import React from "react";

export type SectionType = "image" | "video" | "text";

export interface StreamSection {
  id: string;
  title: string;
  type: SectionType;
  mediaUrl?: string; // для image / video
  text?: string; // для text
  durationSec?: number;
  greenScreen?: boolean; // если true — специальный зелёный фон (для хрома)
  showDecorations?: boolean; // рамки/логотипы
  overlayOpacity?: number; // 0..1
}

export interface StreamConfig {
  id?: string;
  slug?: string;
  title: string;
  description?: string;
  startAt?: string | null;
  endAt?: string | null;
  sections: StreamSection[];
  lastUpdated?: number;
}

export default function StreamOverlay({
  config,
  activeIndex = 0,
  visible = true,
  mode = "public", // 'public' | 'admin'
  onClose,
}: {
  config: StreamConfig | null;
  activeIndex?: number;
  visible?: boolean;
  mode?: "public" | "admin";
  onClose?: () => void;
}) {
  if (!config || !visible) return null;
  const section = config.sections?.[activeIndex] ?? null;

  return (
    <div
      aria-hidden={mode === "admin" ? "false" : "true"}
      className={`fixed inset-0 z-[9999] flex items-center justify-center ${mode === "public" ? "pointer-events-none" : "pointer-events-auto"}`}
    >
      {/* If green screen — render full-green background (for chroma key). Otherwise background image/video/text */}
      {section ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              section.greenScreen
                ? "#00ff00" // obvious green for chroma-key
                : section.type === "image" && section.mediaUrl
                ? `center / cover no-repeat url(${section.mediaUrl})`
                : section.type === "video"
                ? "black"
                : "linear-gradient(180deg,#05050a,#0b1220)",
            transition: "all 300ms ease",
            opacity: section.overlayOpacity ?? 1,
          }}
        >
          {section.type === "video" && section.mediaUrl && !section.greenScreen && (
            // autoplay loop muted for background video
            // NOTE: playsInline + muted for autoplay on mobile
            // pointer-events none to allow OBS window capture without interactions
            <video
              src={section.mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}

          {/* Text overlay */}
          {section.type === "text" && (
            <div className="max-w-4xl px-6 text-center">
              <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
                <h2 className="text-4xl md:text-6xl font-bold text-white">{section.title}</h2>
                <p className="mt-3 text-lg md:text-2xl text-white/90 whitespace-pre-line">{section.text}</p>
              </div>
            </div>
          )}

          {/* If image and not greenScreen we render the image element (for mobile lazy loading & better scaling) */}
          {section.type === "image" && section.mediaUrl && !section.greenScreen && (
            <img src={section.mediaUrl} alt={section.title} className="w-full h-full object-cover" />
          )}

          {/* Admin overlay chrome */}
          {mode === "admin" && (
            <div className="absolute top-4 right-4 flex gap-2 z-50">
              <button
                onClick={onClose}
                className="px-3 py-2 bg-black/60 text-white rounded-md text-sm hover:bg-black/80"
              >
                Закрыть превью
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-4 bg-black/50 rounded-md text-white">Нет секций для отображения</div>
        </div>
      )}

      {/* Optional small footer: title */}
      <div className="absolute bottom-6 left-6 z-50 pointer-events-none">
        <div className="bg-black/40 px-3 py-1 rounded text-xs text-white">
          {config.title} — секция {activeIndex + 1}/{config.sections.length}
        </div>
      </div>
    </div>
  );
}