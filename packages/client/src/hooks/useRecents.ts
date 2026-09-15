import { createSignal, onSettled } from "solid-js";
import {
    readRecentGames,
    RECENTS_UPDATED_EVENT,
    type RecentGame,
} from "../lib/recentlyViewed";

/**
 * Recently viewed games, kept in sync across tabs and with writes made
 * elsewhere in the same tab. One signal, two listeners, for the app's lifetime.
 */
export function useRecents() {
    const [recents, setRecents] = createSignal<RecentGame[]>(readRecentGames());

    onSettled(() => {
        const sync = () => setRecents(readRecentGames());
        window.addEventListener(RECENTS_UPDATED_EVENT, sync);
        window.addEventListener("storage", sync);

        return () => {
            window.removeEventListener(RECENTS_UPDATED_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    });

    return recents;
}
