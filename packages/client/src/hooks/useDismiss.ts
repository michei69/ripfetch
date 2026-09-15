import { createEffect, type Accessor } from "solid-js";

/**
 * Calls `onDismiss` when a pointer lands outside `element`.
 *
 * Written as a ref consumer so it rides Solid's assignment timing: the effect
 * runs on mount, is skipped while `enabled` is false, and its cleanup removes
 * the listener. The callback is read untracked inside the handler, so passing
 * an inline closure never re-subscribes.
 */
export function onDismiss(
    element: HTMLElement | undefined,
    onDismiss: () => void,
    enabled: Accessor<boolean> = () => true,
) {
    if (!element) return;

    createEffect(
        () => enabled(),
        (active) => {
            if (!active) return;

            const listener = (event: PointerEvent) => {
                if (element.contains(event.target as Node)) return;
                onDismiss();
            };

            document.addEventListener("pointerdown", listener);
            return () => document.removeEventListener("pointerdown", listener);
        },
    );
}
