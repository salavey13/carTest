"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getMinimalRentalsForIndicator } from "@/app/rentals/actions"; // <-- ИМПОРТ НОВОГО БЕЗОПАСНОГО ЭКШЕНА

export const ActiveRentalsIndicator = () => {
  const { dbUser, userCrewInfo, isLoading: isAppLoading } = useAppContext();
  const [activeRentalsCount, setActiveRentalsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Не делаем запрос, пока не загрузились основные данные пользователя
    if (isAppLoading) return;
    
    // Если пользователя нет, скрываем индикатор
    if (!dbUser?.user_id) {
      setIsLoading(false);
      return;
    }

    const fetchRentals = async () => {
      // Определяем ID команд, которыми владеет пользователь
      const ownedCrewIds = userCrewInfo?.is_owner && userCrewInfo.id ? [userCrewInfo.id] : [];

      // *** ГЛАВНОЕ ИЗМЕНЕНИЕ: ВЫЗЫВАЕМ БЕЗОПАСНУЮ СЕРВЕРНУЮ ФУНКЦИЮ ***
      const result = await getMinimalRentalsForIndicator(dbUser.user_id, ownedCrewIds);

      if (result.success && result.data) {
        // Считаем только те аренды, которые требуют внимания пользователя
        const activeCount = result.data.filter(r =>
          ["active", "pending_confirmation"].includes(r.status)
        ).length;
        setActiveRentalsCount(activeCount);
      } else if (result.error) {
        console.error("Failed to fetch rentals for indicator:", result.error);
      }
      setIsLoading(false);
    };

    fetchRentals();

    // Устанавливаем интервал для периодической проверки
    const intervalId = setInterval(fetchRentals, 60000); // Проверять каждую минуту
    
    // Очищаем интервал при размонтировании компонента
    return () => clearInterval(intervalId);

  }, [dbUser, userCrewInfo, isAppLoading]); // Зависим от загрузки контекста

  // Показываем скелет загрузки, пока идет первый запрос
  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />;
  }

  return (
    <TooltipProvider>
      <AnimatePresence>
        {activeRentalsCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Link
                  href="/rentals"
                  className="relative block p-2 text-primary hover:text-primary/80 rounded-full transition-colors duration-200 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                >
                  <VibeContentRenderer
                    content="::FaFileInvoice::"
                    className="h-5 w-5 sm:h-6 sm:w-6"
                  />
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                    {activeRentalsCount}
                  </span>
                </Link>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>У вас {activeRentalsCount} активных сделок</p>
            </TooltipContent>
          </Tooltip>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
};