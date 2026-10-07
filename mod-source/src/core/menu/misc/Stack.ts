export default class Stack<T> {
    private items: T[] = [];

    push(item: T) {
        if (typeof item === "undefined") return;
        this.items.push(item);
    }

    pop(): T | undefined {
        return this.items.pop();
    }

    peek(): T | undefined {
        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    clear() {
        this.items.length = 0;
    }
}