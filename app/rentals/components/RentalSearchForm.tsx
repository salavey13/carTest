"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

export function RentalSearchForm() {
    const [rentalId, setRentalId] = useState('');
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedId = rentalId.trim();
        if (trimmedId) {
            router.push(`/rentals/${trimmedId}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <Input 
                type="text" 
                value={rentalId} 
                onChange={(e) => setRentalId(e.target.value)} 
                placeholder="Вставьте ID аренды..." 
                className="input-cyber h-12 text-center text-base tracking-wider flex-grow" 
            />
            <Button 
                type="submit" 
                className="h-12 w-12 text-lg font-orbitron hover:bg-primary/90" 
                disabled={!rentalId.trim()} 
                size="icon"
            >
                <VibeContentRenderer content="::FaMagnifyingGlass::" />
            </Button>
        </form>
    );
}