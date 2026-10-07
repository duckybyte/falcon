export default function lineInRect(
    recMinX: number, recMinY: number,
    recMaxX: number, recMaxY: number,
    x1: number, y1: number,
    x2: number, y2: number
) {
    const intersectMinX = Math.max(recMinX, Math.min(x1, x2));
    const intersectMaxX = Math.min(recMaxX, Math.max(x1, x2));

    if (intersectMinX > intersectMaxX) return false;

    let yAtMinX = y1;
    let yAtMaxX = y2;

    const dx = x2 - x1;

    if (Math.abs(dx) > 0.0000001) {
        const slope = (y2 - y1) / dx;
        const intercept = y1 - slope * x1;
        yAtMinX = slope * intersectMinX + intercept;
        yAtMaxX = slope * intersectMaxX + intercept;
    }

    const lineMinY = Math.min(yAtMinX, yAtMaxX);
    const lineMaxY = Math.max(yAtMinX, yAtMaxX);
    const finalIntersectMinY = Math.max(recMinY, lineMinY);
    const finalIntersectMaxY = Math.min(recMaxY, lineMaxY);

    return finalIntersectMinY <= finalIntersectMaxY;
}