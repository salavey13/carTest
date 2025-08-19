"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import StreamOverlay, { StreamConfig } from "@/components/streamer/StreamOverlay";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Robust overlay page:
 * - loads streamer row from public.users by user_id (streamerId)
 * - reads metadata.streamConfig (accepts object or JSON string)
 * - validates presence of sections[]
 * - auto-advances sections safely (no crash on empty)
 * - exposes useful console logs for debugging in OBS Inspector
 */

export default function OverlayPage() {
  const params = useParams();
  const streamerId = (params?.streamerId ?? "") as string;
  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const supabase = useRef(getSupabaseBrowserClient());

  // Helper: try to parse possible stringified JSON
  function tryParseStreamConfig(raw: any): StreamConfig | null {
    if (!raw) return null;
    if (typeof raw === "object") {
      if (Array.isArray((raw as any).sections)) return raw as StreamConfig;
      return null;
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sections)) return parsed as StreamConfig;
      } catch (e) {
        console.warn("streamConfig JSON parse failed", e);
        return null;
      }
    }
    return null;
  }

  useEffect(() => {
    if (!streamerId) {
      setError("streamerId not provided in URL");
      setLoading(false);
      console.error("[overlay] no streamerId in params");
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setConfig(null);

    (async () => {
      try {
        const sb = supabase.current;
        // Query public.users by user_id
        const { data, error: sbError } = await sb
          .from("users")
          .select("user_id, username, avatar_url, metadata")
          .eq("user_id", streamerId)
          .maybeSingle();

        if (sbError) {
          console.error("[overlay] supabase error fetching user", sbError);
          if (!mounted) return;
          setError("Supabase error: " + sbError.message);
          setLoading(false);
          return;
        }

        if (!data) {
          console.warn("[overlay] user not found:", streamerId);
          if (!mounted) return;
          setError("User not found: " + streamerId);
          setLoading(false);
          return;
        }

        // Try common metadata keys for stream config
        const meta = data.metadata ?? {};
        const candidates = [
          meta.streamConfig,
          meta.streamSpecs,
          meta.stream_config,
          meta.streams?.[0]?.config, // fallback if stored under streams array
        ];

        let found: StreamConfig | null = null;
        for (const c of candidates) {
          const parsed = tryParseStreamConfig(c);
          if (parsed) {
            found = parsed;
            break;
          }
        }

        // If nothing found, maybe metadata itself is a stringified streamConfig
        if (!found) {
          const parsedMeta = tryParseStreamConfig(meta);
          if (parsedMeta) found = parsedMeta;
        }

        if (!found) {
          console.warn("[overlay] streamConfig not present or invalid in public.users.metadata for", streamerId, "metadata:", meta);
          if (!mounted) return;
          setError("No valid streamConfig found in user metadata (public.users.metadata.streamConfig).");
          setLoading(false);
          return;
        }

        // sanity: ensure sections is array
        if (!Array.isArray(found.sections) || found.sections.length === 0) {
          console.warn("[overlay] streamConfig.sections empty or invalid", found);
          if (!mounted) {
            setLoading(false);
            return;
          }
          setError("streamConfig has no sections (empty).");
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setConfig(found);
        setActiveIndex(0);
        setLoading(false);
        console.info("[overlay] loaded streamConfig for", streamerId, found);
      } catch (e: any) {
        console.error("[overlay] unexpected error", e);
        if (!mounted) return;
        setError(String(e?.message ?? e));
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [streamerId]);

  // Auto-advance timer (safe)
  useEffect(() => {
    if (!config || !playing) return;
    if (!Array.isArray(config.sections) || config.sections.length === 0) return;

    const curr = config.sections[activeIndex] ?? null;
    const durationMs = Math.max(1000, (curr?.durationSec ?? 8) * 1000);
    const timer = window.setTimeout(() => {
      // advance only if still playing and config unchanged
      setActiveIndex((prev) => {
        if (!config || !Array.isArray(config.sections) || config.sections.length === 0) return 0;
        return (prev + 1) % config.sections.length;
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [activeIndex, config, playing]);

  // Render fallbacks on green background (for OBS chroma)
  if (loading) {
    return (
      <div className="fixed inset-0 bg-green-500 flex items-center justify-center text-white">
        <div>
          <div className="text-2xl font-bold">Loading config...</div>
          <div className="text-sm mt-2 opacity-80">Загружаю public.users → metadata.streamConfig</div>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="fixed inset-0 bg-green-500 flex items-center justify-center text-white p-6">
        <div className="max-w-xl text-center">
          <h2 className="text-2xl font-bold mb-2">Ошибка загрузки оверлея</h2>
          <p className="mb-4">{error ?? "stream config not available."}</p>
          <details className="text-left text-xs opacity-90 bg-black/20 p-3 rounded">
            <summary className="cursor-pointer">Что проверить (нажми)</summary>
            <ul className="mt-2 list-inside list-disc">
              <li>В таблице <code>public.users</code> найдите пользователя с <code>user_id = {streamerId}</code>.</li>
              <li>Проверьте поле <code>metadata.streamConfig</code> — оно должно быть объектом или JSON-строкой с массивом <code>sections</code>.</li>
              <li>Каждая секция должна содержать хотя бы <code>type</code> и <code>durationSec</code> (рекомендуется).</li>
              <li>Откройте консоль (OBS → Inspect) для подробных логов.</li>
            </ul>
          </details>
        </div>
      </div>
    );
  }

  // All good -> render overlay (public mode, forced green screen)
  return (
    <div className="fixed inset-0 bg-green-500"> {/* Green background for OBS chroma key */}
      <StreamOverlay
        config={config}
        activeIndex={activeIndex}
        visible={true}
        mode="public"
        forceGreenScreen={true}
      />

      {/* Small invisible debug panel (only for inspect console visibility) */}
      <div style={{ position: "fixed", right: 8, bottom: 8, pointerEvents: "none", opacity: 0.0001 }}>
        <pre>{JSON.stringify({ streamerId, activeIndex, sections: config.sections.length }, null, 2)}</pre>
      </div>
    </div>
  );
}