// /components/streamer/StreamOverlay.tsx
"use client";
import React from "react";

export type SectionType = "image" | "video" | "text";

export interface StreamSection {
  id: string;
  title: string;
  type: SectionType;
  mediaUrl?: string;
  text?: string;
  durationSec?: number;
  greenScreen?: boolean;
  showDecorations?: boolean;
  overlayOpacity?: number;
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
  mode = "public",
  onClose,
  forceGreenScreen = false,
}: {
  config: StreamConfig | null;
  activeIndex?: number;
  visible?: boolean;
  mode?: "public" | "admin";
  onClose?: () => void;
  forceGreenScreen?: boolean;
}) {
  if (!config || !visible) return null;
  const section = config.sections?.[activeIndex] ?? null;

  return (
    <div
      aria-hidden={mode === "admin" ? "false" : "true"}
      className={`fixed inset-0 z-[9999] flex items-center justify-center ${
        mode === "public" ? "pointer-events-none" : "pointer-events-auto"
      }`}
    >
      {section ? (
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{
            background: forceGreenScreen || section.greenScreen
              ? "#00ff00"
              : section.type === "image" && section.mediaUrl
              ? `center / cover no-repeat url(${section.mediaUrl})`
              : section.type === "video"
              ? "black"
              : "linear-gradient(180deg,#05050a,#0b1220)",
            opacity: section.overlayOpacity ?? 1,
          }}
        >
          {section.type === "video" &&
            section.mediaUrl &&
            !section.greenScreen && (
              <video
                src={section.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.warn("Video load failed:", section.mediaUrl, e);
                  // Fallback UI
                  e.currentTarget.style.display = "none";
                }}
              />
            )}

          {section.type === "text" && (
            <div className="max-w-4xl px-6 text-center">
              <div className="bg-background/80 backdrop-blur-md rounded-2xl p-6 border border-border shadow-lg">
                <h2 className="text-4xl md:text-6xl font-orbitron font-bold text-foreground drop-shadow-lg">
                  {section.title}
                </h2>
                <p className="mt-4 text-lg md:text-2xl text-muted-foreground whitespace-pre-line"> 
                  {section.text}
                </p>
              </div>
            </div>
          )}

          {section.type === "image" &&
            section.mediaUrl &&
            !section.greenScreen && (
              <img
                src={section.mediaUrl}
                alt={section.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.warn("Image load failed:", section.mediaUrl, e);
                  e.currentTarget.style.display = "none";
                }}
              />
            )}

          {mode === "admin" && (
            <div className="absolute top-4 right-4 flex gap-2 z-50">
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 transition"
              >
                Закрыть превью
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="p-4 bg-card border border-border rounded-md text-muted-foreground shadow">
            Нет секций для отображения
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 z-50 pointer-events-none">
        <div className="bg-background/80 backdrop-blur-sm px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground">
          {config.title} — секция {activeIndex + 1}/{config.sections.length}
        </div>
      </div>
    </div>
  );
}