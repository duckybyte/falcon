export default function lerpAngle(a: number, b: number, t: number) {
    const TWO_PI = Math.PI * 2;
    const delta = (((b - a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI) - Math.PI;
    return a + delta * t;
}