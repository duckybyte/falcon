import { ListItem } from "@constants/items";
import Player from "@constants/Player";
import ObjectManager from "@core/logic/ObjectManager";
import getDir from "@utils/angle/getDir";
import getDist from "@utils/geometry/getDist";
import IntervalHelper, { Interval } from "@utils/geometry/IntervalHelper";

export default class ObjectUtils {
    private static readonly MAX_INTERVALS = 64;
    public static readonly spikeArcBuffer: Interval[] = Array.from({ length: ObjectUtils.MAX_INTERVALS }, () => [0, 0]);
    public static spikeArcBufferLength = 0;

    private static readonly swapBuffer: Interval[] = Array.from({ length: ObjectUtils.MAX_INTERVALS }, () => [0, 0]);

    static getSpikeBounceArc(builder: Player, victim: Player, item: ListItem, ignoreSID?: number): number {
        const builderPos = builder.real_position;
        const victimPos = victim.real_position;

        const dist = getDist(builderPos, victimPos);
        const builderToVictim = getDir(victimPos, builderPos);

        const placementRadius = 35 + item.scale + (item.placeOffset ?? 0);
        const hitBoxScale = item.scale + 35;

        if (dist > placementRadius + hitBoxScale) {
            ObjectUtils.spikeArcBufferLength = 0;
            return 0;
        }

        const num = (placementRadius * placementRadius) + (dist * dist) - (hitBoxScale * hitBoxScale);
        const den = 2 * dist * placementRadius;

        let cosVal = num / den;
        if (cosVal < -1) cosVal = -1;
        else if (cosVal > 1) cosVal = 1;

        const theta = Math.acos(cosVal);
        const minAngle = builderToVictim - theta;
        const maxAngle = builderToVictim + theta;

        ObjectUtils.spikeArcBuffer[0][0] = minAngle;
        ObjectUtils.spikeArcBuffer[0][1] = maxAngle;
        ObjectUtils.spikeArcBufferLength = 1;

        const closeObjects = ObjectManager.pool.closeObjects;
        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (ignoreSID === gameObject.sid) continue;

            const blockedCount = IntervalHelper.computeInterval(builderPos, gameObject, item);
            if (blockedCount === 0) continue;

            for (let j = 0; j < blockedCount; j++) {
                if (ObjectUtils.spikeArcBufferLength === 0) break;

                const currentCount = ObjectUtils.spikeArcBufferLength;
                for (let k = 0; k < currentCount; k++) {
                    ObjectUtils.swapBuffer[k][0] = ObjectUtils.spikeArcBuffer[k][0];
                    ObjectUtils.swapBuffer[k][1] = ObjectUtils.spikeArcBuffer[k][1];
                }

                const bStart = IntervalHelper.computeBuffer[j][0];
                const bEnd = IntervalHelper.computeBuffer[j][1];

                ObjectUtils.spikeArcBufferLength = IntervalHelper.subtractInterval(currentCount, bStart, bEnd, ObjectUtils.swapBuffer);
            }
        }

        return ObjectUtils.spikeArcBufferLength;
    }
}