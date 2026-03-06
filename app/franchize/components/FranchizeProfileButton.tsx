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
  const franchizeAdminHref = `/franchize/admin${userCrewInfo?.slug ? `?slug=${encodeURIComponent(userCrewInfo.slug)}` : ""}`;

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

        <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1.5rem)]" sideOffset={8}>
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <User className="mr-2 h-4 w-4" />
              <span className="truncate">Профиль</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Settings className="mr-2 h-4 w-4" />
              <span className="truncate">Настройки</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/franchize/create" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Palette className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Branding (экипаж)</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={franchizeAdminHref} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
              <Shield className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Franchize admin</span>
            </Link>
          </DropdownMenuItem>

          {userCrewInfo?.slug && (
            <DropdownMenuItem asChild>
              <Link href={`/crews/${userCrewInfo.slug}`} className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                <Palette className="mr-2 h-4 w-4" />
                <span className="truncate">Мой экипаж</span>
              </Link>
            </DropdownMenuItem>
          )}

          {userIsAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer flex min-w-0 items-center gap-2 w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  <span className="truncate">Admin</span>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}