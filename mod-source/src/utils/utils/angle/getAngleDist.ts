export default function getAngleDist(a: number, b: number) {
    const diff = Math.abs(a - b) % (Math.PI * 2);
    return diff > Math.PI ? (Math.PI * 2 - diff) : diff;
}