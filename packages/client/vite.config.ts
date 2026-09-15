import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const apiPort = process.env.PORT || "3111";

export default defineConfig({
    plugins: [tailwindcss(), solid()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            "/api": {
                target: `http://localhost:${apiPort}`,
                changeOrigin: true,
            },
        },
    },
});
