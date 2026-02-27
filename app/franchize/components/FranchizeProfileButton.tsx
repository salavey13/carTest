"use client";

import Image from "next/image";
import Link from "next/link";
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
    <div style={{ isolation: "isolate", pointerEvents: "auto" }}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Профиль и навигация"
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition hover:opacity-80"
            style={{ backgroundColor: bgColor, color: textColor, pointerEvents: "auto" }}
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

          {/* 
            FIX: Nested Link inside DropdownMenuItem without 'asChild'.
            Added 'p-0' to Item and padding to Link to ensure the click target is the Link itself.
          */}
          <DropdownMenuItem className="p-0 focus:bg-transparent">
            <Link href="/profile" className="flex w-full cursor-pointer items-center px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm outline-none">
              <User className="mr-2 h-4 w-4" />
              <span>Профиль</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="p-0 focus:bg-transparent">
            <Link href="/settings" className="flex w-full cursor-pointer items-center px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm outline-none">
              <Settings className="mr-2 h-4 w-4" />
              <span>Настройки</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="p-0 focus:bg-transparent">
            <Link href="/franchize/create" className="flex w-full cursor-pointer items-center px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm outline-none">
              <Palette className="mr-2 h-4 w-4" />
              <span>Branding (экипаж)</span>
            </Link>
          </DropdownMenuItem>

          {userCrewInfo?.slug && (
            <DropdownMenuItem className="p-0 focus:bg-transparent">
              <Link href={`/crews/${userCrewInfo.slug}`} className="flex w-full cursor-pointer items-center px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm outline-none">
                <Palette className="mr-2 h-4 w-4" />
                <span>Мой экипаж</span>
              </Link>
            </DropdownMenuItem>
          )}

          {userIsAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-0 focus:bg-transparent">
                <Link href="/admin" className="flex w-full cursor-pointer items-center px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm outline-none">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}