import Ai, { ais } from "@constants/Ai";
import items from "@constants/items";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import { WeaponFetchData } from "@core/logic/players/core/PlayerCombatManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import getDir from "@utils/angle/getDir";
import getDistSq from "@utils/geometry/getDistSq";
import lineInRect from "@utils/geometry/lineInRect";

export default class DefenseUtils {
    static canUseEMP(enemy: Player) {
        const player = Client.player;
        const realPlayerPos = player.real_position;
        const realEnemyPos = enemy.real_position;
        const radiusSq = 490000;

        let smallestDistSq = Infinity;
        let closest: Ai | Player | undefined;

        const playersVisible = PlayerManager.players.visible.all;
        const playersLength = playersVisible.length;

        for (let i = 0, len = playersLength + ais.all.length; i < len; i++) {
            const entity = playersVisible[i] || ais.all[i - playersLength];
            const isInvalidPlayer = entity.isPlayer && (
                entity.sid === enemy.sid || entity.sid === player.sid ||
                entity.skinIndex === STORE_HAT_MAP.EMP_HELMET ||
                Client.isTeam(entity, entity.sid)
            );

            if (isInvalidPlayer) continue;

            const distSq = getDistSq(entity.real_position, realEnemyPos);

            if (distSq <= radiusSq && distSq < smallestDistSq) {
                smallestDistSq = distSq;
                closest = entity;
            }
        }

        if (closest && lineInRect(
            realPlayerPos.x - 35, realPlayerPos.y - 35,
            realPlayerPos.x + 35, realPlayerPos.y + 35,
            realEnemyPos.x, realEnemyPos.y,
            closest.real_position.x, closest.real_position.y
        )) {
            return false;
        }

        return true;
    }

    static isInLineOfSight(enemy: Player, projectileWeapon: WeaponFetchData) {
        const wpn = items.weapons[projectileWeapon.id];
        if (wpn && typeof wpn.projectile !== "number") return true;

        const player = Client.player;
        const playerPos = player.real_position;

        const enemyPos = enemy.real_position;
        const enemyNextPos = enemy.next_position;
        const closeObjects = ObjectManager.pool.closeObjects;

        const tmpDir = getDir(playerPos, enemyPos);

        const playerDistSq = getDistSq(playerPos, enemyPos);
        const projData = items.projectiles[projectileWeapon.id === STORE_HAT_MAP.TURRET_GEAR ? 1 : wpn.projectile!];
        const projRange = projData.range ?? 700;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            const distSq = getDistSq(gameObject, enemyPos);
            const tmpScale = gameObject.getScale() - .05;

            if (gameObject.ignoreCollision) continue;

            const currentRaycast = lineInRect(
                gameObject.x - tmpScale, gameObject.y - tmpScale,
                gameObject.x + tmpScale, gameObject.y + tmpScale,
                enemyPos.x, enemyPos.y,
                enemyPos.x + Math.cos(tmpDir) * projRange,
                enemyPos.y + Math.sin(tmpDir) * projRange
            );

            const predRaycast = lineInRect(
                gameObject.x - tmpScale, gameObject.y - tmpScale,
                gameObject.x + tmpScale, gameObject.y + tmpScale,
                enemyNextPos.x, enemyNextPos.y,
                enemyNextPos.x + Math.cos(tmpDir) * projRange,
                enemyNextPos.y + Math.sin(tmpDir) * projRange
            );

            if (playerDistSq > distSq && projData.indx <= gameObject.layer && currentRaycast && predRaycast) {
                return false;
            }
        }

        return true;
    }
}