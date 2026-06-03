import { eq, and, gt, lte, sql } from "drizzle-orm"
import { db } from "./db"
import { cache as cacheTable } from "./schema"

const SEARCH_CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours in milliseconds
const GAME_INFO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
const LINKS_CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

export async function getCache(key: string): Promise<any | null> {
  const now = new Date()
  const [result] = await db
    .select()
    .from(cacheTable)
    .where(
      and(
        eq(cacheTable.key, key),
        gt(cacheTable.expiresAt, now)
      )
    )
    .limit(1)

  if (!result) {
    return null
  }

  try {
    return JSON.parse(result.value)
  } catch {
    return null
  }
}

export async function setCache(key: string, value: any, ttlMs?: number): Promise<void> {
  const expiresAt = new Date(Date.now() + (ttlMs || GAME_INFO_CACHE_TTL))
  const valueStr = JSON.stringify(value)

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
    })
}

export async function setSearchCache(key: string, value: any): Promise<void> {
  return setCache(key, value, SEARCH_CACHE_TTL)
}

export async function setLinksCache(key: string, value: any): Promise<void> {
  return setCache(key, value, LINKS_CACHE_TTL)
}

export async function deleteCache(key: string): Promise<void> {
  await db
    .delete(cacheTable)
    .where(eq(cacheTable.key, key))
}

export async function clearExpiredCache(): Promise<void> {
  const now = new Date()
  await db
    .delete(cacheTable)
    .where(lte(cacheTable.expiresAt, now))
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
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache (expires_at)
  `)
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_cache_key ON cache (key)
  `)
}