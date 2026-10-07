import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import items from "@constants/items";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import withinDist from "@utils/geometry/withinDist";

export default class VelocityAttacker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("velocityHits")) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        if (DefenseSystem.canPlaceOnMe) return false;
        if (AutoBreaker.allSpikesBuffer.length) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const enemy = ModManager.enemyData.nearest!;
        const allSpikes = ObjectManager.pool.allSpikes;
        const primary = PlayerCombatManager.fetch(player, 0);

        const enemyPosition = PlayerStateManager.placementMap.get(enemy.sid)!;
        const playerPosition = PlayerStateManager.placementMap.get(player.sid)!;

        if (enemyPosition <= playerPosition) return;
        if (!CombatUtils.isAttackPrimary(primary.id)) return;
        if (!CombatUtils.getCombatDistance(player, enemy, items.weapons[primary.id].range)) return;
        if (enemy.trap) return;
        if (primary.reload !== 1) return;

        let damage = primary.dmg * 1.5;
        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObj = allSpikes[i];
            if (!gameObj) continue;

            const isDamagable = !Client.isTeam(enemy, gameObj.ownerSID ?? -1);
            if (!isDamagable) continue;
            if (!withinDist(enemy.next_position, gameObj, gameObj.scale + 34)) continue;

            damage += gameObj.dmg || 35;
            break;
        }

        if (damage < 100) return;
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "velBullHit");
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}