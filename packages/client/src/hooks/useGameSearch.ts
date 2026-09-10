import { useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/config";
import { isJsonObject, parseEventData } from "../lib/sse";
import { useDebounce } from "./useDebounce";

export type SearchResult = {
    name: string;
    id: number;
    objectID?: string;
    small_capsule?: string;
};

const MIN_QUERY_LENGTH = 2;

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

export function useGameSearch(query: string) {
    const trimmed = query.trim();
    const debounced = useDebounce(trimmed, 300);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        setResults([]);
        setError("");

        if (trimmed.length < MIN_QUERY_LENGTH) {
            setLoading(false);
            setStatus("");
            return;
        }

        // Still debouncing: hold the loading state so the UI keeps its
        // skeletons up instead of flashing the empty state.
        if (trimmed !== debounced) {
            setLoading(true);
            setStatus("");
            return;
        }

        setLoading(true);
        setStatus("Connecting to search server");

        const stream = new EventSource(
            `${API_BASE_URL}/api/search/sse?q=${encodeURIComponent(debounced)}`,
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
            setError("Connection interrupted. Please try again.");
            setLoading(false);
            stream.close();
        };

        return () => stream.close();
    }, [debounced, trimmed, attempt]);

    return {
        results,
        status,
        loading,
        error,
        searching: trimmed.length >= MIN_QUERY_LENGTH,
        retry: () => setAttempt((value) => value + 1),
    };
}

export type GameSearch = ReturnType<typeof useGameSearch>;
