"use client";

import Link from "next/link";
import Image from "next/image";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import UserInfo from "@/components/user-info";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ActiveRentalsIndicator } from "@/components/ActiveRentalsIndicator"; // <-- ИМПОРТ НОВОГО КОМПОНЕНТА

export default function BikeHeader() {
  const { tg, isInTelegramContext, userCrewInfo } = useAppContext();

  const handleInvite = () => {
    if (!userCrewInfo) return;
    const inviteUrl = `https://t.me/oneBikePlsBot/app?startapp=crew_${userCrewInfo.slug}_join_crew`;
    const text = `Присоединяйся к нашему экипажу '${userCrewInfo.name}' в VibeRider!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;
    if (isInTelegramContext && tg) {
        tg.openLink(shareUrl);
    } else {
        window.open(shareUrl, "_blank");
    }
  };

  return (
    <TooltipProvider>
      <motion.header
        className={cn("fixed top-0 left-0 right-0 z-40 bg-black/80 border-b border-brand-orange/40 shadow-md backdrop-blur-md")}
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: "tween", duration: 0.3 }}
      >
        <div className="container mx-auto px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/vipbikerental"
              className={cn("text-2xl md:text-3xl font-orbitron font-bold uppercase tracking-wider", "transition-all duration-300 hover:brightness-125 flex items-center gap-3")}
            >
              <Image 
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_20250725_233953_793-f4d8a590-5d2c-4416-9969-c8f9a4627eb5.jpg" 
                alt="Vip Bike Rental Logo" 
                width={36} 
                height={36} 
                className="rounded-full"
              />
              <div className="flex items-baseline">
                <span className="text-brand-orange glitch" data-text="VIP">VIP</span>
                <span className="gta-vibe-text-effect">BIKE</span>
              </div>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
                {/* --- ИЗМЕНЕНИЯ ЗДЕСЬ --- */}
                <ActiveRentalsIndicator />

                {userCrewInfo ? (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={handleInvite} className="p-2 text-brand-lime hover:text-brand-lime/70 focus:outline-none focus:ring-2 focus:ring-brand-lime focus:ring-offset-2 focus:ring-offset-black rounded-md transition-all duration-200 hover:bg-brand-lime/10">
                                    <VibeContentRenderer content="::FaUserPlus::" className="h-5 w-5 sm:h-6 sm:w-6" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Пригласить в Экипаж</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <Link href={`/crews/${userCrewInfo.slug}`}>
                                    <Image src={userCrewInfo.logo_url} alt={userCrewInfo.name} width={32} height={32} className="rounded-full border-2 border-brand-green/50 hover:border-brand-green transition-colors"/>
                                 </Link>
                            </TooltipTrigger>
                            <TooltipContent><p>Мой Экипаж: {userCrewInfo.name}</p></TooltipContent>
                        </Tooltip>
                    </>
                ) : (
                   null // Убрали иконку-ссылку на бота, так как она не нужна постоянно
                )}

                <UserInfo />
            </div>
          </div>
        </div>
      </motion.header>
    </TooltipProvider>
  );
}