"use client";

import UserInfo from "@/components/user-info";

interface FranchizeProfileButtonProps {
  bgColor: string;
  textColor: string;
}

export function FranchizeProfileButton({ bgColor, textColor }: FranchizeProfileButtonProps) {
  return (
    <div
      className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-1 transition"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <UserInfo />
    </div>
  );
}
