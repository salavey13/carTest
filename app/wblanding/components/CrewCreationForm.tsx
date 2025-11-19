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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FaFlagCheckered, FaUserPlus, FaUsers } from 'react-icons/fa6';
import { Loader2 } from 'lucide-react';
import { motion } from "framer-motion";
import Link from 'next/link';

const generateSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+|-+$/g, '');

export const CrewCreationForm = () => {
  const { dbUser } = useAppContext();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCrew, setCreatedCrew] = useState<{ slug: string; name: string } | null>(null);

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
        setCreatedCrew({ slug: result.data.slug, name: result.data.name });
        await notifyAdmin(`🎉 New Crew: ${result.data.name} by ${dbUser.username}`);
        await sendComplexMessage(dbUser.user_id, `🎉 Склад "${result.data.name}" готов.`, []);
      } else { throw new Error(result.error || "Error creating crew"); }
    } catch (error) {
      toast.error("Ошибка создания: " + (error as Error).message);
    } finally { setIsSubmitting(false); }
  };

  const handleInvite = () => {
    if (!createdCrew) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${createdCrew.slug}_join_crew`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=Вступай в команду склада!`;
    window.open(shareUrl, "_blank");
  };

  if (createdCrew) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-6 bg-zinc-900/50 p-8 rounded-2xl border border-green-500/30">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <FaFlagCheckered className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-3xl font-bold text-white">База развернута!</h3>
        <p className="text-gray-400">Склад "{createdCrew.name}" готов к работе.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleInvite} className="bg-brand-cyan text-black font-bold px-8 py-4 rounded-xl">
                <FaUserPlus className="mr-2"/> ПРИГЛАСИТЬ БАНДУ
            </Button>
            <Link href={`/wb/${createdCrew.slug}`}>
                <Button variant="outline" className="border-zinc-600 text-white hover:bg-white hover:text-black px-8 py-4 rounded-xl">
                    ПЕРЕЙТИ НА СКЛАД
                </Button>
            </Link>
        </div>
      </motion.div>
    );
  }

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
            <h3 className="text-2xl font-bold text-white font-orbitron">СОЗДАНИЕ ШТАБА</h3>
            <p className="text-gray-400 text-sm">Бесплатно. Без СМС. 30 секунд.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label className="text-gray-400 text-xs font-mono">НАЗВАНИЕ</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Warehouse" className="bg-black border-zinc-700 text-white" required />
                </div>
                <div>
                    <Label className="text-gray-400 text-xs font-mono">SLUG (URL)</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="main-wh" className="bg-black border-zinc-700 text-white" required />
                </div>
            </div>
            
            <div>
                <Label className="text-gray-400 text-xs font-mono">ОПИСАНИЕ</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Главный склад на Южной..." className="bg-black border-zinc-700 text-white" />
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-neon-lime hover:bg-neon-lime/80 text-black font-bold py-4 text-lg rounded-xl shadow-[0_0_15px_rgba(100,255,100,0.3)] transition-all">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "СФОРМИРОВАТЬ ЭКИПАЖ"}
            </Button>
        </form>
    </motion.div>
  );
};