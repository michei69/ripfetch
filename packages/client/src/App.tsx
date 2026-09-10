import { BrowserRouter, Routes, Route } from "react-router";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "next-themes";
import { Layout } from "./components/Layout";
import { SearchProvider } from "./components/SearchContext";
import SearchPage from "./pages/SearchPage";
import GamePage from "./pages/GamePage";

function App() {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="ripfetch:theme"
      disableTransitionOnChange
    >
      <BrowserRouter>
        <SearchProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/game/:id" element={<GamePage />} />
            </Routes>
          </Layout>
        </SearchProvider>
      </BrowserRouter>
      <ToastContainer
        position="bottom-right"
        autoClose={2500}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        role="status"
      />
    </ThemeProvider>
  );
}

export default App;
