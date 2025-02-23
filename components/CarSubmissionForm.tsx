// components/CarSubmissionForm.tsx
"use client"
import { useState } from "react"
import type React from "react"
import { useWorker } from "@/hooks/useWorker"
import { supabaseAdmin } from "@/hooks/supabase"
import { uploadImage } from "@/hooks/supabase"

export function CarSubmissionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    description: "",
    specs: {} as Record<string, string>,
    daily_price: "",
    image_url: "",
    rent_link: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const { generateEmbedding } = useWorker()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl = formData.image_url
      if (imageFile) {
        const bucketName = "car-images"
        imageUrl = await uploadImage(bucketName, imageFile)
      }

      const specsString = JSON.stringify(formData.specs)
      const combinedText = `${formData.description} ${specsString}`
      const embedding = await generateEmbedding(combinedText)

      const { data: car, error: insertError } = await supabaseAdmin
        .from("cars")
        .insert({
          ...formData,
          specs: formData.specs,
          daily_price: Number(formData.daily_price),
          image_url: imageUrl,
          rent_link: formData.rent_link || `/rent/${formData.id}`,
          embedding: JSON.stringify(embedding),
        })
        .select()

      if (insertError) throw insertError

      setFormData({
        make: "",
        model: "",
        description: "",
        specs: {},
        daily_price: "",
        image_url: "",
        rent_link: "",
      })
      setImageFile(null)

      alert("Автомобиль успешно добавлен!")
    } catch (error) {
      console.error("Ошибка при добавлении:", error)
      alert("Ошибка при добавлении автомобиля")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Make */}
      <div>
        <input
          type="text"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          placeholder="Марка (например, Tesla)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Model */}
      <div>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="Модель (например, Roadster)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание (например, Футуристический электросуперкар)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Specs */}
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Характеристики</h3>
        <div className="space-y-2">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specs: {
                      ...formData.specs,
                      [e.target.value]: formData.specs[key],
                    },
                  })
                }
                placeholder="Параметр (например, версия)"
                className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specs: {
                      ...formData.specs,
                      [key]: e.target.value,
                    },
                  })
                }
                placeholder="Значение (например, v12)"
                className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, specs: { ...formData.specs, "": "" } })}
            className="w-full p-3 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Добавить характеристику
          </button>
        </div>
      </div>

      {/* Daily Price */}
      <div>
        <input
          type="number"
          value={formData.daily_price}
          onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
          placeholder="Цена за день (XTR)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Image URL or Upload */}
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Изображение</h3>
        <div className="flex gap-4 items-center">
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="URL изображения (необязательно)"
            className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <label
            htmlFor="image-upload"
            className="p-3 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors cursor-pointer"
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

      {/* Rent Link */}
      <div>
        <input
          type="url"
          value={formData.rent_link}
          onChange={(e) => setFormData({ ...formData, rent_link: e.target.value })}
          placeholder="Ссылка на аренду (по умолчанию: /rent/<id>)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full p-3 rounded bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors disabled:opacity-50"
      >
        {isSubmitting ? "Добавление автомобиля..." : "Добавить автомобиль в аренду"}
      </button>
    </form>
  )
}
