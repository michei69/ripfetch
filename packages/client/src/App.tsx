import { Router } from "./router";
import { Layout } from "./components/Layout";
import { SearchProvider } from "./components/SearchContext";
import { ThemeProvider } from "./lib/theme";
import { Toaster } from "./lib/toast";

/**
 * Root render. The router's render prop is the app shell: it is created once
 * and receives the matched route as `props.children`, so the rail, the theme
 * and the single search stream all survive navigation.
 */
export default function App() {
  return (
    <>
      <Router>
        {(props) => (
          <ThemeProvider>
            <SearchProvider>
              <Layout>{props.children}</Layout>
            </SearchProvider>
          </ThemeProvider>
        )}
      </Router>
      <Toaster />
    </>
  );
}
