const STORE_ITEM_ASSETS =
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps";

/**
 * App art all lives under `/store_item_assets/steam/apps/<appid>/`. Steam
 * builds the capsule path out of a per-app hash, so every segment after the
 * app id is encoded rather than interpolated raw.
 */
function storeItemAsset(id: number | string, ...segments: string[]): string {
    return [
        STORE_ITEM_ASSETS,
        encodeURIComponent(String(id)),
        ...segments.map(encodeURIComponent),
    ].join("/");
}

export const steamHeaderUrl = (id: number | string): string =>
    storeItemAsset(id, "header.jpg");

/**
 * Steam's cinematic library art (1920x620). Not every app has one — callers
 * fall back to the header capsule, which is always present.
 */
export const steamHeroUrl = (id: number | string): string =>
    storeItemAsset(id, "library_hero.jpg");

export const steamCapsuleUrl = (
    id: number | string,
    smallCapsule: string,
): string => storeItemAsset(id, smallCapsule, "capsule_231x87.jpg");

/** Hosts Steam serves store art from; the API may answer with any of them. */
const STEAM_IMAGE_HOSTS = [
    "shared.fastly.steamstatic.com",
    "shared.akamai.steamstatic.com",
    "cdn.akamai.steamstatic.com",
    "steamcdn-a.akamaihd.net",
];

export function isSafeSteamImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;

        const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
        return STEAM_IMAGE_HOSTS.includes(hostname);
    } catch {
        return false;
    }
}
