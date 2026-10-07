import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import MovementPhysicsSimulator, { DamageSimAction, KnockbackSimAction } from "@simulation/MovementPhysicsSimulator";
import withinDist from "@utils/geometry/withinDist";

type TurretGearKBSimActions = [
    [DamageSimAction],
    [KnockbackSimAction]
];

export default class TurretGearKnockbacker extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];

        firstAction.skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        firstAction.skinData[1] = false;
        firstAction.reason = "turretKB";
        firstAction.dontUse = false;
        firstAction.noAttack = true;

        attackAction.grade = Infinity;
        attackAction.cost = 1;
    }

    private simActions: TurretGearKBSimActions = [
        [{
            type: "damage",
            damage: 25
        }],
        [{
            type: "knockback",
            pos: { x: 0, y: 0 },
            knockPower: .3
        }]
    ];

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("turretGearKB")) return false;
        if (AutoBreaker.allSpikesBuffer.length) return false;
        if (DefenseSystem.canPlaceOnMe) return false;
        if (!Client.player.skins[STORE_HAT_MAP.TURRET_GEAR]) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;
        const turret = PlayerCombatManager.fetch(player, 2);

        if (nearestEnemy.skinIndex === STORE_HAT_MAP.EMP_HELMET) return;
        if (turret.reload !== 1) return;
        if (!withinDist(nearestEnemy.real_position, player.real_position, 700)) return;
        if (nearestEnemy.trap) return;
        if (CombatUtils.canTurretHit(nearestEnemy)) return;

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