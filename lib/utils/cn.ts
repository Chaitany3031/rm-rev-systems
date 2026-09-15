import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Tailwind CSS class merging utility.
 * Used across all shadcn/ui components and application code.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
