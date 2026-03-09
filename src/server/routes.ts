import Elysia, { t } from "elysia"
import { swagger } from "@elysiajs/swagger"
import { cors } from "@elysiajs/cors"
import Steam from "../api/game-stuff/steam"
import Game3rb from "../api/game-stuff/game3rb"
import Igg from "../api/game-stuff/igg"
import Onlinefix from "../api/game-stuff/onlinefix"
import Steamrip from "../api/game-stuff/steamrip"
import Steamunlocked from "../api/game-stuff/steamunlocked"
import Uploadhaven from "../api/game-stuff/uploadhaven"
import { getCache, setCache, setSearchCache, setLinksCache } from "./cache"

const gameSources = [new Game3rb(), new Igg(), new Onlinefix(), new Steamrip(), new Steamunlocked()]

// @ts-ignore
async function getDownloadsForGame(gameName: string): Promise<Record<string, Record<string, string>>> {
    const downloads: Record<string, Record<string, string>> = {}

    for (const source of gameSources) {
        try {
            const results = await source.search(gameName)

            try {
                for (const result of results) {
                    const sourceName = `${source.displayName} (${result.title})`
                    if (!downloads[sourceName]) {
                        const dls = await source.getDownloads(result.url)
                        if (Object.keys(dls).length > 0) {
                            const flatDls: Record<string, string> = {}
                            for (const [host, links] of Object.entries(dls)) {
                                for (const [name, url] of Object.entries(links)) {
                                    flatDls[`${host} - ${name}`] = url
                                }
                            }
                            downloads[sourceName] = flatDls
                            break
                        }
                    }
                }
            } catch (error) {
                console.error(`Error getting downloads from ${source.displayName}:`, error)
            }
        } catch (error) {
            console.error(`Error searching ${source.displayName}:`, error)
        }
    }

    return downloads
}

export const searchRoute = new Elysia()
    .get("/search", async ({ query }) => {
        const cacheKey = `search:${query.q}`
        const cached = await getCache(cacheKey)
        if (cached !== null) {
            return cached
        }

        try {
            let results = await Steam.search(query.q)
            await setSearchCache(cacheKey, results)
            return results
        } catch (error) {
            console.error("Search failed, refreshing Algolia key:", error)
            try {
                await Steam.refreshAlgolia(true)
                const results = await Steam.search(query.q)
                await setSearchCache(cacheKey, results)
                return results
            } catch (retryError) {
                console.error("Search error after refresh:", retryError)
                const response: any[] = []
                await setSearchCache(cacheKey, response)
                return response
            }
        }
    }, {
        query: t.Object({
            q: t.String({description: "Search query"}),
        }),
        detail: {
            tags: ["Search"],
            summary: "Search for games",
            description: "Search for games using Steam's Algolia search",
        },
    })
    .get("/game/:id", async ({ params }) => {
        const cacheKey = `game:${params.id}`
        const cached = await getCache(cacheKey)
        if (cached !== null) {
            return cached
        }
        const steamInfo = await Steam.getInfo(params.id)
        const response = { steam: steamInfo }
        await setCache(cacheKey, response)
        return response
    }, {
        params: t.Object({
            id: t.Union([t.String(), t.Number()], {description: "Steam app id"}),
        }),
        detail: {
            tags: ["Game"],
            summary: "Get game info",
            description: "Get detailed game info from Steam",
        },
    })
    .get("/game/:id/links", async ({ params }) => {
        const cacheKey = `links:${params.id}`
        const cached = await getCache(cacheKey)
        if (cached !== null) {
            return cached
        }
        
        const steamInfo = await Steam.getInfo(params.id)
        if (!steamInfo) {
            const response = { downloads: {} }
            await setLinksCache(cacheKey, response)
            return response
        }
        const downloads = await getDownloadsForGame(steamInfo.name)
        const response = { downloads }
        await setLinksCache(cacheKey, response)
        return response
    }, {
        params: t.Object({
            id: t.Union([t.String(), t.Number()], {description: "Steam app id"}),
        }),
        detail: {
            tags: ["Game"],
            summary: "Get download links for game",
            description: "Get download links from various sources for a game",
        },
    })
    .get("/uploadhaven/:id", async ({ params, set }) => {
        try {
            const realUrl = await Uploadhaven.getRealUrl(`https://uploadhaven.com/download/${params.id}`);
            if (!realUrl) {
                set.status = 404;
                return { error: "Not found" };
            }
            const response = await fetch(realUrl);
            if (!response.ok) {
                set.status = response.status;
                return { error: "Failed to fetch file" };
            }
            const headers = new Headers();
            for (const [key, value] of response.headers.entries()) {
                if (key.toLowerCase() === 'content-length') continue;
                headers.set(key, value);
            }
            const contentDisposition = response.headers.get('content-disposition');
            if (!contentDisposition) {
                headers.set('Content-Disposition', `attachment; filename="${params.id}"`);
            }
            return new Response(response.body, {
                headers,
                status: response.status,
            });
        } catch (error) {
            console.error("Uploadhaven proxy error:", error);
            set.status = 502;
            return { error: "Proxy error" };
        }
    }, {
        params: t.Object({
            id: t.String({description: "Uploadhaven download id"}),
        }),
        detail: {
            tags: ["Uploadhaven"],
            summary: "Proxy download from Uploadhaven",
            description: "Get real download URL from Uploadhaven and stream the file",
        },
    })

export const app = new Elysia({ prefix: "/api" })
    .use(cors())
    .use(swagger({
        documentation: {
            info: {
                title: "RipFetch API",
                version: "1.0.0",
                description: "An API for searching games and fetching download links lol",
            },
        },
    }))
    .use(searchRoute)
    .get("/health", () => ({ status: "ok" }))

export default app