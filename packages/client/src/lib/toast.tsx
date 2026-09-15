import { createStore } from "solid-js";
import { Portal } from "@solidjs/web";
import { Check, TriangleAlert } from "../components/icons";

/**
 * Bottom-right toasts, previously `react-toastify`. The surface this app used
 * is three calls wide, so it is one store and one fixed container instead of a
 * dependency; the `Toastify__*` class names are kept, which keeps the skin in
 * `index.css` (and therefore the visuals) untouched.
 */
export type ToastTone = "success" | "error";

type Toast = { id: number; tone: ToastTone; message: string };

const AUTO_CLOSE_MS = 2500;

const [toasts, setToasts] = createStore<Toast[]>([]);
let nextId = 0;

function push(tone: ToastTone, message: string) {
  const id = ++nextId;
  // Newest on top, so it is unshifted rather than pushed.
  setToasts((list) => {
    list.unshift({ id, tone, message });
  });
  return id;
}

function dismiss(id: number) {
  setToasts((list) => {
    const index = list.findIndex((entry) => entry.id === id);
    if (index !== -1) list.splice(index, 1);
  });
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
};

function ToastCard(props: { toast: Toast }) {
  let remaining = AUTO_CLOSE_MS;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining -= Date.now() - startedAt;
  };

  const start = () => {
    startedAt = Date.now();
    timer = setTimeout(() => dismiss(props.toast.id), remaining);
  };

  start();

  return (
    <div
      class={`Toastify__toast Toastify__toast-theme--light Toastify__toast--${props.toast.tone}`}
      role="status"
      onMouseEnter={stop}
      onMouseLeave={start}
    >
      <div class="Toastify__toast-icon">
        {props.toast.tone === "success" ? (
          <Check size={16} />
        ) : (
          <TriangleAlert size={16} />
        )}
      </div>
      <div>{props.toast.message}</div>
    </div>
  );
}

export function Toaster() {
  return (
    <Portal mount={document.body}>
      <div
        class="Toastify__toast-container Toastify__toast-container--bottom-right"
        aria-live="polite"
      >
        {toasts.map((entry) => (
          <ToastCard toast={entry} />
        ))}
      </div>
    </Portal>
  );
}
