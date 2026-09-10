import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onDismiss` when a pointer lands outside `ref`.
 *
 * The handler is held in a ref so callers can pass an inline closure without
 * re-subscribing on every render.
 */
export function useDismiss<T extends HTMLElement>(
    ref: RefObject<T | null>,
    onDismiss: () => void,
    enabled = true,
) {
    const handlerRef = useRef(onDismiss);

    useEffect(() => {
        handlerRef.current = onDismiss;
    }, [onDismiss]);

    useEffect(() => {
        if (!enabled) return;

        const onPointerDown = (event: PointerEvent) => {
            const element = ref.current;
            if (!element || element.contains(event.target as Node)) return;
            handlerRef.current();
        };

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [ref, enabled]);
}
