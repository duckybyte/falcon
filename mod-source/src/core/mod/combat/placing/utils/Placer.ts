import items, { LIST_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import Angle from "@core/mod/combat/placing/Angle";
import AngleFinder, { FinderOptions } from "@core/mod/combat/placing/AngleFinder";
import { Preplacement } from "@core/mod/combat/placing/modules/AutoPlacer";
import ModManager from "@core/ModManager";
import { Replacement } from "@placing/modules/AutoReplacer";
import PlacerUtils from "@placing/utils/PlacerUtils";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";

interface RawPlacement {
    x: number;
    y: number;
    id: number;
    scale: number;
}

export const PlacementTypes = {
    NORMAL: 1,
    REPLACE: 2,
    PREPLACE: 3,
    RESERVED: 4,
    PREDICTIVE: 5
} as const;

export type PlacementType = typeof PlacementTypes[keyof typeof PlacementTypes];

export default abstract class Placer {
    protected shouldSkip(item: RawPlacement) {
        const placementBlock = PlacementSystem.getTrapPlacementBlock();
        if (item.id !== LIST_ID_MAP.PIT_TRAP) return false;
        if (ModManager.tick > placementBlock.untilTick) return false;

        const scale = items.list[item.id].scale;
        return withinDist(item, placementBlock, scale + placementBlock.scale);
    }

    protected process(buffer: Angle[], count: number, totalAngles: number, options: FinderOptions, dontPlace?: boolean) {
        const player = Client.player;

        PlacementSystem.bestAngles.length = 0;
        PlacementSystem.bestAnglesSet.clear();
        PlacementSystem.angleCandidates.length = 0;

        const playerPos = player.real_position;
        const playerNext = player.next_position;
        const speedMag = getDistSq(playerPos, playerNext);

        let allowOverlap = false;
        const candidates = PlacementSystem.angleCandidates;
        const bestAngles = PlacementSystem.bestAngles;
        const bestAnglesSet = PlacementSystem.bestAnglesSet;
        const preplacements = PlacementSystem.AutoPlacer.preplacements;
        const replacements = PlacementSystem.AutoReplacer.replacements;

        for (let i = 0; i < count; i++) {
            const angle = buffer[i];
            if (!angle || angle.dontUse) continue;
            candidates.push(angle);
        }

        const sortCandidates = (a: Angle, b: Angle) => b.grade - a.grade || +(b.isTrap) - +(a.isTrap);
        candidates.sort(sortCandidates);

        const oldUsedAnglesCount = PlacementSystem.usedAnglesCount;
        if (speedMag >= 25) PlacementSystem.usedAnglesCount = 0;
        const currentTick = ModManager.tick;

        for (let i = 0, len = candidates.length; i < len; i++) {
            const currentAngle = candidates[i];
            const isPreemptive = currentAngle.preplace;

            if (PlacementSystem.totalPlacements + bestAngles.length >= 4) break;
            if (isPreemptive && PlacerUtils.checkPreplacementOverlap(bestAngles, currentAngle)) continue;
            if (!isPreemptive && PlacerUtils.checkForPreplacements(preplacements, currentAngle, currentTick)) continue;
            if (bestAnglesSet.size >= totalAngles) break;
            if (PlacerUtils.filterOverlapWithReplacements(replacements, currentAngle, currentTick)) continue;
            if (bestAnglesSet.has(currentAngle)) continue;
            if (allowOverlap && currentAngle.grade <= 0) continue;
            if (options.replace && allowOverlap) break;

            if (!allowOverlap) {
                if (!PlacerUtils.filterWithoutOverlap(bestAngles, currentAngle)) {
                    bestAngles.push(currentAngle);
                    bestAnglesSet.add(currentAngle);
                }
            } else {
                if (!PlacerUtils.filterWithOverlap(bestAngles, currentAngle)) {
                    bestAngles.push(currentAngle);
                    bestAnglesSet.add(currentAngle);
                }
            }

            if (!allowOverlap && i + 1 >= len && bestAnglesSet.size < 4) {
                allowOverlap = true;
                i = -1;
            }
        }

        if (dontPlace) PlacementSystem.usedAnglesCount = oldUsedAnglesCount;
        return bestAngles;
    }

    protected place(item: Angle | Replacement | Preplacement, placementType: PlacementType = PlacementTypes.NORMAL) {
        PlacementSystem.usedAngles[PlacementSystem.usedAnglesHead].redefine(item.angle, ModManager.tick);
        PlacementSystem.usedAnglesHead = (PlacementSystem.usedAnglesHead + 1) % PlacementSystem.usedAngles.length;
        PlacementSystem.usedAnglesCount = Math.min(PlacementSystem.usedAnglesCount + 1, PlacementSystem.usedAngles.length);
        if (placementType !== PlacementTypes.PREPLACE) PlacementSystem.totalPlacements++;

        PlacementSystem.place(item.id, item.angle);
        PlacementSystem.sendMarker(item, placementType);
    }

    protected emptyBestAngles: Angle[] = [];

    protected start(player: Player, totalAngles: number, options: Readonly<FinderOptions>, dontPlace?: boolean) {
        const count = AngleFinder.compute(player, options);
        const buffer = AngleFinder.angleBuffer;

        if (count === 0) return this.emptyBestAngles;

        const bestAngles = this.process(buffer, count, totalAngles, options, dontPlace);
        return bestAngles;
    }

    protected update(took: string) {
        Client.placementTime[Client.placementTimeHead] = took;
        Client.placementTimeHead = (Client.placementTimeHead + 1) % Client.placementTime.length;
    }

    abstract execute(player: Player): void;
}