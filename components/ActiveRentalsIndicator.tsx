"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { supabaseAdmin } from "@/hooks/supabase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MinimalRental = {
  rental_id: string;
  status: string;
};

export const ActiveRentalsIndicator = () => {
  const { dbUser, userCrewInfo } = useAppContext();
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!dbUser?.user_id) {
      setIsLoading(false);
      return;
    }

    const fetchRentals = async () => {
      setIsLoading(true);

      const crewIds =
        userCrewInfo?.is_owner && userCrewInfo.id
          ? [userCrewInfo.id]
          : [];

      const { data, error } = await supabaseAdmin.rpc("get_user_rentals_dashboard", {
        p_owned_crew_ids: crewIds,
        p_user_id: dbUser.user_id,
        p_minimal: true
      });

      if (error) {
        console.error("Ошибка получения аренд:", error);
        setIsLoading(false);
        return;
      }

      const minimalData = (data as MinimalRental[]) || [];
      const active = minimalData.filter(r =>
        ["active", "pending_confirmation"].includes(r.status)
      ).length;

      setActiveRentalsCount(active);
      setIsLoading(false);
    };

    fetchRentals();
  }, [dbUser, userCrewInfo]);

  if (isLoading) {
    return <div className="w-8 h-8 bg-muted/20 rounded-md animate-pulse" />;
  }

  if (activeRentalsCount === 0) {
    return null;
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
            <VibeContentRenderer
              content="::FaFileInvoice::"
              className="h-5 w-5 sm:h-6 sm:w-6"
            />
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