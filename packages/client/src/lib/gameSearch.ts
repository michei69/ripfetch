import { createEffect, createSignal, type Accessor } from "solid-js";
import { API_BASE_URL } from "./config";
import { isJsonObject, parseEventData } from "./sse";

export type SearchResult = {
    name: string;
    id: number;
    objectID?: string;
    small_capsule?: string;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const parseSearchResult = (value: unknown): SearchResult | null => {
    if (
        !isJsonObject(value) ||
        typeof value.name !== "string" ||
        typeof value.id !== "number" ||
        !Number.isSafeInteger(value.id) ||
        value.id <= 0
    ) {
        return null;
    }

    const name = value.name;
    const id = value.id;
    return {
        name,
        id,
        ...(typeof value.objectID === "string"
            ? { objectID: value.objectID }
            : {}),
        ...(typeof value.small_capsule === "string"
            ? { small_capsule: value.small_capsule }
            : {}),
    };
};

export type GameSearch = {
    /** Emitted results so far, deduplicated by app id. */
    results: Accessor<SearchResult[]>;
    /** Latest human-readable progress line from the server. */
    status: Accessor<string>;
    /** True while a stream is open or still being debounced. */
    loading: Accessor<boolean>;
    error: Accessor<string>;
    /** True once the query is long enough to search for. */
    searching: Accessor<boolean>;
    retry: () => void;
};

/**
 * Streams matches for `query` from the search SSE endpoint.
 *
 * The debounce is a derived signal rather than a second copy of the query, so
 * "still typing" is `debounced() !== trimmed()` and needs no bookkeeping state.
 */
export function createGameSearch(source: Accessor<string>): GameSearch {
    const [query, setQuery] = createSignal(source());
    createEffect(
        () => source(),
        (next) => {
            setQuery(next);
        },
    );

    const trimmed = () => query().trim();
    const [debounced, setDebounced] = createSignal(trimmed());
    createEffect(
        () => trimmed(),
        (value) => {
            const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
            return () => clearTimeout(timer);
        },
    );

    // Always a fresh array so consumers see every emission; `equals: false`
    // keeps identical-looking arrays from being swallowed.
    const [results, setResults] = createSignal<SearchResult[]>([], {
        equals: false,
    });
    const [status, setStatus] = createSignal("");
    const [loading, setLoading] = createSignal(false);
    const [error, setError] = createSignal("");
    const [attempt, setAttempt] = createSignal(0);

    createEffect(
        () => [debounced(), trimmed(), attempt()] as const,
        ([settled, typed]) => {
            setResults([]);
            setError("");

            if (typed.length < MIN_QUERY_LENGTH) {
                setLoading(false);
                setStatus("");
                return;
            }

            // Still debouncing: hold the loading state so the UI keeps its
            // skeletons up instead of flashing the empty state.
            if (typed !== settled) {
                setLoading(true);
                setStatus("");
                return;
            }

            setLoading(true);
            setStatus("Connecting to search server");

            let active = true;
            const stream = new EventSource(
                `${API_BASE_URL}/api/search/sse?q=${encodeURIComponent(settled)}`,
            );

            stream.addEventListener("status", (event) => {
                const data = parseEventData(event);
                if (isJsonObject(data) && typeof data.message === "string") {
                    setStatus(data.message);
                }
            });

            stream.addEventListener("result", (event) => {
                const result = parseSearchResult(parseEventData(event));
                if (!result) return;
                setResults((previous) =>
                    previous.some((item) => item.id === result.id)
                        ? previous
                        : [...previous, result],
                );
            });

            stream.addEventListener("complete", () => {
                setLoading(false);
                setStatus("Search complete");
                stream.close();
            });

            stream.addEventListener("failure", () => {
                setError("Search is unavailable. Please try again.");
                setLoading(false);
                stream.close();
            });

            stream.onerror = () => {
                if (!active) return;
                setError("Connection interrupted. Please try again.");
                setLoading(false);
                stream.close();
            };

            // Runs before the next stream opens, and on disposal.
            return () => {
                active = false;
                stream.close();
            };
        },
    );

    return {
        results,
        status,
        loading,
        error,
        searching: () => trimmed().length >= MIN_QUERY_LENGTH,
        retry: () => setAttempt((value) => value + 1),
    };
}
