import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import items from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import MovementPhysicsSimulator, { KnockbackSimAction } from "@simulation/MovementPhysicsSimulator";

type BarbarianKnockbackerSimActions = [
    [],
    [KnockbackSimAction]
]

export default class BarbarianKnockbacker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];

        firstAction.skinData[0] = STORE_HAT_MAP.BARBARIAN_ARMOR;
        firstAction.skinData[1] = false;
        firstAction.reason = "barbKB";
        firstAction.dontUse = false;
        firstAction.noAttack = true;

        attackAction.grade = Infinity;
        attackAction.cost = .5;
    }

    private simActions: BarbarianKnockbackerSimActions = [
        [],
        [{
            type: "knockback",
            pos: { x: 0, y: 0 },
            knockPower: .6
        }]
    ];

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("barbKnockback")) return false;
        if (DefenseSystem.canPlaceOnMe) return false;
        if (!Client.player.skins[STORE_HAT_MAP.BARBARIAN_ARMOR]) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;

        const wpnData = items.weapons[nearestEnemy.weaponIndex];
        if (wpnData.projectile !== undefined) return;
        if (nearestEnemy.trap) return;

        const wasWeaponReloaded = nearestEnemy.getLastReload(nearestEnemy.weaponIndex < 9 ? 0 : 1) === 1;
        const enemyWeapon = PlayerCombatManager.fetch(nearestEnemy, nearestEnemy.weaponIndex < 9 ? 0 : 1);

        if (!CombatUtils.getCombatDistance(player, nearestEnemy, wpnData.range - 1)) return;
        if (enemyWeapon.reload < 1) return;
        if (wasWeaponReloaded) return;

        const kbAction = this.simActions[1][0];
        kbAction.pos.x = player.next_position.x;
        kbAction.pos.y = player.next_position.y;

        const res = MovementPhysicsSimulator.simulate(nearestEnemy.getSimulationState(), this.simActions, 2);
        const shouldCommit = res.oneTicked || res.spikesHit >= 3 || res.pitTrapped;
        if (!shouldCommit) return;

        const attackAction = this.attackAction;
        attackAction.sequence[0].wpnId = Client.weaponIndex;
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}