export class ConcurrencyLimiter {
    private active = 0;
    private readonly waiters: Array<{
        signal: AbortSignal;
        resolve: () => void;
        reject: (error: Error) => void;
        onAbort: () => void;
        settled: boolean;
    }> = [];

    constructor(
        private readonly limit: number,
        private readonly maxQueue = limit * 10,
    ) {}

    async run<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
        await this.acquire(signal);
        try {
            return await task();
        } finally {
            this.release();
        }
    }

    private acquire(signal: AbortSignal): Promise<void> {
        if (signal.aborted) {
            return Promise.reject(new Error("Request aborted"));
        }

        if (this.active < this.limit) {
            this.active++;
            return Promise.resolve();
        }

        if (this.waiters.length >= this.maxQueue) {
            return Promise.reject(new Error("Concurrency queue is full"));
        }

        return new Promise((resolve, reject) => {
            const waiter = {
                signal,
                resolve,
                reject,
                onAbort: () => {},
                settled: false,
            };
            waiter.onAbort = () => {
                if (waiter.settled) return;
                waiter.settled = true;
                const index = this.waiters.indexOf(waiter);
                if (index !== -1) this.waiters.splice(index, 1);
                reject(new Error("Request aborted"));
            };
            this.waiters.push(waiter);
            signal.addEventListener("abort", waiter.onAbort, { once: true });
        });
    }

    private release() {
        this.active--;

        while (this.waiters.length) {
            const waiter = this.waiters.shift();
            if (!waiter || waiter.settled || waiter.signal.aborted) continue;

            waiter.settled = true;
            waiter.signal.removeEventListener("abort", waiter.onAbort);
            this.active++;
            waiter.resolve();
            return;
        }
    }
}

export class AsyncQueue<T> {
    private items: T[] = [];
    private resolvers: ((value: IteratorResult<T>) => void)[] = [];

    push(item: T) {
        if (this.resolvers.length) {
            const resolve = this.resolvers.shift()!;
            resolve({ value: item, done: false });
        } else {
            this.items.push(item);
        }
    }

    // returns a promise that resolves when the next item is available
    async next(): Promise<IteratorResult<T>> {
        if (this.items.length) {
            const v = this.items.shift()!;
            return { value: v, done: false };
        }
        return new Promise((resolve) => this.resolvers.push(resolve));
    }

    // optional: close the queue
    close() {
        while (this.resolvers.length) {
            const resolve = this.resolvers.shift()!;
            resolve({ value: undefined, done: true });
        }
    }
}

export const getFirstMatch = (text: string | undefined, regex: RegExp) =>
    text?.matchAll(regex).next().value;
