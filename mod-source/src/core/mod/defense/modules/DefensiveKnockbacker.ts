import CombatUtils from "@combat-utils/CombatUtils";
import items from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import DefenseModule from "@core/mod/defense/utils/DefenseModule";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";

export default class DefensiveKnockbacker extends DefenseModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = Infinity;
        attackAction.cost = 2;
    }

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (!Menu.getValue("defensiveKB")) return false;
        if (!Client.player.skins[STORE_HAT_MAP.TURRET_GEAR] && Menu.getValue("defKBRequireTurret")) return false;
        return true;
    }

    protected execute() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;

        const primary = PlayerCombatManager.fetch(player, 0);
        const turretReload = player.getReload(2);
        const defKBRequireTurret = Menu.getValue("defKBRequireTurret");

        if (primary.reload !== 1) return;
        if (turretReload !== 1 && defKBRequireTurret) return;
        if (!player.trap) return;
        if (nearestEnemy.trap) return;
        if (!CombatUtils.getCombatDistance(player, nearestEnemy, items.weapons[primary.id].range)) return;
        if (getDistSq(player.next_position, player.real_position) <= 3) return;

        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(nearestEnemy.sid)!;
        const realPos = player.real_position;
        const nextPos = player.next_position;

        const dt_x = nextPos.x - realPos.x;
        const dt_y = nextPos.y - realPos.y;
        const isHigher = myPositionalSpot < enemyPositionalSpot;

        const nextPosition = {
            x: realPos.x + (isHigher ? dt_x : dt_x * 2),
            y: realPos.y + (isHigher ? dt_y : dt_y * 2)
        };

        const allSpikes = ObjectManager.pool.allSpikes;
        let collisionPotential = false;

        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObject = allSpikes[i];
            if (!gameObject) continue;

            const isEnemy = !Client.isFriendly(gameObject.ownerSID ?? -1);
            if (!isEnemy) continue;

            if (!withinDist(nextPosition, gameObject, 36 + gameObject.scale)) continue;
            if (withinDist(player.real_position, gameObject, 37 + gameObject.scale)) continue;
            collisionPotential = true;
            break;
        }

        if (!collisionPotential) return;
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "defKB");
        attackAction.sequence[0].skinData[0] = turretReload === 1 ? STORE_HAT_MAP.TURRET_GEAR : STORE_HAT_MAP.SOLDIER_HELMET;
        AttackManager.addAttackQueue(attackAction);
    }

    update() { }
}