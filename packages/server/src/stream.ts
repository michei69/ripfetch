import { requestProgress } from "./requestProgress";

type Event = { event: string; data: unknown };
export function streamResponse(
    request: Request,
    work: (emit: (event: Event) => void, signal: AbortSignal) => Promise<void>,
) {
    const controller = new AbortController();
    let stop = () => {};
    const body = new ReadableStream<Uint8Array>({
        start(output) {
            const encoder = new TextEncoder();
            let closed = false;
            const emit = (event: Event) => {
                if (!closed)
                    output.enqueue(
                        encoder.encode(
                            `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
                        ),
                    );
            };
            const heartbeat = setInterval(
                () => emit({ event: "ping", data: { timestamp: Date.now() } }),
                5000,
            );
            stop = () => {
                if (closed) return;
                closed = true;
                clearInterval(heartbeat);
                controller.abort();
                request.signal.removeEventListener("abort", stop);
                output.close();
            };
            request.signal.addEventListener("abort", stop, { once: true });
            if (request.signal.aborted) {
                stop();
                return;
            }
            void requestProgress.run(
                {
                    signal: controller.signal,
                    report: (message) =>
                        emit({ event: "status", data: { message } }),
                },
                async () => {
                    try {
                        await work(emit, controller.signal);
                    } catch (error) {
                        if (!controller.signal.aborted) {
                            console.error("Streaming request failed:", error);
                            emit({
                                event: "failure",
                                data: {
                                    message:
                                        "Request failed. Results already received remain available.",
                                },
                            });
                        }
                    } finally {
                        stop();
                    }
                },
            );
        },
        cancel() {
            stop();
        },
    });
    return new Response(body, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    });
}
