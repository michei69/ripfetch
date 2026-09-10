import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useGameSearch, type GameSearch } from "../hooks/useGameSearch";

/**
 * Owns the single search stream, shared by the rail field and the search route.
 *
 * The field's value is local state, never the URL: binding it to `?q=` directly
 * drops keystrokes, because the router's update lands a render later than the
 * next keypress. The URL is then written from that local state, and only read
 * back when it changes for some other reason — a link, the back button, or a
 * route change.
 */
type SearchValue = {
  query: string;
  setQuery: (value: string) => void;
  submit: () => void;
  clear: () => void;
  search: GameSearch;
  onSearchRoute: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
};

const SearchContext = createContext<SearchValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSearchRoute = pathname === "/";
  const urlQuery = params.get("q") ?? "";

  const [query, setQueryState] = useState(urlQuery);
  /** Last value this component wrote to the URL, to tell our writes apart. */
  const written = useRef(urlQuery);

  // Adopt URL changes we did not cause: shared links, back/forward.
  useEffect(() => {
    if (urlQuery === written.current) return;
    written.current = urlQuery;
    setQueryState(urlQuery);
  }, [urlQuery]);

  // Entering the search route adopts its query; leaving it clears the field.
  useEffect(() => {
    const next = pathname === "/" ? urlQuery : "";
    written.current = next;
    setQueryState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      if (!onSearchRoute) return;
      written.current = value;
      setParams(value ? { q: value } : {}, { replace: true });
    },
    [onSearchRoute, setParams],
  );

  const clear = useCallback(() => setQuery(""), [setQuery]);

  const submit = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    if (onSearchRoute) return;
    navigate(`/?q=${encodeURIComponent(trimmed)}`);
  }, [navigate, onSearchRoute, query]);

  // One stream for the field, on every route: the search route renders the
  // results full-width, other routes show them in the field's popover.
  const search = useGameSearch(query);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      // Skip on touch devices, where the field would summon a soft keyboard.
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
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1080px)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    inputRef.current?.focus();
  }, []);

  return (
    <SearchContext.Provider
      value={{
        query,
        setQuery,
        submit,
        clear,
        search,
        onSearchRoute,
        inputRef,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchValue {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearch must be used inside a SearchProvider");
  return value;
}
