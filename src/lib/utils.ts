import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalize class name, e.g. "10a3" -> "10A3"
export function normalizeClassName(input: string): string {
  const trimmed = (input || "").trim();
  const match = trimmed.match(/^(10|11|12)\s*([A-Za-z])\s*(\d{1,2})$/);
  if (!match) return trimmed.toUpperCase().replace(/\s+/g, "");
  const grade = match[1];
  const letter = match[2].toUpperCase();
  const idx = match[3];
  return `${grade}${letter}${idx}`;
}

export function isValidClassName(input: string): boolean {
  const normalized = normalizeClassName(input);
  return /^(10|11|12)[A-Z]\d{1,2}$/.test(normalized);
}
