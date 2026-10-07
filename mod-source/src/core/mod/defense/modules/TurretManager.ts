import { ais } from "@constants/Ai";
import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import ModManager from "@core/ModManager";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";

export default class TurretManager {
    private static readonly TURRET_RANGE_SQ = 700 * 700;

    private static updatePlayer(player: Player, turret: GameObject) {
        if (getDistSq(player.real_position, turret) > this.TURRET_RANGE_SQ) return;

        if (player.sid === Client.mySID) {
            if (!Client.isFriendly(turret.ownerSID ?? -1)) {
                player.turretThreats++;
            }

            return;
        }

        const closestAI = ais.all.sort((a, b) => getDistSq(a.real_position, turret) - getDistSq(b.real_position, turret))[0];
        const closestEnemy = PlayerManager.players.visible.all
            .filter((e) => !Client.isTeam(e, turret.ownerSID ?? -1) && e.skinIndex !== STORE_HAT_MAP.EMP_HELMET)
            .sort((a, b) => getDistSq(a.real_position, turret) - getDistSq(b.real_position, turret))[0];

        const closestEnemyDistance = closestEnemy ? getDistSq(closestEnemy.real_position, turret) : Infinity;
        const closestAiDistance = closestAI ? getDistSq(closestAI.real_position, turret) : Infinity;
        const closest = !isFinite(closestAiDistance) ? closestEnemy : closestEnemyDistance >= closestAiDistance ? closestEnemy : closestAI;

        if (!isFinite(closestEnemyDistance) && !isFinite(closestAiDistance)) return;
        if (!closest) return;
        if (closest !== player) return;

        const range = 1.5 * ScriptConfig.SERVER_UPDATE_SPEED;
        const rangeSq = range * range;

        if (getDistSq(player.real_position, turret) > rangeSq) return;
        player.turretThreats++;
    }

    static updateReloads() {
        const allTurrets = ObjectManager.allTurrets.all;
        const nearby = ModManager.enemyData.nearby;
        const player = Client.player;

        for (let i = 0, len = allTurrets.length; i < len; i++) {
            const gameObject = allTurrets[i];
            if (!gameObject) continue;

            gameObject.reload++;
            if (gameObject.reload < 20) continue;
            gameObject.reload = 0;

            this.updatePlayer(player, gameObject);
            for (let j = 0; j < nearby.length; j++) {
                this.updatePlayer(nearby[j], gameObject);
            }
        }
    }
}