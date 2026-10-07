import GameObject from "@constants/GameObject";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ObjectBreaker from "@core/mod/defense/modules/ObjectBreaker";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import ObjectUtils from "@core/mod/defense/utils/ObjectUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import { Point } from "@mod-types/index";
import AngleFinder, { FinderOptions } from "@placing/AngleFinder";
import { Input } from "@ui/Hook";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import getMagSq from "@utils/geometry/getMagSq";
import withinDist from "@utils/geometry/withinDist";

export interface AutoBreakerInternal {
    replaceSpike: boolean;
    replaceTrap: boolean;
    trapBreakFaster: boolean;
    isConsidering: boolean;
}

export default class AutoBreaker {
    static aimAngle = 0;

    static allSpikesBuffer: GameObject[] = [];
    private static allKatanaSpikesBuffer: GameObject[] = [];
    private static targetObject = new GameObject(0, 0, 0, 0, 0, 0, 0);
    private static useKatana = false;
    static lastRejectedTank = 0;

    private static gatherAllSpikes(playerPos: Point) {
        this.allSpikesBuffer.length = 0;
        this.allKatanaSpikesBuffer.length = 0;

        const allSpikes = ObjectManager.pool.allSpikes;
        const allSpikesBuffer = this.allSpikesBuffer;
        const allKatanaSpikesBuffer = this.allKatanaSpikesBuffer;
        const bestId = CombatController.bestWeaponForBreak();

        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObject = allSpikes[i];
            const isDangerous = !Client.isFriendly(gameObject.ownerSID ?? -1);
            const withinRange = BreakerUtils.getObjectAttackDistance(playerPos, gameObject, items.weapons[bestId].range - 1);
            const isWithinAutoPushRange = withinDist(playerPos, gameObject, gameObject.scale + AutoPusher.AUTO_PUSH_DISTANCE);
            const canKatanaHit = BreakerUtils.getObjectAttackDistance(playerPos, gameObject, items.weapons[WEAPON_ID_MAP.KATANA].range - 1);

            if (!isDangerous) continue;
            if (!gameObject.hasHealth) continue;
            if (canKatanaHit && !withinRange) allKatanaSpikesBuffer.push(gameObject);
            if (withinRange && isWithinAutoPushRange) allSpikesBuffer.push(gameObject);
        }

        allSpikesBuffer.sort((a, b) => getDistSq(a, playerPos) - getDistSq(b, playerPos));
        allKatanaSpikesBuffer.sort((a, b) => getDistSq(a, playerPos) - getDistSq(b, playerPos));
    }

    private static setTarget(x: number, y: number, id: number, scale: number, health: number) {
        this.targetObject.x = x;
        this.targetObject.y = y;
        this.targetObject.id = id;
        this.targetObject.scale = scale;
        this.targetObject.health = health;
    }

    private static angleFinderOptions: FinderOptions = { replace: true, trap: true, budgetMlt: .75 };
    private static midPoint = { x: 0, y: 0 };
    private static shouldUseTankLate = false;

    private static isReplaceable(playerPos: Point, obj: GameObject) {
        const nearest = ModManager.enemyData.nearest;

        if (!nearest) return false;

        obj.isGhost = true;
        const buffer = AngleFinder.angleBuffer;
        const count = AngleFinder.compute(nearest, this.angleFinderOptions);
        obj.isGhost = false;

        for (let i = 0; i < count; i++) {
            const item = buffer[i];
            if (withinDist(playerPos, item, 35 + obj.scale)) return true;
        }

        return false;
    }

    private static katanaSpikesSpikePosBuffer = { x: 0, y: 0 };

    private static processKatanaSpikes(player: Player, trap: GameObject) {
        const nearestEnemy = ModManager.enemyData.nearest;
        if (!nearestEnemy) return;

        if (player.weapons[0] !== WEAPON_ID_MAP.KATANA) return;
        if (player.damages.length > 0 && this.targetObject.id !== LIST_ID_MAP.PIT_TRAP) return;

        const enemyPrimary = PlayerCombatManager.fetch(nearestEnemy, 0);
        if (enemyPrimary.reload !== 1) return;

        const spikeData = items.list[LIST_ID_MAP.SPINNING_SPIKES];
        const arcCount = ObjectUtils.getSpikeBounceArc(nearestEnemy, player, spikeData, trap.sid);
        if (arcCount === 0) return;

        const enemyPos = nearestEnemy.real_position;
        const playerPos = player.real_position;

        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(nearestEnemy.sid)!;
        const placementRadius = spikeData.scale + 30;

        const sampleSteps = 5;
        const dt = ScriptConfig.SERVER_UPDATE_SPEED;
        const katanaSpikesBuffer = this.allKatanaSpikesBuffer;
        const spikeArcsBuffer = ObjectUtils.spikeArcBuffer;

        const enemyToPlayer = ModManager.enemyData.angle + Math.PI;
        const enemyToPlayerCos = Math.cos(enemyToPlayer);
        const enemyToPlayerSin = Math.sin(enemyToPlayer);
        const spikePos = this.katanaSpikesSpikePosBuffer;

        let totalDamage = enemyPrimary.dmg * 1.5 + 45;
        let targetSpike: GameObject | undefined = undefined;

        for (let i = 0, len = katanaSpikesBuffer.length; i < len; i++) {
            const spike = katanaSpikesBuffer[i];
            const hitRadius = 35 + spike.scale;
            const hitRadiusSq = hitRadius * hitRadius;

            for (let j = 0; j < arcCount; j++) {
                const start = spikeArcsBuffer[j][0];
                const end = spikeArcsBuffer[j][1];
                const step = (end - start) / sampleSteps;

                for (let k = 0; k <= sampleSteps; k++) {
                    const placeAngle = start + step * k;
                    spikePos.x = enemyPos.x + placementRadius * Math.cos(placeAngle);
                    spikePos.y = enemyPos.y + placementRadius * Math.sin(placeAngle);

                    const kbDir = getDir(playerPos, spikePos);
                    const kbVelX = 1.5 * Math.cos(kbDir);
                    const kbVelY = 1.5 * Math.sin(kbDir);

                    let projX = playerPos.x + kbVelX * dt;
                    let projY = playerPos.y + kbVelY * dt;

                    if (myPositionalSpot > enemyPositionalSpot) {
                        projX += enemyToPlayerCos * enemyPrimary.totalKnock * dt;
                        projY += enemyToPlayerSin * enemyPrimary.totalKnock * dt;
                    }

                    if (getMagSq(projX - spike.x, projY - spike.y) <= hitRadiusSq) {
                        totalDamage += spike.dmg;
                        targetSpike = spike;
                        break;
                    }
                }

                if (targetSpike) break;
            }

            if (targetSpike) break;
        }

        if (!targetSpike) return;
        if (totalDamage * .75 < 100) return;
        this.useKatana = true;

        this.setTarget(
            targetSpike.x,
            targetSpike.y,
            targetSpike.id,
            targetSpike.scale,
            targetSpike.health
        );
    }

    private static processSpikes(player: Player, trap: GameObject, originalBestId: number, canEnemyReplaceTrap: boolean) {
        ModManager.brainState.breakerInternal.isConsidering = true;
        const targetSpike = this.allSpikesBuffer[0];
        if (!targetSpike) return;

        const playerPos = player.real_position;
        const spikesHitsUntilBreak = BreakerUtils.hitsUntilBreak(player, originalBestId, targetSpike.health);
        const trapHitsUntilBreak = BreakerUtils.hitsUntilBreak(player, originalBestId, trap.health);

        const trapBreakFaster = trapHitsUntilBreak < spikesHitsUntilBreak;
        const shouldStayWithTrap = trapBreakFaster && !canEnemyReplaceTrap;
        const canEnemyReplaceSpike = this.isReplaceable(playerPos, targetSpike);
        const fullGreatHammerHit = 247.5;

        ModManager.brainState.breakerInternal.replaceTrap = canEnemyReplaceTrap;
        ModManager.brainState.breakerInternal.replaceSpike = canEnemyReplaceSpike;
        ModManager.brainState.breakerInternal.trapBreakFaster = trapBreakFaster;

        if (targetSpike.playerDamageDealt < fullGreatHammerHit) {
            if (trap.playerDamageDealt >= fullGreatHammerHit) return false;
            if (canEnemyReplaceTrap && canEnemyReplaceSpike && trapBreakFaster) return false;
            if (!canEnemyReplaceTrap && canEnemyReplaceSpike && trapHitsUntilBreak === spikesHitsUntilBreak) return false;
            if (shouldStayWithTrap) return false;
        }

        const midPoint = this.midPoint;
        const toTarget = getDir(targetSpike, playerPos);

        for (let i = 1, len = this.allSpikesBuffer.length; i < len; i++) {
            const otherTarget = this.allSpikesBuffer[i];
            const toOther = getDir(otherTarget, playerPos);

            midPoint.x = (targetSpike.x + otherTarget.x) / 2;
            midPoint.y = (targetSpike.y + otherTarget.y) / 2;

            const toMidpoint = getDir(midPoint, playerPos);
            const canAttackCurrent = getAngleDist(toMidpoint, toTarget) <= ScriptConfig.GATHER_ANGLE;
            const canAttackOther = getAngleDist(toMidpoint, toOther) <= ScriptConfig.GATHER_ANGLE;

            if (otherTarget && canAttackCurrent && canAttackOther) {
                this.setTarget(
                    midPoint.x,
                    midPoint.y,
                    targetSpike.id,
                    Math.min(targetSpike.scale, otherTarget.scale),
                    Math.max(targetSpike.health, otherTarget.health)
                );
                return;
            }
        }

        this.setTarget(
            targetSpike.x,
            targetSpike.y,
            targetSpike.id,
            targetSpike.scale,
            targetSpike.health
        );
    }

    private static shouldUseTank(peek = false) {
        const allSpikesBuffer = this.allSpikesBuffer;
        const nearby = ModManager.enemyData.nearby;
        const player = Client.player;

        let oneShotThreat = false;
        let checkingForLatePre = false;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            const primary = PlayerCombatManager.fetch(enemy, 0);
            if (primary.reload !== 1) continue;
            if (primary.dmg * 1.5 + 45 < 100) continue;
            if (enemy.profilingData.preHitAttacks === 0 && DefenseSystem.preHitChances > 1) continue;
            if (enemy.profilingData.preHitAttacks === 0 && enemy.profilingData.latePreHitAttacks > 1) continue;

            if (enemy.profilingData.checkLateHit && enemy.profilingData.latePreHitAttacks < 2 && player.shameCount < 4) {
                checkingForLatePre = true;
            }

            oneShotThreat = true;
            break;
        }

        if (checkingForLatePre && this.shouldUseTankLate) {
            this.shouldUseTankLate = false;
            return false;
        }

        if (ModManager.tick - this.lastRejectedTank < 2) return true;
        if (!oneShotThreat) return true;

        for (let i = 0; i < allSpikesBuffer.length; i++) {
            const spike = allSpikesBuffer[i];
            const willHitSpike = withinDist(player.next_position, spike, spike.scale + 35);
            const isHittingSpike = withinDist(player.real_position, spike, spike.scale + 36);

            if (!willHitSpike && !isHittingSpike) continue;
            if (!peek) this.lastRejectedTank = ModManager.tick;
            return false;
        }

        return true;
    }

    static currentBestGroup: 0 | 1 | 2 = 0;
    static currentBestId = 0;
    private static twoHitRequireTank = false;

    static preTick() {
        const player = Client.player;
        const playerPos = Client.player.real_position;
        this.allSpikesBuffer.length = 0;

        if (!player.trap) return;
        this.gatherAllSpikes(playerPos);

        const originalBestId = CombatController.bestWeaponForBreak();
        const canEnemyReplaceTrap = this.isReplaceable(playerPos, player.trap);

        let bestWpnId = originalBestId;
        let bestWpnGroup = CombatController.bestWeaponForBreak("group");
        this.useKatana = false;

        this.setTarget(player.trap.x, player.trap.y, LIST_ID_MAP.PIT_TRAP, 50, player.trap.health);

        if (!Input.keys["ShiftLeft"]) {
            this.processSpikes(player, player.trap, originalBestId, canEnemyReplaceTrap);
            if (!this.allSpikesBuffer.length) this.processKatanaSpikes(player, player.trap);

            if (this.useKatana) {
                bestWpnId = WEAPON_ID_MAP.KATANA;
                bestWpnGroup = 0;
            }
        }

        const buf = ObjectBreaker.getDoubleHitId(bestWpnId, bestWpnGroup, this.targetObject);
        const id = buf[0];
        const twoHitRequireTank = buf[1];

        this.currentBestGroup = id < 9 ? 0 : 1;
        this.currentBestId = id;
        this.twoHitRequireTank = twoHitRequireTank;
    }

    static main() {
        const player = Client.player;

        if (!Menu.getValue("autoBreak")) return false;
        if (!player.trap) return false;

        const originalBestId = CombatController.bestWeaponForBreak();
        const group = this.currentBestGroup;
        const id = this.currentBestId;
        const twoHitRequireTank = this.twoHitRequireTank;
        const bestWpnReload = player.getReload(group);

        CombatController.selectWeapon(id, true);
        CombatController.currentMode = this.targetObject.dmg ? "autobreakspike" : "autobreak";

        if (bestWpnReload === 1) {
            this.aimAngle = getDir(this.targetObject, player.real_position);

            if (!HatSystem.allowHatSwitch()) {
                CombatController.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                CombatController.mustBeSoldier = true;
                ModManager.activityList.push("tankHoldOff");
                return true;
            }

            if (!this.shouldUseTank()) {
                CombatController.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                CombatController.mustBeSoldier = true;
                ModManager.activityList.push("antiPreHit");
                return true;
            }

            this.shouldUseTankLate = true;
            CombatController.skinIndex = this.useKatana || id === originalBestId || twoHitRequireTank ? STORE_HAT_MAP.TANK_GEAR : STORE_HAT_MAP.SOLDIER_HELMET;
            CombatController.mustBeSoldier = false;
            CombatController.hitOnce();
        } else {
            CombatController.mustBeSoldier = false;
            CombatController.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
        }

        return true;
    }
}