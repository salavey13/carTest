// components/AddCarForm.tsx
"use client"
import { useState } from "react"
import { useWorker } from "@/hooks/useWorker"

export default function AddCarForm() {
  const [description, setDescription] = useState("")
  const { generateEmbedding } = useWorker()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)

    // Generate embedding
    const embedding = await generateEmbedding(description)

    await supabase.from("cars").insert({
      make: formData.get("make"),
      model: formData.get("model"),
      description,
      embedding: JSON.stringify(embedding),
      daily_price: formData.get("price"),
      image_url: formData.get("image"),
      rent_link: formData.get("rentLink"),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      <button type="submit">Add Car</button>
    </form>
  )
}

