import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { ThemeProvider } from "next-themes";
import { Layout } from "./components/Layout";
import SearchPage from "./pages/SearchPage";
import GamePage from "./pages/GamePage";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/game/:id" element={<GamePage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </ThemeProvider>
  );
}

export default App;
