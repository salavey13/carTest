"use client"

import { useState, useCallback } from "react"
import type React from "react"
import { Loader2, Search, X } from "lucide-react"
import { searchCars } from "@/hooks/supabase"
import { useWorker } from "@/hooks/useWorker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { debugLogger } from "@/lib/debugLogger"

interface CarResult {
  id: string
  make: string
  model: string
  similarity: number
  description: string
  image_url: string
  rent_link: string
}

export default function SemanticSearch({ compact = false }: { compact?: boolean }) {
  const { generateEmbedding, isInitialized } = useWorker()
  const [queryText, setQueryText] = useState("")
  const [results, setResults] = useState<CarResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async (text: string) => {
    if (text.length < 3 || !isInitialized) {
      setError(!isInitialized ? "Инициализация поиска..." : "Введите минимум 3 символа")
      return
    }
    setLoading(true)
    setError(null)
    setResults([])

    try {
      debugLogger.log("Generating embedding for:", text)
      const embedding = await generateEmbedding(text)
      debugLogger.log("Searching cars with embedding")
      const data = await searchCars(embedding, 5)
      setResults(data || [])
      if (!data.length) setError("Ничего не найдено")
    } catch (err: any) {
      debugLogger.error("Search failed:", err)
      setError(err.message || "Ошибка поиска")
    } finally {
      setLoading(false)
    }
  }, [generateEmbedding, isInitialized])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryText(e.target.value)
    setError(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch(queryText)
  }

  const clearInput = () => {
    setQueryText("")
    setResults([])
    setError(null)
  }

  const inputClass = compact
    ? "w-full pl-10 pr-20 py-2 bg-black/30 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded"
    : "w-full pl-10  py-2 bg-black/30 border-2 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded"

  const containerClass = compact ? "relative w-full" : "w-full max-w-md mx-auto"

  return (
    <div className={containerClass}>
      <div className="relative flex w-full items-center gap-2">
        <Input
          type="search"
          value={queryText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={compact ? "Поиск..." : "Введите запрос..."}
          className={inputClass}
          disabled={!isInitialized}
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-2 top-1/2 -translate-y-1/2 hover:bg-transparent text-[#00ff9d]"
          onClick={() => handleSearch(queryText)}
          disabled={loading || queryText.length < 3 || !isInitialized}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {queryText && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-10 top-1/2 -translate-y-1/2 hover:bg-transparent text-[#00ff9d]"
            onClick={clearInput}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-transparent text-[#00ff9d]"
          onClick={() => handleSearch(queryText)}
          disabled={loading || queryText.length < 3 || !isInitialized}
        >
          Поиск
        </Button>
      </div>

      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

      {results.length > 0 && !compact && (
        <ul className="mt-4 space-y-2">
          {results.map((car) => (
            <li key={car.id} className="p-2 bg-black/30 border border-[#00ff9d]/30 rounded shadow">
              <span className="font-bold text-[#00ff9d]">
                {car.make} {car.model}
              </span>
              <span className="ml-2 text-sm text-gray-400">({(car.similarity * 100).toFixed(2)}% совпадение)</span>
              <p className="text-gray-300 text-sm">{car.description}</p>
              {car.image_url && (
                <img src={car.image_url} alt={`${car.make} ${car.model}`} className="mt-2 w-32 rounded" />
              )}
              <a href={car.rent_link} className="text-[#00ff9d] underline text-sm">Арендовать</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

