export function steamHeaderUrl(id: number | string): string {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(
        String(id),
    )}/header.jpg`;
}

export function steamCapsuleUrl(
    id: number | string,
    smallCapsule: string,
): string {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(
        String(id),
    )}/${encodeURIComponent(smallCapsule)}/capsule_231x87.jpg`;
}

export function isSafeSteamImageUrl(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;

        const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
        return (
            hostname === "shared.fastly.steamstatic.com" ||
            hostname === "shared.akamai.steamstatic.com" ||
            hostname === "cdn.akamai.steamstatic.com" ||
            hostname === "steamcdn-a.akamaihd.net"
        );
    } catch {
        return false;
    }
}
