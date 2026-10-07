export default function lerp(start: number, end: number, t: number) {
    return start + (end - start) * t;
}