import {
    type DownloadsResult,
    genericClosestTo,
    type SearchResult,
} from "./commonData";
import Chrome from "../Chrome";
import { parse, type HTMLElement } from "node-html-parser";
import { isSafeExternalUrl, safeGet } from "./NetworkRequest";

type GOGSearchResponse = {
    pages: number;
    currentlyShownProductCount: number;
    productCount: number;
    products: Array<{
        id: string; // number
        slug: string;
        features: Array<{ name: string; slug: string }>;
        screenshots: string[];
        userPreferredLanguage: any; // not imp
        releaseDate: string;
        storeReleaseDate: string;
        productType: "game";
        title: string;
        coverHorizontal: string;
        coverVertical: string;
        logo: string;
        galaxyBackgroundImage: string;
        developers: string[];
        publishers: string[];
        operatingSystems: string[];
        price: any; // not imp
        productState: "default";
        genres: Array<{ name: string; slug: string }>;
        reviewsRating: number;
        reviewsCount: number;
        editions: any[];
        ratings: any[];
        storeLink: string;
    }>;
    searchAlgo: "default";
};

export default class GOGto {
    static displayName = "GOGto";

    static async search(title: string): Promise<SearchResult[]> {
        const req = await safeGet<GOGSearchResponse>(
            `https://catalog.gog.com/v1/catalog?limit=20&locale=en-US&order=desc:score&page=1&productType=in:game&query=like:${encodeURIComponent(title)}`,
            ["catalog.gog.com"],
        );
        const data = req?.data;

        const results: SearchResult[] = [];
        for (const result of data?.products ?? []) {
            results.push({
                title: result.title.trim(),
                url: `https://gog-games.to/game/${result.slug}`,
            });
        }
        return results;
    }

    static async getClosestTo(query: string): Promise<SearchResult | null> {
        const results = await GOGto.search(query);
        if (results.length === 0) return null;
        return genericClosestTo(results, ["title"], query) || null;
    }

    static async getDownloads(url: string): Promise<DownloadsResult> {
        if (!url || !isSafeExternalUrl(url)) return {};
        const req = await safeGet(url, ["gog-games.to"], {
            maxRedirects: 0,
        });
        if (!req || req.status !== 200) return {}; // redirect == no game

        const data = await Chrome.browserRequest(
            url,
            [
                {
                    instruction: "wait_for",
                    arguments: [".game-section-with-accordion-game"],
                },
            ],
            "content",
        );

        const html = parse(data.result);

        // The sidecar waited for this section, so its absence means the page
        // never rendered and there is nothing else worth reading.
        const game = html.querySelector(".game-section-with-accordion-game");
        if (!game) return {};

        const results: DownloadsResult = Object.create(null);
        collectAccordion(game, results);
        for (const selector of [
            ".game-section-with-accordion-goodie",
            ".game-section-with-accordion-patch",
        ]) {
            collectAccordion(html.querySelector(selector), results);
        }

        return results;
    }
}

/**
 * Each accordion section is a row of `<details>`, one per file host, with the
 * host in its `<summary>` and the links in the body.
 */
function collectAccordion(
    accordion: HTMLElement | null,
    results: DownloadsResult,
): void {
    for (const provider of accordion?.querySelectorAll("details") ?? []) {
        const host = provider.querySelector("summary")?.innerText.trim();
        if (!host) continue;
        results[host] = results[host] || {};

        for (const link of provider.querySelectorAll("div > a")) {
            const url = link.getAttribute("href");
            if (!isSafeExternalUrl(url)) continue;
            results[host][link.innerText.trim()] = url;
        }
    }
}
