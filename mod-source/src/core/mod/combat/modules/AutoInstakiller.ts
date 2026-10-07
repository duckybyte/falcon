import items, { WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager, { WeaponFetchData } from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import MovementPhysicsSimulator, { DamageSimAction, KnockbackSimAction, SimulationOptions, SimulationResult } from "@core/mod/simulation/MovementPhysicsSimulator";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import ScriptConfig from "@utils/config/ScriptConfig";
import lineInRect from "@utils/geometry/lineInRect";
import withinDist from "@utils/geometry/withinDist";

type AutoInstakillerSimActions = [
    [DamageSimAction, DamageSimAction, KnockbackSimAction],
    [DamageSimAction, DamageSimAction, KnockbackSimAction, KnockbackSimAction],
    [KnockbackSimAction, KnockbackSimAction]
];

export default class AutoInstakiller extends CombatModule {
    private normalAttackAction!: AttackQueue;
    private reverseAttackAction!: AttackQueue;

    private createAction(action: AttackQueue, firstHat: number, secondHat: number) {
        const firstAction = action.sequence[0];
        const secondAction = action.sequence[1];

        firstAction.skinData[0] = firstHat;
        secondAction.skinData[0] = secondHat;
        firstAction.dontUse = secondAction.dontUse = false;
    }

    protected initialize() {
        this.normalAttackAction = AttackQueuePool.createAttackQueue();
        this.reverseAttackAction = AttackQueuePool.createAttackQueue();

        const normalAttackAction = this.normalAttackAction;
        const reverseAttackAction = this.reverseAttackAction;

        this.createAction(normalAttackAction, STORE_HAT_MAP.BULL_HELMET, STORE_HAT_MAP.TURRET_GEAR);
        this.createAction(reverseAttackAction, STORE_HAT_MAP.TURRET_GEAR, STORE_HAT_MAP.BULL_HELMET);
        normalAttackAction.cost = reverseAttackAction.cost = 3;
    }

    protected canExecute() {
        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (!ModManager.enemyData.nearest) return false;
        if (AttackManager.autoInstaToggle) return true;
        if (AttackManager.placeIntent.retrap) return false;
        if (!Menu.getValue("attackFactoringKB:insta")) return false;
        if (!Menu.getValue("attackFactoringKB:insta:allowInTrap") && Client.player.trap) return false;
        if (Menu.getValue("attackFactoringKB:insta:allowInTrap") && Client.player.trap && AutoBreaker.allSpikesBuffer.length)
            return false;

        return true;
    }

    private simulationActions: AutoInstakillerSimActions = [
        [{
            type: "damage",
            damage: 0
        }, {
            type: "damage",
            dontUse: true,
            damage: 0
        }, {
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 99
        }],
        [{
            type: "damage",
            damage: 0
        }, {
            type: "damage",
            dontUse: true,
            damage: 0
        }, {
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 99
        }, {
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 99
        }],
        [{
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 99
        }, {
            type: "knockback",
            dontUse: true,
            pos: { x: 0, y: 0 },
            knockPower: 99
        }]
    ];

    private resetAllActions() {
        const actions = this.simulationActions;

        for (let i = 0, len = actions.length; i < len; i++) {
            const steps = actions[i];

            for (let j = 0, sLen = steps.length; j < sLen; j++) {
                const step = steps[j];

                // ignore the first dmg action since there will always be at least one dmg per actiongroup
                if (step.type === "damage" && j === 0) continue;
                step.dontUse = true;
            }
        }
    }

    private modifySimulationActions(player: Player, nearestEnemy: Player, shouldReverseInsta: boolean, hasProjectile: boolean, primary: WeaponFetchData, secondary: WeaponFetchData) {
        this.resetAllActions();

        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(nearestEnemy.sid)!;
        const isFasterExecution = myPositionalSpot < enemyPositionalSpot;

        const actions = this.simulationActions;
        const firstStep = actions[0];
        const secondStep = actions[1];
        const thirdStep = actions[2];

        const sourceOneKB_1 = firstStep[2];

        const sourceOneKB_2 = secondStep[2];
        const sourceTwoKB_2 = secondStep[3];

        const sourceOneKB_3 = thirdStep[0];
        const sourceTwoKB_3 = thirdStep[1];

        if (shouldReverseInsta) {
            // first tick
            const turretDmgAction = firstStep[0];
            const hammerDamageAction = firstStep[1];

            const hammerKbAction = isFasterExecution ? sourceOneKB_1 : sourceOneKB_2;
            const turretKbAction = sourceTwoKB_2;

            turretDmgAction.damage = 25;
            hammerDamageAction.damage = CombatUtils.getMonkeyDamage(secondary.dmg);
            hammerDamageAction.dontUse = false;

            turretKbAction.dontUse = false;
            hammerKbAction.dontUse = false;

            turretKbAction.pos = hammerKbAction.pos = player.real_position;
            turretKbAction.knockPower = .3;
            hammerKbAction.knockPower = secondary.totalKnock;

            // second tick
            const primaryDmgAction = secondStep[0];
            const primaryKbAction = isFasterExecution ? sourceOneKB_2 : sourceOneKB_3;
            primaryDmgAction.damage = CombatUtils.getMonkeyDamage(primary.dmg * 1.5);
            primaryKbAction.dontUse = false;

            primaryKbAction.pos = player.next_position;
            primaryKbAction.knockPower = primary.totalKnock;
        } else {
            // first tick
            const primaryDmgAction = firstStep[0];
            const primaryKbAction = isFasterExecution ? sourceOneKB_1 : sourceOneKB_2;
            primaryDmgAction.damage = CombatUtils.getMonkeyDamage(primary.dmg * 1.5);
            primaryKbAction.dontUse = false;

            primaryKbAction.pos = player.real_position;
            primaryKbAction.knockPower = primary.totalKnock;

            // second tick
            const turretDmgAction = secondStep[0];
            const secondaryDamageAction = secondStep[1];
            const turretKbAction = sourceOneKB_3;
            const secondaryKbAction = isFasterExecution ? sourceTwoKB_2 : sourceTwoKB_3;

            turretDmgAction.damage = 25;
            secondaryDamageAction.damage = CombatUtils.getMonkeyDamage(secondary.dmg, hasProjectile);
            secondaryDamageAction.dontUse = false;

            turretKbAction.dontUse = false;
            secondaryKbAction.dontUse = false;

            turretKbAction.pos = secondaryKbAction.pos = player.next_position;
            turretKbAction.knockPower = .3;
            secondaryKbAction.knockPower = secondary.totalKnock;
        }
    }

    private isTrapPush(player: Player, nearestEnemy: Player, simResult: Readonly<SimulationResult>) {
        if (!simResult.trap) return false;
        if (player.trap) return false;

        if (!nearestEnemy.wasTrapped && (player.weapons[0] === WEAPON_ID_MAP.STICK || player.weapons[0] === WEAPON_ID_MAP.DAGGERS)) {
            return false;
        }

        if (!Client.isFriendly(simResult.trap.ownerSID ?? -1)) return false;

        const closeObjects = ObjectManager.pool.closeObjects;
        const playerPos = player.real_position;
        const simTrap = simResult.trap;
        const maxRange = 200;
        const goldHammerDamage = 272.25;
        let isPushable = false;

        if (withinDist(playerPos, simTrap, maxRange) || simTrap.health <= goldHammerDamage) return false;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];

            const tmpScale = gameObject.getScale(.6);
            const isSpike = gameObject.dmg && !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);
            const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
            if (gameObject.health <= goldHammerDamage) continue;

            if ((isSpike || isCactus) && withinDist(simTrap, gameObject, gameObject.scale + 65)) {
                isPushable = true;
            }

            if (!withinDist(playerPos, gameObject, maxRange)) continue;
            if (gameObject.ignoreCollision && !(gameObject.boostSpeed || gameObject.teleport)) continue;
            if (lineInRect(
                gameObject.x - tmpScale,
                gameObject.y - tmpScale,
                gameObject.x + tmpScale,
                gameObject.y + tmpScale,
                playerPos.x,
                playerPos.y,
                simTrap.x,
                simTrap.y
            )) {
                return false;
            }
        }

        return isPushable;
    }

    protected execute() {
        const player = Client.player;

        const nearestEnemy = ModManager.enemyData.nearest!;
        const primary = PlayerCombatManager.fetch(player, 0);
        const secondary = PlayerCombatManager.fetch(player, 1);
        const turretReload = player.getReload(2);

        if (player.weapons.length !== 2) return;
        if (primary.reload !== 1 || secondary.reload !== 1 || turretReload !== 1) return;
        if (primary.id === WEAPON_ID_MAP.TOOL_HAMMER) return;
        if (nearestEnemy.trap && !AttackManager.autoInstaToggle) return;

        const hasSpikeGear = nearestEnemy.skinIndex === STORE_HAT_MAP.SPIKE_GEAR;
        const hasGreatHammer = secondary.id === WEAPON_ID_MAP.GREAT_HAMMER;
        const weaponRange = hasGreatHammer ? items.weapons[secondary.id].range : items.weapons[primary.id].range;
        if (!CombatUtils.getCombatDistance(player, nearestEnemy, weaponRange - 1)) return;

        const shouldReverseInsta = hasGreatHammer || hasSpikeGear;
        const hasProjectile = !!items.weapons[secondary.id].projectile;
        if (!hasGreatHammer && !hasProjectile) return;

        this.modifySimulationActions(player, nearestEnemy, shouldReverseInsta, hasProjectile, primary, secondary);

        const simActions = AttackManager.autoInstaToggle ? SimulationOptions.get().toggleGatherRawDamage() : undefined;
        const simResult = MovementPhysicsSimulator.simulate(nearestEnemy.getSimulationState(), this.simulationActions, 2, simActions);
        const requiredSpikeHits = primary.dmg <= 25 ? 1 : 0;
        const isATOSOn = simResult.totalDamage > 100 && AttackManager.autoInstaToggle;
        const normalInsta = isATOSOn || simResult.spikesHit > requiredSpikeHits || simResult.oneTicked || simResult.pitTrapped;
        const validPushInsta = hasGreatHammer && this.isTrapPush(player, nearestEnemy, simResult);
        if (!normalInsta && !validPushInsta) return;

        const attackAction = shouldReverseInsta ? this.reverseAttackAction : this.normalAttackAction;
        attackAction.sequence[0].reason = attackAction.sequence[1].reason = AttackManager.autoInstaToggle ? "ATOS" : validPushInsta && !normalInsta ? "pushInstaKill" : "autoInstaKill";
        attackAction.sequence[0].wpnId = shouldReverseInsta ? secondary.id : primary.id;
        attackAction.sequence[1].wpnId = shouldReverseInsta ? primary.id : secondary.id;
        attackAction.grade = 0;

        AttackManager.gradeAttackQueue(attackAction, simResult);
        AttackManager.addAttackQueue(attackAction);
        AttackManager.autoInstaToggle = false;
    }

    update() { }
}