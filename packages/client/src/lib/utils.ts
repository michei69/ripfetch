import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * `1 link`, `3 links` — every count this app prints is a number and a noun, so
 * the plural rule lives in one place instead of a ternary per call site.
 */
export function plural(count: number, noun: string, suffix = "s"): string {
    return `${count} ${noun}${count === 1 ? "" : suffix}`;
}
