export type JsonObject = Record<string, unknown>;

export function parseEventData(event: Event): unknown {
    const data = (event as MessageEvent<string>).data;
    try {
        return JSON.parse(data) as unknown;
    } catch {
        return null;
    }
}

export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null;
}
