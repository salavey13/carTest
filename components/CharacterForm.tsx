"use client";
import { useState, useEffect } from "react";
import { supabaseAdmin, uploadImage } from "@/hooks/supabase";
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
        const { data, error } = await supabaseAdmin
          .from("characters")
          .select("*")
          .eq("name", char.name)
          .single();
        if (error || !data) {
          await supabaseAdmin.from("characters").insert(char);
        }
      }
    };
    checkAndInsertDefaults();
  }, []); // Removed defaultCharacters from dependency array as it's constant

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;
      if (imageFile) {
        const bucketName = "character-images"; // Ensure this bucket exists and is public
        const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
        if (bucketError) throw bucketError;
        if (!buckets.some((b) => b.name === bucketName)) {
          await supabaseAdmin.storage.createBucket(bucketName, { public: true });
        }
        imageUrl = await uploadImage(bucketName, imageFile);
      }

      if (character) {
        // Update existing character
        const { error } = await supabaseAdmin
          .from("characters")
          .update({ ...formData, image_url: imageUrl })
          .eq("id", character.id);
        if (error) throw error;
        toast.success("Character updated successfully!");
      } else {
        // Add new character
        const { error } = await supabaseAdmin
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