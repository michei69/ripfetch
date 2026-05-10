export class AsyncQueue<T> {
    private items: T[] = []
    private resolvers: ((value: IteratorResult<T>) => void)[] = []

    push(item: T) {
        if (this.resolvers.length) {
            const resolve = this.resolvers.shift()!
            resolve({ value: item, done: false })
        } else {
            this.items.push(item)
        }
    }

    // returns a promise that resolves when the next item is available
    async next(): Promise<IteratorResult<T>> {
        if (this.items.length) {
            const v = this.items.shift()!
            return { value: v, done: false }
        }
        return new Promise(resolve => this.resolvers.push(resolve))
    }

    // optional: close the queue
    close() {
        while (this.resolvers.length) {
            const resolve = this.resolvers.shift()!
            resolve({ value: undefined, done: true })
        }
    }
}