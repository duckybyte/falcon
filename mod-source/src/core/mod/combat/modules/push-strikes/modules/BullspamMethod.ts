
import { WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import PushSpikeMethod, { PushStrikeContext } from "@core/mod/combat/modules/push-strikes/utils/PushStrikeMethod";
import withinDist from "@utils/geometry/withinDist";

export default class BullspamMethod extends PushSpikeMethod {
    private attackAction!: AttackQueue;

    initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    execute(ctx: PushStrikeContext) {
        const { primary, nearestEnemy, spike, scale, player } = ctx;

        const enemyPos = nearestEnemy.real_position;
        const scalePadding = player.trap ? 0 : 10;

        if (primary.reload !== 1) return;
        if (!withinDist(enemyPos, spike, scale + scalePadding)) return;
        if (!withinDist(enemyPos, player.real_position, 100)) return;

        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "spikeStrikes");

        if (primary.id === WEAPON_ID_MAP.DAGGERS && player.getReload(2) === 1) {
            attackAction.sequence[0].skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        }

        AttackManager.addAttackQueue(attackAction);
    }
}