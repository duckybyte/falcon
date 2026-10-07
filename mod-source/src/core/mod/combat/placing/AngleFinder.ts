import GameObject from "@constants/GameObject";
import items, { ListItem } from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import Menu from "@core/menu/Menu";
import { Point } from "@mod-types/index";
import Angle from "@placing/Angle";
import AngleGrader from "@placing/AngleGrader";
import getDir from "@utils/angle/getDir";
import normalizeAngle from "@utils/angle/normalizeAngle";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";

type AngleItemContextIntervals = "open" | "raw" | "invalid" | "valid";
type AngleItemContextIndexs = `${AngleItemContextIntervals}Index`;

interface AngleItemContext {
    rawIndex: number;
    invalidIndex: number;
    validIndex: number;
    openIndex: number;

    /**
     * The open buffer is used to represent the angular footprints of objects that are about to break.
     * This is only used while in 'preplace' mode.
     */

    open: Float32Array;

    /**
     * The raw buffer that holds the raw slices of blocked angles before merging.
     */

    raw: Float32Array;

    /**
     * Buffer that holds blocked angles.
     */

    invalid: Float32Array;

    /**
     * Buffer that holds valid angles for placement.
     */

    valid: Float32Array;
}

interface FinderSampleContext {
    trapSamples: Float32Array;
    spikeSamples: Float32Array;

    trapPreplaceSamples: Float32Array;
    trapPreplaceSamplesIndex: number;

    spikePreplaceSamples: Float32Array;
    spikePreplaceSamplesIndex: number;
}

interface FinderComputeContext {
    spike: AngleItemContext;
    trap: AngleItemContext;
    samples: FinderSampleContext;
}

export interface FinderOptions {
    obj?: GameObject;
    grade?: boolean;
    replace?: boolean;
    trap?: boolean;
    spike?: boolean;
    budgetMlt?: number;
    preplace?: boolean;
}

function insertionSortIntervals(arr: Float32Array, n: number) {
    for (let i = 2; i < n; i += 2) {
        const currentStart = arr[i];
        const currentEnd = arr[i + 1];

        let j = i - 2;

        while (j >= 0 && arr[j] > currentStart) {
            arr[j + 2] = arr[j];
            arr[j + 3] = arr[j + 1];

            j -= 2;
        }

        arr[j + 2] = currentStart;
        arr[j + 3] = currentEnd;
    }
}

export default class AngleFinder {
    private static riverObject = new GameObject(0, ScriptConfig.MAP_SIZE / 2, 0, 362, -1, -1);

    static readonly HIGHEST_ANGLE_COUNT = 140;
    static readonly CLOSEST_OBJ_DISTANCE_SQ = 20 * 20;
    static readonly CLOSEST_BLOCKER_DISTANCE_SQ = 270 * 270;
    private static readonly defaultOptions: FinderOptions = { grade: true };

    static angleBuffer: Angle[] = Array.from({ length: this.HIGHEST_ANGLE_COUNT }, () => new Angle(0, 0, 0, 0, 0));

    private static readonly MAX_INTERVALS = 30; // a estimate
    private static tmpBuffer = new Float32Array(AngleFinder.MAX_INTERVALS * 2);

    private static data: FinderComputeContext = {
        spike: {
            raw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            invalid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            valid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            open: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            openIndex: 0,
            rawIndex: 0,
            invalidIndex: 0,
            validIndex: 0
        },

        trap: {
            raw: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            invalid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            valid: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            open: new Float32Array(AngleFinder.MAX_INTERVALS * 2),
            openIndex: 0,
            rawIndex: 0,
            invalidIndex: 0,
            validIndex: 0
        },

        samples: {
            trapSamples: new Float32Array(70),
            spikeSamples: new Float32Array(70),

            trapPreplaceSamples: new Float32Array(70),
            trapPreplaceSamplesIndex: 0,
            spikePreplaceSamples: new Float32Array(70),
            spikePreplaceSamplesIndex: 0
        }
    };

    private static resetCtx(ctx: FinderComputeContext) {
        ctx.trap.rawIndex = 0;
        ctx.trap.invalidIndex = 0;
        ctx.trap.openIndex = 0;
        ctx.trap.validIndex = 0;

        ctx.spike.rawIndex = 0;
        ctx.spike.invalidIndex = 0;
        ctx.spike.openIndex = 0;
        ctx.spike.validIndex = 0;

        ctx.samples.spikePreplaceSamplesIndex = 0;
        ctx.samples.trapPreplaceSamplesIndex = 0;
    }

    private static computeInterval(playerPos: Point, obj: GameObject, item: ListItem, interval: Float32Array, index: number, isOurPlayer: boolean, isPreplace?: boolean) {
        const itemScale = item.scale;
        const placementOffset = 35 + itemScale + (item.placeOffset ?? 0);
        const placeDistanceSq = placementOffset * placementOffset;

        const objScale = (this.riverObject === obj ? this.riverObject.scale :
            obj.blocker ? obj.blocker : obj.getScale(.6, obj.isItem)) + (isOurPlayer ? .01 : -.05);

        const totalRadius = itemScale + objScale;
        const totalRadiusSq = totalRadius * totalRadius;

        const distanceSq = getDistSq(playerPos, obj);
        const maxReach = placementOffset + totalRadius;

        if (distanceSq > maxReach * maxReach) return index;

        const distance = Math.sqrt(distanceSq);
        const isRiverObject = obj === this.riverObject;
        const riverObjectEffectiveScale = this.riverObject.scale - 20;
        const riverObjectEffectiveScaleSq = riverObjectEffectiveScale * riverObjectEffectiveScale;
        const isWithinRiver = isRiverObject && distanceSq <= riverObjectEffectiveScaleSq;

        if (isOurPlayer && isPreplace) {
            const ourPlayer = Client.player;

            if (ourPlayer.trap && obj.sid === ourPlayer.trap.sid) {
                interval[index++] = 0;
                interval[index++] = Math.PI * 2;
                return index;
            }
        }

        if ((obj.blocker && distanceSq < AngleFinder.CLOSEST_BLOCKER_DISTANCE_SQ) || distanceSq < AngleFinder.CLOSEST_OBJ_DISTANCE_SQ || isWithinRiver) {
            interval[index++] = 0;
            interval[index++] = Math.PI * 2;
            return index;
        }

        const num = placeDistanceSq + distanceSq - totalRadiusSq;
        const den = 2 * distance * placementOffset;

        let cosVal = num / den;
        if (cosVal < -1) cosVal = -1;
        if (cosVal > 1) cosVal = 1;

        const thetha = Math.acos(cosVal);

        const dir = getDir(obj, playerPos);
        const start = normalizeAngle(dir - thetha);
        const end = normalizeAngle(dir + thetha);

        if (start > end) {
            interval[index++] = start;
            interval[index++] = Math.PI * 2;

            interval[index++] = 0;
            interval[index++] = end;
        } else {
            interval[index++] = start;
            interval[index++] = end;
        }

        return index;
    }

    private static mergeRawInterval(
        itemCtx: AngleItemContext,
        sourceInterval: AngleItemContextIntervals, sourceIntervalIndex: AngleItemContextIndexs,
        destInterval: AngleItemContextIntervals, destIntervalIndex: AngleItemContextIndexs
    ) {
        const tmpBuffer = this.tmpBuffer;
        const sourceCount = itemCtx[sourceIntervalIndex];

        if (sourceCount < 2) return;
        insertionSortIntervals(itemCtx[sourceInterval], itemCtx[sourceIntervalIndex]);

        const source = itemCtx[sourceInterval];

        let currentStart = source[0];
        let currentEnd = source[1];
        let writeIdx = 0;

        for (let i = 2; i < sourceCount; i += 2) {
            const nextStart = source[i];
            const nextEnd = source[i + 1];

            if (nextStart <= currentEnd) {
                currentEnd = Math.max(currentEnd, nextEnd);
            } else {
                tmpBuffer[writeIdx++] = currentStart;
                tmpBuffer[writeIdx++] = currentEnd;

                currentStart = nextStart;
                currentEnd = nextEnd;
            }
        }

        tmpBuffer[writeIdx++] = currentStart;
        tmpBuffer[writeIdx++] = currentEnd;

        for (let i = 0; i < writeIdx; i++) {
            itemCtx[destInterval][i] = tmpBuffer[i];
        }

        itemCtx[destIntervalIndex] = writeIdx;
    }

    private static invertInterval(invalid: Float32Array, invalidIndex: number, valid: Float32Array) {
        if (invalidIndex === 0) {
            valid[0] = 0;
            valid[1] = Math.PI * 2;
            return 2;
        }

        let lastEnd = 0;
        let index = 0;

        for (let i = 0; i < invalidIndex; i += 2) {
            const start = invalid[i];
            const end = invalid[i + 1];

            if (start > lastEnd) {
                valid[index++] = lastEnd;
                valid[index++] = start;
            }

            lastEnd = Math.max(lastEnd, end);
        }

        if (lastEnd < Math.PI * 2) {
            valid[index++] = lastEnd;
            valid[index++] = Math.PI * 2;
        }

        return index;
    }

    private static readonly budgets = [16, 22, 28, 34, 40, 46, 52, 58, 64, 70];

    private static convertToBudget(unparsed: string, options: Readonly<FinderOptions>) {
        const parsed = parseInt(unparsed);
        const level = isNaN(parsed) ? 7 : parsed;
        const budgetMlt = options.budgetMlt ?? 1;

        return (this.budgets[level - 1] * budgetMlt) | 0;
    }

    private static optionalDefaultOther = new Float32Array(0);
    private static getSampleResponse = new Int32Array(2);

    private static getSample(
        container: Float32Array,
        intervals: Float32Array, intervalIndex: number,
        totalWidth: number,
        budget: number
    ) {
        let index = 0;

        for (let i = 0; i < intervalIndex; i += 2) {
            const sampleStart = intervals[i];
            const sampleEnd = intervals[i + 1];

            const trueWidth = sampleEnd - sampleStart;
            const ratio = trueWidth / totalWidth;
            const count = Math.max(0, (ratio * budget) | 0);

            if (sampleEnd < sampleStart) continue;
            if (count <= 0) continue;

            if (count === 1) {
                container[index++] = (sampleStart + sampleEnd) / 2;
            } else {
                const shrunkenWidth = sampleEnd - sampleStart;
                const step = shrunkenWidth / (count - 1);

                for (let j = 0; j < count; j++) {
                    container[index++] = sampleStart + (step * j);
                }
            }
        }

        return index;
    }

    private static getSamples(
        samples: Float32Array,
        valid: Float32Array, validIndex: number,
        budget: number,
        preplaceSamples?: Float32Array,
        other?: Float32Array, otherIndex?: number
    ) {
        otherIndex = otherIndex ?? 0;
        other = other ?? this.optionalDefaultOther;
        preplaceSamples = preplaceSamples ?? this.optionalDefaultOther;

        if (validIndex < 2 && otherIndex < 2) return 0;

        let validWidth = 0;
        let preplaceWidth = 0;

        for (let i = 0; i < validIndex; i += 2) {
            validWidth += valid[i + 1] - valid[i];
        }

        for (let i = 0; i < otherIndex; i += 2) {
            preplaceWidth += other[i + 1] - other[i];
        }

        const totalWidth = validWidth + preplaceWidth;

        if (totalWidth <= 0) {
            this.resetSampleResponse();
            return;
        }

        const validBudget = ((validWidth / totalWidth) * budget) | 0;
        const preplaceBudget = budget - validBudget;

        let index = this.getSample(samples, valid, validIndex, validWidth, validBudget);
        let preplaceIndex = this.getSample(preplaceSamples, other, otherIndex, preplaceWidth, preplaceBudget);

        this.getSampleResponse[0] = index;
        this.getSampleResponse[1] = preplaceIndex;
    }

    private static grade(
        playerPos: Point,
        samples: Float32Array, samplesIndex: number,
        item: ListItem, currentIdx: number,
        isPreplacement: boolean, options: Readonly<FinderOptions>
    ) {
        const scale = item.scale;
        const offset = 35 + scale + (item.placeOffset ?? 0);

        for (let i = 0; i < samplesIndex; i++) {
            const ang = samples[i];
            const x = playerPos.x + Math.cos(ang) * offset;
            const y = playerPos.y + Math.sin(ang) * offset;

            this.angleBuffer[currentIdx].redefine(x, y, scale, ang, item.id, isPreplacement);
            if (options.grade) AngleGrader.grade(currentIdx, options);
            currentIdx++;
        }

        return currentIdx;
    }

    private static gradeAll(
        playerPos: Point,
        spikeItem: ListItem,
        samples: FinderSampleContext, spikeSamplesIndex: number, trapSamplesIndex: number,
        options: Readonly<FinderOptions>
    ) {
        const trapItem = items.list[15];

        let currentIdx = 0;
        const trapSamples = samples.trapSamples;
        const spikeSamples = samples.spikeSamples;

        currentIdx = this.grade(
            playerPos,
            trapSamples, trapSamplesIndex,
            trapItem, currentIdx,
            false, options
        );

        currentIdx = this.grade(
            playerPos,
            spikeSamples, spikeSamplesIndex,
            spikeItem, currentIdx,
            false, options
        );

        if (options.preplace) {
            const trapPreplaceSamples = samples.trapPreplaceSamples;
            const spikePreplaceSamples = samples.spikePreplaceSamples;

            const trapPreplacementsIndex = samples.trapPreplaceSamplesIndex;
            const spikePreplaceSamplesIndex = samples.spikePreplaceSamplesIndex;

            currentIdx = this.grade(
                playerPos,
                trapPreplaceSamples, trapPreplacementsIndex,
                trapItem, currentIdx,
                true, options
            );

            this.grade(
                playerPos,
                spikePreplaceSamples, spikePreplaceSamplesIndex,
                spikeItem, currentIdx,
                true, options
            );
        }
    }

    private static computeAllIntervals(
        playerPos: Point, gameObject: GameObject,
        spikeItem: ListItem, trapItem: ListItem,
        ctx: FinderComputeContext, isOurPlayer: boolean, options: Readonly<FinderOptions>
    ) {
        if (gameObject.willBreak && options.preplace) {
            if (!options.trap) ctx.spike.openIndex = this.computeInterval(playerPos, gameObject, spikeItem, ctx.spike.open, ctx.spike.openIndex, isOurPlayer, true);
            if (!options.spike) ctx.trap.openIndex = this.computeInterval(playerPos, gameObject, trapItem, ctx.trap.open, ctx.trap.openIndex, isOurPlayer, true);
            return;
        }

        if (!options.trap) ctx.spike.rawIndex = this.computeInterval(playerPos, gameObject, spikeItem, ctx.spike.raw, ctx.spike.rawIndex, isOurPlayer);
        if (!options.spike) ctx.trap.rawIndex = this.computeInterval(playerPos, gameObject, trapItem, ctx.trap.raw, ctx.trap.rawIndex, isOurPlayer);
    }

    private static shrinkInterval(
        ctx: AngleItemContext,
        shrinkenInterval: AngleItemContextIntervals, shrinkenIntervalIndex: AngleItemContextIndexs,
        shrinkerInterval: AngleItemContextIntervals, shrinkerIntervalIndex: AngleItemContextIndexs
    ) {
        let count = ctx[shrinkenIntervalIndex];
        const tmpBuffer = this.tmpBuffer;

        for (let i = 0; i < ctx[shrinkerIntervalIndex]; i += 2) {
            const invStart = ctx[shrinkerInterval][i];
            const invEnd = ctx[shrinkerInterval][i + 1];

            let index = 0;

            for (let j = 0; j < count; j += 2) {
                let openStart = ctx[shrinkenInterval][j];
                let openEnd = ctx[shrinkenInterval][j + 1];

                const isIntervalsNotOverlapping = invEnd <= openStart || invStart >= openEnd;
                const isInvalidBiggerThanOpen = invStart <= openStart && invEnd >= openEnd;
                const isInvalidBisectingOpen = invStart > openStart && invEnd < openEnd;

                if (isIntervalsNotOverlapping) {
                    tmpBuffer[index++] = openStart;
                    tmpBuffer[index++] = openEnd;
                } else if (isInvalidBiggerThanOpen) {
                    continue;
                } else if (isInvalidBisectingOpen) {
                    tmpBuffer[index++] = openStart;
                    tmpBuffer[index++] = invStart;
                    tmpBuffer[index++] = invEnd;
                    tmpBuffer[index++] = openEnd;
                } else {
                    if (invStart <= openStart) openStart = invEnd;
                    else if (invEnd >= openEnd) openEnd = invStart;

                    if (openEnd > openStart) {
                        tmpBuffer[index++] = openStart;
                        tmpBuffer[index++] = openEnd;
                    }
                }
            }

            for (let k = 0; k < index; k++) ctx[shrinkenInterval][k] = tmpBuffer[k];
            count = index;
        }

        ctx[shrinkenIntervalIndex] = count;
    }

    private static resetSampleResponse() {
        this.getSampleResponse[0] = 0;
        this.getSampleResponse[1] = 0;
    }

    static compute(player: Player, options?: Readonly<FinderOptions>) {
        if (!options) options = AngleFinder.defaultOptions;
        const budget = this.convertToBudget(Menu.getValue("angleFinderLevel"), options);

        const playerPos = player.real_position;
        const playerNextPos = player.sid === Client.mySID ? player.next_state : player.next_position;
        const blockableObjects = ObjectManager.pool.blockableObjects;
        this.riverObject.x = playerPos.x;

        const ctx = this.data;
        this.resetCtx(ctx);

        const spikeItem = items.list[player.items[2]];
        const trapItem = items.list[15];
        if (options.replace && options.preplace) return 0;

        for (let i = 0, len = blockableObjects.length; i < len; i++) {
            const gameObject = blockableObjects[i];
            if (!gameObject || !gameObject.active || gameObject.isGhost) continue;

            if (ctx.spike.rawIndex >= AngleFinder.MAX_INTERVALS * 2 || ctx.trap.rawIndex >= AngleFinder.MAX_INTERVALS * 2) {
                console.log("raw interval has gone beyond 30 (basic fix: should increase the buffer)");
                break;
            }

            const requireNextPosition = options.replace || (options.preplace && gameObject.willBreak);
            this.computeAllIntervals(requireNextPosition ? playerNextPos : playerPos, gameObject, spikeItem, trapItem, ctx, player.sid === Client.mySID, options);
        }

        this.computeAllIntervals(playerPos, this.riverObject, spikeItem, trapItem, ctx, player.sid === Client.mySID, options);

        if (options.preplace) {
            if (!options.trap) this.mergeRawInterval(ctx.spike, "open", "openIndex", "open", "openIndex");
            if (!options.spike) this.mergeRawInterval(ctx.trap, "open", "openIndex", "open", "openIndex");
        }

        if (!options.trap) this.mergeRawInterval(ctx.spike, "raw", "rawIndex", "invalid", "invalidIndex");
        if (!options.spike) this.mergeRawInterval(ctx.trap, "raw", "rawIndex", "invalid", "invalidIndex");

        if (options.preplace) {
            if (!options.trap) this.shrinkInterval(ctx.spike, "open", "openIndex", "invalid", "invalidIndex");
            if (!options.spike) this.shrinkInterval(ctx.trap, "open", "openIndex", "invalid", "invalidIndex");
        }

        if (!options.trap)
            ctx.spike.validIndex = this.invertInterval(ctx.spike.invalid, ctx.spike.invalidIndex, ctx.spike.valid);

        if (!options.spike)
            ctx.trap.validIndex = this.invertInterval(ctx.trap.invalid, ctx.trap.invalidIndex, ctx.trap.valid);

        if (options.preplace) {
            if (!options.trap) this.shrinkInterval(ctx.spike, "valid", "validIndex", "open", "openIndex");
            if (!options.spike) this.shrinkInterval(ctx.trap, "valid", "validIndex", "open", "openIndex");
        }

        const intervalTag = "valid";
        const intervalIndexTag = "validIndex";

        this.resetSampleResponse();

        if (!options.trap) this.getSamples(
            ctx.samples.spikeSamples,
            ctx.spike[intervalTag],
            ctx.spike[intervalIndexTag],
            budget,
            options.preplace ? ctx.samples.spikePreplaceSamples : undefined,
            options.preplace ? ctx.spike.open : undefined,
            options.preplace ? ctx.spike.openIndex : undefined
        );

        const spikeSamplesIndex = this.getSampleResponse[0];
        const spikePreplaceSamplesIndex = ctx.samples.spikePreplaceSamplesIndex = this.getSampleResponse[1];

        this.resetSampleResponse();

        if (!options.spike) this.getSamples(
            ctx.samples.trapSamples,
            ctx.trap[intervalTag],
            ctx.trap[intervalIndexTag],
            budget,
            options.preplace ? ctx.samples.trapPreplaceSamples : undefined,
            options.preplace ? ctx.trap.open : undefined,
            options.preplace ? ctx.trap.openIndex : undefined
        );

        const trapSamplesIndex = this.getSampleResponse[0];
        const trapPreplaceSamplesIndex = ctx.samples.trapPreplaceSamplesIndex = this.getSampleResponse[1];

        this.gradeAll(playerPos, spikeItem, ctx.samples, spikeSamplesIndex, trapSamplesIndex, options);
        return spikeSamplesIndex + spikePreplaceSamplesIndex + trapSamplesIndex + trapPreplaceSamplesIndex;
    }
}