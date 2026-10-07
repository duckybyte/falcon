import { STORE_HAT_MAP } from "@constants/store";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import PushSpikeMethod, { PushStrikeContext } from "@core/mod/combat/modules/push-strikes/utils/PushStrikeMethod";
import Menu from "@menu/Menu";
import withinDist from "@utils/geometry/withinDist";

export default class ShameStrikeMethod extends PushSpikeMethod {
    private attackAction!: AttackQueue;

    initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];

        firstAction.skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        firstAction.reason = "daggerSpikeHit";

        firstAction.dontUse = false;
        attackAction.grade = Infinity;
        attackAction.cost = 2;
    }

    execute(ctx: PushStrikeContext) {
        const { nearestEnemy, primary, player, spike, scale } = ctx;

        const enemyPos = nearestEnemy.real_position;

        if (nearestEnemy.shameCount < parseInt(Menu.getValue("daggerShameStrikeThres"))) return;
        if (nearestEnemy.skinIndex === STORE_HAT_MAP.SHAME) return;
        if (primary.reload !== 1) return;
        if (player.getReload(2) !== 1) return;
        if (!withinDist(enemyPos, player.real_position, 100)) return;

        const willHitSpike = withinDist(nearestEnemy.real_position, spike, scale);
        const isHittingSpike = withinDist(enemyPos, spike, scale);

        if (!willHitSpike && !isHittingSpike) return;

        const attackAction = this.attackAction;
        attackAction.sequence[0].wpnId = primary.id;
        AttackManager.addAttackQueue(attackAction);
    }
}