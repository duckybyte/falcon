import items from "@constants/items";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

export default class ProjectileSyncer extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = Infinity;
        attackAction.cost = 1;
    }

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        if (!Menu.getValue("projectileSync")) return false;
        return true;
    }

    protected execute() {
        const myPlayer = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;

        const primary = PlayerCombatManager.fetch(myPlayer, 0);
        const weaponRange = items.weapons[primary.id].range;

        if (primary.reload !== 1) return;
        if (!CombatUtils.getCombatDistance(myPlayer, nearestEnemy, weaponRange)) return;

        let totalDamage = nearestEnemy.turretThreats * 25;
        for (let i = 0, len = nearestEnemy.projDamages.length; i < len; i++) {
            totalDamage += nearestEnemy.projDamages[i];
        }

        if (primary.dmg * 1.5 + totalDamage < 100) return;

        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "projSync");
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}