import OneTicker from "@combat-modules/OneTicker";
import CombatModule from "@combat-utils/CombatModule";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";
import inRange from "@utils/math/inRange";

export default class TurretAPAssister extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];

        firstAction.skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        firstAction.skinData[1] = false;
        firstAction.reason = "turretAPAssist";
        firstAction.dontUse = false;
        firstAction.noAttack = true;

        attackAction.grade = 3;
        attackAction.cost = 1;
    }

    protected canExecute() {
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("turretBulletAssistOnAP")) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (AttackManager.isAttacking()) return false;
        if (AttackManager.oneTicker.tapMode) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const enemy = ModManager.enemyData.nearest!;
        const turret = PlayerCombatManager.fetch(player, 2);
        let spikeHit = false;

        const minDist = OneTicker.MIN_DIST - 45;
        const maxDist = OneTicker.MAX_DIST + 45;
        const canOneTick = OneTicker.canOneTick() && inRange(getDistSq(enemy.real_position, player.real_position), minDist * minDist, maxDist * maxDist);

        if (!canOneTick) return;
        if (!withinDist(enemy.real_position, player.real_position, 300)) return;
        if (turret.reload !== 1) return;
        if (AutoPusher.autoPushing && !player.trap) return;
        if (enemy.skinIndex === STORE_HAT_MAP.EMP_HELMET) return;
        if (!enemy.trap) return;
        if (getDistSq(enemy.real_position, enemy.next_position) >= 25) return;
        if (enemy.damages.length === 0) return;

        const allSpikes = ObjectManager.pool.allSpikes;
        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const obj = allSpikes[i];
            const canDamage = !Client.isTeam(enemy, obj.ownerSID ?? -1);

            if (!canDamage) continue;
            if (!withinDist(enemy.real_position, obj, obj.scale + 36)) continue;
            spikeHit = true;
            break;
        }

        if (!spikeHit) return;
        const attackAction = this.attackAction;
        attackAction.sequence[0].wpnId = Client.weaponIndex;
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}