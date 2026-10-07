import Player from "@constants/Player";
import { STORE_ACCESSORY_MAP } from "@constants/store";
import Client from "@core/Client";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import Angle from "@core/mod/combat/placing/Angle";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

export default class SpikeTicker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    consider = false;

    protected canExecute() {
        if (!this.consider) return false;
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        if (!Menu.getValue("autoPlacing")) return false;
        if (!Menu.getValue("replacer")) return false;
        if (!Menu.getValue("spikeTick")) return false;
        return true;
    }

    process(angle: Angle, enemy: Player) {
        const player = Client.player;
        const primaryId = player.weapons[0];

        const isReloaded = player.getReload(0) === 1;
        const canAttackEnemy = isReloaded && CombatUtils.canAttack(enemy, player, primaryId);
        const isAttackPrimary = CombatUtils.isAttackPrimary(primaryId) || Menu.getValue("appleAllowsLowDamagePri");
        if (!canAttackEnemy || !isAttackPrimary || !enemy.trap) return;

        if (DefenseSystem.canPlaceOnMe) angle.grade -= 1.5;
        angle.spikeTick = true;
        angle.grade -= .5;
    }

    private commit() {
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "spikeTick");
        AttackManager.addAttackQueue(attackAction);
    }

    protected execute() {
        AttackManager.spikeTicker.consider = false;
        this.commit();
    }

    update() { }
}