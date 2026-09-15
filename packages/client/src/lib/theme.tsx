import { createContext, createSignal, useContext } from "solid-js";
import type { ParentProps } from "solid-js";
import { createEffect } from "solid-js";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "ripfetch:theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#F4F1EA",
  dark: "#0B0B0C",
};

/**
 * Theme state, previously `next-themes`.
 *
 * `theme-init.js` has already resolved and applied the theme before the first
 * paint, so the initial value is read straight back off the document instead of
 * being tracked as a separate "not mounted yet" state. That removes the
 * placeholder render `next-themes` forced on the switch, which is why it can
 * now always render its three buttons.
 */
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage can be unavailable; fall through to the system default.
  }
  return "system";
}

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readAppliedTheme(): ResolvedTheme {
  try {
    const applied = document.documentElement.getAttribute("data-theme");
    if (applied === "light" || applied === "dark") return applied;
  } catch {
    // No document (tests): fall through.
  }
  return media().matches ? "dark" : "light";
}

type ThemeValue = {
  theme: () => Theme;
  resolvedTheme: () => ResolvedTheme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeValue>({
  theme: () => "system",
  resolvedTheme: () => "light",
  setTheme: () => {},
});

export function ThemeProvider(props: ParentProps) {
  const [theme, setThemeSignal] = createSignal<Theme>(readStoredTheme());
  const [systemDark, setSystemDark] = createSignal(media().matches);
  const [applied, setApplied] = createSignal<ResolvedTheme>(readAppliedTheme());

  // Follow the OS while (and only while) the preference is "system".
  createEffect(
    () => media(),
    (query) => {
      const onChange = (event: MediaQueryListEvent) =>
        setSystemDark(event.matches);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
  );

  const resolvedTheme = (): ResolvedTheme => {
    const preference = theme();
    if (preference !== "system") return preference;
    return systemDark() ? "dark" : "light";
  };

  createEffect(
    () => resolvedTheme(),
    (next) => {
      if (next === applied()) return;
      setApplied(next);

      // `disableTransitionOnChange`: pin `transition: none` for one frame
      // so the swap does not animate every themed property at once.
      const style = document.createElement("style");
      style.textContent = "*,*::before,*::after{transition:none!important}";
      document.head.append(style);

      const root = document.documentElement;
      root.setAttribute("data-theme", next);
      root.style.colorScheme = next;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", THEME_COLORS[next]);

      requestAnimationFrame(() => style.remove());
    },
  );

  const setTheme = (next: Theme) => {
    setThemeSignal(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // A theme that cannot be persisted still applies for this session.
    }
  };

  return (
    <ThemeContext value={{ theme, resolvedTheme, setTheme }}>
      {props.children}
    </ThemeContext>
  );
}

export const useTheme = () => useContext(ThemeContext);
