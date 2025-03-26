"use client";
import { useState, useEffect } from "react";
import { supabaseAdmin } from "@/hooks/supabase";
import { toast } from "sonner";
import { CharacterForm } from "@/components/CharacterForm";
import { motion } from "framer-motion";
import Link from "next/link";
import { uploadVideoToYouTube, getYouTubeAnalytics } from "@/app/youtube_actions/actions";
import { useTelegram } from "@/hooks/useTelegram";
import { VideoUploadProgress } from "@/components/VideoUploadProgress";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export default function YoutubeAdminPage() {
  const { dbUser, isAdmin } = useTelegram();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<any | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Fetch characters and analytics on page load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabaseAdmin.from("characters").select("*");
        if (error) throw error;
        setCharacters(data || []);

        const analytics = await getYouTubeAnalytics();
        setAnalyticsData(analytics);
      } catch (error) {
        toast.error("Failed to load data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("tags", tags);

      const result = await uploadVideoToYouTube(formData);
      if (result.success) {
        toast.success("Video uploaded successfully!");
        // Save video metadata to database
        await supabaseAdmin.from("videos").insert([{
          title,
          description,
          tags: tags.split(",").map(tag => tag.trim()),
          youtube_id: result.videoId,
          uploaded_by: dbUser?.user_id,
          status: "uploaded"
        }]);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      console.error(error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setTitle("");
      setDescription("");
      setTags("");
      setVideoFile(null);
    }
  };

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

  if (!isAdmin()) {
    return (
      <div className="pt-24 p-4 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 p-4 bg-background min-h-screen">
      <nav className="mt-8 flex justify-center space-x-4 mb-8">
        <Link href="/yt" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
          Characters
        </Link>
        <Link href="/tasks" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
          Tasks
        </Link>
        <button 
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
        >
          {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
        </button>
      </nav>

      <h1 className="text-3xl font-bold text-primary mb-6 text-center">YouTube Admin Dashboard</h1>

      {showAnalytics && (
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-secondary mb-4">YouTube Analytics</h2>
          <AnalyticsDashboard data={analyticsData} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: YouTube Video Upload */}
        <section className="bg-card p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-secondary mb-4">Video Upload</h2>
          <form onSubmit={handleYoutubeSubmit} className="space-y-4">
            <div>
              <label className="block text-muted-foreground mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-input text-foreground"
                required
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-input text-foreground min-h-[120px]"
                required
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-2">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg bg-input text-foreground"
                placeholder="tag1, tag2, tag3"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-2">Video File</label>
              <input
                type="file"
                onChange={handleFileChange}
                accept="video/*"
                className="w-full p-3 border border-gray-300 rounded-lg bg-input text-foreground"
                required
              />
            </div>
            {isUploading && (
              <VideoUploadProgress progress={uploadProgress} />
            )}
            <button
              type="submit"
              disabled={isUploading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </form>
        </section>

        {/* Section 2: Character Management */}
        <section className="bg-card p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold text-secondary mb-4">Character Management</h2>

          <div className="mb-8">
            <CharacterForm 
              character={selectedCharacter} 
              onSuccess={(newCharacter) => {
                if (selectedCharacter) {
                  setCharacters(characters.map(c => c.id === newCharacter.id ? newCharacter : c));
                } else {
                  setCharacters([...characters, newCharacter]);
                }
                setSelectedCharacter(null);
              }}
            />
            {selectedCharacter && (
              <button
                onClick={() => setSelectedCharacter(null)}
                className="mt-4 text-red-500 hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <h3 className="text-xl font-semibold text-secondary mb-4">Existing Characters</h3>
          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : characters.length === 0 ? (
            <p className="text-center text-muted-foreground">No characters found.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {characters.map((char) => (
                <motion.div
                  key={char.id}
                  className="p-4 bg-gray-800 rounded-lg shadow-lg flex justify-between items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center space-x-4">
                    {char.image_url && (
                      <img 
                        src={char.image_url} 
                        alt={char.name} 
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h4 className="text-lg font-semibold text-white">{char.name}</h4>
                      <p className="text-sm text-gray-400 line-clamp-2">{char.description}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedCharacter(char)}
                      className="p-2 bg-blue-500 rounded hover:bg-blue-600 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCharacter(char.id)}
                      className="p-2 bg-red-500 rounded hover:bg-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}