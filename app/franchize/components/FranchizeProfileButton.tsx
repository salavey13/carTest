"use client";

import Image from "next/image";
import { ChevronDown, Palette, Settings, Shield, User } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navigateWithReload } from "../lib/navigation";

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
  const { dbUser, user, userCrewInfo, isAdmin } = useAppContext();
  const effectiveUser = dbUser || user;
  const displayName = effectiveUser?.username || effectiveUser?.full_name || effectiveUser?.first_name || "Operator";
  const avatarUrl = dbUser?.avatar_url || user?.photo_url;
  const userIsAdmin = typeof isAdmin === "function" ? isAdmin() : false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Профиль и навигация"
          className="inline-flex h-11 items-center gap-2 rounded-xl border px-2 transition"
          style={{ backgroundColor: bgColor, color: textColor, borderColor }}
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
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          navigateWithReload("/profile");
        }}>
          <User className="h-4 w-4" />
          Профиль
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          navigateWithReload("/settings");
        }}>
          <Settings className="h-4 w-4" />
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => {
          event.preventDefault();
          navigateWithReload("/crews/create");
        }}>
          <Palette className="h-4 w-4" />
          Branding (экипаж)
        </DropdownMenuItem>

        {userCrewInfo?.slug && (
          <DropdownMenuItem onSelect={(event) => {
            event.preventDefault();
            navigateWithReload(`/crews/${userCrewInfo.slug}`);
          }}>
            <Palette className="h-4 w-4" />
            Мой экипаж
          </DropdownMenuItem>
        )}

        {userIsAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(event) => {
              event.preventDefault();
              navigateWithReload("/admin");
            }}>
              <Shield className="h-4 w-4" />
              Admin
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
