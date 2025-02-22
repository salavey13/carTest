"use client"
import { useState, useCallback } from "react"
import type React from "react"
import { Loader2, Search, X } from "lucide-react"
import { searchCars } from "@/hooks/supabase"
import { useWorker } from "@/hooks/useWorker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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

  const handleSearch = useCallback(
    async (text: string) => {
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
    },
    [generateEmbedding, isInitialized]
  )

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

  const containerClass = compact
    ? "relative w-full"
    : "w-full max-w-xl mx-auto relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-6 shadow-2xl"
  const inputClass = compact
    ? "w-full pl-10 pr-10 py-2 bg-gray-800/70 border border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded-lg focus:ring-2 focus:ring-[#00ff9d]/60 focus:border-[#00ff9d] placeholder-gray-500/70 text-sm shadow-inner"
    : "w-full pl-12 pr-12 py-3 bg-gray-800/70 border-2 border-[#00ff9d]/30 text-[#00ff9d] font-mono rounded-xl focus:ring-2 focus:ring-[#00ff9d]/60 focus:border-[#00ff9d] placeholder-gray-500/70 text-lg shadow-inner"

  return (
    <div className={containerClass}>
      {/* Subtle glare effect */}
      {!compact && (
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#00ff9d]/10 rounded-full blur-3xl opacity-20 pointer-events-none" />
      )}

      <div className="relative group z-10">
        <Input
          type="search"
          value={queryText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={compact ? "Поиск..." : "Опишите машину мечты..."}
          className={inputClass}
          disabled={!isInitialized}
        />
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${
            loading ? "text-gray-600" : "text-[#00ff9d]/60 group-hover:text-[#00ff9d]"
          } transition-colors`}
        />
        {queryText && (
          <Button
            size="icon"
            variant="ghost"
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-[#00ff9d]/60 hover:text-[#00ff9d] hover:bg-gray-700/50 rounded-full ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            } transition-all`}
            onClick={clearInput}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {!compact && (
          <Button
            size="sm"
            className="absolute -right-32 top-1/2 -translate-y-1/2 bg-[#00ff9d]/10 text-[#00ff9d] hover:bg-[#00ff9d]/20 border border-[#00ff9d]/40 rounded-lg px-6 py-2 font-semibold shadow-md hover:shadow-[#00ff9d]/20 transition-all"
            onClick={() => handleSearch(queryText)}
            disabled={loading || queryText.length < 3 || !isInitialized}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Найти"}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-900/10 px-4 py-2 rounded-lg shadow-md z-10 relative">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className={compact ? "mt-2" : "mt-6 z-10 relative"}>
          {compact ? (
            <p className="text-sm text-gray-400/80">
              Найдено {results.length} результатов
            </p>
          ) : (
            <div className="grid gap-5">
              {results.map((car) => (
                <Card
                  key={car.id}
                  className="bg-gray-850/80 border border-[#00ff9d]/20 hover:border-[#00ff9d]/50 hover:shadow-xl hover:shadow-[#00ff9d]/10 transition-all duration-300 rounded-lg overflow-hidden"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-5">
                      {car.image_url && (
                        <div className="relative">
                          <img
                            src={car.image_url}
                            alt={`${car.make} ${car.model}`}
                            className="w-28 h-20 object-cover rounded-md border border-[#00ff9d]/20 shadow-sm"
                          />
                          <div className="absolute -top-1 -right-1 bg-[#00ff9d]/20 text-[#00ff9d] text-xs font-semibold px-2 py-1 rounded-full shadow">
                            {(car.similarity * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-[#00ff9d] font-semibold text-xl tracking-tight">
                          {car.make} {car.model}
                        </h3>
                        <p className="text-gray-300 text-sm line-clamp-2 mt-1 leading-relaxed">
                          {car.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full bg-[#00ff9d]/5 text-[#00ff9d] border-[#00ff9d]/30 hover:bg-[#00ff9d]/10 hover:text-[#00ff9d] hover:border-[#00ff9d]/50 font-semibold py-2 rounded-lg transition-all shadow-sm hover:shadow-[#00ff9d]/20"
                    >
                      <a href={car.rent_link}>Арендовать</a>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
