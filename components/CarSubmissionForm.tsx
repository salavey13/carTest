// components/CarSubmissionForm.tsx
'use client';
import { useState } from 'react';
import { useWorker } from '@/hooks/useWorker';

export function CarSubmissionForm() {
  const { generateEmbedding } = useWorker();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    description: '',
    daily_price: '',
    image_url: '',
    rent_link: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const embedding = await generateEmbedding(formData.description);
      
      await supabase.from('cars').insert({
        ...formData,
        daily_price: Number(formData.daily_price),
        embedding: JSON.stringify(embedding)
      });
      
      setFormData({
        make: '',
        model: '',
        description: '',
        daily_price: '',
        image_url: '',
        rent_link: ''
      });
      
      alert('Car added successfully!');
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Error adding car');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">Make</label>
        <input
          type="text"
          value={formData.make}
          onChange={(e) => setFormData({...formData, make: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Model</label>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({...formData, model: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white h-32"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Daily Price ($)</label>
        <input
          type="number"
          value={formData.daily_price}
          onChange={(e) => setFormData({...formData, daily_price: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Image URL</label>
        <input
          type="url"
          value={formData.image_url}
          onChange={(e) => setFormData({...formData, image_url: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white"
          required
        />
      </div>

      <div>
        <label className="block mb-1">Rent Link</label>
        <input
          type="url"
          value={formData.rent_link}
          onChange={(e) => setFormData({...formData, rent_link: e.target.value})}
          className="w-full p-2 rounded bg-gray-800 text-white"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Adding Car...' : 'Add Rental Car'}
      </button>
    </form>
  );
}

