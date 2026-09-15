type RequestServer = {
    requestIP(request: Request): { address: string } | null;
};

type Limit = {
    key: string;
    max: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
// ponytail: process-local buckets keep this dependency-free; use a shared
// store when deploying multiple server instances behind a load balancer.
const buckets = new Map<string, Bucket>();

function getLimit(pathname: string): Limit | null {
    if (pathname === "/api/search" || pathname === "/api/search/sse") {
        return { key: "search", max: 30 };
    }

    if (/^\/api\/game\/[^/]+$/.test(pathname)) {
        return { key: "game-info", max: 60 };
    }

    if (/^\/api\/game\/[^/]+\/(?:links|links\/sse|stream)$/.test(pathname)) {
        return { key: "source-search", max: 6 };
    }

    if (/^\/api\/uploadhaven\/[^/]+$/.test(pathname)) {
        return { key: "uploadhaven", max: 4 };
    }

    return null;
}

function pruneBuckets(now: number) {
    if (buckets.size < MAX_BUCKETS) return;

    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

export function rateLimitRequest(
    request: Request,
    server: RequestServer | null,
): Response | undefined {
    const { pathname } = new URL(request.url);
    const limit = getLimit(pathname);
    if (!limit) return;

    const address = server?.requestIP(request)?.address ?? "unknown";
    const key = `${address}:${limit.key}`;
    const now = Date.now();
    pruneBuckets(now);

    const current = buckets.get(key);
    if (!current && buckets.size >= MAX_BUCKETS) {
        return new Response("Too many requests", {
            status: 429,
            headers: {
                "Cache-Control": "no-store",
                "Content-Type": "text/plain; charset=utf-8",
                "Retry-After": "60",
            },
        });
    }

    const bucket =
        current && current.resetAt > now
            ? current
            : { count: 0, resetAt: now + WINDOW_MS };

    bucket.count++;
    buckets.set(key, bucket);

    if (bucket.count <= limit.max) return;

    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return new Response("Too many requests", {
        status: 429,
        headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "Retry-After": String(retryAfter),
        },
    });
}
