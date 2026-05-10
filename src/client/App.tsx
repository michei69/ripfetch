import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import { ToastProvider } from "./components/ui/toast"
import { Layout } from "./components/Layout"
import SearchPage from "./pages/SearchPage"
import GamePage from "./pages/GamePage"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ripfetch-theme">
      <ToastProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/game/:id" element={<GamePage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
