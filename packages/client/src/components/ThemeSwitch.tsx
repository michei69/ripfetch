import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { For } from "solid-js";
import { Monitor, Moon, Sun } from "./icons";
import { useTheme, type Theme } from "../lib/theme";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies readonly {
  value: Theme;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
}[];

/**
 * Segmented control rather than a menu: three finite options are cheaper to
 * read and switch at a glance than a dropdown, and each button keeps its own
 * accessible name.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  return (
    <div class="theme-switch" role="group" aria-label="Color theme">
      <For each={OPTIONS}>
        {(option) => (
          <button
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={theme() === option.value ? "true" : "false"}
            aria-label={option.label}
            title={option.label}
          >
            <Dynamic component={option.icon} size={14} />
          </button>
        )}
      </For>
    </div>
  );
}
