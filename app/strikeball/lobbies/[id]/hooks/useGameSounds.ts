"use client";

import { useCallback, useRef } from "react";

const BASE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/";

type SoundKey = 
  | "fire" 
  | "hit" 
  | "death" 
  | "melee" 
  | "humiliation" 
  | "startMatch" 
  | "medkit" 
  | "holyshit";

const soundMap: Record<SoundKey, string> = {
  fire:        "sshotf1b.mp3",
  hit:         "falling1.mp3",
  death:       "death3.mp3",
  melee:       "humiliation.mp3",
  humiliation: "holyshit.mp3",
  startMatch:  "fight.mp3",
  medkit:      "use_medkit.mp3",
  holyshit:    "holyshit.mp3",
};

export function useGameSounds() {
  const audioCache = useRef<Record<string, HTMLAudioElement>>({});

  const getAudio = useCallback((key: SoundKey) => {
    const filename = soundMap[key];
    if (!filename) return null;

    const url = `${BASE_URL}${filename}`;

    if (!audioCache.current[url]) {
      const audio = new Audio(url);
      audio.preload = "auto";
      audioCache.current[url] = audio;
    }

    return audioCache.current[url];
  }, []);

  const playSound = useCallback((key: SoundKey, volume = 0.8) => {
    const audio = getAudio(key);
    if (!audio) return;

    // Клонируем, чтобы можно было играть несколько раз подряд
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {});
  }, [getAudio]);

  // Специальные методы с вибрацией
  const fire = useCallback(() => {
    playSound("fire", 0.85);

    if (navigator.vibrate) {
      navigator.vibrate([100, 30, 100, 30, 300]); // burst pattern
    }
  }, [playSound]);

  const hit = useCallback(() => {
    playSound("hit", 1.0);
    // Более сильная вибрация для попадания
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [playSound]);

  const meleeAttack = useCallback(() => {
    playSound("melee", 0.9);
    if (navigator.vibrate) {
      navigator.vibrate([50, 20, 150, 20, 50]); // quick melee combo
    }
  }, [playSound]);

  const death = useCallback(() => {
    playSound("death", 1.0);
    if (navigator.vibrate) {
      navigator.vibrate([600]); // long vibration for death
    }
  }, [playSound]);

  const startMatch = useCallback(() => {
    playSound("startMatch", 0.7);
  }, [playSound]);

  return {
    playSound,
    fire,
    hit,
    meleeAttack,
    death,
    startMatch,
    // Дополнительные
    playMedkit: () => playSound("medkit", 0.75),
    playHolyShit: () => playSound("holyshit", 1.0),
    playHumiliation: () => playSound("humiliation", 0.95),
  };
}