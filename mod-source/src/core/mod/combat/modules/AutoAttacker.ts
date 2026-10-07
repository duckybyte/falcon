import items from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import PlayerCombatManager, { WeaponFetchData } from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import MovementPhysicsSimulator, { DamageSimAction, KnockbackSimAction } from "@simulation/MovementPhysicsSimulator";

type AutoAttackerSimActions = [
    [DamageSimAction, KnockbackSimAction],
    [KnockbackSimAction]
];

export default class AutoAttacker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.cost = 1;
    }

    canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("attackFactoringKB:hits")) return false;
        return true;
    }

    private simulationActions: AutoAttackerSimActions = [
        [{
            type: "damage",
            damage: -1
        }, {
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 9999
        }],
        [{
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 9999
        }]
    ];

    private modifyActions(player: Player, nearestEnemy: Player, primary: WeaponFetchData) {
        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(nearestEnemy.sid)!;
        const actions = this.simulationActions;

        const firstActions = actions[0];
        const secondActions = actions[1];

        const damageAction = firstActions[0];
        const sameTickKbAction = firstActions[1];
        const nextTickKbAction = secondActions[0];

        damageAction.damage = CombatUtils.getMonkeyDamage(primary.dmg * 1.5);
        sameTickKbAction.knockPower = nextTickKbAction.knockPower = primary.totalKnock;
        sameTickKbAction.pos = nextTickKbAction.pos = player.real_position;

        if (myPositionalSpot < enemyPositionalSpot) {
            sameTickKbAction.dontUse = false;
            nextTickKbAction.dontUse = true;
        } else {
            sameTickKbAction.dontUse = true;
            nextTickKbAction.dontUse = false;
        }
    }

    execute() {
        const nearestEnemy = ModManager.enemyData.nearest!;
        const player = Client.player;
        const primary = PlayerCombatManager.fetch(player, 0);
        if (primary.reload !== 1) return;

        const primaryRange = items.weapons[primary.id].range
        if (!CombatUtils.getCombatDistance(player, nearestEnemy, primaryRange)) return;
        if (nearestEnemy.trap) return;

        this.modifyActions(player, nearestEnemy, primary);

        const simResult = MovementPhysicsSimulator.simulate(nearestEnemy.getSimulationState(), this.simulationActions, 1);
        const hasHitSpikes = simResult.spikesHit >= 3; // ensures shame gain
        const enemyKilled = simResult.pitTrapped || simResult.oneTicked; // enemy literally dies if these happen
        const damagedEnemyEnough = hasHitSpikes || enemyKilled;
        if (!damagedEnemyEnough) return;

        const attackAction = this.attackAction;
        attackAction.grade = 0; // reset
        AttackManager.gradeAttackQueue(attackAction, simResult);
        AttackManager.prepareBullHitSequence(attackAction.sequence);
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}