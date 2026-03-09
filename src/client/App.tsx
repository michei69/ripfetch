import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import SearchPage from "./pages/SearchPage"
import GamePage from "./pages/GamePage"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="games-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/game/:id" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
