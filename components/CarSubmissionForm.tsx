// components/CarSubmissionForm.tsx
'use client';
import { useState } from 'react';
import { supabaseAdmin } from '@/hooks/supabase';
import { uploadImage } from '@/hooks/supabase';

export function CarSubmissionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    description: '',
    specs: {} as Record<string, string>, // Structured specs object
    daily_price: '',
    image_url: '',
    rent_link: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null); // For image upload

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Handle image upload if a file is selected
      let imageUrl = formData.image_url;
      if (imageFile) {
        const bucketName = 'car-images'; // Public bucket for car images
        imageUrl = await uploadImage(bucketName, imageFile);
      }

      // Combine description and specs into a single text input
      const specsString = JSON.stringify(formData.specs); // Convert specs to JSON string
      const combinedText = `${formData.description} ${specsString}`;

      // Generate embedding (assuming generateEmbedding is available)
      const embedding = await generateEmbedding(combinedText);

      // Insert the car into the database
      const { data: car, error: insertError } = await supabaseAdmin
        .from('cars')
        .insert({
          ...formData,
          specs: formData.specs, // Store specs as JSON object
          daily_price: Number(formData.daily_price),
          image_url: imageUrl,
          rent_link: formData.rent_link || `/rent/${formData.id}`, // Default rent link
          embedding: JSON.stringify(embedding),
        })
        .select(); // Return the inserted car to get its ID

      if (insertError) throw insertError;

      // Reset form data
      setFormData({
        make: '',
        model: '',
        description: '',
        specs: {},
        daily_price: '',
        image_url: '',
        rent_link: '',
      });
      setImageFile(null); // Clear uploaded image

      alert('Car added successfully!');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Error adding car');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Make */}
      <div>
        <input
          type="text"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          placeholder="Make (e.g., Tesla)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Model */}
      <div>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="Model (e.g., Roadster)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description (e.g., Futuristic electric supercar)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Specs */}
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Specifications</h3><div className="space-y-2">
          {Object.entries(formData.specs).map(([key, value], index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specs: {
                      ...formData.specs,
                      [e.target.value]: formData.specs[key],
                    },
                  })
                }
                placeholder="Key (e.g., version)"
                className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
              <input
                type="text"
                value={value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specs: {
                      ...formData.specs,
                      [key]: e.target.value,
                    },
                  })
                }
                placeholder="Value (e.g., v12)"
                className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData({ ...formData, specs: { ...formData.specs, '': '' } })}
            className="w-full p-3 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            Add Spec
          </button>
        </div>
      </div>

      {/* Daily Price */}
      <div>
        <input
          type="number"
          value={formData.daily_price}
          onChange={(e) => setFormData({ ...formData, daily_price: e.target.value })}
          placeholder="Daily Price ($)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          required
        />
      </div>

      {/* Image URL or Upload */}
      <div>
        <h3 className="text-lg font-semibold text-cyan-400 mb-2">Image</h3>
        <div className="flex gap-4 items-center">
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="Image URL (optional)"
            className="flex-1 p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <label
            htmlFor="image-upload"
            className="p-3 rounded bg-gray-700 text-white hover:bg-gray-600 transition-colors cursor-pointer"
          >
            Upload Image
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>
      </div>

      {/* Rent Link */}
      <div>
        <input
          type="url"
          value={formData.rent_link}
          onChange={(e) => setFormData({ ...formData, rent_link: e.target.value })}
          placeholder="Rent Link (default: /rent/<id>)"
          className="w-full p-3 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full p-3 rounded bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Adding Car...' : 'Add Rental Car'}
      </button>
    </form>
  );
}

