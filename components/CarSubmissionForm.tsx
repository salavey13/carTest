"use client";
import { useState } from "react";
import type React from "react";
import { useWorker } from "@/hooks/useWorker";
import { supabaseAdmin } from "@/hooks/supabase";
import { uploadImage } from "@/hooks/supabase";
import { toast } from "sonner";

interface CarSubmissionFormProps {
  ownerId: string;
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
  const { generateEmbedding } = useWorker();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;
      if (imageFile) {
        const bucketName = "car-images";
        imageUrl = await uploadImage(bucketName, imageFile);
        toast.success("Изображение загружено!");
      }

      const specsString = JSON.stringify(formData.specs);
      const combinedText = `${formData.description} ${specsString}`; // Add make and model if desired
      const embedding = await generateEmbedding(combinedText);

      const { data: car, error: insertError } = await supabaseAdmin
        .from("cars")
        .insert({
          ...formData,
          owner_id: ownerId,
          specs: formData.specs,
          daily_price: Number(formData.daily_price),
          image_url: imageUrl,
          rent_link: formData.rent_link || `/rent/${formData.id}`,
          embedding: JSON.stringify(embedding),
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
      toast.success("Автомобиль успешно добавлен!");
    } catch (error) {
      console.error("Ошибка при добавлении:", error);
      toast.error("Ошибка при добавлении автомобиля");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300">Марка</label>
        <input
          type="text"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          placeholder="Марка (например, Tesla)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Модель</label>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="Модель (например, Roadster)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Описание</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание (например, Футуристический электросуперкар)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          required
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Характеристики</h3>
        <div className="space-y-2">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newSpecs = { ...formData.specs };
                  delete newSpecs[key];
                  newSpecs[e.target.value] = formData.specs[key];
                  setFormData({ ...formData, specs: newSpecs });
                }}
                placeholder="Параметр (например, версия)"
                className="flex-1 min-w-[150px] p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                required
              />
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specs: { ...formData.specs, [key]: e.target.value },
                  })
                }
                placeholder="Значение (например, v12)"
                className="flex-1 min-w-[150px] p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, specs: { ...formData.specs, "": "" } })}
            className="w-full p-3 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors text-sm"
          >
            Добавить характеристику
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">Цена за день (XTR)</label>
        <input
          type="number"
          value={formData.daily_price}
          onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
          placeholder="Цена за день (XTR)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          required
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Изображение</h3>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="URL изображения (необязательно)"
            className="flex-1 min-w-[200px] p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          <label
            htmlFor="image-upload"
            className="p-3 rounded bg-cyan-500 text-white hover:bg-cyan-600 transition-colors cursor-pointer text-center min-w-[150px] text-sm"
          >
            Загрузить изображение
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
        <label className="block text-sm font-medium text-gray-300">Ссылка на аренду</label>
        <input
          type="url"
          value={formData.rent_link}
          onChange={(e) => setFormData({ ...formData, rent_link: e.target.value })}
          placeholder="Ссылка на аренду (по умолчанию: /rent/<id>)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full p-3 rounded bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors disabled:opacity-50 text-sm"
      >
        {isSubmitting ? "Добавление автомобиля..." : "Добавить автомобиль в аренду"}
      </button>
    </form>
  );
}
