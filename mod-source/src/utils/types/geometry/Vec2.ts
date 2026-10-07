export default class Vec2 {
    constructor(
        public x: number,
        public y: number
    ) { }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    copy(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(other: Vec2): Vec2;
    add(x: number, y: number): void;
    add(a: Vec2 | number, b?: number) {
        if (typeof a !== "number") {
            return new Vec2(this.x + a.x, this.y + a.y);
        }

        this.x += a as number;
        this.y += b!;
    }

    sub(other: Vec2, target: Vec2): Vec2;
    sub(x: number, y: number): void;
    sub(a: Vec2 | number, b: number | Vec2) {
        if (typeof a !== "number" && typeof b !== "number") {
            b.copy(this.x - a.x, this.y - a.y);
            return b;
        }

        if (typeof a === "number" && typeof b === "number") {
            this.x -= a;
            this.y -= b;
        }
    }

    scale(s: number) {
        return new Vec2(this.x * s, this.y * s);
    }

    normalize() {
        const mag = this.mag();
        if (mag === 0) return new Vec2(0, 0);
        return new Vec2(this.x / mag, this.y / mag);
    }

    dot(other: Vec2) {
        return this.x * other.x + this.y * other.y;
    }

    cross(other: Vec2) {
        return this.x * other.y - this.y * other.x;
    }

    lerp(other: Vec2, t: number) {
        return new Vec2(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        );
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    equals(other: Vec2) {
        return this.x === other.x && this.y === other.y;
    }
}