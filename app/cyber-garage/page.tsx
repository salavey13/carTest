// /app/cyber-garage/page.tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Car, Music, Paintbrush, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function CyberGarage() {
  const [selectedMod, setSelectedMod] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const mods = [
    { id: "neon", name: "Неоновая подсветка", icon: <Sparkles className="h-6 w-6" />, color: "from-primary to-secondary" },
    { id: "paint", name: "Кибер-краска", icon: <Paintbrush className="h-6 w-6" />, color: "from-accent to-primary" },
    { id: "audio", name: "Кухонный Кодер", icon: <Music className="h-6 w-6" />, color: "from-muted to-secondary" },
  ];

  const handleModSelect = (modId: string) => {
    setSelectedMod(modId);
    if (modId === "audio") {
      setIsMusicPlaying(true);
      toast.success("Запускаю бит 'Кухонный Кодер' — держись, братан!");
    } else {
      toast.success(`Тюнинг ${mods.find(m => m.id === modId)?.name} активирован!`);
    }
  };

  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-6 z-10 border-b border-muted">
        <h1 className="text-4xl font-bold text-gradient cyber-text glitch" data-text="КИБЕР-ГАРАЖ">
          КИБЕР-ГАРАЖ
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
        >
          <h2 className="text-3xl font-semibold text-primary mb-8 cyber-text glitch text-center" data-text="ТЮНИНГ ЖЕЛЕЗА">
            ТЮНИНГ ЖЕЛЕЗА
          </h2>
          <p className="text-lg text-muted-foreground font-mono mb-10 text-center">
            Добро пожаловать в секретный ангар! Тюнингуй тачку, как настоящий кибер-повар — неон, краска или наш трек!
          </p>

          {/* Car Display */}
          <div className="relative h-96 w-full mb-12 rounded-xl overflow-hidden border border-muted shadow-[0_0_25px_rgba(255,107,107,0.5)]">
            <Image
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/salavey13-15-05-2024-0001.jpg" // Placeholder—replace with a real cyberpunk car image!
              alt="Кибер-bike"
              fill
              className="object-cover animate-[pulse_5s_infinite]"
              style={{ filter: selectedMod === "neon" ? "brightness(1.2) hue-rotate(15deg)" : selectedMod === "paint" ? "contrast(1.3) saturate(1.5)" : "none" }}
            />
            {selectedMod === "neon" && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/50 animate-[neon_2s_infinite]" />
            )}
          </div>

          {/* Mod Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {mods.map((mod) => (
              <motion.button
                key={mod.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleModSelect(mod.id)}
                className={`bg-gradient-to-r ${mod.color} p-6 rounded-xl flex flex-col items-center gap-4 shadow-[0_0_15px_rgba(255,107,107,0.5)] hover:shadow-[0_0_25px_rgba(255,107,107,0.8)] transition-all ${selectedMod === mod.id ? "border-2 border-primary" : "border border-muted"}`}
              >
                {mod.icon}
                <span className="text-lg font-mono text-primary-foreground text-glow">{mod.name}</span>
              </motion.button>
            ))}
          </div>

          {/* Audio Player (Hidden "Кухонный Кодер" Surprise) */}
          {isMusicPlaying && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-10 bg-popover p-6 rounded-xl shadow-inner border border-muted text-center"
            >
              <h3 className="text-2xl font-semibold text-secondary mb-4 cyber-text glitch" data-text="КУХОННЫЙ КОДЕР">
                КУХОННЫЙ КОДЕР
              </h3>
              <p className="text-muted-foreground font-mono mb-4">
                Секретный трек активирован! Готовь борщ и код под этот бит, братан!
              </p>
              <audio controls autoPlay className="w-full">
                <source src="https://tyqnthnifewjrrjlvmor.supabase.co/storage/v1/object/public/project-files/ratata.mp3" type="audio/mp3" />
                {/* Placeholder—replace with a real MP3 of our song if you’ve got one! */}
                Твой браузер не поддерживает аудио, сорян!
              </audio>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

