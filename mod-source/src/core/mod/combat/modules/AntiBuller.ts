import CombatUtils from "@combat-utils/CombatUtils";
import { accessories, CORRUPT_X_WINGS_INDEX, hats, SPIKE_GEAR_INDEX, STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import withinDist from "@utils/geometry/withinDist";

export default class AntiBuller extends CombatModule {
    private attackAction!: AttackQueue;

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        attackAction.grade = 2;
        attackAction.cost = 1;
    }

    protected canExecute() {
        return true;
    }

    consider = false;

    private commit() {
        const attackAction = this.attackAction;
        AttackManager.prepareBullHitSequence(attackAction.sequence, "pAB");
        AttackManager.addAttackQueue(attackAction);
    }

    private hasPredictedBullHit() {
        const nearestEnemy = ModManager.enemyData.nearest!;

        if (!nearestEnemy.damages.length) return false;

        const player = Client.player;
        if (player.skinIndex !== STORE_HAT_MAP.SPIKE_GEAR || player.tailIndex !== STORE_ACCESSORY_MAP.CORRUPT_X_WINGS) return false;

        const primary = PlayerCombatManager.fetch(player, 0);
        const enemyPrimary = PlayerCombatManager.fetch(nearestEnemy, 0);
        const sgReflection = hats[SPIKE_GEAR_INDEX].dmg!;
        const cxReflection = accessories[CORRUPT_X_WINGS_INDEX].dmg!;

        const lowestTotalDamage = enemyPrimary.dmg * sgReflection + enemyPrimary.dmg + cxReflection;

        this.consider = false;
        if (primary.dmg * 1.5 + lowestTotalDamage >= 100 && player.health + enemyPrimary.dmg <= 100) {
            this.commit();
            return true;
        }

        return false;
    }

    protected execute() {
        const player = Client.player;

        if (player.shameCount >= 4) return;
        if (!Menu.getValue("antiBull")) {
            this.consider = false;
            return;
        }

        const ourPrimary = PlayerCombatManager.fetch(player, 0);
        const nearby = ModManager.enemyData.nearby;
        const nearestEnemy = ModManager.enemyData.nearest;

        if (!CombatUtils.isAttackPrimary(player.weapons[0])) return;
        if (!nearestEnemy) {
            this.consider = false;
            return;
        }

        if (ourPrimary.reload === 1 && this.hasPredictedBullHit()) return;
        this.consider = false;

        let totalDamage = 0;
        let consider = false;
        let spikesNear = false;
        const allSpikes = ObjectManager.pool.allSpikes;

        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObject = allSpikes[i];
            if (!gameObject) continue;

            if (Client.isFriendly(gameObject.ownerSID ?? -1)) continue;
            if (!withinDist(player.real_position, gameObject, 150)) continue;

            spikesNear = true;
            break;
        }

        const canForceAntiBull = Menu.getValue("forceAntiBull") && !DefenseSystem.canPlaceOnMe && !spikesNear;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            const enemyPrimary = PlayerCombatManager.fetch(enemy, 0);
            const wasPrimaryReloaded = enemy.getLastReload(0) === 1;
            const isCorrectPrimary = CombatUtils.isAttackPrimary(enemyPrimary.id);

            if (enemyPrimary.reload < 1) continue;
            if (enemy === nearestEnemy && isCorrectPrimary && (canForceAntiBull || !wasPrimaryReloaded)) {
                consider = true;
            }

            totalDamage += enemyPrimary.dmg * 1.5;
        }

        if (totalDamage >= 100) return;
        if (!consider) return;
        this.consider = true;
    }

    update() { }
}