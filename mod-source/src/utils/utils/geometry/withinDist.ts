import { Point } from "@mod-types/index";

export default function withinDist(a: Point, b: Point, dist: number) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy < dist * dist;
}