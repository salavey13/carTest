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
  owner_id: string; // Added owner field
  similarity: number;
}

export default function SemanticSearch({ compact = false }: { compact?: boolean }) {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<CarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (text: string) => {
    if (text.length < 3) {
      setError("Query must be at least 3 characters");
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

      if (!response.ok) throw new Error("Search request failed");
      const data = await response.json();
      setResults(data);
      if (!data.length) setError("No results found");
    } catch (err: any) {
      console.error("Search failed:", err);
      setError(err.message || "Search error");
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
      {/* Cyberpunk Neon Glow */}
      {!compact && (
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#00ff9d]/20 rounded-full blur-3xl opacity-30 pointer-events-none animate-pulse" />
      )}

      <div className="relative z-10 flex items-center gap-2">
        <Input
          type="search"
          value={queryText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={compact ? "Search..." : "Describe your dream ride..."}
          className={`w-full pl-10 pr-10 py-2 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] font-mono rounded-lg focus:ring-2 focus:ring-[#00ff9d] focus:border-[#00ff9d] placeholder-[#00ff9d]/40 text-sm shadow-[inset_0_0_5px_rgba(0,255,157,0.5)] ${
            compact ? "py-1.5" : "md:py-3 md:text-base"
          }`}
          style={{ WebkitAppearance: "none" }} // Disable default "x"
        />
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#00ff9d]/70 ${
            loading ? "opacity-50" : "hover:text-[#00ff9d]"
          } transition-colors`}
        />
        {queryText && (
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
        )}
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

      {/* Hide default browser clear button */}
      <style jsx>{`
        input[type="search"]::-webkit-search-cancel-button,
        input[type="search"]::-ms-clear {
          display: none;
        }
      `}</style>

      {error && (
        <p className="mt-2 text-sm text-[#ff007a] bg-[#ff007a]/10 px-3 py-1 rounded-lg shadow-[0_0_5px_rgba(255,0,122,0.5)] z-10 relative">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className={compact ? "mt-2" : "mt-6 z-10 relative"}>
          {compact ? (
            <div className="space-y-2">
              {results.slice(0, 3).map((car) => (
                <Link key={car.id} href={car.rent_link}>
                  <div className="flex items-center gap-3 text-[#00ff9d] hover:bg-[#00ff9d]/10 p-2 rounded-lg transition-all">
                    <img src={car.image_url} alt={car.make} className="w-12 h-12 rounded-md border border-[#00ff9d]/30" />
                    <div>
                      <p className="text-sm font-mono">{car.make} {car.model}</p>
                      <p className="text-xs text-[#00ff9d]/70">Owner: {car.owner_id}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {results.length > 3 && (
                <p className="text-xs text-[#00ff9d]/50">+{results.length - 3} more</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {results.map((car) => (
                <Card
                  key={car.id}
                  className="bg-black/90 border border-[#00ff9d]/40 hover:border-[#00ff9d] hover:shadow-[0_0_15px_rgba(0,255,157,0.5)] transition-all rounded-lg overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {car.image_url && (
                        <div className="relative">
                          <img
                            src={car.image_url}
                            alt={`${car.make} ${car.model}`}
                            className="w-24 h-16 object-cover rounded-md border border-[#00ff9d]/30"
                          />
                          <div className="absolute -top-2 -right-2 bg-[#00ff9d]/30 text-[#00ff9d] text-xs font-mono px-2 py-1 rounded-full shadow-[0_0_5px_rgba(0,255,157,0.5)]">
                            {(car.similarity * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-[#00ff9d] font-mono text-lg tracking-tight">
                          {car.make} {car.model}
                        </h3>
                        <p className="text-[#00ff9d]/80 text-sm line-clamp-2 mt-1">
                          {car.description}
                        </p>
                        <p className="text-[#00ff9d]/60 text-xs mt-1">Owner: {car.owner_id}</p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/50 hover:bg-[#00ff9d]/20 hover:border-[#00ff9d] font-mono rounded-lg transition-all shadow-[0_0_5px_rgba(0,255,157,0.3)]"
                    >
                      <a href={car.rent_link}>Rent Now</a>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
