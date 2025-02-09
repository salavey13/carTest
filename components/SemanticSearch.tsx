// components/SemanticSearch.tsx
"use client"
import { useState } from "react" // Added ReactElement import
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const embedding = await generateEmbedding(queryText)
      const data = await searchCars(embedding, 5)
      setResults(data || [])
    } catch (err: any) {
      console.error("Search failed:", err)
      setError(err.message || "Search error")
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <form onSubmit={handleSearch} className="relative w-full">
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Поиск..."
          className="w-full pl-10 pr-4 py-2 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded"
        />
        <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2">
          🔍
        </button>
      </form>
    )
  }

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Введите запрос..."
          className="w-full p-2 rounded bg-black/30 text-[#00ff9d] font-mono"
        />
        <button type="submit">Поиск</button>
      </form>
      {loading && <p>Поиск...</p>}
      {error && <p>{error}</p>}
      {results.length > 0 && (
        <ul>
          {results.map((car) => (
            <li key={car.id}>
              {car.make} {car.model} ({(car.similarity * 100).toFixed(2)}%)
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

