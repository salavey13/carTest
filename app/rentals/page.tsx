"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";
import { motion } from "framer-motion";

export default function FindRentalPage() {
    const [rentalId, setRentalId] = useState('');
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (rentalId.trim()) {
            router.push(`/rentals/${rentalId.trim()}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
             <div className="fixed inset-0 z-[-1] opacity-20">
                <Image
                    src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
                    alt="Background"
                    fill
                    className="object-cover animate-pan-zoom"
                />
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md bg-card/70 backdrop-blur-xl border border-brand-purple/30 rounded-2xl shadow-2xl shadow-brand-purple/10 p-8"
            >
                <div className="text-center mb-6">
                    <VibeContentRenderer content="::FaTicketAlt::" className="text-5xl text-brand-cyan mx-auto mb-4" />
                    <h1 className="text-3xl font-orbitron text-foreground">Найти Аренду</h1>
                    <p className="text-muted-foreground mt-2 font-mono text-sm">Введите ID вашей аренды, чтобы продолжить.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="text"
                        value={rentalId}
                        onChange={(e) => setRentalId(e.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="input-cyber h-12 text-center text-base tracking-wider"
                        required
                    />
                    <Button type="submit" className="w-full h-12 text-lg font-orbitron" disabled={!rentalId.trim()}>
                        <VibeContentRenderer content="::FaSearch:: Найти" />
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}