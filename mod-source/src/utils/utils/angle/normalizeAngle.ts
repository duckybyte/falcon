const TWO_PI = Math.PI * 2;

export default function normalizeAngle(angle: number) {
    return (angle % TWO_PI + TWO_PI) % TWO_PI;
}