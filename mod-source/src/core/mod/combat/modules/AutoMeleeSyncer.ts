import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import items from "@constants/items";
import Player from "@constants/Player";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import getDir from "@utils/angle/getDir";

export default class AutoMeleeSyncer extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = Infinity;
        attackAction.cost = 1;
    }

    protected canExecute() {
        if (!ModManager.enemyData.all.length) return false;
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        if (!Menu.getValue("meleeSync")) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;

        const meleeSyncTarget = parseInt(Menu.getValue("meleeSyncTarget"));
        if (isNaN(meleeSyncTarget) || meleeSyncTarget === -1 || meleeSyncTarget === Client.mySID) return;

        let partner: Player | undefined = undefined;
        const players = PlayerManager.players.visible.all;

        for (let i = 0; i < players.length; i++) {
            if (players[i].sid === meleeSyncTarget) {
                partner = players[i];
                break;
            }
        }

        if (!partner) return;

        const ourPrimary = PlayerCombatManager.fetch(player, 0);
        const partnerPrimary = PlayerCombatManager.fetch(partner, 0);
        if (ourPrimary.reload !== 1 || partnerPrimary.reload !== 1) return;
        if (ourPrimary.dmg * 1.5 + partnerPrimary.dmg * 1.5 < 100) return;

        const allEnemies = ModManager.enemyData.all;
        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const partnerPositionalSpot = PlayerStateManager.placementMap.get(partner.sid)!;

        let angleX = 0;
        let angleY = 0;
        let commit = false;

        for (let i = 0; i < allEnemies.length; i++) {
            const enemy = allEnemies[i];
            if (enemy.sid === meleeSyncTarget) continue;

            const enemyPositionalSpot = PlayerStateManager.placementMap.get(enemy.sid)!;
            let allyRangeDecrement = 1;
            let myRangeDecrement = 1;

            const canPartnerHit = CombatUtils.getCombatDistance(partner, enemy, items.weapons[partnerPrimary.id].range - allyRangeDecrement, partnerPositionalSpot < enemyPositionalSpot);
            const canWeHit = CombatUtils.getCombatDistance(player, enemy, items.weapons[ourPrimary.id].range - myRangeDecrement, myPositionalSpot < enemyPositionalSpot);

            if (canPartnerHit && canWeHit) {
                const angleTo = getDir(enemy.next_position, player.next_position);
                angleX += Math.cos(angleTo);
                angleY += Math.sin(angleTo);
                commit = true;
            }
        }

        if (!commit) return;

        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "meleeSync");
        attackAction.sequence[0].customAim = Math.atan2(angleY, angleX);
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}