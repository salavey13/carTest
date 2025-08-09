"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAppContext } from '@/contexts/AppContext';
import { getUserRentals } from '@/app/rentals/actions';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type UserRentalDashboardItem = Awaited<ReturnType<typeof getUserRentals>>['data'] extends (infer U)[] ? U : never;

export const ActiveRentalsIndicator = () => {
    const { dbUser } = useAppContext();
    const [activeRentalsCount, setActiveRentalsCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!dbUser?.user_id) {
            setIsLoading(false);
            return;
        }

        const fetchRentals = async () => {
            setIsLoading(true);
            const result = await getUserRentals(dbUser.user_id);
            if (result.success && result.data) {
                const active = result.data.filter(r => r.status === 'active' || r.status === 'pending_confirmation');
                setActiveRentalsCount(active.length);
            }
            setIsLoading(false);
        };
        fetchRentals();
    }, [dbUser]);

    if (isLoading) {
        return <div className="w-8 h-8 bg-muted/20 rounded-md animate-pulse" />;
    }

    if (activeRentalsCount === 0) {
        return null; // Не отображаем ничего, если нет активных аренд
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link href="/rentals" passHref legacyBehavior>
                    <motion.a 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative p-2 text-brand-orange hover:text-brand-orange/70 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-orange/10 animate-pulse"
                    >
                        <VibeContentRenderer content="::FaFileInvoice::" className="h-5 w-5 sm:h-6 sm:w-6" />
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                            {activeRentalsCount}
                        </span>
                    </motion.a>
                </Link>
            </TooltipTrigger>
            <TooltipContent>
                <p>У вас {activeRentalsCount} активных сделок</p>
            </TooltipContent>
        </Tooltip>
    );
};