"use client";
import { useState } from "react";
import type React from "react";
import { pipeline } from "@huggingface/transformers"; // Ensure this is installed
import { supabaseAdmin } from "@/hooks/supabase";
import { uploadImage } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";
interface CarSubmissionFormProps {
  ownerId: string; // Should be the admin's user_id
}

// Simplified embedding generator
function generateSimplifiedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return new Array(384).fill(0);

  const embedding = new Array(384).fill(0);
  const wordCount: { [key: string]: number } = {};

  // Count word frequencies
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Hash-based distribution with frequency weighting
  Object.entries(wordCount).forEach(([word, count], index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 31 + word.charCodeAt(i)) % 10007;
    }
    const baseIdx = (hash + index * 17) % 384;
    for (let i = 0; i < 5; i++) { // Spread across 5 dimensions
      const idx = (baseIdx + i) % 384;
      embedding[idx] += (count / words.length) * (1 - i * 0.1); // Decay effect
    }
  });
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

  // Generate default rent_link based on make and model
  const generatedId = `${formData.make.toLowerCase().replace(/\s+/g, "-")}-${formData.model.toLowerCase().replace(/\s+/g, "-")}`;
  const defaultRentLink = formData.make && formData.model ? `/rent/${generatedId}` : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    toast.info("Запускаю добавление тачки...");

    try {
      // Ensure public bucket exists
      const bucketName = "car-images";
      const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
      if (bucketError) throw bucketError;
      if (!buckets.some((b) => b.name === bucketName)) {
        await supabaseAdmin.storage.createBucket(bucketName, { public: true });
        toast.success(`Бакет ${bucketName} создан на лету!`);
      }

      // Upload image if provided
      let imageUrl = formData.image_url;
      if (imageFile) {
        imageUrl = await uploadImage(bucketName, imageFile);
        toast.success("Картинка залита в неон!");
      }

      // Generate embedding using transformer model
      const specsString = JSON.stringify(formData.specs);
      const combinedText = `${formData.make} ${formData.model} ${formData.description} ${specsString}`;
      const embedding = await generateSimplifiedEmbedding(combinedText);

      // Insert car with generated ID and owner_id
      const { data: car, error: insertError } = await supabaseAdmin
        .from("cars")
        .insert({
          id: generatedId,
          owner_id: ownerId, // Ensure this is the admin's user_id
          make: formData.make,
          model: formData.model,
          description: formData.description,
          specs: formData.specs,
          daily_price: Number(formData.daily_price),
          image_url: imageUrl,
          rent_link: formData.rent_link || defaultRentLink,
          embedding: JSON.stringify(embedding),
        })
        .select();

      if (insertError) throw insertError;

      // Reset form
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
      toast.success("Тачка в гараже, братан!");
    } catch (error) {
      toast.error(`Ошибка: ${(error instanceof Error ? error.message : "Хз что сломалось!")}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6 bg-popover p-6 rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <h2 className="text-2xl font-semibold text-gradient cyber-text glitch mb-6" data-text="ДОБАВИТЬ КИБЕР-ЖЕЛЕЗО">
        ДОБАВИТЬ КИБЕР-ЖЕЛЕЗО
      </h2>

      <div>
        <label className="block text-sm font-mono text-primary text-glow">Марка</label>
        <input
          type="text"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value, rent_link: defaultRentLink })}
          placeholder="Марка (например, Chery)"
          className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-mono text-primary text-glow">Модель</label>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value, rent_link: defaultRentLink })}
          placeholder="Модель (например, Tiggo)"
          className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-mono text-primary text-glow">Описание</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание (например, Турбированный кибер-зверь)"
          className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground h-32 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)] resize-none scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
          required
        />
      </div>

      <div>
        <h3 className="text-lg font-mono text-secondary mb-2 cyber-text glitch" data-text="ХАРАКТЕРИСТИКИ">
          ХАРАКТЕРИСТИКИ
        </h3>
        <div className="space-y-3">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newSpecs = { ...formData.specs };
                  delete newSpecs[key];
                  newSpecs[e.target.value] = value;
                  setFormData({ ...formData, specs: newSpecs });
                }}
                placeholder="Параметр (например, мощность)"
                className="flex-1 min-w-[150px] p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
                required
              />
              <input
                type="text"
                value={value}
                onChange={(e) => setFormData({ ...formData, specs: { ...formData.specs, [key]: e.target.value } })}
                placeholder="Значение (например, 300 л.с.)"
                className="flex-1 min-w-[150px] p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, specs: { ...formData.specs, "": "" } })}
            className="w-full p-3 bg-muted hover:bg-primary/50 text-foreground hover:text-primary-foreground rounded-lg font-mono text-sm transition-colors shadow-[0_0_10px_rgba(255,107,107,0.3)]"
          >
            + Добавить шнягу
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-mono text-primary text-glow">Цена за день (XTR)</label>
        <input
          type="number"
          value={formData.daily_price}
          onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
          placeholder="Цена (например, 50)"
          className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
          required
        />
      </div>

      <div>
        <h3 className="text-lg font-mono text-secondary mb-2 cyber-text glitch" data-text="КАРТИНКА">
          КАРТИНКА
        </h3>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="URL картинки (опционально)"
            className="flex-1 min-w-[200px] p-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
          />
          <label
            htmlFor="image-upload"
            className="p-3 bg-primary hover:bg-secondary text-primary-foreground rounded-lg font-mono text-sm cursor-pointer min-w-[150px] text-center shadow-[0_0_15px_rgba(255,107,107,0.5)] hover:shadow-[0_0_25px_rgba(255,107,107,0.8)] transition-all text-glow"
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

      <div>
        <label className="block text-sm font-mono text-primary text-glow">Ссылка на аренду</label>
        <input
          type="text"
          value={formData.rent_link || defaultRentLink}
          onChange={(e) => setFormData({ ...formData, rent_link: e.target.value })}
          placeholder={`/rent/${generatedId}`}
          className="w-full p-3 mt-1 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono shadow-[inset_0_0_10px_rgba(255,107,107,0.2)]"
        />
      </div>

      <motion.button
        type="submit"
        disabled={isSubmitting}
        className={`w-full p-4 bg-primary hover:bg-secondary text-primary-foreground rounded-xl font-mono text-lg ${isSubmitting ? "animate-pulse cursor-not-allowed opacity-50" : "shadow-[0_0_15px_rgba(255,107,107,0.7)] hover:shadow-[0_0_25px_rgba(255,107,107,0.9)]"} transition-all text-glow`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isSubmitting ? "Гружу тачку..." : "Засунуть в гараж"}
      </motion.button>
    </motion.form>
  );
}

