import CombatModule from "@combat-utils/CombatModule";
import CombatUtils from "@combat-utils/CombatUtils";
import items, { WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_ACCESSORY_MAP, STORE_HAT_ID, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import MovementPhysicsSimulator, { KnockbackSimAction } from "@simulation/MovementPhysicsSimulator";
import { PlayerSimulationState } from "@simulation/SimulationStates";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDist from "@utils/geometry/getDist";
import getDistSq from "@utils/geometry/getDistSq";
import inRange from "@utils/math/inRange";

interface OneTickStep {
    moveIndex: number;
    state: PlayerSimulationState;
    weaponIndex: number;
}

type OneTickerSimActions = [
    [KnockbackSimAction]
];

export default class OneTicker extends CombatModule {
    private attackAction!: AttackQueue;
    private simActions: OneTickerSimActions = [
        [{
            type: "knockback",
            pos: { x: 0, y: 0 },
            knockPower: .5
        }]
    ];

    protected initialize() {
        this.attackAction = AttackQueuePool.createAttackQueue();

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];
        const secondAction = attackAction.sequence[1];

        firstAction.skinData[0] = STORE_HAT_MAP.TURRET_GEAR;
        secondAction.skinData[0] = STORE_HAT_MAP.BULL_HELMET;
        firstAction.skinData[1] = secondAction.skinData[1] = false;

        firstAction.reason = secondAction.reason = "oneTick";
        firstAction.noAttack = true;
        firstAction.dontUse = false;
        secondAction.dontUse = false;

        attackAction.grade = Infinity;
        attackAction.cost = 3;
    }

    readonly minDist = 204;
    tapMode = false;

    protected canExecute() {
        if (!Menu.getValue("dynamicOneTick")) {
            this.tapMode = false;
            return false;
        }

        if (!ModManager.enemyData.nearest) {
            this.tapMode = false;
            return false;
        }

        if (AttackManager.isAttacking()) return false;
        if (!HatSystem.allowHatSwitch()) return false;
        if (AutoBreaker.allSpikesBuffer.length) return false;
        if (Client.player.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL) return false;
        return true;
    }

    private possibleMovements = [0, null, Math.PI];

    private getTickMode(moveIndex: number) {
        return moveIndex === 0 ? "to" : moveIndex === 1 ? "stop" : "away";
    }

    private commit(firstStep: OneTickStep, secondStep: OneTickStep) {
        this.tapMode = false;

        const attackAction = this.attackAction;
        const firstAction = attackAction.sequence[0];
        const secondAction = attackAction.sequence[1];

        firstAction.wpnId = firstStep.weaponIndex;
        firstAction.tickMode = this.getTickMode(firstStep.moveIndex);

        secondAction.wpnId = secondStep.weaponIndex;
        secondAction.tickMode = this.getTickMode(secondStep.moveIndex);
        AttackManager.addAttackQueue(attackAction);
    }

    private willStayInSoldier(enemy: Player) {
        const bTickOffset = ModManager.tick - enemy.bullTick;
        if (enemy.shameCount > 0 && bTickOffset % 9 === 8) return false;
        if (enemy.clowned) return false;
        if (!enemy.findHat(STORE_HAT_MAP.TANK_GEAR)) return true;

        const wpnIndex = enemy.weaponIndex;
        const speed = items.weapons[wpnIndex].speed;
        const wpnReload = enemy.getReload(wpnIndex < 9 ? 0 : 1);

        const tickReload = ScriptConfig.SERVER_UPDATE_SPEED / speed;
        if (wpnReload + tickReload < 1) return true;
        if (wpnReload + tickReload * 2 < 1) return true;
        return false;
    }

    getMoveHat(): STORE_HAT_ID {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest;

        if (player.trap) {
            return STORE_HAT_MAP.IGNORE;
        }

        if (!nearestEnemy || player.weapons[0] !== WEAPON_ID_MAP.POLEARM) {
            this.tapMode = false;
            return STORE_HAT_MAP.IGNORE;
        }

        const dist = getDist(nearestEnemy.real_position, player.real_position);
        const goToDistance = this.minDist + 10;
        const diff = Math.abs(dist - goToDistance);

        if (diff > 20) return STORE_HAT_MAP.BOOSTER_HAT;
        if (diff <= 10) return STORE_HAT_MAP.TANK_GEAR;
        return STORE_HAT_MAP.SOLDIER_HELMET;
    }

    getMoveDir(peek = false) {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest;
        const enemyAngle = ModManager.enemyData.angle;

        if (player.trap) {
            return null;
        }

        if (!nearestEnemy || player.weapons[0] !== WEAPON_ID_MAP.POLEARM) {
            if (!peek) this.tapMode = false;
            return null;
        }

        const dist = getDist(nearestEnemy.real_position, player.real_position);
        const goToDistance = this.minDist + 10;

        if (Math.abs(dist - goToDistance) <= 4)
            return null;

        if (dist < goToDistance) {
            return enemyAngle + Math.PI;
        }

        return enemyAngle;
    }

    static readonly MIN_DIST = 195;
    static readonly MAX_DIST = 265;

    static readonly MIN_DIST_SQ = this.MIN_DIST * this.MIN_DIST;
    static readonly MAX_DIST_SQ = this.MAX_DIST * this.MAX_DIST;

    static canOneTick() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;

        const primary = PlayerCombatManager.fetch(player, 0);
        const turretReloadPerTick = ScriptConfig.SERVER_UPDATE_SPEED / ScriptConfig.TURRET_GEAR_RELOAD;
        const turretReloaded = player.getReload(2) + turretReloadPerTick >= 1;
        const fullyReloaded = primary.reload === 1 && turretReloaded;
        const isInLineOfSight = CombatUtils.canTurretHit(nearestEnemy);

        return fullyReloaded && isInLineOfSight && primary.dmg * 1.5 + 25 >= 100;
    }

    protected execute() {
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest!;
        const enemyAngle = ModManager.enemyData.angle;

        const primary = PlayerCombatManager.fetch(player, 0);
        const turretReloadPerTick = ScriptConfig.SERVER_UPDATE_SPEED / ScriptConfig.TURRET_GEAR_RELOAD;
        const turretReloaded = player.getReload(2) + turretReloadPerTick >= 1;
        const minDistSq = this.minDist * this.minDist;
        const distanceSq = getDistSq(nearestEnemy.real_position, player.real_position);

        const isInCorrectDistance = inRange(distanceSq, OneTicker.MIN_DIST_SQ, OneTicker.MAX_DIST_SQ);
        const fullyReloaded = primary.reload === 1 && turretReloaded;
        const isInLineOfSight = CombatUtils.canTurretHit(nearestEnemy);

        const isDiamondPolearm = primary.id === WEAPON_ID_MAP.POLEARM && primary.variant >= WEAPON_VARIANT_MAP.DIAMOND;
        const isRubyKatana = primary.id === WEAPON_ID_MAP.KATANA && primary.variant >= WEAPON_VARIANT_MAP.RUBY;
        const isUsingCorrectWeapon = isDiamondPolearm || isRubyKatana;

        if (!isUsingCorrectWeapon || (this.tapMode && primary.id === WEAPON_ID_MAP.KATANA)) {
            this.tapMode = false;
            return;
        }

        if (!isInCorrectDistance || !fullyReloaded || !isInLineOfSight) return;

        const playerState = player.getSimulationState();
        const possibleMovements = this.possibleMovements;
        const ignoreHats = Menu.getValue("oneTickIgnoreHats");

        const enemyMoveDir = getDistSq(nearestEnemy.real_position, nearestEnemy.next_position) <= 3 ?
            null : getDir(nearestEnemy.next_position, nearestEnemy.real_position);

        let enemyState = MovementPhysicsSimulator.simTick(nearestEnemy.getSimulationState(), enemyMoveDir);
        let firstStep: OneTickStep | null = null;
        playerState.skinIndex = STORE_HAT_MAP.TURRET_GEAR;

        for (let i = 0, len = possibleMovements.length; i < len; i++) {
            const moveModifier = possibleMovements[i];
            const moveDir = typeof moveModifier !== "number" ? null : enemyAngle + moveModifier;
            const state = MovementPhysicsSimulator.simTick(playerState, moveDir);
            const isTooClose = getDistSq(state, enemyState) <= minDistSq;

            if (isTooClose) continue;
            firstStep = { moveIndex: i, state, weaponIndex: state.weaponIndex };
            break;
        }

        if (!firstStep) return;

        const firstStepState = firstStep.state;
        const primaryRange = items.weapons[primary.id].range;
        firstStepState.skinIndex = STORE_HAT_MAP.BULL_HELMET;

        let secondStep: OneTickStep | null = null;
        enemyState = MovementPhysicsSimulator.simTick(enemyState, enemyMoveDir);
        const stepTwoEnemyAngle = getDir(enemyState, firstStepState);

        for (let i = 0, len = possibleMovements.length; i < len; i++) {
            const moveModifier = possibleMovements[i];
            const moveDir = typeof moveModifier !== "number" ? null : stepTwoEnemyAngle + moveModifier;

            firstStepState.weaponIndex = primary.id;
            const state = MovementPhysicsSimulator.simTick(firstStepState, moveDir);

            if (!CombatUtils.getCombatDistance(state, enemyState, primaryRange - 2)) continue;
            secondStep = { moveIndex: i, state, weaponIndex: state.weaponIndex };
            break;
        }

        if (!secondStep) return;

        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(nearestEnemy.sid)!;
        const isFasterExecution = myPositionalSpot < enemyPositionalSpot;

        let totalDmg = 25 + primary.dmg * 1.5;
        const bTickOffset = ModManager.tick - nearestEnemy.bullTick;

        const knockbackAction = this.simActions[0][0];
        knockbackAction.pos.x = secondStep.state.x;
        knockbackAction.pos.y = secondStep.state.y;
        knockbackAction.knockPower = primary.totalKnock;
        knockbackAction.dontUse = !isFasterExecution;

        const simResult = MovementPhysicsSimulator.simulate(enemyState, this.simActions, 1);
        const isTankAfterSoldier = nearestEnemy.lastSkinIndex === STORE_HAT_MAP.SOLDIER_HELMET && nearestEnemy.skinIndex === STORE_HAT_MAP.TANK_GEAR;
        const isTankOrSoldier = (nearestEnemy.clowned && nearestEnemy.lastSkinIndex === STORE_HAT_MAP.SOLDIER_HELMET) || isTankAfterSoldier || nearestEnemy.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET;

        if (bTickOffset % 9 === 8) totalDmg += 5;
        if (!nearestEnemy.trap || nearestEnemy.damages.length) totalDmg += simResult.spikesHit * 35;
        if (isTankOrSoldier && !ignoreHats && this.willStayInSoldier(nearestEnemy)) totalDmg *= .75;
        if (nearestEnemy.skinIndex === STORE_HAT_MAP.EMP_HELMET && !ignoreHats) totalDmg -= 25;
        if (totalDmg < 100) return;

        this.commit(firstStep, secondStep);
    }

    update() { }
}