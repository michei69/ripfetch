import { useEffect, useState } from "react";
import {
    readRecentGames,
    RECENTS_UPDATED_EVENT,
    type RecentGame,
} from "../lib/recentlyViewed";

/**
 * Recently viewed games, kept in sync across tabs and with writes made
 * elsewhere in the same tab.
 */
export function useRecents(): RecentGame[] {
    const [recents, setRecents] = useState<RecentGame[]>([]);

    useEffect(() => {
        setRecents(readRecentGames());

        const sync = () => setRecents(readRecentGames());
        window.addEventListener(RECENTS_UPDATED_EVENT, sync);
        window.addEventListener("storage", sync);

        return () => {
            window.removeEventListener(RECENTS_UPDATED_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, []);

    return recents;
}
