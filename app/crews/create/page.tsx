"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FaTerminal, FaCircleNodes, FaWandSparkles, FaRocket } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';

// Тот же конфиг, но на русском
const MAX_PROVIDER_SCHEMA = {
  "is_provider": true,
  "provider_type": "facility",
  "teambuilding_budget_base": 10000,
  "contacts": {
    "phone": "8-9XX-XXX-XX-XX",
    "manager": "Позывной Командира",
    "working_hours": "10:00 - 22:00"
  },
  "services": [
    {
      "id": "match_game",
      "name": "Тактическая игра",
      "description": "Организация матча на нашей территории",
      "min_players": 8,
      "packages": [
        { "id": "std", "name": "Стандарт", "price": 1500, "includes": "Прокат, 2 часа игры, зона отдыха" }
      ]
    }
  ]
};

export default function CreateCrewPage() {
  const { dbUser, userCrewInfo, refreshDbUser } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUpgrade = searchParams.get('upgrade') === 'true';

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isProvider, setIsProvider] = useState(isUpgrade);
  const [metadataJson, setMetadataJson] = useState("");

  // ПРЕДЗАПОЛНЕНИЕ ПРИ АПГРЕЙДЕ
  useEffect(() => {
    if (isUpgrade && userCrewInfo) {
        setName(userCrewInfo.name);
        // Можно добавить запрос для получения полного описания, если нужно
    }
  }, [isUpgrade, userCrewInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return;

    let meta = {};
    if (isProvider) {
        try { meta = JSON.parse(metadataJson || "{}"); } 
        catch (e) { return toast.error("ОШИБКА JSON МЕТАДАННЫХ"); }
    }

    toast.loading(isUpgrade ? "МОДЕРНИЗАЦИЯ БАЗЫ..." : "УСТАНОВКА СВЯЗИ...");
    
    const res = await createCrew({
      name,
      slug: name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
      description,
      owner_id: dbUser.user_id,
      logo_url: "",
      hq_location: "56.3269,44.0059",
      // @ts-ignore
      metadata: { ...meta, is_provider: isProvider }
    });

    if (res.success) {
      toast.dismiss();
      toast.success(isUpgrade ? "БАЗА МОДЕРНИЗИРОВАНА" : "СЕКТОР ЗАНЯТ");
      await refreshDbUser();
      router.push(`/crews/${res.data.slug}`);
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-28 px-4 pb-32 font-mono">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-2xl mx-auto space-y-12">
        <div className="text-center">
            {isUpgrade ? <FaRocket className="text-5xl text-amber-500 mx-auto mb-4" /> : <FaTerminal className="text-5xl text-cyan-500 mx-auto mb-4" />}
            <h1 className="text-4xl font-black font-orbitron uppercase tracking-tighter italic">
                {isUpgrade ? "Upgrade_Base" : "Establish_Crew"}
            </h1>
            <p className="text-[10px] text-zinc-600 mt-2 tracking-[0.4em] uppercase">Уровень доступа: КОМАНДИР</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/50 border border-zinc-800 p-8 shadow-2xl">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-black text-zinc-500">Название Подразделения</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-black border-zinc-700 rounded-none h-12 text-lg focus:border-cyan-500 transition-all" required />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-black text-zinc-500">Манифест / Описание</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-black border-zinc-700 rounded-none h-32 text-sm italic" placeholder="Мы те, кто..." required />
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div className="flex gap-4 items-center">
                <FaCircleNodes className={isProvider ? "text-amber-500" : "text-zinc-700"} />
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-white">Статус Провайдера</div>
                    <div className="text-[8px] text-zinc-500 uppercase">Открыть каталог услуг и прием оплаты</div>
                </div>
            </div>
            <Switch checked={isProvider} onCheckedChange={setIsProvider} />
          </div>

          <AnimatePresence>
            {isProvider && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 pt-4 border-t border-zinc-800 overflow-hidden">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] uppercase font-black text-amber-500">Конфиг Услуг (JSON)</Label>
                        <Button type="button" variant="ghost" className="h-6 text-[8px] gap-1 hover:text-amber-400" onClick={() => setMetadataJson(JSON.stringify(MAX_PROVIDER_SCHEMA, null, 2))}>
                            <FaWandSparkles /> ЗАГРУЗИТЬ ШАБЛОН
                        </Button>
                    </div>
                    <Textarea value={metadataJson} onChange={e => setMetadataJson(e.target.value)} className="bg-black border-amber-900/50 rounded-none h-64 font-mono text-[10px] text-amber-500" placeholder="{ ... }" />
                </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] rounded-none hover:bg-cyan-500 hover:text-white transition-all">
            {isUpgrade ? "ПРИМЕНИТЬ_МОДЕРНИЗАЦИЮ" : "ПОДТВЕРДИТЬ_ДИСЛОКАЦИЮ"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}