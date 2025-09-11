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

export async function triggerFileDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Download failed:", error);
    // Fallback for browsers that might block this
    window.open(url, '_blank');
  }
}
