import {
  createContext,
  createEffect,
  createSignal,
  onSettled,
  untrack,
  useContext,
} from "solid-js";
import type { ParentProps } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { createGameSearch, type GameSearch } from "../lib/gameSearch";

/**
 * Owns the single search stream, shared by the rail field and the search route.
 *
 * The field's value is a signal, never the URL: binding it to `?q=` directly
 * drops keystrokes, because the router's update lands after the next keypress.
 * The URL is then written from that signal, and only read back when it changes
 * for some other reason — a link, the back button, or a route change.
 */
type SearchValue = {
  query: () => string;
  setQuery: (value: string) => void;
  submit: () => void;
  clear: () => void;
  search: GameSearch;
  onSearchRoute: () => boolean;
  /** Assigns the rail input; `undefined` until the field is mounted. */
  inputRef: (element: HTMLInputElement) => void;
};

const SearchContext = createContext<SearchValue | null>(null);

const toPath = (value: string) =>
  value ? `/?${new URLSearchParams({ q: value }).toString()}` : "/";

export function SearchProvider(props: ParentProps) {
  const location = useLocation();
  const navigate = useNavigate();

  let input: HTMLInputElement | undefined;
  const urlQuery = () => {
    const value = location.query.q;
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const onSearchRoute = () => location.pathname === "/";

  const [query, setQuery] = createSignal(untrack(urlQuery));

  // The field adopts the URL's query on load, after back/forward, and on any
  // route change — but never fights the keystrokes that produced it. Only the
  // two URL facts are tracked, so typing does not re-run this.
  let written: string | null = null;
  createEffect(
    () => [urlQuery(), location.pathname] as const,
    ([inUrl, pathname]) => {
      const enteredSearch = pathname === "/";

      if (enteredSearch && inUrl !== written) {
        written = inUrl;
        setQuery(inUrl);
        return;
      }
      // The field's own value is not a reason to re-adopt it.
      const current = untrack(query);
      if (!enteredSearch && current !== "") {
        setQuery("");
        return;
      }
      written = enteredSearch ? current : "";
    },
  );

  const setQueryValue = (value: string) => {
    setQuery(value);
    if (!onSearchRoute()) return;
    written = value;
    // `replace` so a keystroke does not stack history, `scroll: false` so
    // the rewrite never jumps the page.
    navigate(toPath(value), { replace: true, scroll: false });
  };

  const submit = () => {
    const trimmed = query().trim();
    if (trimmed.length === 0 || onSearchRoute()) return;
    navigate(toPath(trimmed));
  };

  // One stream for the field, on every route: the search route renders the
  // results full-width, other routes show them in the field's popover.
  const search = createGameSearch(query);

  onSettled(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      // Skip on touch devices, where the field would summon a keyboard.
      if (window.matchMedia("(pointer: coarse)").matches) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      input?.focus();
      input?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  onSettled(() => {
    if (!window.matchMedia("(min-width: 1080px)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    input?.focus();
  });

  return (
    <SearchContext
      value={{
        query,
        setQuery: setQueryValue,
        submit,
        clear: () => setQueryValue(""),
        search,
        onSearchRoute,
        inputRef: (element) => {
          input = element;
        },
      }}
    >
      {props.children}
    </SearchContext>
  );
}

export function useSearch(): SearchValue {
  const value = useContext(SearchContext);
  if (!value) {
    throw new Error("useSearch must be used inside a SearchProvider");
  }
  return value;
}
