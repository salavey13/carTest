import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { logger } from "./logger";
import { ethers } from 'ethers';

/**
 * calcFee: принимает amountWei (строка целого, wei), feeBps и возвращает строку wei для fee.
 * Реализовано через bigint — совместимо с ethers@6 (ethers.parseUnits возвращает bigint).
 */
export function calcFee(amountWei: string, feeBps: number, round: 'floor' | 'round' = 'round') {
  const amt = BigInt(amountWei);
  const numerator = amt * BigInt(feeBps);
  const denom = 10_000n;
  const raw = numerator / denom;
  if (round === 'floor') return raw.toString();
  const rem = numerator % denom;
  const add = (rem * 2n >= denom) ? 1n : 0n;
  return (raw + add).toString();
}

/**
 * reverseAmountWithFee: given repay = loan + fee,
 * compute loan using bigint arithmetic.
 */
export function reverseAmountWithFee(repayWei: string, feeBps: number) {
  const r = BigInt(repayWei);
  const loan = r * 10000n / (10000n + BigInt(feeBps));
  return loan.toString();
}

// convert decimal amount to wei string (token decimals) using ethers.parseUnits (v6 returns bigint)
export function decimalsToWei(amount: string, decimals: number) {
  const v = ethers.parseUnits(amount, decimals); // bigint
  return v.toString();
}

/**
 * formatDate: небольшая функция-утилита (оставлена простая)
 */
export function formatDate(dateInput: Date | string | number, locale: string = 'ru-RU') {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  return d.toLocaleDateString(locale);
}

/**
 * cn: combine tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}