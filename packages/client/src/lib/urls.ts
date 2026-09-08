export function isSafeExternalUrl(value: unknown): value is string {
    if (typeof value !== "string" || !value.trim()) return false;

    try {
        const { protocol } = new URL(value);
        return (
            protocol === "http:" ||
            protocol === "https:" ||
            protocol === "magnet:"
        );
    } catch {
        return false;
    }
}
