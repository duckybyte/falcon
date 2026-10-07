import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import Angle from "@core/mod/combat/placing/Angle";
import ModManager from "@core/ModManager";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDist from "@utils/geometry/getDist";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";

interface GraderEnemyCache {
    directionMap: Map<number, number>;
    distanceSqMap: Map<number, number>;
    trapsNearMap: Map<number, number>;
    spikesNearMap: Map<number, number>;
    trapSpikesMap: Map<number, number>;
}

interface GraderInternalCache {
    enemies: GraderEnemyCache;
    canAbuse: boolean;
}

export default abstract class Grader {
    constructor() { }

    protected internalCache: GraderInternalCache = {
        enemies: {
            directionMap: new Map(),
            distanceSqMap: new Map(),
            trapsNearMap: new Map(),
            spikesNearMap: new Map(),
            trapSpikesMap: new Map()
        },
        canAbuse: false
    };

    factorAngleAbuse(item: Angle, enemy: Player) {
        const scale = item.scale + enemy.placePotential.objectScale;
        const scaleSq = scale * scale;

        for (let i = 0, len = enemy.placePotential.allBufferIndex; i < len; i++) {
            const placeData = enemy.placePotential.all[i];
            const distanceSq = getDistSq(placeData, item);

            if (distanceSq <= scaleSq) {
                item.priority = true;
                return false;
            }
        }

        return true;
    }

    private factorAlignment(obj: GameObject, item: Angle) {
        const totalScale = obj.scale + item.scale;
        const dist = getDist(obj, item);
        const dir = getDir(obj, item);

        item.grade += 1.5 * (1 - (getAngleDist(dir, item.angle) / Math.PI));
        item.alignment = 1.5 * (1 - (dist / totalScale));
        item.grade += item.alignment;
    }

    private factorPreplaceAlignment(item: Angle) {
        let total = 0;
        let obj: GameObject | undefined;
        const willBreakObjects = ModManager.willBreakObjects;

        for (let i = 0, len = willBreakObjects.length; i < len; i++) {
            const gameObj = willBreakObjects[i];
            if (!gameObj) continue;
            if (!withinDist(item, gameObj, gameObj.scale + item.scale)) continue;

            if (gameObj.isBreaking) {
                item.breaking = true;
            }

            obj = gameObj;
            total++;

            if (total >= 2) {
                item.overlap = true;
                item.dontUse = true;
                break;
            }
        }

        if (!obj || item.overlap) return;
        this.factorAlignment(obj, item);
    }

    protected applyDecay(item: Angle) {
        const usedAngles = PlacementSystem.usedAngles;
        const usedAnglesCount = PlacementSystem.usedAnglesCount;
        if (usedAnglesCount === 0) return;

        const tick = ModManager.tick;

        for (let i = 0; i < usedAnglesCount; i++) {
            const used = usedAngles[i];

            const tickOffset = tick - used.tick;
            if (tickOffset > 18) continue;

            const isOverlapping = getAngleDist(item.angle, used.angle) <= .12;
            if (!isOverlapping) continue;

            item.dontUse = true;
            break;
        }
    }

    private factorPotentialObjects(item: Angle, allowPreplace: boolean) {
        const closeObjects = PotentialObjectManager.closeObjects;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const obj = closeObjects[i];
            if (!obj || !obj.active) continue;
            if (!withinDist(item, obj, item.scale + 50)) continue;
            if (ModManager.tick - obj.tick <= 1) continue;

            if (!item.preplace && allowPreplace && obj.willBreak) {
                item.predict = true;
                item.grade += .75;
                item.predictBoost += .75;
                continue;
            }

            item.grade -= item.preplace ? 1 : .5;
        }
    }

    prepare(item: Angle, enemies: Player[], allowPreplace: boolean, replaceObj?: GameObject) {
        const allSpikes = ObjectManager.pool.allSpikes;
        const allTraps = ObjectManager.pool.allTraps;
        if (replaceObj) item.replace = true;

        const { directionMap, distanceSqMap, trapsNearMap, spikesNearMap, trapSpikesMap } = this.internalCache.enemies;

        directionMap.clear();
        distanceSqMap.clear();
        trapsNearMap.clear();
        spikesNearMap.clear();
        trapSpikesMap.clear();

        this.factorPotentialObjects(item, allowPreplace);
        if (!item.preplace)
            this.applyDecay(item);

        let canAbuse = true;

        const spikesLength = allSpikes.length;
        const totalLength = allSpikes.length + allTraps.length;

        for (let i = 0, len = enemies.length; i < len; i++) {
            const enemy = enemies[i];
            const pos = enemy.real_position;

            const distanceSq = getDistSq(pos, item);

            directionMap.set(enemy.sid, getDir(pos, item));
            distanceSqMap.set(enemy.sid, distanceSq);

            const proposedCanAbuse = this.factorAngleAbuse(item, enemy);
            if (canAbuse) canAbuse = proposedCanAbuse;

            let trapsNear = 0;
            let spikesNear = 0;
            let trapSpikes = 0;

            for (let i = 0; i < totalLength; i++) {
                const gameObject = allSpikes[i] ?? allTraps[i - spikesLength];
                if (!gameObject || !gameObject.active || gameObject.isGhost) continue;

                const isTeam = Client.isTeam(enemy, gameObject.ownerSID ?? -1);
                const willBreak = item.preplace && gameObject.willBreak;
                const isTrap = gameObject.trap && !isTeam && !willBreak;
                const isSpike = gameObject.dmg && !isTeam && !willBreak;
                const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
                const isPointyScaryThingy = isCactus || isSpike;

                const isInRange = withinDist(item, gameObject, 15 + item.scale + gameObject.scale);
                const withinTrapSpikeRadius = enemy.trap && withinDist(enemy.trap, gameObject, AutoPusher.AUTO_PUSH_DISTANCE + gameObject.scale);

                if (isPointyScaryThingy && withinTrapSpikeRadius) {
                    trapSpikes++;
                }

                if (isInRange && (isPointyScaryThingy || isTrap)) {
                    if (isPointyScaryThingy) {
                        spikesNear++;
                    } else {
                        trapsNear++;
                    }
                }
            }

            trapSpikesMap.set(enemy.sid, trapSpikes);
            trapsNearMap.set(enemy.sid, trapsNear);
            spikesNearMap.set(enemy.sid, spikesNear);
        }

        if (item.predict && !item.priority) {
            item.predict = false;
            item.grade -= item.predictBoost;
        }

        if (item.replace) {
            const obj = replaceObj!;
            this.factorAlignment(obj, item);
        }

        if (item.preplace) {
            item.grade++;
            if (!item.priority) item.dontUse = true;
            this.factorPreplaceAlignment(item);
        }

        this.internalCache.canAbuse = canAbuse;
    }

    abstract grade(item: Angle, enemy: Player): void;
}