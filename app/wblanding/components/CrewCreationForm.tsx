"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from "@/contexts/AppContext";
import { createCrew, notifyAdmin } from "@/app/actions";
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FaFlagCheckered, FaUserPlus, FaUsers, FaWarehouse } from 'react-icons/fa6';
import { Loader2, ArrowRight } from 'lucide-react';
import { motion } from "framer-motion";
import Link from 'next/link';

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

export const CrewCreationForm = () => {
  const { dbUser, userCrewInfo, refreshDbUser } = useAppContext(); // Using global context for state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate slug
  useEffect(() => { setSlug(generateSlug(name)); }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) { toast.error("Войдите в систему!"); return; }
    if (!slug) { toast.error("Slug обязателен"); return; }
    
    setIsSubmitting(true);
    try {
      const result = await createCrew({
        name, slug, description, logo_url: logoUrl, owner_id: dbUser.user_id, hq_location: hqLocation,
      });
      
      if (result.success && result.data) {
        toast.success(`Штаб "${result.data.name}" развернут!`);
        await refreshDbUser(); // Update context to reflect new crew
        await notifyAdmin(`🎉 New Crew: ${result.data.name} by ${dbUser.username}`);
        await sendComplexMessage(dbUser.user_id, `🎉 Склад "${result.data.name}" готов.`, []);
      } else { throw new Error(result.error || "Error creating crew"); }
    } catch (error) {
      toast.error("Ошибка создания: " + (error as Error).message);
    } finally { setIsSubmitting(false); }
  };

  const handleInvite = () => {
    if (!userCrewInfo) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${userCrewInfo.slug}_join_crew`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=Вступай в команду склада ${userCrewInfo.name}!`;
    window.open(shareUrl, "_blank");
  };

  // --- STATE: ALREADY HAS CREW ---
  if (userCrewInfo) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="max-w-2xl mx-auto bg-zinc-900/80 backdrop-blur-md p-8 rounded-2xl border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.15)]"
      >
        <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-indigo-500 relative">
                <FaWarehouse className="w-10 h-10 text-indigo-400" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-zinc-900"></div>
            </div>
            
            <div>
                <h3 className="text-2xl font-bold text-white font-orbitron mb-2">{userCrewInfo.name}</h3>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono text-gray-400">
                    <span className="text-neon-lime">●</span> ONLINE
                    <span className="text-zinc-600">|</span>
                    {userCrewInfo.is_owner ? "OWNER" : "MEMBER"}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {userCrewInfo.is_owner && (
                    <Button onClick={handleInvite} className="w-full bg-brand-cyan text-black font-bold h-12 text-base hover:bg-brand-cyan/90 shadow-lg shadow-cyan-500/20">
                        <FaUserPlus className="mr-2"/> ПРИГЛАСИТЬ БАНДУ
                    </Button>
                )}
                <Link href={`/wb/${userCrewInfo.slug}`} className={userCrewInfo.is_owner ? "" : "col-span-2"}>
                    <Button variant="outline" className="w-full border-zinc-600 text-white hover:bg-white hover:text-black h-12 text-base">
                        ВОЙТИ В ШТАБ <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </Link>
            </div>
        </div>
      </motion.div>
    );
  }

  // --- STATE: CREATE NEW CREW ---
  return (
    <motion.div 
      id="create-crew-form"
      initial={{ opacity: 0, y: 20 }} 
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="max-w-2xl mx-auto bg-zinc-900/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl"
    >
        <div className="text-center mb-8">
            <FaUsers className="w-12 h-12 text-neon-lime mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white font-orbitron">РАЗВЕРНУТЬ БАЗУ</h3>
            <p className="text-gray-400 text-sm">Создай своё пространство. Пригласи команду. Начни игру.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label className="text-gray-400 text-xs font-mono">НАЗВАНИЕ</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Black Star Warehouse" className="bg-black border-zinc-700 text-white" required />
                </div>
                <div>
                    <Label className="text-gray-400 text-xs font-mono">SLUG (URL)</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="black-star" className="bg-black border-zinc-700 text-white" required />
                </div>
            </div>
            
            <div>
                <Label className="text-gray-400 text-xs font-mono">ОПИСАНИЕ</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Главный распределительный центр..." className="bg-black border-zinc-700 text-white" />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-neon-lime hover:bg-neon-lime/80 text-black font-bold py-4 text-lg rounded-xl shadow-[0_0_15px_rgba(100,255,100,0.3)] transition-all">
                {isSubmitting ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2"><FaFlagCheckered /> СОЗДАТЬ ЭКИПАЖ</span>}
            </Button>
        </form>
    </motion.div>
  );
};