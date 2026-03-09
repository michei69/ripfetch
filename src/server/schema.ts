import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  steamId: text("steam_id"),
  name: text("name").notNull(),
  searchQuery: text("search_query"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
})

export const searchHistory = sqliteTable("search_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
})

export const cache = sqliteTable("cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
})
