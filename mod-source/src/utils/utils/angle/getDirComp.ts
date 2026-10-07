import { Point } from "@mod-types/index";


const dirComp: Point = { x: 0, y: 0 };
export default function getDirComp(end: Point, start: Point): Readonly<Point> {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);

    dirComp.x = dx / dist;
    dirComp.y = dy / dist;
    return dirComp;
}