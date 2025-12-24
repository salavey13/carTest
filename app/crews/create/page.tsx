"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import { createCrew } from "@/app/actions";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FaTerminal, FaSackDollar, FaWandSparkles, FaCircleNodes, FaCircleInfo } from 'react-icons/fa6';

const MAX_STRUCTURE_EXAMPLE = {
  is_provider: true,
  teambuilding_budget_base: 5000,
  provider_type: "facility", // or "rental_service"
  amenities: [
    { id: "grill", name: "Мангальные зоны", icon: "FaFire" },
    { id: "parking", name: "Парковка", icon: "FaCar" }
  ],
  services: [
    {
      id: "activity_01",
      name: "Tactical Paintball",
      description: "Urban warfare simulation",
      min_players: 10,
      image_url: "https://example.com/paintball.jpg",
      packages: [
        { id: "std", name: "Standard", price: 1600, includes: "400 balls, marker, mask" },
        { id: "pro", name: "Unlimited", price: 2200, includes: "Unlimited balls, smoke grenades" }
      ]
    }
  ],
  gallery: ["url1", "url2"]
};

export default function CreateCrewPage() {
  const { dbUser, refreshDbUser } = useAppContext();
  const router = useRouter();
  
  const [form, setForm] = useState({ name: "", description: "", hq: "56.3269,44.0059" });
  const [isProvider, setIsProvider] = useState(false);
  const [baseBudget, setBaseBudget] = useState("0");
  const [metadataJson, setMetadataJson] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return;

    let meta: any = { 
        is_provider: isProvider,
        teambuilding_budget_base: Number(baseBudget),
        teambuilding_budget_dynamic: 0 // Will grow by 13% of lobby revenue
    };

    if (isProvider && metadataJson) {
      try { Object.assign(meta, JSON.parse(metadataJson)); } 
      catch (e) { return toast.error("JSON Error: Check your commas and brackets"); }
    }

    toast.loading("Establishing Link...");
    const res = await createCrew({
      ...form,
      slug: form.name.toLowerCase().replace(/[\s_]+/g, '-'),
      owner_id: dbUser.user_id,
      logo_url: "",
      hq_location: form.hq,
      // @ts-ignore
      metadata: meta
    });

    if (res.success) {
      toast.dismiss();
      await refreshDbUser();
      router.push(`/crews/${res.data.slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-32 px-4 font-mono">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center">
            <FaTerminal className="text-5xl text-brand-cyan mx-auto mb-4 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]" />
            <h1 className="text-4xl font-black font-orbitron uppercase tracking-tighter italic break-words">Establish_New_Unit</h1>
            <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.4em]">Auth: Commander Level Clear</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 bg-zinc-900/30 border border-zinc-800 p-6 md:p-10 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-zinc-500">Unit Name / Callsign</Label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-black border-zinc-700 h-12" placeholder="GHOST_SQUAD" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-zinc-500">HQ Coordinates (Lat,Lng)</Label>
                <Input value={form.hq} onChange={e => setForm({...form, hq: e.target.value})} className="bg-black border-zinc-700 h-12" />
              </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-black text-zinc-500">Mission Brief / Manifesto</Label>
            <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-black border-zinc-700 h-32 text-sm italic" placeholder="The outcome is our only priority..." required />
          </div>

          <div className="bg-zinc-950 p-4 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FaCircleNodes className={isProvider ? "text-amber-500" : "text-zinc-700"} />
                    <div>
                        <div className="text-xs font-black uppercase text-white tracking-widest">Service Provider Mode</div>
                        <div className="text-[8px] text-zinc-500 uppercase">Unlock Marketplace Bidding & Service Catalog</div>
                    </div>
                </div>
                <Switch checked={isProvider} onCheckedChange={setIsProvider} />
              </div>

              {isProvider && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pt-4 border-t border-zinc-900 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-amber-500 flex items-center gap-2">
                            <FaSackDollar /> Starting Teambuilding Budget (₽)
                        </Label>
                        <Input value={baseBudget} onChange={e => setBaseBudget(e.target.value)} type="number" className="bg-black border-amber-900/50 h-12 text-amber-500" />
                        <p className="text-[9px] text-zinc-500 italic">This fund will grow automatically by 13% from every operation hosted by you.</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-[10px] uppercase font-black text-amber-500">Service Map (JSON)</Label>
                            <Button type="button" variant="ghost" className="h-6 text-[8px] text-zinc-500 gap-1 hover:text-amber-500" onClick={() => setMetadataJson(JSON.stringify(MAX_STRUCTURE_EXAMPLE, null, 2))}>
                                <FaWandSparkles /> LOAD_FULL_SCHEMA
                            </Button>
                        </div>
                        <Textarea 
                            value={metadataJson} 
                            onChange={e => setMetadataJson(e.target.value)} 
                            className="bg-black border-amber-900/50 font-mono text-[10px] text-amber-500 h-64 h-80" 
                            placeholder='{ "services": [...] }'
                        />
                        <div className="flex items-start gap-2 bg-amber-950/20 p-2 border border-amber-900/30 rounded">
                            <FaInfoCircle className="text-amber-500 mt-0.5 shrink-0" size={10} />
                            <p className="text-[8px] text-amber-200/70 leading-normal uppercase">
                                Use the schema to define your activity types, pricing, and amenities. This data will be used to auto-generate offers in Lobbies.
                            </p>
                        </div>
                    </div>
                </motion.div>
              )}
          </div>

          <Button type="submit" className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] rounded-none hover:bg-brand-cyan hover:text-white transition-all shadow-[0_10px_20px_rgba(255,255,255,0.1)]">
            Initialize_Unit_Deployment
          </Button>
        </form>
      </div>
    </div>
  );
}