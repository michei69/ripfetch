import { eq, and, gt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import { cache as cacheTable } from "./schema";

const GAME_INFO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const MAX_CACHE_VALUE_LENGTH = 8 * 1024 * 1024;
const CACHE_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let cleanupStarted = false;

export async function getCache<T = unknown>(key: string): Promise<T | null> {
    const now = new Date();
    const [result] = await db
        .select()
        .from(cacheTable)
        .where(and(eq(cacheTable.key, key), gt(cacheTable.expiresAt, now)))
        .limit(1);

    if (!result) {
        return null;
    }
    if (result.value.length > MAX_CACHE_VALUE_LENGTH) return null;

    try {
        return JSON.parse(result.value) as T;
    } catch {
        return null;
    }
}

export async function setCache(
    key: string,
    value: unknown,
    ttlMs?: number,
): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttlMs || GAME_INFO_CACHE_TTL));
    const valueStr = JSON.stringify(value);
    if (!valueStr || valueStr.length > MAX_CACHE_VALUE_LENGTH) {
        throw new Error("Cache value exceeds the configured size limit");
    }

    await db
        .insert(cacheTable)
        .values({
            key,
            value: valueStr,
            expiresAt,
        })
        .onConflictDoUpdate({
            target: cacheTable.key,
            set: {
                value: valueStr,
                expiresAt,
            },
        });
}

export async function clearExpiredCache(): Promise<void> {
    const now = new Date();
    await db.delete(cacheTable).where(lte(cacheTable.expiresAt, now));
}

export function startCacheCleanup(): void {
    if (cleanupStarted) return;
    cleanupStarted = true;

    setInterval(() => {
        void clearExpiredCache().catch((error) => {
            console.error("Could not clear expired cache:", error);
        });
    }, CACHE_CLEANUP_INTERVAL_MS);
}

export async function ensureCacheTable(): Promise<void> {
    // SQLite syntax: create table if not exists
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);
    await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache (expires_at)
  `);
    await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_cache_key ON cache (key)
  `);
}
