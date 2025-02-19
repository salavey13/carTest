"use client"
import { useState, useCallback } from "react"
import type React from "react"
import { Loader2 } from "lucide-react"
import { searchCars } from "@/hooks/supabase"
import { useWorker } from "@/hooks/useWorker"

interface CarResult {
  id: string
  make: string
  model: string
  similarity: number
}

export default function SemanticSearch({ compact = false }: { compact?: boolean }) {
  const { generateEmbedding } = useWorker()
  const [queryText, setQueryText] = useState("")
  const [results, setResults] = useState<CarResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(
    async (text: string) => {
      if (text.length < 3) return
      setLoading(true)
      setError(null)
      try {
        const embedding = await generateEmbedding(text)
        const data = await searchCars(embedding, 5)
        setResults(data || [])
      } catch (err: any) {
        console.error("Search failed:", err)
        setError(err.message || "Ошибка поиска")
      } finally {
        setLoading(false)
      }
    },
    [generateEmbedding],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryText(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch(queryText)
    }
  }

  if (compact) {
    return (
      <div className="relative w-full">
        <input
          type="search"
          value={queryText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Поиск..."
          className="w-full pl-10 pr-4 py-2 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded"
        />
        <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => handleSearch(queryText)}>
          {loading ? <Loader2 className="animate-spin" /> : "🔍"}
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative">
        <input
          type="search"
          value={queryText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Введите запрос..."
          className="w-full p-2 rounded bg-black/30 border-2 border-[#00ff9d]/30 text-[#00ff9d] font-mono"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#00ff9d]" />}
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((car) => (
            <li key={car.id} className="p-2 bg-black/30 border border-[#00ff9d]/30 rounded shadow">
              <span className="font-bold text-[#00ff9d]">
                {car.make} {car.model}
              </span>
              <span className="ml-2 text-sm text-gray-400">({(car.similarity * 100).toFixed(2)}% совпадение)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

