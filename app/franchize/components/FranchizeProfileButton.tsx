"use client";

import Image from "next/image";
import { ChevronDown, Palette, Settings, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/contexts/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FranchizeProfileButtonProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FranchizeProfileButton({ bgColor, textColor, borderColor }: FranchizeProfileButtonProps) {
  const router = useRouter();
  const { dbUser, user, userCrewInfo, isAdmin } = useAppContext();
  const effectiveUser = dbUser || user;
  const displayName = effectiveUser?.username || effectiveUser?.full_name || effectiveUser?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = typeof isAdmin === "function" ? isAdmin() : false;

  const handleNav = (path: string) => {
    router.push(path);
  };

  return (
    <div style={{ isolation: "isolate" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Профиль и навигация"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition hover:opacity-80"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            <span className="relative block h-8 w-8 overflow-hidden rounded-full border" style={{ borderColor }}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill className="object-cover" unoptimized />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                  {getInitials(displayName)}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 opacity-80" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => handleNav("/profile")} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Профиль</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleNav("/settings")} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Настройки</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleNav("/franchize/create")} className="cursor-pointer">
            <Palette className="mr-2 h-4 w-4" />
            <span>Branding (экипаж)</span>
          </DropdownMenuItem>

          {userCrewInfo?.slug && (
            <DropdownMenuItem onClick={() => handleNav(`/crews/${userCrewInfo.slug}`)} className="cursor-pointer">
              <Palette className="mr-2 h-4 w-4" />
              <span>Мой экипаж</span>
            </DropdownMenuItem>
          )}

          {userIsAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNav("/admin")} className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}