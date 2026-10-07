import AntiBuller from "@combat-modules/AntiBuller";
import AppleInstakiller from "@combat-modules/AppleInstakiller";
import AutoAttacker from "@combat-modules/AutoAttacker";
import AutoInstakiller from "@combat-modules/AutoInstakiller";
import AutoMeleeSyncer from "@combat-modules/AutoMeleeSyncer";
import AutoPusherStriker from "@combat-modules/AutoPushStriker";
import BarbarianKnockbacker from "@combat-modules/BarbarianKnockbacker";
import OneTicker from "@combat-modules/OneTicker";
import ProjectileSyncer from "@combat-modules/ProjectileSyncer";
import ShameGrinder from "@combat-modules/ShameGrinder";
import SpikeTicker from "@combat-modules/SpikeTicker";
import TurretAPAssister from "@combat-modules/TurretAPAssister";
import TurretGearKnockbacker from "@combat-modules/TurretGearKnockbacker";
import VelocityAttacker from "@combat-modules/VelocityAttacker";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import AttackQueuePool, { AttackAction, AttackQueue } from "@core/mod/combat/core/AttackQueuePool";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import DefensiveKnockbacker from "@core/mod/defense/modules/DefensiveKnockbacker";
import ModModule from "@core/mod/utils/ModModule";
import ModManager from "@core/ModManager";
import { SimulationResult } from "@simulation/MovementPhysicsSimulator";
import withinDist from "@utils/geometry/withinDist";

export default class AttackManager {
    static autoInstaToggle = false;
    private static _currentAttackActions: AttackAction[] = AttackQueuePool.createAttackSequence();
    private static _currentAttackAction: AttackAction | undefined;
    private static currentAttackActionHead = 3;

    private static attackQueue: Readonly<AttackQueue>[] = [];

    static spikeTicker = new SpikeTicker();
    static shameGrinder = new ShameGrinder();
    static appleInstakiller = new AppleInstakiller();
    static antiBuller = new AntiBuller();
    static oneTicker = new OneTicker();

    static modules: ModModule[] = [
        this.antiBuller,
        new AutoInstakiller(),
        new AutoAttacker(),
        new ProjectileSyncer(),
        new AutoPusherStriker(),
        new TurretAPAssister(),
        new VelocityAttacker(),
        new DefensiveKnockbacker(),
        new AutoMeleeSyncer(),
        new TurretGearKnockbacker(),
        new BarbarianKnockbacker(),
        this.shameGrinder,
        this.appleInstakiller,
        this.spikeTicker,
        this.oneTicker
    ];

    static get currentAttackActions(): Readonly<AttackAction>[] {
        return this._currentAttackActions;
    }

    static get currentAttackAction(): Readonly<AttackAction | undefined> {
        return this._currentAttackAction;
    }

    static checkForAutoPushingStatus() {
        if (!AutoPusher.autoPushing) return false;

        const theSpike = AutoPusher.theSpike;
        const enemy = ModManager.enemyData.nearest;

        if (!enemy) return false; // shouldn't happen but to keep TS from screaming at me
        if (!theSpike) return false;
        return withinDist(enemy.real_position, theSpike, 36 + theSpike.scale);
    }

    static gradeAttackQueue(queue: AttackQueue, simResult: SimulationResult) {
        queue.grade += simResult.spikesHit;
        if (simResult.pitTrapped) queue.grade += 4;
        if (simResult.oneTicked) queue.grade = Infinity;
    }

    static addAttackQueue(queue: AttackQueue) {
        this.attackQueue.push(queue);
    }

    static prepareBullHitSequence(seq: AttackAction[], reason?: string) {
        const player = Client.player;
        const primaryId = player.weapons[0];
        const attackHat = primaryId === WEAPON_ID_MAP.DAGGERS ? STORE_HAT_MAP.SOLDIER_HELMET : STORE_HAT_MAP.BULL_HELMET;

        const firstAction = seq[0];
        const secondAction = seq[1];

        firstAction.dontUse = false;
        secondAction.dontUse = true;

        firstAction.wpnId = primaryId;
        firstAction.skinData[0] = attackHat;
        firstAction.skinData[1] = false;
        firstAction.aimType = "nearest";
        firstAction.reason = reason ?? "autoBullHit";
    }

    static isAttacking() {
        return this.currentAttackActionHead < 2;
    }

    static setAttackAction(action: AttackAction) {
        if (this.isAttacking()) return;
        this._currentAttackAction = action;
    }

    static stopAttackAction() {
        this.currentAttackActionHead = 3;
        this._currentAttackAction = undefined;
    }

    static placeIntent = {
        retrap: false,
        appleInstaIntent: false
    };

    private static probePlacements() {
        const nearestEnemy = ModManager.enemyData.nearest;
        this.placeIntent.retrap = false;
        this.placeIntent.appleInstaIntent = false;

        if (!nearestEnemy) return;
        if (!nearestEnemy.trap) return;

        const spikeCollisionScale = items.list[Client.player.items[2]].scale + 34;
        const preplacement = PlacementSystem.AutoPlacer.potentialPreplacements;

        for (let i = 0; i < preplacement.count; i++) {
            const item = preplacement.placements[i];
            const itemData = items.list[item.id];

            const isTrap = item.id === LIST_ID_MAP.PIT_TRAP;
            const isSpike = itemData.dmg;
            const isOverlapping = withinDist(item, nearestEnemy.next_position, isSpike ? spikeCollisionScale : 49);

            if (!isOverlapping) continue;
            if (isTrap) this.placeIntent.retrap = true;
            if (isSpike && item.appleInsta) this.placeIntent.appleInstaIntent = true;
        }

        const replacements = PlacementSystem.AutoReplacer.execute(Client.player, nearestEnemy.trap, true);
        if (replacements === undefined) return;

        for (let i = 0; i < replacements.length; i++) {
            const item = replacements[i];
            const isTrap = item.isTrap;
            const isSpike = item.isSpike;
            const isOverlapping = withinDist(item, nearestEnemy.next_position, isSpike ? spikeCollisionScale : 49);

            if (!isOverlapping) continue;
            if (isTrap) this.placeIntent.retrap = true;
            if (isSpike && item.appleInsta) this.placeIntent.appleInstaIntent = true;
        }
    }

    static main() {
        const attackQueue = this.attackQueue;
        const modules = this.modules;
        const modulesLength = modules.length;
        attackQueue.length = 0;

        this.probePlacements();
        for (let i = 0; i < modulesLength; i++) {
            modules[i].init();
            modules[i].update();
        }

        for (let i = 0; i < modulesLength; i++) {
            modules[i].run();
        }

        if (attackQueue.length) {
            const bestQueue = attackQueue[0];
            AttackQueuePool.copySequenceOver(bestQueue.sequence, this._currentAttackActions)
            this.currentAttackActionHead = 0;
            bestQueue.onSelect?.();
        }

        if (this.currentAttackActionHead < 2) {
            this._currentAttackAction = this.currentAttackActions[this.currentAttackActionHead];
            if (this._currentAttackAction.dontUse) this._currentAttackAction = undefined;
        } else {
            this._currentAttackAction = undefined;
        }

        this.currentAttackActionHead++;
    }
}