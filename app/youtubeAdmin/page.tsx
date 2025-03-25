"use client";
import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/hooks/supabase"; // Adjust this import based on your setup
import { toast } from "sonner"; // For notifications
import { CharacterForm } from "@/components/CharacterForm"; // Your CharacterForm component
import { motion } from "framer-motion"; // For animations

export default function YoutubeAdminPage() {
  // YouTube form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Character management states
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<any | null>(null);

  // Fetch characters on page load
  useEffect(() => {
    const fetchCharacters = async () => {
      const { data, error } = await supabaseAdmin.from("characters").select("*");
      if (error) {
        toast.error("Failed to load characters");
        console.error(error);
      } else {
        setCharacters(data || []);
      }
      setLoading(false);
    };
    fetchCharacters();
  }, []);

  // Handle YouTube form submission
  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add your YouTube submission logic here (e.g., API call)
    toast.success("YouTube video submitted successfully!");
    setTitle("");
    setDescription("");
    setTags("");
  };

  // Delete a character
  const handleDeleteCharacter = async (id: number) => {
    try {
      const { error } = await supabaseAdmin.from("characters").delete().eq("id", id);
      if (error) throw error;
      setCharacters(characters.filter((char) => char.id !== id));
      toast.success("Character deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete character");
      console.error(error);
    }
  };

  return (
    <div className="pt-24 p-4 bg-background min-h-screen">
      <nav className="mt-8 flex justify-center space-x-4">
        <Link href="/yt" className="text-blue-400 hover:underline">Characters</Link>
        <Link href="/tasks" className="text-blue-400 hover:underline">Tasks</Link>
      </nav>
      <h1 className="text-3xl font-bold text-primary mb-6">YouTube Admin Dashboard</h1>

      {/* Section 1: YouTube Video Upload */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-secondary mb-4">YouTube Video Upload</h2>
        <form onSubmit={handleYoutubeSubmit} className="space-y-4 max-w-lg mx-auto">
          <div>
            <label className="block text-muted-foreground">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 w-full bg-card text-foreground rounded shadow-glow"
            />
          </div>
          <div>
            <label className="block text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 w-full bg-card text-foreground rounded shadow-glow"
            />
          </div>
          <div>
            <label className="block text-muted-foreground">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="border p-2 w-full bg-card text-foreground rounded shadow-glow"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground p-3 rounded shadow-glow hover:shadow-glow"
          >
            Upload Video
          </button>
        </form>
      </section>

      {/* Section 2: Character Management */}
      <section>
        <h2 className="text-2xl font-semibold text-secondary mb-4">Character Management</h2>

        {/* Character Form for adding/editing */}
        <div className="mb-8">
          <CharacterForm character={selectedCharacter} />
          {selectedCharacter && (
            <button
              onClick={() => setSelectedCharacter(null)}
              className="mt-4 text-red-500 hover:underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* List of Existing Characters */}
        <h3 className="text-xl font-semibold text-secondary mb-4">Existing Characters</h3>
        {loading ? (
          <p className="text-center text-muted-foreground">Loading characters...</p>
        ) : characters.length === 0 ? (
          <p className="text-center text-muted-foreground">No characters found.</p>
        ) : (
          <ul className="space-y-4">
            {characters.map((char) => (
              <motion.li
                key={char.id}
                className="p-4 bg-card rounded-lg shadow-lg flex justify-between items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <h4 className="text-lg font-semibold text-white">{char.name}</h4>
                  <p className="text-sm text-gray-400">{char.description}</p>
                  {char.video_url && (
                    <a
                      href={char.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Video
                    </a>
                  )}
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setSelectedCharacter(char)}
                    className="text-blue-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
