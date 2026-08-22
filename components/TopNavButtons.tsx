"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import {
  FaUser,
  FaDumbbell,
  FaAppleAlt,
  FaUsers,
  FaCog,
  FaStar,
  FaHome
} from "react-icons/fa"; // Using FaHome for main/dashboard
import { cn } from "@/lib/utils";

const navItems = [
  // { href: "/", label: "Главная", icon: <FaHome /> }, // Optional: if you want a dedicated Home button
  { href: "/start-training", label: "Тренировка", icon: <FaDumbbell /> },
  { href: "/nutrition", label: "Питание", icon: <FaAppleAlt /> },
  { href: "/profile", label: "Профиль", icon: <FaUser /> },
  { href: "/premium", label: "Премиум", icon: <FaStar /> },
  { href: "/partner", label: "Партнерка", icon: <FaUsers /> },
  { href: "/settings", label: "Настройки", icon: <FaCog /> },
];

export default function TopNavButtons() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3 p-4 bg-card/50 rounded-lg shadow-md mb-6 border border-border">
      {navItems.map((item) => (
        <Link href={item.href} key={item.label} legacyBehavior>
          <Button
            variant={pathname === item.href ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex-grow md:flex-grow-0 text-xs sm:text-sm font-mono transition-all duration-200 ease-in-out transform hover:scale-105",
              pathname === item.href 
                ? "bg-brand-green text-black shadow-lg shadow-brand-green/30" 
                : "bg-muted hover:bg-primary/20 hover:text-primary"
            )}
          >
            <span className="mr-1.5 text-base">{item.icon}</span>
            {item.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}