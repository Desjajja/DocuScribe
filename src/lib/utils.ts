import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Clamp and validate a numeric string within inclusive bounds; returns number or null.
export function parseBoundedInt(value: string, min: number, max: number): number | null {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < min || n > max) return null;
  return n;
}

