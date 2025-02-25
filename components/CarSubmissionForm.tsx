"use client";
import { useState } from "react";
import type React from "react";
import { supabaseAdmin } from "@/hooks/supabase";
import { uploadImage } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X } from "lucide-react";

// Simplified embedding generator (verified and slightly tuned)
function generateSimplifiedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return new Array(384).fill(0);

  const embedding = new Array(384).fill(0);
  const wordCount: { [key: string]: number } = {};

  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  Object.entries(wordCount).forEach(([word, count], index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) % 10007;
    }
    const baseIdx = Math.abs(hash + index * 23) % 384;
    for (let i = 0; i < 7; i++) {
      const idx = (baseIdx + i * 3) % 384;
      embedding[idx] += (count / words.length) * (1 - i * 0.05);
    }
  });

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
}

interface CarSubmissionFormProps {
  ownerId: string; // Admin's user_id
}

export function CarSubmissionForm({ ownerId }: CarSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    description: "",
    specs: {} as Record<string, string>,
    daily_price: "",
    image_url: "",
    rent_link: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Default spec keys aligned with RentCarPage
  const defaultSpecKeys = [
    "version",      // Версия
    "electric",     // Электро (boolean as "Да/Нет")
    "color",        // Цвет
    "theme",        // Тема
    "horsepower",   // Лошадки
    "torque",       // Крутяк
    "acceleration", // Разгон
    "topSpeed",     // Макс
  ];

  const generatedId = `${formData.make.toLowerCase().replace(/\s+/g, "-")}-${formData.model.toLowerCase().replace(/\s+/g, "-")}`;
  const defaultRentLink = formData.make && formData.model ? `/rent/${generatedId}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    toast.info("Запускаю добавление тачки...", { style: { background: "#ff007a", color: "#fff" } });

    try {
      const bucketName = "car-images";
      const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
      if (bucketError) throw bucketError;
      if (!buckets.some((b) => b.name === bucketName)) {
        await supabaseAdmin.storage.createBucket(bucketName, { public: true });
        toast.success(`Бакет ${bucketName} создан на лету!`);
      }

      let imageUrl = formData.image_url;
      if (imageFile) {
        imageUrl = await uploadImage(bucketName, imageFile);
        toast.success("Картинка залита в неон!");
      }

      const specsString = JSON.stringify(formData.specs);
      const combinedText = `${formData.make} ${formData.model} ${formData.description} ${specsString}`;
      const embedding = generateSimplifiedEmbedding(combinedText);

      const { data: car, error: insertError } = await supabaseAdmin
        .from("cars")
        .insert({
          id: generatedId,
          owner_id: ownerId,
          make: formData.make,
          model: formData.model,
          description: formData.description,
          specs: formData.specs,
          daily_price: Number(formData.daily_price),
          image_url: imageUrl || "",
          rent_link: formData.rent_link || defaultRentLink,
          embedding,
        })
        .select();

      if (insertError) throw insertError;

      setFormData({
        make: "",
        model: "",
        description: "",
        specs: {},
        daily_price: "",
        image_url: "",
        rent_link: "",
      });
      setImageFile(null);
      toast.success("Тачка в гараже, братан!", { style: { background: "#00ff9d", color: "#000" } });
    } catch (error) {
      toast.error(`Ошибка: ${(error instanceof Error ? error.message : "Хз что сломалось!")}`, { style: { background: "#ff007a", color: "#fff" } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addNewSpec = () => {
    const usedKeys = Object.keys(formData.specs);
    const nextKey = defaultSpecKeys.find(key => !usedKeys.includes(key)) || "";
    setFormData({ ...formData, specs: { ...formData.specs, [nextKey]: "" } });
  };

  const removeSpec = (keyToRemove: string) => {
    const newSpecs = { ...formData.specs };
    delete newSpecs[keyToRemove];
    setFormData({ ...formData, specs: newSpecs });
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-8 bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl shadow-[0_0_30px_rgba(255,107,107,0.7)] border border-[#ff007a]/70"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 150, damping: 15 }}
    >
      <h2 className="text-3xl font-mono text-[#00ff9d] glitch mb-8 text-center animate-[neon_2s_infinite]" data-text="ДОБАВИТЬ КИБЕР-ЖЕЛЕЗО">
        ДОБАВИТЬ КИБЕР-ЖЕЛЕЗО
      </h2>

      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-mono text-[#00ff9d] text-glow mb-2">Марка</label>
          <input
            type="text"
            value={formData.make}
            onChange={(e) => setFormData({ ...formData, make: e.target.value, rent_link: defaultRentLink })}
            placeholder="Марка (например, Chery)"
            className="w-full p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-mono text-[#00ff9d] text-glow mb-2">Модель</label>
          <input
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value, rent_link: defaultRentLink })}
            placeholder="Модель (например, Tiggo)"
            className="w-full p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
            required
          />
        </div>
      </motion.div>

      <div>
        <label className="block text-sm font-mono text-[#00ff9d] text-glow mb-2">Описание</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание (например, Турбированный кибер-зверь)"
          className="w-full p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg h-32 focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)] resize-none scrollbar-thin scrollbar-thumb-[#00ff9d] scrollbar-track-gray-900"
          required
        />
      </div>

      <div>
        <h3 className="text-lg font-mono text-[#00ff9d] mb-4 glitch animate-[neon_2s_infinite]" data-text="ХАРАКТЕРИСТИКИ">
          ХАРАКТЕРИСТИКИ
        </h3>
        <div className="space-y-4">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex gap-3 items-center"
            >
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newSpecs = { ...formData.specs };
                  delete newSpecs[key];
                  newSpecs[e.target.value || defaultSpecKeys[index % defaultSpecKeys.length]] = value;
                  setFormData({ ...formData, specs: newSpecs });
                }}
                placeholder={defaultSpecKeys[index % defaultSpecKeys.length]}
                className="flex-1 p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
                required
              />
              <input
                type="text"
                value={value}
                onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, [key]: e.target.value } })}
                placeholder="Значение (например, 300 л.с.)"
                className="flex-1 p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
                required
              />
              <button
                type="button"
                onClick={() => removeSpec(key)}
                className="p-2 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full shadow-[0_0_10px_rgba(255,0,122,0.5)] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
          <motion.button
            type="button"
            onClick={addNewSpec}
            className="w-full p-3 bg-gray-800/80 hover:bg-[#00ff9d]/30 text-[#00ff9d] rounded-lg font-mono text-sm transition-colors shadow-[0_0_15px_rgba(0,255,157,0.5)] hover:shadow-[0_0_25px_rgba(0,255,157,0.7)]"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            + Добавить шнягу
          </motion.button>
        </div>
      </div>

      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-mono text-[#00ff9d] text-glow mb-2">Цена за день (XTR)</label>
          <input
            type="number"
            value={formData.daily_price}
            onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
            placeholder="Цена (например, 50)"
            className="w-full p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-mono text-[#00ff9d] text-glow mb-2">Ссылка на аренду</label>
          <input
            type="text"
            value={formData.rent_link || defaultRentLink}
            onChange={(e) => setFormData({ ...formData, rent_link: e.target.value })}
            placeholder={`/rent/${generatedId}`}
            className="w-full p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
          />
        </div>
      </motion.div>

      <div>
        <h3 className="text-lg font-mono text-[#00ff9d] mb-2 glitch" data-text="КАРТИНКА">
          КАРТИНКА
        </h3>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="URL картинки (опционально)"
            className="flex-1 min-w-[200px] p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
          />
          <label
            htmlFor="image-upload"
            className="p-3 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-lg font-mono text-sm cursor-pointer min-w-[150px] text-center shadow-[0_0_15px_rgba(255,0,122,0.5)] hover:shadow-[0_0_25px_rgba(255,0,122,0.8)] transition-all animate-[neon_2s_infinite]"
          >
            Залить фотку
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
      </div>

      <motion.button
        type="submit"
        disabled={isSubmitting}
        className={`w-full p-4 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-xl font-mono text-lg ${isSubmitting ? "animate-pulse cursor-not-allowed opacity-50" : "shadow-[0_0_20px_rgba(255,0,122,0.8)] hover:shadow-[0_0_30px_rgba(255,0,122,1)]"} transition-all animate-[neon_2s_infinite]`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isSubmitting ? "ГРУЖУ ТАЧКУ..." : "ЗАСУНУТЬ В ГАРАЖ"}
      </motion.button>
    </motion.form>
  );
}

