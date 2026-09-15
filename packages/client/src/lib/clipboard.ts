/**
 * Writes `text` to the clipboard, reporting failure instead of throwing: the
 * API rejects on an insecure origin, on a denied permission, and when the
 * document is not focused. Callers each render their own failure state.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
