"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FaTerminal, FaCircleNodes, FaWandSparkles } from 'react-icons/fa6';
import { motion, AnimatePresence } from 'framer-motion';

const AI_TEMPLATE = {
  is_provider: true,
  teambuilding_budget_base: 5000,
  services: [
    {
      id: "activity_id",
      name: "Activity Name",
      description: "Tactical brief here",
      min_players: 10,
      packages: [{ id: "p1", name: "Standard", price: 1500, includes: "Gear, 2h Play" }]
    }
  ]
};

export default function CreateCrewPage() {
  const { dbUser, refreshDbUser } = useAppContext();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isProvider, setIsProvider] = useState(false);
  const [metadataJson, setMetadataJson] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return;

    let meta = {};
    if (isProvider) {
        try { meta = JSON.parse(metadataJson || "{}"); } 
        catch (e) { return toast.error("INVALID_JSON_METADATA"); }
    }

    toast.loading("ESTABLISHING_LINK...");
    const res = await createCrew({
      name,
      slug: name.toLowerCase().replace(/ /g, '-'),
      description,
      owner_id: dbUser.user_id,
      logo_url: "",
      hq_location: "56.3269,44.0059",
      // @ts-ignore
      metadata: { ...meta, is_provider: isProvider }
    });

    if (res.success) {
      toast.dismiss();
      toast.success("SQUAD_DEPLOYED");
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
            <FaTerminal className="text-5xl text-cyan-500 mx-auto mb-4" />
            <h1 className="text-4xl font-black font-orbitron uppercase tracking-tighter italic">Establish_Crew</h1>
            <p className="text-[10px] text-zinc-600 mt-2 tracking-[0.4em] uppercase">Security Clearance Level: COMMANDER</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/50 border border-zinc-800 p-8 shadow-2xl">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-black text-zinc-500">Squad Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-black border-zinc-700 rounded-none h-12 text-lg focus:border-cyan-500 transition-all" placeholder="E.G. GHOST_UNIT" required />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-black text-zinc-500">Mission Brief / Manifesto</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-black border-zinc-700 rounded-none h-32 text-sm italic" placeholder="We rule the darkness..." required />
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div className="flex gap-4 items-center">
                <FaCircleNodes className={isProvider ? "text-amber-500" : "text-zinc-700"} />
                <div>
                    <div className="text-xs font-black uppercase tracking-widest text-white">Commercial Provider Status</div>
                    <div className="text-[8px] text-zinc-500 uppercase">Unlock service catalog and WMS tracking</div>
                </div>
            </div>
            <Switch checked={isProvider} onCheckedChange={setIsProvider} />
          </div>

          <AnimatePresence>
            {isProvider && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 pt-4 border-t border-zinc-800 overflow-hidden">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] uppercase font-black text-amber-500">Service Config (JSON)</Label>
                        <Button type="button" variant="ghost" className="h-6 text-[8px] gap-1 hover:text-amber-400" onClick={() => setMetadataJson(JSON.stringify(AI_TEMPLATE, null, 2))}>
                            <FaWandSparkles /> LOAD_AI_TEMPLATE
                        </Button>
                    </div>
                    <Textarea value={metadataJson} onChange={e => setMetadataJson(e.target.value)} className="bg-black border-amber-900/50 rounded-none h-64 font-mono text-[10px] text-amber-500" placeholder="{ ... }" />
                    <p className="text-[8px] text-zinc-500 italic">Pro-tip: Ask your AI to 'generate provider metadata json' using this schema.</p>
                </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] rounded-none hover:bg-cyan-500 hover:text-white transition-all">
            Initialize_Deployment
          </Button>
        </form>
      </motion.div>
    </div>
  );
}