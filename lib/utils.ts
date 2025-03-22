// /lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function getBaseUrl() {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://v0-car-test.vercel.app";
}
