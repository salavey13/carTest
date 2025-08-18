"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StreamOverlay, { StreamConfig } from "@/components/streamer/StreamOverlay";

export default function OverlayPage() {
  const params = useParams();
  const streamerId = params.streamerId as string;
  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!streamerId) return;
    fetch(`/api/streamer/profile?streamerId=${streamerId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setConfig(j.data.metadata?.streamConfig || null);
        }
      })
      .catch((e) => console.error("Failed to load stream config", e));
  }, [streamerId]);

  useEffect(() => {
    if (!config || !playing) return;
    const curr = config.sections[activeIndex];
    const duration = (curr?.durationSec ?? 8) * 1000;
    const timer = setTimeout(() => {
      const next = (activeIndex + 1) % config.sections.length;
      setActiveIndex(next);
    }, duration);
    return () => clearTimeout(timer);
  }, [activeIndex, config, playing]);

  if (!config) return <div className="fixed inset-0 bg-green-500 flex items-center justify-center text-white">Loading config...</div>;

  return (
    <div className="fixed inset-0 bg-green-500"> {/* Green background for OBS chroma key */}
      <StreamOverlay
        config={config}
        activeIndex={activeIndex}
        visible={true}
        mode="public"
        forceGreenScreen={true}
      />
    </div>
  );
}