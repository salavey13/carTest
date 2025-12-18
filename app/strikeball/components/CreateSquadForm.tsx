"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createCrew } from "@/app/actions"; // Reusing core action
import { cn } from "@/lib/utils";

const Q3Input = ({ label, value, onChange, placeholder }: any) => (
  <label className="block mb-3">
    <div className="text-[10px] text-cyan-500 font-bold mb-1 uppercase tracking-wider">{label}</div>
    <input 
      type="text"
      value={value} 
      onChange={onChange} 
      className="w-full p-3 bg-zinc-950 border border-zinc-700 text-zinc-300 font-mono text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-900 transition-colors rounded-none placeholder:text-zinc-800" 
      placeholder={placeholder} 
    />
  </label>
);

export const CreateSquadForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { dbUser, refreshDbUser } = useAppContext();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateSlug = (val: string) => val.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
      if (!slug) setSlug(generateSlug(e.target.value));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return toast.error("LOGIN REQUIRED");
    setIsSubmitting(true);

    try {
      const res = await createCrew({
          name, 
          slug: slug || generateSlug(name),
          description: "Strikeball Squad",
          logo_url: "",
          owner_id: dbUser.user_id,
          hq_location: ""
      });

      if (!res.success) throw new Error(res.error);
      
      toast.success("SQUAD ESTABLISHED");
      await refreshDbUser();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="bg-zinc-900/90 border-2 border-cyan-700 p-4">
      <h3 className="text-cyan-500 font-black font-orbitron text-lg mb-4 border-b border-cyan-900/50 pb-2">
          REGISTER NEW SQUAD
      </h3>
      <Q3Input label="Squad Name" value={name} onChange={handleNameChange} placeholder="e.g. Alpha Company" />
      <Q3Input label="Callsign (Slug)" value={slug} onChange={(e: any) => setSlug(e.target.value)} placeholder="alpha-co" />
      
      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full bg-cyan-900/50 border border-cyan-500 text-cyan-100 font-bold py-3 uppercase hover:bg-cyan-800 transition-colors"
      >
          {isSubmitting ? "PROCESSING..." : "CONFIRM REGISTRATION"}
      </button>
    </form>
  );
};