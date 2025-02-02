// components/SemanticSearch.tsx
'use client';
import { useState } from 'react';
import { supabase } from '@/hooks/supabase';
import { useWorker } from '@/hooks/useWorker';

interface CarResult {
  id: string;
  make: string;
  model: string;
  similarity: number;
}

const getStarRating = (similarity: number) => {
  // Assuming similarity is a value between 0 and 1, convert it to a 5 star rating.
  // For example, similarity 1 = 5 stars, similarity 0.5 = 2.5 stars, etc.
  const stars = Math.round(similarity * 5 * 2) / 2; // rounding to nearest half star
  return stars;
};

export default function SemanticSearch() {
  const { generateEmbedding } = useWorker();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<CarResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Generate embedding for the input query text.
      const embedding = await generateEmbedding(queryText);
      
      // Call the search_cars RPC with the generated embedding
      const { data, error } = await supabase.rpc('search_cars', {
        query_embedding: embedding,
        match_count: 5, // or any number you prefer
      });
      if (error) throw error;
      if (data) setResults(data);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search error');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (similarity: number) => {
    const stars = getStarRating(similarity);
    const fullStars = Math.floor(stars);
    const halfStar = stars % 1 !== 0;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    return (
      <div className="flex">
        {Array.from({ length: fullStars }).map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400 text-lg">★</span>
        ))}
        {halfStar && <span className="text-yellow-400 text-lg">☆</span>}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-500 text-lg">★</span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg text-white">
      <h2 className="text-2xl font-bold mb-4">Semantic Car Search</h2>
      <form onSubmit={handleSearch} className="mb-4">
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Enter your query (e.g. 'electric futuristic performance')"
          className="w-full p-2 rounded bg-gray-700 text-white mb-2"
          required
        />
        <button
          type="submit"
          className="w-full bg-cyan-500 hover:bg-cyan-600 p-2 rounded font-bold"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search Cars'}
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      {results.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-2">Results:</h3>
          <ul>
            {results.map((car) => (
              <li key={car.id} className="mb-4 border-b pb-2">
                <div className="flex justify-between items-center">
                  <strong>{car.make} {car.model}</strong>
                  {renderStars(car.similarity)}
                </div>
                <p className="text-sm text-gray-300">Similarity: {(car.similarity * 100).toFixed(2)}%</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

