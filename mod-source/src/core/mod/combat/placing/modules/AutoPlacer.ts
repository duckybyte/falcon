import Player from "@constants/Player";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import { FinderOptions } from "@core/mod/combat/placing/AngleFinder";
import PingTracker from "@core/mod/utils/PingTracker";
import ModManager from "@core/ModManager";
import PlayerUpdateEvent from "@core/socket/events/core/PlayerUpdateEvent";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import Angle from "@placing/Angle";
import Placer, { PlacementTypes } from "@placing/utils/Placer";
import ScriptConfig from "@utils/config/ScriptConfig";

export interface PreplacementQueue {
    count: number;
    tick: number;
    placements: Preplacement[];
}

export class Preplacement {
    x: number = -111000;
    y: number = -111000;
    angle: number = -111000;
    id: number = -111000;
    scale: number = 52;
    spikeTick = false;
    appleInsta = false;
    shameGrind = false;
    predict = false;

    copyFrom(item: Angle) {
        this.x = item.x;
        this.y = item.y;
        this.angle = item.angle;
        this.id = item.id;
        this.spikeTick = item.spikeTick;
        this.appleInsta = item.appleInsta;
        this.scale = item.scale;
        this.predict = item.predict;
        this.shameGrind = item.shameGrind;
    }
}

export default class AutoPlacer extends Placer {
    private finderOptions: FinderOptions = { grade: true };
    private cachedBestAngles: Angle[] = Array.from({ length: 4 }, () => new Angle(-1, -1, -1, -1, -1));
    private cachedBestAnglesCount = 0;
    private preComputeDuration = 0;

    potentialPreplacements: PreplacementQueue = {
        tick: 0,
        count: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    };

    preplacementsBufferHead = 0;
    preplacements: PreplacementQueue[] = [{
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }, {
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }, {
        count: 0,
        tick: 0,
        placements: Array.from({ length: 4 }, () => new Preplacement())
    }];

    constructor() {
        super();
        this.executePreplaceBatch = this.executePreplaceBatch.bind(this);
    }

    updatePreplacement(i: number, item: Angle) {
        const preplacement = this.preplacements[i];
        const arr = preplacement.placements[preplacement.count++];
        arr.copyFrom(item);
        preplacement.tick = ModManager.tick;
    }

    private executePreplaceBatch(arr: Preplacement[], count: number, originalWaitMs: number) {
        for (let i = 0; i < count; i++) {
            if (originalWaitMs > 0 && this.shouldSkip(arr[i])) continue;
            this.place(arr[i], arr[i].predict ? PlacementTypes.PREDICTIVE : PlacementTypes.PREPLACE);
            if (originalWaitMs > 0) PacketTracker.freeAfterUse("PLACE", 1);
        }

        ModManager.updateDirection();
    }

    private placePreplacement(index: number) {
        const padding = Menu.getValue("prenorounding") ? 0 : .5;
        let waitMs = ScriptConfig.SERVER_UPDATE_SPEED - PingTracker.getCurrentPing() + padding;

        const preplacement = this.preplacements[index];
        const arr = preplacement.placements;
        const count = preplacement.count;
        PlacementSystem.totalPlacements += count;

        waitMs -= performance.now() - PlayerUpdateEvent.lastReceive;

        if (waitMs <= 0) {
            this.executePreplaceBatch(arr, count, 0);
            return;
        }

        PacketTracker.use("PLACE", count);
        setTimeout(this.executePreplaceBatch, waitMs, arr, count, waitMs);
    }

    preStart(player: Player) {
        const now = performance.now();
        const preplacer = !!Menu.getValue("preplacer");
        this.finderOptions.preplace = preplacer;

        const bestAngles = this.start(player, 4, this.finderOptions);
        const preplacement = this.potentialPreplacements;
        this.cachedBestAnglesCount = bestAngles.length;
        preplacement.count = 0;

        const shouldTick = ModManager.tick % 2 === 0 || !Menu.getValue("twoTickPlacements");
        let offset = 0;
        let requirePadding = 0;

        for (let i = 0; i < bestAngles.length; i++) {
            const item = bestAngles[i];
            this.cachedBestAngles[i].redefine(item.x, item.y, item.scale, item.angle, item.id, item.preplace, item.predict);
            if (item.preplace || item.predict) requirePadding++;
            else if (!shouldTick) offset++;
        }

        const totalActions = PacketTracker.request("PLACE", bestAngles.length - offset, requirePadding);
        for (let i = 0, len = Math.min(bestAngles.length, totalActions); i < len; i++) {
            const item = bestAngles[i];

            if (item.preplace && !item.overlap) {
                const arr = preplacement.placements[preplacement.count++];
                arr.copyFrom(item);
            }
        }

        this.preComputeDuration = performance.now() - now;
    }

    execute(_player: Player) {
        const now = performance.now();
        const bestAngles = this.cachedBestAngles;
        const bestAnglesCount = this.cachedBestAnglesCount;
        let hasPreplacements = false;

        const currentIndex = this.preplacementsBufferHead;
        let preplacementInformalCount = 0;
        let requirePadding = 0;
        let offset = 0;

        this.preplacements[currentIndex].count = 0;
        this.preplacementsBufferHead = (this.preplacementsBufferHead + 1) % this.preplacements.length;
        const shouldTick = ModManager.tick % 2 === 0 || !Menu.getValue("twoTickPlacements");

        for (let i = 0; i < bestAnglesCount; i++) {
            const item = bestAngles[i];

            if (item.preplace || item.predict) {
                requirePadding++;
                continue;
            }

            if (!shouldTick) offset++;
        }

        const totalActions = PacketTracker.request("PLACE", bestAnglesCount - offset, requirePadding);
        for (let i = 0, len = Math.min(bestAnglesCount, totalActions); i < len; i++) {
            const item = bestAngles[i];
            if (this.shouldSkip(item)) continue;

            if (item.preplace || item.predict) {
                hasPreplacements = true;
                preplacementInformalCount++;
                this.updatePreplacement(currentIndex, item);
                continue;
            }

            if (shouldTick)
                this.place(item);
        }

        if (hasPreplacements) {
            this.placePreplacement(currentIndex);
        }

        const took = (performance.now() - now) + this.preComputeDuration;
        ModManager.activityList.push("autoPlace");
        this.preComputeDuration = 0;
        this.update(took.toFixed(2));
    }
}