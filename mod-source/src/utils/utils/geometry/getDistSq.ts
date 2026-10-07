import { Point } from "@mod-types/index";

export default function getDistSq(a: Point, b: Point) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}