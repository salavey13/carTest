"use client";
import { useState, useEffect } from "react";
import { supabaseAnon } from "@/hooks/supabase";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CharacterFormProps {
  character?: { id: number; name: string; description: string; image_url: string; video_url: string }; // Optional for editing
}

export function CharacterForm({ character }: CharacterFormProps) {
  const [formData, setFormData] = useState({
    name: character?.name || "",
    description: character?.description || "",
    image_url: character?.image_url || "",
    video_url: character?.video_url || "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default characters to ensure they exist in the database
  const defaultCharacters = [
    { name: "Donald Trump", image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/trump.png", description: "Default character", video_url: "" },
    { name: "Kim Jong-un", image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/kim.png", description: "Default character", video_url: "" },
    { name: "Bashar al-Assad", image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/assad.png", description: "Default character", video_url: "" },
    { name: "Vladimir Putin", image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/putin-sarcastic.png", description: "Default character", video_url: "" },
    { name: "Xi Jinping", image_url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions/pooh.png", description: "Default character", video_url: "" },
  ];

  // Insert default characters on component mount if they don’t exist
  useEffect(() => {
    const checkAndInsertDefaults = async () => {
      for (const char of defaultCharacters) {
        const { data, error } = await supabaseAnon
          .from("characters")
          .select("*")
          .eq("name", char.name)
          .single();
        if (error || !data) {
          await supabaseAnon.from("characters").insert(char);
        }
      }
    };
    checkAndInsertDefaults();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;
      if (imageFile) {
        const bucketName = "character-images";
        // Route through server-side /api/cars/upload-image (uses supabaseAdmin with
        // SUPABASE_SERVICE_ROLE_KEY — the client-side hooks/supabase.ts:uploadImage
        // throws "supabaseAdmin is unavailable" because the env var is stripped
        // from the client bundle).
        const characterSlug = (formData.name || `char-${Date.now()}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const fd = new FormData();
        fd.append("file", imageFile);
        fd.append("bucket", bucketName);
        fd.append("path", `${characterSlug}/image_1.jpg`);
        fd.append("upsert", "true");
        const upResp = await fetch("/api/cars/upload-image", { method: "POST", body: fd });
        const up = upResp.ok ? await upResp.json().catch(() => null) : null;
        if (!upResp.ok || !up?.success || !up.publicUrl) {
          throw new Error(up?.error || `Image upload failed (HTTP ${upResp.status})`);
        }
        imageUrl = up.publicUrl;
      }

      if (character) {
        // Update existing character
        const { error } = await supabaseAnon
          .from("characters")
          .update({ ...formData, image_url: imageUrl })
          .eq("id", character.id);
        if (error) throw error;
        toast.success("Character updated successfully!");
      } else {
        // Add new character
        const { error } = await supabaseAnon
          .from("characters")
          .insert({ ...formData, image_url: imageUrl });
        if (error) throw error;
        toast.success("Character added successfully!");
      }

      // Reset form after submission
      setFormData({ name: "", description: "", image_url: "", video_url: "" });
      setImageFile(null);
    } catch (error) {
      toast.error("Error saving character");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6 p-6 bg-gray-900 rounded-lg shadow-lg max-w-lg mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h2 className="text-2xl font-bold text-white">
        {character ? "Edit Character" : "Add New Character"}
      </h2>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
        />
        <input
          type="text"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          placeholder="Or enter image URL"
          className="w-full p-2 mt-2 bg-gray-800 border border-gray-700 text-white rounded"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-1">Video URL</label>
        <input
          type="text"
          value={formData.video_url}
          onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
          placeholder="Enter video URL"
          className="w-full p-2 bg-gray-800 border border-gray-700 text-white rounded"
        />
      </div>

      <button
        type="submit"
        className={`w-full p-3 bg-blue-600 text-white rounded ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : character ? "Update Character" : "Add Character"}
      </button>
    </motion.form>
  );
}