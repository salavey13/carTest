// /components/SemanticSearch.tsx
"use client";
import { useState, useCallback } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import Link from "next/link";

interface CarResult {
  id: string;
  make: string;
  model: string;
  description: string;
  image_url: string;
  rent_link: string;
  owner: string;
  similarity: number;
}

export default function SemanticSearch({ compact = false }: { compact?: boolean }) {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<CarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (text: string) => {
    if (text.length < 3) {
      setError("Запрос должен быть не менее 3 символов");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      const data = await response.json();
      setResults(data);
      if (!data.length) setError("Ничего не найдено");
    } catch (err: any) {
      console.error("Поиск не удался:", err);
      setError(err.message || "Ошибка поиска");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQueryText(e.target.value);
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch(queryText);
  };

  const clearInput = () => {
    setQueryText("");
    setResults([]);
    setError(null);
  };

  const containerClass = compact
    ? "relative w-full"
    : "w-full max-w-2xl mx-auto bg-gradient-to-b from-gray-900 to-black rounded-xl p-4 shadow-[0_0_15px_rgba(0,255,157,0.3)]";

  return (
    <div className={containerClass}>
      {!compact && (
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00ff9d]/20 rounded-full blur-3xl opacity-30 pointer-events-none animate-pulse" />
      )}

      <div className="relative z-10 flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="search"
            value={queryText}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={compact ? "Поиск..." : "Опишите машину мечты..."}
            className={`w-full pl-10 pr-10 py-2 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] font-mono rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm shadow-[inset_0_0_5px_rgba(0,255,157,0.5)] ${
              compact ? "py-1.5" : "md:py-3 md:text-base"
            }`}
          />
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#00ff9d]/70 ${
              loading ? "opacity-50" : "hover:text-[#00ff9d]"
            } transition-colors`}
          />
          {/*queryText && (
            <Button
              size="icon"
              variant="ghost"
              className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-[#00ff9d]/70 hover:text-[#00ff9d] hover:bg-[#00ff9d]/10 rounded-full ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              } transition-all`}
              onClick={clearInput}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          )*/}
        </div>
        {!compact && (
          <Button
            size="icon"
            className="bg-[#00ff9d]/20 text-[#00ff9d] hover:bg-[#00ff9d]/30 border border-[#00ff9d]/50 rounded-lg h-10 w-10 shadow-[0_0_10px_rgba(0,255,157,0.5)] transition-all"
            onClick={() => handleSearch(queryText)}
            disabled={loading || queryText.length < 3}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-[#ff007a] bg-[#ff007a]/10 px-3 py-1 rounded-lg shadow-[0_0_5px_rgba(255,0,122,0.5)] z-10 relative">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className={compact ? "mt-2" : "mt-6 z-10 relative"}>
          <div className="space-y-2">
            {results.slice(0, compact ? 3 : results.length).map((car) => (
              <Link key={car.id} href={car.rent_link}>
                <div className="flex items-center gap-3 text-[#00ff9d] hover:bg-[#00ff9d]/10 p-2 rounded-lg transition-all">
                  <img src={car.image_url} alt={car.make} className="w-12 h-12 rounded-md border border-[#00ff9d]/30" />
                  <div className="flex-1">
                    <p className="text-sm font-mono">
                      {car.make} {car.model}
                    </p>
                    {!compact && (
                      <p className="text-xs text-[#00ff9d]/80 line-clamp-1">{car.description}</p>
                    )}
                    <p className="text-xs text-[#00ff9d]/70">Владелец: {car.owner}</p>
                  </div>
                  <div className="text-xs text-[#00ff9d]/50">
                    {(car.similarity * 100).toFixed(1)}%
                  </div>
                </div>
              </Link>
            ))}
            {compact && results.length > 3 && (
              <p className="text-xs text-[#00ff9d]/50">+{results.length - 3} ещё</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

