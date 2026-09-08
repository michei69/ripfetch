export const SECURITY_HEADERS = {
    "Content-Security-Policy":
        "default-src 'self'; base-uri 'self'; object-src 'none'; " +
        "frame-ancestors 'none'; form-action 'self'; script-src 'self'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https://shared.fastly.steamstatic.com " +
        "https://cdn.akamai.steamstatic.com " +
        "https://steamcdn-a.akamaihd.net; connect-src 'self'",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
} as const;
