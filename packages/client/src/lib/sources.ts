/**
 * Source and host knowledge shared by the source index, the search route and
 * the download workspace.
 *
 * Download payloads are keyed `${displayName} (${title})`, so every lookup
 * here is done on the lowercased display name.
 */

export type SourceInfo = {
    /** Lowercased display name, as it appears in download payload keys. */
    key: string;
    /** Display name, as the server reports it. */
    name: string;
    /** Short tag surfaced in the source index when a pre-redirect warning exists. */
    note?: string;
};

export const SOURCES: readonly SourceInfo[] = [
    { key: "online-fix.me", name: "Online-Fix.me", note: "zip password" },
    { key: "gogto", name: "GOGto" },
    { key: "gload", name: "GLoad" },
    { key: "steamrip", name: "SteamRIP" },
    { key: "fitgirl", name: "FitGirl" },
    { key: "ovagames", name: "OvaGames", note: "zip password" },
    { key: "dodirepacks", name: "DodiRepacks", note: "adblocker" },
    { key: "game3rb", name: "Game3RB", note: "malware risk" },
    { key: "igg", name: "IGG", note: "malware risk" },
    { key: "steamunlocked", name: "SteamUnlocked", note: "slow" },
];

export const SOURCE_COUNT = SOURCES.length;

/** Position of a source in the index; unknown sources sink to the bottom. */
export const SOURCE_RANK: Record<string, number> = Object.fromEntries(
    SOURCES.map((source, index) => [source.key, index]),
);

// ─── hosts ─────────────────────────────────────────────────────────────────

/** Ordered by preference: the earlier the marker, the better the host. */
const TRUSTED_HOSTS = [
    "fuckingfast",
    "megaup",
    "gofile",
    "pixeldrain",
    "mega.nz",
    "vikingfile",
    "datanodes",
    "1fichier",
    "koramaup",
    "buzzheavier",
    "1cloudfile",
    "fileq",
    "torrent",
];

/** Rate-limited hosts: usable, but the last thing you want to click. */
const SLOW_HOSTS = ["uploadhaven"];

/** Hosts we reach through the server's own relay. */
const PROXIED_HOSTS = ["uploadhaven"];

export type HostFlags = {
    trusted: boolean;
    slow: boolean;
    proxied: boolean;
};

const matchedAt = (host: string, markers: readonly string[]): number => {
    const needle = host.toLowerCase();
    return markers.findIndex((marker) => needle.includes(marker));
};

export function hostFlags(host: string): HostFlags {
    return {
        trusted: matchedAt(host, TRUSTED_HOSTS) !== -1,
        slow: matchedAt(host, SLOW_HOSTS) !== -1,
        proxied: matchedAt(host, PROXIED_HOSTS) !== -1,
    };
}

/** Known hosts first in preference order, then the rest alphabetically. */
export function compareHosts(a: string, b: string): number {
    const rankA = matchedAt(a, TRUSTED_HOSTS);
    const rankB = matchedAt(b, TRUSTED_HOSTS);
    if (rankA !== rankB) {
        if (rankA === -1) return 1;
        if (rankB === -1) return -1;
        return rankA - rankB;
    }
    return a.localeCompare(b);
}

// ─── releases ──────────────────────────────────────────────────────────────

export type Release = { label: string; url: string };
export type HostGroup = { host: string; releases: Release[] };

/**
 * Release keys are `${host} - ${release}`, e.g. `fuckingfast - Part 1`.
 * Anything without a separator lands in a catch-all group.
 */
export function groupByHost(links: Record<string, string>): HostGroup[] {
    const groups = new Map<string, Release[]>();

    for (const [key, url] of Object.entries(links)) {
        const separator = key.indexOf(" - ");
        const host = separator === -1 ? "Other" : key.slice(0, separator);
        const label = separator === -1 ? key : key.slice(separator + 3);
        const releases = groups.get(host);
        if (releases) releases.push({ label, url });
        else groups.set(host, [{ label, url }]);
    }

    return [...groups.entries()]
        .map(([host, releases]) => ({
            host,
            releases: releases.sort(compareReleases),
        }))
        .sort((a, b) => compareHosts(a.host, b.host));
}

/** `Part 2` sorts before `Part 10`. */
function compareReleases(a: Release, b: Release): number {
    const aParts = a.label.split(/(\d+)/);
    const bParts = b.label.split(/(\d+)/);
    const shared = Math.min(aParts.length, bParts.length);

    for (let index = 0; index < shared; index++) {
        const isNumber = index % 2 === 1;
        if (!isNumber) {
            const diff = (aParts[index] ?? "").localeCompare(
                bParts[index] ?? "",
            );
            if (diff !== 0) return diff;
            continue;
        }
        const aNumber = Number.parseInt(aParts[index] ?? "", 10) || 0;
        const bNumber = Number.parseInt(bParts[index] ?? "", 10) || 0;
        if (aNumber !== bNumber) return aNumber - bNumber;
    }

    return aParts.length - bParts.length;
}

// ─── misc ──────────────────────────────────────────────────────────────────

/** Splits `SteamRIP (Elden Ring)` into its source and matched title. */
export function parseSourceKey(key: string): {
    source: string;
    title: string | null;
} {
    const match = key.match(/^(.+?)\s*\((.+)\)$/);
    return match
        ? { source: (match[1] ?? "").trim(), title: (match[2] ?? "").trim() }
        : { source: key, title: null };
}

export function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url.length > 34 ? `${url.slice(0, 34)}…` : url;
    }
}
