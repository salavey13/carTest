"use client";
import { useEffect, useState } from "react";
import { getCharacters } from "@/app/youtube_actions/actions";
import Link from "next/link";

export default function YTPage() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const data = await getCharacters();
        setCharacters(data);
      } catch (error) {
        console.error("Ошибка при загрузке персонажей:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  if (loading) return <p className="text-center text-muted-foreground animate-pulse-slow">Загрузка...</p>;

  return (
    <div className="container mx-auto p-4 pt-24 bg-background min-h-screen">
      <h1 className="text-4xl font-bold text-primary mb-8 text-center animate-glitch text-glow">Наши персонажи</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {characters.map((char) => (
          <div key={char.id} className="group relative overflow-hidden rounded-lg shadow-lg bg-card hover:shadow-xl transition-shadow duration-300">
            <img src={char.image_url} alt={char.name} className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="p-4">
              <h2 className="text-xl font-semibold text-secondary">{char.name}</h2>
              <p className="text-muted-foreground">{char.description}</p>
            </div>
            {char.video_url && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <iframe
                  src={char.video_url}
                  title={char.name}
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allowFullScreen
                  className="rounded"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <nav className="mt-8 flex justify-center space-x-4">
        <Link href="/tasks" className="text-primary hover:underline">Задачи</Link>
        <Link href="/youtubeAdmin" className="text-primary hover:underline">Админ YouTube</Link>
      </nav>
    </div>
  );
}