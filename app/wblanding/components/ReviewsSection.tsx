"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { getApprovedTestimonials } from '../actions_view';
import { supabaseAdmin } from '@/hooks/supabase'; // Можно вынести в action_create_review, но для краткости тут

interface Testimonial {
  id: string;
  username?: string;
  content: string;
  rating: number;
}

export const ReviewsSection = () => {
  const { dbUser } = useAppContext();
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [newReview, setNewReview] = useState("");
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getApprovedTestimonials().then(res => {
      if (res.success && res.data) setReviews(res.data as any);
    });
  }, []);

  const handleSubmit = async () => {
    if (!dbUser) return toast.error("Войдите, чтобы оставить отзыв");
    if (newReview.length < 10) return toast.error("Минимум 10 символов");
    
    setIsSubmitting(true);
    try {
      // Лучше вынести в Server Action, но для примера:
      const { error } = await supabaseAdmin.from('testimonials').insert({
        user_id: dbUser.user_id,
        username: dbUser.username || 'Anon',
        content: newReview,
        rating: rating,
        is_approved: false // Премодерация
      });
      
      if (error) throw error;
      
      toast.success("Отзыв отправлен на модерацию!");
      setNewReview("");
    } catch (e) {
      toast.error("Ошибка отправки");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-white font-orbitron">ГОЛОСА ИЗ ТЕНИ (ОТЗЫВЫ)</h2>
        
        {/* Review List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {reviews.length > 0 ? reviews.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="bg-black p-6 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-brand-cyan text-xs">
                            {t.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                           <div className="font-bold text-white text-sm">{t.username || 'Аноним'}</div>
                           <div className="flex text-yellow-500 text-xs">
                             {[...Array(5)].map((_, i) => (
                               <Star key={i} className={`w-3 h-3 ${i < t.rating ? 'fill-current' : 'text-gray-700'}`} />
                             ))}
                           </div>
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm italic">"{t.content}"</p>
                </motion.div>
            )) : (
                <div className="col-span-full text-center text-gray-500 italic">Пока тихо... Система в бете.</div>
            )}
        </div>

        {/* Input Form */}
        {dbUser ? (
            <div className="max-w-2xl mx-auto bg-black border border-zinc-800 p-6 rounded-xl">
                <h3 className="text-white font-bold mb-4">Оставить отзыв</h3>
                <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setRating(s)}>
                            <Star className={`w-6 h-6 ${s <= rating ? 'text-yellow-500 fill-current' : 'text-gray-600'}`} />
                        </button>
                    ))}
                </div>
                <Textarea 
                    value={newReview} 
                    onChange={(e) => setNewReview(e.target.value)} 
                    placeholder="Как мы спасли твой склад (или нет)..." 
                    className="bg-zinc-900 border-zinc-700 text-white mb-4"
                />
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-zinc-800 hover:bg-brand-cyan hover:text-black">
                    {isSubmitting ? "Отправка..." : <><Send className="w-4 h-4 mr-2" /> ОТПРАВИТЬ</>}
                </Button>
            </div>
        ) : (
            <div className="text-center">
                <p className="text-gray-500 text-sm">Войдите, чтобы оставить отзыв.</p>
            </div>
        )}
      </div>
    </section>
  );
};