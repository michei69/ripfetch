import { isSafeSteamImageUrl } from "./steam";

export type RecentGame = {
    id: number;
    name: string;
    cover: string;
    viewedAt: number;
};

export const RECENTS_UPDATED_EVENT = "ripfetch:recents-updated";

const STORAGE_KEY = "ripfetch:recent-games:v1";
const MAX_RECENT_GAMES = 10;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const parseRecentGame = (value: unknown): RecentGame | null => {
    if (!isRecord(value)) return null;

    const { id, name, cover, viewedAt } = value;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
        return null;
    }
    if (typeof name !== "string" || !name.trim()) return null;
    if (typeof cover !== "string" || !isSafeSteamImageUrl(cover)) return null;
    if (typeof viewedAt !== "number" || !Number.isFinite(viewedAt)) return null;

    return { id, name: name.trim(), cover, viewedAt };
};

export function readRecentGames(): RecentGame[] {
    if (typeof window === "undefined") return [];

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .flatMap((entry) => {
                const game = parseRecentGame(entry);
                return game ? [game] : [];
            })
            .sort((a, b) => b.viewedAt - a.viewedAt)
            .slice(0, MAX_RECENT_GAMES);
    } catch {
        return [];
    }
}

export function recordRecentGame(game: {
    id: number;
    name: string;
    cover: string;
}): void {
    if (typeof window === "undefined") return;

    if (
        !Number.isSafeInteger(game.id) ||
        game.id <= 0 ||
        !game.name.trim() ||
        !isSafeSteamImageUrl(game.cover)
    ) {
        return;
    }

    try {
        const existing = readRecentGames().filter(
            (entry) => entry.id !== game.id,
        );
        const next: RecentGame[] = [
            {
                id: game.id,
                name: game.name.trim(),
                cover: game.cover,
                viewedAt: Date.now(),
            },
            ...existing,
        ].slice(0, MAX_RECENT_GAMES);

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(RECENTS_UPDATED_EVENT));
    } catch {
        // Recents are best-effort; storage can be unavailable or full.
    }
}
