import GameObject from "@constants/GameObject";
import items, { Weapon } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import withinDist from "@utils/geometry/withinDist";

export default class ObjectBreaker {
    static gameObjectQueue: GameObject[] = [];

    static aimAngle = 0;
    static isObjectBreaking = false;
    private static targetObject = new GameObject(0, 0, 0, 0, 0, 0, 0);
    private static midPoint = { x: 0, y: 0 };
    private static inQueueObjects = new Set<number>();
    private static doubleHitIdBuffer: [number, boolean] = [0, false];

    static getDoubleHitId(originalId: number, originalGroup: 0 | 1 | 2, targetObject: GameObject): [number, boolean] {
        const player = Client.player;

        const primaryId = player.weapons[0];
        const primaryIsNotBest = primaryId !== originalId;
        const primaryReloaded = player.getReload(0) === 1;
        const canBreakWithoutTank = BreakerUtils.getObjectDamage(player, 0, true) >= targetObject.health;
        const canBreakWithTank = BreakerUtils.getObjectDamage(player, 0) >= targetObject.health;
        const canAttack = BreakerUtils.getObjectAttackDistance(player, targetObject, items.weapons[primaryId].range - 1);
        const bestWeaponReloaded = player.getReload(originalGroup) === 1;
        const shouldDoubleHit = BreakerUtils.isDoubleHitPrimary(primaryId, targetObject.id);
        const canBreak = canBreakWithTank || canBreakWithoutTank;

        if (!bestWeaponReloaded && shouldDoubleHit && primaryIsNotBest && primaryReloaded && canBreak && canAttack) {
            this.doubleHitIdBuffer[0] = primaryId;
            this.doubleHitIdBuffer[1] = canBreakWithTank && !canBreakWithoutTank;
            return this.doubleHitIdBuffer;
        }

        this.doubleHitIdBuffer[0] = originalId;
        this.doubleHitIdBuffer[1] = false;
        return this.doubleHitIdBuffer;
    }

    private static processPitSpikeModule(wpn: Weapon) {
        if (!Menu.getValue("objectBreaker:pit_spike")) return;

        this.isObjectBreaking = false;
        const player = Client.player;
        const closeObjects = ObjectManager.pool.closeObjects;
        const nearestEnemy = ModManager.enemyData.nearest;
        const enemyInTrap = nearestEnemy && nearestEnemy.trap;

        if (!enemyInTrap) return;
        const enemyTrap = nearestEnemy.trap!;
        const trapDir = getDir(enemyTrap, player.real_position);

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];

            const isSpike = gameObject.dmg && !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);
            const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
            const isWithinRange = withinDist(enemyTrap, gameObject, AutoPusher.AUTO_PUSH_DISTANCE + gameObject.scale);

            if (!isSpike && !isCactus) continue;
            if (!isWithinRange) continue;
            return;
        }

        const canAttackTrap = BreakerUtils.getObjectAttackDistance(player, enemyTrap, wpn.range - 1);

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            const isNearEnemyTrap = withinDist(enemyTrap, gameObject, 75 + gameObject.scale);
            const isNotEnemyTrap = gameObject !== enemyTrap;
            const canAttack = BreakerUtils.getObjectAttackDistance(player, gameObject, wpn.range - 1);
            const isSpike = gameObject.dmg && !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);

            if (withinDist(gameObject, player.real_position, 30 + gameObject.scale)) continue;
            if (withinDist(gameObject, player.next_position, 30 + gameObject.scale)) continue;
            if (isSpike) continue;
            if (!canAttack) continue;
            if (!gameObject.hasHealth || !isFinite(gameObject.health) || isNaN(gameObject.health)) continue;
            if (!isNearEnemyTrap || !isNotEnemyTrap) continue;
            if (this.inQueueObjects.has(gameObject.sid)) continue;

            const withinArc = getAngleDist(trapDir, getDir(gameObject, player.real_position)) <= ScriptConfig.GATHER_ANGLE;
            if (canAttackTrap && withinArc) continue;

            this.gameObjectQueue.push(gameObject);
        }
    }

    static main(): boolean {
        if (!Menu.getValue("walkBreaker")) return false;

        const player = Client.player;
        const playerPos = player.real_position;
        const bestWpnId = CombatController.bestWeaponForBreak();
        const closeObjects = ObjectManager.pool.closeObjects;

        const wpn = items.weapons[bestWpnId];
        this.inQueueObjects.clear();

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];

            const isSpike = gameObject.dmg;
            const isTeleport = gameObject.teleport;
            const isBoost = gameObject.boostSpeed;
            const isTrap = gameObject.trap;
            const isNotFriendly = !Client.isFriendly(gameObject.ownerSID ?? -1);

            const isTarget = isSpike || isTeleport || isBoost || isTrap;
            const canAttack = BreakerUtils.getObjectAttackDistance(player, gameObject, wpn.range - 1);

            if (isTarget && isNotFriendly && canAttack) {
                this.inQueueObjects.add(gameObject.sid);

                if (isSpike) {
                    this.gameObjectQueue.unshift(gameObject);
                } else {
                    this.gameObjectQueue.push(gameObject);
                }
            }
        }

        this.isObjectBreaking = true;
        if (!this.gameObjectQueue.length && player.getReload(0) === 1) this.processPitSpikeModule(wpn);
        if (!this.gameObjectQueue.length) return false;

        const currentTarget = this.gameObjectQueue[0];
        const toTarget = getDir(currentTarget, playerPos);

        this.targetObject.x = currentTarget.x;
        this.targetObject.y = currentTarget.y;
        this.targetObject.scale = currentTarget.scale;
        this.targetObject.health = currentTarget.health;

        const midPoint = this.midPoint;

        for (let i = 1, len = this.gameObjectQueue.length; i < len; i++) {
            const otherTarget = this.gameObjectQueue[i];
            const toOther = getDir(otherTarget, playerPos);

            midPoint.x = (currentTarget.x + otherTarget.x) / 2;
            midPoint.y = (currentTarget.y + otherTarget.y) / 2;

            const toMidpoint = getDir(midPoint, playerPos);
            const canAttackCurrent = getAngleDist(toMidpoint, toTarget) <= ScriptConfig.GATHER_ANGLE;
            const canAttackOther = getAngleDist(toMidpoint, toOther) <= ScriptConfig.GATHER_ANGLE;

            if (otherTarget && canAttackCurrent && canAttackOther) {
                this.targetObject.x = midPoint.x;
                this.targetObject.y = midPoint.y;
                this.targetObject.scale = Math.min(currentTarget.scale, otherTarget.scale);
                this.targetObject.health = Math.max(currentTarget.health, otherTarget.health);
                break;
            }
        }

        const bestWpnGroup = CombatController.bestWeaponForBreak("group");
        const buf = ObjectBreaker.getDoubleHitId(bestWpnId, bestWpnGroup, this.targetObject);
        const id = buf[0];
        const twoHitRequireTank = buf[1];

        CombatController.selectWeapon(id, true);
        if (player.getReload(id < 9 ? 0 : 1) === 1) {
            CombatController.skinIndex = bestWpnId === id || twoHitRequireTank ? STORE_HAT_MAP.TANK_GEAR : STORE_HAT_MAP.SOLDIER_HELMET;
            this.aimAngle = getDir(this.targetObject, player.real_position);
            CombatController.hitOnce();
        }

        return true;
    }
}