import "dotenv/config";
import { Elysia, file, type ElysiaFile } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import Steam from "./api/game-stuff/Steam";
import {
    clearExpiredCache,
    ensureCacheTable,
    startCacheCleanup,
} from "./cache";
import app from "./routes";
import { SECURITY_HEADERS } from "./securityHeaders";

async function initialize() {
    await ensureCacheTable();
    await clearExpiredCache();
    startCacheCleanup();
    void Steam.refreshAlgolia(true).catch((error) => {
        console.error("Could not warm the Steam search key:", error);
    });
}

const DIST_DIR = resolve(import.meta.dirname, "..", "..", "client", "dist");
const allowedOrigin =
    process.env.CORS_ORIGIN ||
    process.env.HOSTNAME ||
    process.env.DOMAIN ||
    false;

function serveStatic(pathname: string): Response | undefined | ElysiaFile {
    const root = resolve(DIST_DIR);
    const requestedPath = pathname.replace(/^[/\\]+/, "");
    const filePath = resolve(root, requestedPath);
    const relativePath = relative(root, filePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        return undefined;
    }

    let resolvedFilePath = filePath;
    try {
        if (
            !existsSync(resolvedFilePath) ||
            statSync(resolvedFilePath).isDirectory()
        ) {
            resolvedFilePath = join(filePath, "index.html");
        }
    } catch {
        return undefined;
    }

    if (!existsSync(resolvedFilePath)) {
        return undefined;
    }

    return file(resolvedFilePath);
}

async function start() {
    await initialize();

    new Elysia()
        .headers(SECURITY_HEADERS)
        .use(cors({ origin: allowedOrigin }))
        .use(app)
        .get("/*", ({ path }) => {
            if (path.startsWith("/api")) {
                return new Response("Not found", { status: 404 });
            }
            const response = serveStatic(path);
            if (response) return response;
            return (
                serveStatic("index.html") ||
                new Response("Not found", { status: 404 })
            );
        })
        .listen(parseInt(process.env.PORT || "3000", 10), ({ port }) => {
            console.log(`Server is running at http://localhost:${port}`);
        });
}

start().catch((error) => {
    console.error("Could not start production server:", error);
    process.exitCode = 1;
});
