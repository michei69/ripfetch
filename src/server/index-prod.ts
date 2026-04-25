import "dotenv/config"
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { existsSync, statSync } from "fs"
import { join, extname, resolve } from "path"
import Steam from "../api/game-stuff/steam"
import { ensureCacheTable, clearExpiredCache } from "./cache"
import app from "./routes"

async function initialize() {
    await ensureCacheTable()
    await clearExpiredCache()
    await Steam.refreshAlgolia(true)
}

initialize().catch(console.error)

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
    const resolvedPath = resolve(filePath)
    if (!resolvedPath.startsWith(resolve(DIST_DIR))) {
        return undefined
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(DIST_DIR, pathname, "index.html")
    }

    if (!existsSync(filePath)) {
        return undefined
    }

    const ext = extname(filePath)
    const contentType = mimeTypes[ext] || "application/octet-stream"

    return new Response(Bun.file(filePath), {
        headers: {
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "SAMEORIGIN",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
    })
}

const allowedOrigin = process.env["HOSTNAME"] || process.env["DOMAIN"] || "*"

new Elysia()
    .use(cors({ origin: allowedOrigin }))
    .use(app)
    .get("/*", async ({ path }) => {
        if (path.startsWith("/api")) {
            return new Response("Not found", { status: 404 })
        }
        const response = serveStatic(path)
        if (response) return response
        return serveStatic("index.html") || new Response("Not found", { status: 404 })
    })
    .listen(parseInt(process.env["PORT"] || "3000"), ({ port }) => {
        console.log(`Server is running at http://localhost:${port}`)
    })
