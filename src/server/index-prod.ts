import "dotenv/config"
import { Elysia } from "elysia"
import { swagger } from "@elysiajs/swagger"
import { cors } from "@elysiajs/cors"
import { readFileSync, existsSync, statSync } from "fs"
import { join, extname } from "path"
import Steam from "../api/game-stuff/steam"
import { ensureCacheTable, clearExpiredCache } from "./cache"
import app from "./routes"

async function initialize() {
    await ensureCacheTable()
    await clearExpiredCache()
    await Steam.refreshAlgolia()
}

initialize().catch(console.error)
Steam.refreshAlgolia()

const DIST_DIR = join(process.cwd(), "dist")

const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".otf": "font/otf",
    ".webp": "image/webp",
}

function serveStatic(pathname: string): Response | undefined {
    let filePath = join(DIST_DIR, pathname)

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(DIST_DIR, pathname, "index.html")
    }

    if (!existsSync(filePath)) {
        return undefined
    }

    const ext = extname(filePath)
    const contentType = mimeTypes[ext] || "application/octet-stream"

    return new Response(readFileSync(filePath), {
        headers: { "Content-Type": contentType },
    })
}

new Elysia()
    .use(cors())
    .use(swagger({
        documentation: {
            info: {
                title: "Games API",
                version: "1.0.0",
                description: "API for searching games and getting download links",
            },
        },
    }))
    .use(app)
    .get("/*", async ({ path }) => {
        if (path.startsWith("/api")) {
            return new Response("Not found", { status: 404 })
        }
        const response = serveStatic(path)
        if (response) return response
        return serveStatic("index.html") || new Response("Not found", { status: 404 })
    })
    .listen(3000, ({ port }) => {
        console.log(`Server is running at http://localhost:${port}`)
    })
