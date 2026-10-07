import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import PushSpikeMethod, { PushStrikeContext } from "@core/mod/combat/modules/push-strikes/utils/PushStrikeMethod";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import ModManager from "@core/ModManager";
import PacketMap from "@core/PacketMap";
import withinDist from "@utils/geometry/withinDist";

interface PredictiveHitData {
    enemy: Player | undefined;
    dt: number;
    id: number;
}

export default class PredictiveMethod extends PushSpikeMethod {
    private hasAttacked = false;
    private attackData: PredictiveHitData = { enemy: undefined, dt: 0, id: 0 };
    private attackAction!: AttackQueue;

    initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    private commit() {
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "predictiveSpikeStrikes");
        AttackManager.addAttackQueue(attackAction);
    }

    update() {
        if (this.hasAttacked) {
            this.hasAttacked = false;

            if (this.attackData.enemy) {
                const enemy = this.attackData.enemy;
                if (enemy.visible) enemy.profilingData.tankUseHits[this.attackData.id][this.attackData.dt]--;
                else enemy.profilingData.tankUseHits[this.attackData.id][this.attackData.dt]++;
            }

            this.attackData.dt = 0;
            this.attackData.enemy = undefined;
        }

        const nearestEnemy = ModManager.enemyData.nearest;
        const spike = AutoPusher.theSpike;
        const player = Client.player;

        if (!spike) return;
        if (!nearestEnemy) return;

        const enemyPos = nearestEnemy.real_position;
        const scale = 35.8 + spike.scale;

        const willHitSpike = withinDist(nearestEnemy.next_position, spike, scale - .8);
        const isHittingSpike = withinDist(enemyPos, spike, scale);
        if (!willHitSpike && !isHittingSpike) return;

        const myPrimary = PlayerCombatManager.fetch(player, 0);
        if (myPrimary.reload !== 1 || myPrimary.dmg * 1.5 + spike.dmg < 100) return;

        if (
            nearestEnemy.skinIndex === STORE_HAT_MAP.TANK_GEAR &&
            GameEventTracker.confirm(nearestEnemy.sid, PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION)
        ) {
            const tickSinceReloaded = nearestEnemy.weaponIndex < 9 ? nearestEnemy.weaponData.lastTickSincePrimaryReloaded : nearestEnemy.weaponData.lastTickSinceSecondaryReloaded;
            const dt = ModManager.tick - tickSinceReloaded;
            nearestEnemy.profilingData.tankUseHits[nearestEnemy.weaponIndex][dt]++;
        }

        GameEventTracker.track(nearestEnemy.sid, PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION);
    }

    execute(ctx: PushStrikeContext) {
        const { nearestEnemy, primary, spike, scale } = ctx;

        const enemyPos = nearestEnemy.real_position;
        const willHitSpike = withinDist(nearestEnemy.next_position, spike, scale - .8);
        const isHittingSpike = withinDist(enemyPos, spike, scale);

        if (!willHitSpike && !isHittingSpike) return;
        if (primary.reload !== 1) return;

        const tankUseHits = nearestEnemy.profilingData.tankUseHits[nearestEnemy.weaponIndex];
        let highestHits = -Infinity;
        let highestIndex = -Infinity;

        for (let i = 0; i < tankUseHits.length; i++) {
            if (tankUseHits[i] <= 0) {
                tankUseHits[i] = 0;
                continue;
            }

            if (highestHits < tankUseHits[i]) {
                highestHits = tankUseHits[i];
                highestIndex = i;
            }
        }

        if (!isFinite(highestIndex)) return;

        const tickSinceReloaded = nearestEnemy.weaponIndex < 9 ? nearestEnemy.weaponData.lastTickSincePrimaryReloaded : nearestEnemy.weaponData.lastTickSinceSecondaryReloaded;
        const dt = ModManager.tick - tickSinceReloaded;
        if (dt !== highestIndex - 1) return;

        this.attackData.dt = highestIndex;
        this.attackData.enemy = nearestEnemy;
        this.attackData.id = nearestEnemy.weaponIndex;
        this.hasAttacked = true;

        this.commit();
    }
}