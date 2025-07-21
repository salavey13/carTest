"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/Loading";
import Image from "next/image";

const generateSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // Заменяем пробелы и подчеркивания на дефис
    .replace(/[^\w-]+/g, '') // Удаляем все не-буквенно-цифровые символы, кроме дефисов
    .replace(/--+/g, '-') // Заменяем несколько дефисов на один
    .replace(/^-+|-+$/g, ''); // Удаляем дефисы в начале и конце

export default function CreateCrewPage() {
  const { dbUser, isAdmin, isLoading: appContextLoading } = useAppContext();
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [hqLocation, setHqLocation] = useState("56.3269,44.0059"); // Default HQ location
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!appContextLoading && !isAdmin()) {
      toast.error("Доступ запрещен. Только владельцы могут создавать экипажи.");
      router.push("/admin");
    }
  }, [appContextLoading, isAdmin, router]);
  
  // Auto-generate slug from name
  useEffect(() => {
    setSlug(generateSlug(name));
  }, [name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) {
      toast.error("Ошибка: не удалось определить ID пользователя.");
      return;
    }
    if (!slug) {
      toast.error("Slug не может быть пустым. Введите название экипажа.");
      return;
    }
    setIsSubmitting(true);
    toast.info("Создание нового экипажа...");

    try {
      const result = await createCrew({
        name,
        slug,
        description,
        logo_url: logoUrl,
        owner_id: dbUser.user_id,
        hq_location: hqLocation,
      });

      if (result.success && result.data) {
        toast.success(`Экипаж "${result.data.name}" успешно создан!`);
        router.push("/paddock"); 
      } else {
        throw new Error(result.error || "Неизвестная ошибка при создании экипажа.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Произошла ошибка.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (appContextLoading) {
    return <Loading text="ПРОВЕРКА СТАТУСА ВЛАДЕЛЬЦА..." />;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 pt-24 overflow-hidden relative">
       <div className="fixed inset-0 z-[-1] opacity-20">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Admin Background"
          fill
          className="object-cover animate-pan-zoom"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="bg-dark-card/80 backdrop-blur-xl border border-brand-green/50 p-8 rounded-2xl space-y-6 shadow-2xl shadow-brand-green/20">
          <div className="text-center">
            <VibeContentRenderer content="::FaUsers::" className="text-5xl text-brand-green mx-auto mb-4" />
            <h1 className="text-4xl font-orbitron cyber-text text-brand-green" data-text="СОЗДАТЬ ЭКИПАЖ">СОЗДАТЬ ЭКИПАЖ</h1>
            <p className="text-muted-foreground font-mono mt-2">Собери свою команду и начни доминировать на улицах.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <Label htmlFor="crew-name" className="text-brand-green font-mono">НАЗВАНИЕ ЭКИПАЖА</Label>
               <Input id="crew-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Night Runners" required className="input-cyber mt-1" />
             </div>
             <div>
               <Label htmlFor="crew-slug" className="text-brand-green font-mono">SLUG (АДРЕС)</Label>
               <Input id="crew-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="night-runners" required className="input-cyber mt-1" />
             </div>
          </div>
          
          <div>
            <Label htmlFor="crew-desc" className="text-brand-green font-mono">ОПИСАНИЕ / МАНИФЕСТ</Label>
            <Textarea id="crew-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Мы — тени, что скользят по ночному городу..." required className="textarea-cyber mt-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="crew-logo" className="text-brand-green font-mono">URL ЛОГОТИПА</Label>
              <Input id="crew-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="input-cyber mt-1" />
            </div>
            <div>
              <Label htmlFor="crew-hq" className="text-brand-green font-mono">КООРДИНАТЫ ШТАБА</Label>
              <Input id="crew-hq" value={hqLocation} onChange={(e) => setHqLocation(e.target.value)} placeholder="lat,lng" className="input-cyber mt-1" />
            </div>
          </div>
          
          <Button type="submit" disabled={isSubmitting} className="w-full text-lg">
            {isSubmitting ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2':: Создание..." /> : <VibeContentRenderer content="::FaFlagCheckered:: СФОРМИРОВАТЬ ЭКИПАЖ" />}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}