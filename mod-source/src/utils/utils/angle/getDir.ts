import { Point } from "@mod-types/index";

export default function getDir(end: Point, start: Point) {
    return Math.atan2(end.y - start.y, end.x - start.x);
}