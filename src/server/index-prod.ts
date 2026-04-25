import "dotenv/config"
import { Elysia, file, ElysiaFile } from "elysia"
import { cors } from "@elysiajs/cors"
import { existsSync, statSync } from "fs"
import { join, resolve } from "path"
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

function serveStatic(pathname: string): Response | undefined | ElysiaFile {
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

    return file(filePath)
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
