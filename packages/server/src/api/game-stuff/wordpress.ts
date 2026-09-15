import { safeGet } from "./NetworkRequest";

/**
 * Four of the sources are WordPress sites, and every one of them answers both
 * halves of a scrape through the same two REST calls: the `?search=` index for
 * a title, then the single post it points at for the download table.
 */
export type WordPressPost = {
    slug: string;
    title: { rendered: string };
    /** Absent from a `?search=` response, which only asks for title and slug. */
    content?: { rendered: string };
};

/**
 * The allowlist entry that admits `site`. The `www.` is dropped because
 * WordPress answers on both spellings and redirects between them.
 */
export const hostOf = (site: string): string =>
    new URL(site).hostname.replace(/^www\./, "");

/** The `?search=` index, trimmed to the fields a title match needs. */
export async function searchPosts(
    site: string,
    query: string,
): Promise<WordPressPost[]> {
    const req = await safeGet<WordPressPost[]>(
        `${site}/wp-json/wp/v2/posts?_fields=title.rendered,slug&per_page=20&search=${encodeURIComponent(query)}`,
        [hostOf(site)],
    );
    return Array.isArray(req?.data) ? req.data : [];
}

/** The REST URL that returns the rendered body of the post with this slug. */
export const postBodyUrl = (site: string, slug: string): string =>
    `${site}/wp-json/wp/v2/posts?_fields=content.rendered&slug=${encodeURIComponent(slug)}`;

/** The rendered HTML of the single post at `url`. */
export async function postContent(url: string, host: string): Promise<string> {
    const req = await safeGet<WordPressPost[]>(url, [host]);
    return Array.isArray(req?.data)
        ? (req.data[0]?.content?.rendered ?? "")
        : "";
}
