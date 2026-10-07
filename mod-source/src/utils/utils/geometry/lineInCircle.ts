import Vec2 from "@mod-types/geometry/Vec2";
import { Point } from "@mod-types/index";
import withinDist from "./withinDist";

const startVec = new Vec2(0, 0);
const endVec = new Vec2(0, 0);
const circleCenterVec = new Vec2(0, 0);
const lineVec = new Vec2(0, 0);
const startToCenter = new Vec2(0, 0);
const closestPoint: Point = { x: 0, y: 0 };

export default function lineInCircle(lineStart: Point, lineEnd: Point, circleCenter: Point, circleRadius: number) {
    startVec.copy(lineStart.x, lineStart.y);
    endVec.copy(lineEnd.x, lineEnd.y);
    circleCenterVec.copy(circleCenter.x, circleCenter.y);

    endVec.sub(startVec, lineVec);
    const lineMagSq = lineVec.magSq();
    if (lineMagSq === 0) return withinDist(lineStart, circleCenter, circleRadius);

    circleCenterVec.sub(startVec, startToCenter);

    let t = startToCenter.dot(lineVec) / lineMagSq;
    t = Math.max(0, Math.min(1, t));

    closestPoint.x = startVec.x + t * lineVec.x;
    closestPoint.y = startVec.y + t * lineVec.y;
    return withinDist(closestPoint, circleCenter, circleRadius);
}