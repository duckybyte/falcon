import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import { Point } from "@mod-types/index";
import AngleFinder from "@placing/AngleFinder";
import getDir from "@utils/angle/getDir";
import normalizeAngle from "@utils/angle/normalizeAngle";
import getDistSq from "@utils/geometry/getDistSq";

export type Interval = [start: number, end: number];

export default class IntervalHelper {
    private static readonly MAX_INTERVALS = 64;
    public static readonly intervalBuffer: Interval[] = Array.from({ length: IntervalHelper.MAX_INTERVALS }, () => [0, 0]);
    public static intervalBufferLength = 0;

    public static readonly computeBuffer: Interval[] = Array.from({ length: 2 }, () => [0, 0]);
    public static computeBufferLength = 0;

    static subtractInterval(
        inputCount: number,
        bStart: number,
        bEnd: number,
        inputBuffer: Interval[] = IntervalHelper.intervalBuffer
    ): number {
        let resultCount = 0;
        const out = IntervalHelper.intervalBuffer;

        for (let i = 0; i < inputCount; i++) {
            const iStart = inputBuffer[i][0];
            const iEnd = inputBuffer[i][1];

            if (bEnd <= iStart || bStart >= iEnd) {
                out[resultCount][0] = iStart;
                out[resultCount][1] = iEnd;
                resultCount++;
                continue;
            }

            if (bStart > iStart) {
                out[resultCount][0] = iStart;
                out[resultCount][1] = bStart;
                resultCount++;
            }

            if (bEnd < iEnd) {
                out[resultCount][0] = bEnd;
                out[resultCount][1] = iEnd;
                resultCount++;
            }
        }

        IntervalHelper.intervalBufferLength = resultCount;
        return resultCount;
    }

    static computeInterval(playerPos: Point, obj: GameObject, item: ListItem): number {
        const itemScale = item.scale;
        const placementOffset = 35 + itemScale + (item.placeOffset ?? 0);
        const placeDistanceSq = placementOffset * placementOffset;

        const objScale = obj.blocker ? obj.blocker : (obj.getScale(0.6, obj.isItem) - 0.05);

        const totalRadius = itemScale + objScale;
        const maxReach = placementOffset + totalRadius;
        const distanceSq = getDistSq(playerPos, obj);

        if (distanceSq > maxReach * maxReach) {
            IntervalHelper.computeBufferLength = 0;
            return 0;
        }

        if ((obj.blocker && distanceSq < AngleFinder.CLOSEST_BLOCKER_DISTANCE_SQ) || distanceSq < AngleFinder.CLOSEST_OBJ_DISTANCE_SQ) {
            IntervalHelper.computeBuffer[0][0] = 0;
            IntervalHelper.computeBuffer[0][1] = Math.PI * 2;
            IntervalHelper.computeBufferLength = 1;
            return 1;
        }

        const distance = Math.sqrt(distanceSq);
        const num = placeDistanceSq + distanceSq - (totalRadius * totalRadius);
        const den = 2 * distance * placementOffset;

        let cosVal = num / den;
        if (cosVal < -1) cosVal = -1;
        else if (cosVal > 1) cosVal = 1;

        const theta = Math.acos(cosVal);
        const dir = getDir(obj, playerPos);
        const start = normalizeAngle(dir - theta);
        const end = normalizeAngle(dir + theta);

        if (start > end) {
            IntervalHelper.computeBuffer[0][0] = start;
            IntervalHelper.computeBuffer[0][1] = Math.PI * 2;
            IntervalHelper.computeBuffer[1][0] = 0;
            IntervalHelper.computeBuffer[1][1] = end;
            IntervalHelper.computeBufferLength = 2;
            return 2;
        }

        IntervalHelper.computeBuffer[0][0] = start;
        IntervalHelper.computeBuffer[0][1] = end;
        IntervalHelper.computeBufferLength = 1;
        return 1;
    }
}