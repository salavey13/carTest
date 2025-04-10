"use client";
import { useEffect, useState } from "react";
import { getCharacters } from "@/app/youtube_actions/actions";
import Link from "next/link";
import { motion } from "framer-motion";
import { FiYoutube, FiUsers, FiSettings, FiCalendar } from "react-icons/fi";
import { useTelegram } from "@/hooks/useTelegram";
import GlitchyHero from '@/components/GlitchyHero'

export default function YTPage() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { isAdmin } = useTelegram();

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const data = await getCharacters();
        setCharacters(data);
      } catch (error) {
        console.error("Error loading characters:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    character.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-24 p-4 bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {!loading && characters.length > 0 && (
          <GlitchyHero
            imageUrls={characters.slice(0, 5).map(c => c.image_url || "/default-character.jpg")}
            buttonText="Watch Videos"
            buttonLink="https://youtube.com/salavey13"
          />
        )}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <FiYoutube className="text-red-500" /> YouTube Characters
          </h1>
          <div className="flex gap-4">
            <Link href="/tasks" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              Tasks
            </Link>
            {isAdmin && (
              <Link href="/youtubeAdmin" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition">
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="mb-8">
          <input
            type="text"
            placeholder="Search characters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 bg-gray-800 text-white rounded border border-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-700"></div>
                <div className="p-4">
                  <div className="h-6 bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiUsers className="mx-auto text-4xl mb-4" />
            <p>No characters found {searchTerm && `matching "${searchTerm}"`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredCharacters.map((character, i) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                whileHover={{ y: -5 }}
                className="bg-gray-800 rounded-lg shadow-lg overflow-hidden group"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={character.image_url || "/default-character.jpg"}
                    alt={character.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  {character.video_url && (
                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="p-2 bg-red-600 rounded-full">
                        <FiYoutube className="text-white text-2xl" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="text-xl font-semibold text-white mb-2">{character.name}</h2>
                  <p className="text-gray-300 mb-4 line-clamp-2">{character.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <FiCalendar />
                      <span>{new Date(character.created_at).toLocaleDateString()}</span>
                    </div>
                    {character.video_url && (
                      <a
                        href={character.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        Watch Video
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
