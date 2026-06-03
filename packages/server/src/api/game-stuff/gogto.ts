import axios from "axios";
import { DownloadsResult, genericClosestTo, IGameSource, SearchResult } from "./commonData";
import Fuse from "fuse.js";
import Chrome from "../chrome-api";
import { parse } from "node-html-parser";

type GOGSearchResponse = {
    pages: number,
    currentlyShownProductCount: number,
    productCount: number,
    products: Array<{
        id: string, // number
        slug: string,
        features: Array<{ name: string, slug: string }>,
        screenshots: string[],
        userPreferredLanguage: any, // not imp
        releaseDate: string,
        storeReleaseDate: string,
        productType: "game",
        title: string,
        coverHorizontal: string,
        coverVertical: string,
        logo: string,
        galaxyBackgroundImage: string,
        developers: string[],
        publishers: string[],
        operatingSystems: string[],
        price: any, // not imp
        productState: "default",
        genres: Array<{ name: string, slug: string }>,
        reviewsRating: number,
        reviewsCount: number,
        editions: any[],
        ratings: any[],
        storeLink: string
    }>,
    searchAlgo: "default"
}

export default class GOGto implements IGameSource {
    displayName = "GOGto";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await axios.get(`https://catalog.gog.com/v1/catalog?limit=20&locale=en-US&order=desc:score&page=1&productType=in:game&query=like:${encodeURIComponent(title)}`)
        const data = req.data as GOGSearchResponse

        const results: SearchResult[] = []
        for (const result of data.products) {
            results.push({
                title: result.title.trim(),
                url: `https://gog-games.to/game/${result.slug}`
            })
        }
        return results
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await this.search(query)
        if (results.length === 0) return null
        return genericClosestTo(results, ["title"], query) || null
    }

    static async getDownloadsOfClosestTo(query: string): Promise<DownloadsResult | null> {
        const game = await this.getClosestTo(query)
        if (!game) return null
        return await this.getDownloads(game.url)
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url.includes("gog-games.to")) return {}

        console.log(url)
        const req = await axios.get(url, {
            maxRedirects: 0,
            validateStatus: () => true
        })
        if (req.status !== 200) return {} // redirect == no game

        const data = await Chrome.browserRequest(url, [{
            instruction: "wait_for",
            arguments: [".game-section-with-accordion-game"]
        }], "content")
        
        const html = parse(data.result)
        
        const gameAccordion = html.querySelector(".game-section-with-accordion-game")
        if (!gameAccordion) return {}
        const goodiesAccordion = html.querySelector(".game-section-with-accordion-goodie")
        const patchAccordion = html.querySelector(".game-section-with-accordion-patch")

        const results: DownloadsResult = {}
        for (const provider of gameAccordion.querySelectorAll("details")) {
            const host = provider.querySelector("summary")?.innerText.trim()
            if (!host) continue
            results[host] = results[host] || {}

            for (const link of provider.querySelectorAll("div > a")) {
                const url = link.getAttribute("href")
                if (!url) continue
                const title = link.innerText.trim()
                results[host][title] = url
            }
        }
        if (goodiesAccordion) {
            for (const provider of goodiesAccordion.querySelectorAll("details")) {
                const host = provider.querySelector("summary")?.innerText.trim()
                if (!host) continue
                results[host] = results[host] || {}

                for (const link of provider.querySelectorAll("div > a")) {
                    const url = link.getAttribute("href")
                    if (!url) continue
                    const title = link.innerText.trim()
                    results[host][title] = url
                }
            }
        }
        if (patchAccordion) {
            for (const provider of patchAccordion.querySelectorAll("details")) {
                const host = provider.querySelector("summary")?.innerText.trim()
                if (!host) continue
                results[host] = results[host] || {}

                for (const link of provider.querySelectorAll("div > a")) {
                    const url = link.getAttribute("href")
                    if (!url) continue
                    const title = link.innerText.trim()
                    results[host][title] = url
                }
            }
        }

        return results
    }

    search(title: string): Promise<SearchResult[]> {
        return GOGto.search(title)
    }

    getClosestTo(query: string): Promise<SearchResult | null> {
        return GOGto.getClosestTo(query)
    }

    getDownloads(url: string): Promise<DownloadsResult> {
        return GOGto.getDownloads(url)
    }
}
