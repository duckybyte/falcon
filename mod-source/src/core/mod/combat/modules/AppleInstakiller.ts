import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import Angle from "@placing/Angle";

export default class AppleInstakiller extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];
        const secondAction = attackAction.sequence[1];

        firstAction.aimType = "enemy-trap";
        firstAction.reason = secondAction.reason = "appleInsta";
        firstAction.skinData[0] = STORE_HAT_MAP.TANK_GEAR;
        secondAction.skinData[0] = STORE_HAT_MAP.BULL_HELMET;

        firstAction.dontUse = false;
        secondAction.dontUse = false;

        attackAction.grade = 3;
        attackAction.cost = 2;
    }

    protected canExecute() {
        const enemy = ModManager.enemyData.nearest;

        if (!enemy) return false;
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!Menu.getValue("autoPlacing")) return false;
        if (!Menu.getValue("replacer")) return false;
        if (!Menu.getValue("appleInsta")) return false;
        if (!Menu.getValue("appleInstaWhileTrapped") && Client.player.trap) return false;

        if (Menu.getValue("appleInstaWhileTrapped") && Client.player.trap && AutoBreaker.allSpikesBuffer.length)
            return false;

        if (AttackManager.checkForAutoPushingStatus())
            return false;

        return true;
    }

    private static readonly GREAT_HAMMER_RANGE = items.weapons[WEAPON_ID_MAP.GREAT_HAMMER].range - 1;

    process(angle: Angle, enemy: Player) {
        const player = Client.player;
        const secondaryId = player.weapons[1];

        if (typeof secondaryId !== "number") return;
        if (secondaryId !== WEAPON_ID_MAP.GREAT_HAMMER) return;

        const primary = PlayerCombatManager.fetch(player, 0);
        const secondary = PlayerCombatManager.fetch(player, 1);
        const nearestEnemy = ModManager.enemyData.nearest!;

        const enemyTrap = nearestEnemy.trap;
        if (!enemyTrap) return;
        if (primary.reload !== 1 || secondary.reload !== 1) return;
        if (!CombatUtils.isAttackPrimary(primary.id) && !Menu.getValue("appleAllowsLowDamagePri")) return;
        if (!CombatUtils.canAttack(nearestEnemy, player, primary.id)) return;

        const hitDamage = BreakerUtils.getObjectDamage(player, 1);
        if (!BreakerUtils.getObjectAttackDistance(player.next_state, enemyTrap, AppleInstakiller.GREAT_HAMMER_RANGE)) return;
        if (enemyTrap.health > hitDamage) return;

        if (DefenseSystem.canPlaceOnMe) angle.grade -= 1.5;
        if (primary.dmg >= 53 && angle.id === LIST_ID_MAP.SPINNING_SPIKES && enemy.shameCount >= 7) angle.grade += .75;
        angle.appleInsta = true;
    }

    protected execute() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;

        const primary = PlayerCombatManager.fetch(player, 0);
        const secondary = PlayerCombatManager.fetch(player, 1);

        const enemyTrap = nearestEnemy.trap!;
        if (!AttackManager.placeIntent.appleInstaIntent) return;

        const attackAction = this.attackAction;
        attackAction.sequence[0].wpnId = secondary.id;
        attackAction.sequence[1].wpnId = primary.id;
        attackAction.onSelect = () => PlacementSystem.blockTrapPlacement(enemyTrap, 2);
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}