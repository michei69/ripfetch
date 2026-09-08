import { cors } from "@elysiajs/cors";
import Elysia from "elysia";
import { app } from "./routes";
import {
    clearExpiredCache,
    ensureCacheTable,
    startCacheCleanup,
} from "./cache";
import { SECURITY_HEADERS } from "./securityHeaders";

const allowedOrigin =
    process.env.CORS_ORIGIN ||
    process.env.HOSTNAME ||
    process.env.DOMAIN ||
    (process.env.DEV === "true" ? true : false);

async function start() {
    await ensureCacheTable();
    await clearExpiredCache();
    startCacheCleanup();

    new Elysia()
        .headers(SECURITY_HEADERS)
        .use(cors({ origin: allowedOrigin }))
        .use(app)
        .listen(parseInt(process.env.PORT || "3111", 10), ({ port }) => {
            console.log(`Dev server is running at http://localhost:${port}`);
        });
}

start().catch((error) => {
    console.error("Could not start dev server:", error);
    process.exitCode = 1;
});
