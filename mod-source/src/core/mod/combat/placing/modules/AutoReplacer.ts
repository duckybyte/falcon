import CombatUtils from "@combat-utils/CombatUtils";
import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import AttackManager from "@core/mod/combat/core/AttackManager";
import Angle from "@core/mod/combat/placing/Angle";
import { FinderOptions } from "@core/mod/combat/placing/AngleFinder";
import ModManager from "@core/ModManager";
import PacketTracker from "@core/utils/PacketTracker";
import Placer, { PlacementTypes } from "@placing/utils/Placer";

export interface ReplacementQueue {
    count: number;
    tick: number;
    placements: Replacement[];
}

export class Replacement {
    x: number = -1000000;
    y: number = -1000000;
    id: number = -1000000;
    scale: number = -1000000;
    tick: number = -1000000;
    angle: number = -1000000;

    copyFrom(item: Angle | Replacement) {
        this.x = item.x;
        this.y = item.y;
        this.angle = item.angle;
        this.id = item.id;
        this.tick = ModManager.tick;
    }
}

export default class AutoReplacer extends Placer {
    private replacementFinderOptions: FinderOptions = { grade: true, replace: true };
    private replacementHead = 0;

    replacements: Replacement[] = [
        new Replacement(), new Replacement(),
        new Replacement(), new Replacement()
    ];

    private appendReplacement(item: Angle | Replacement) {
        const replacement = this.replacements[this.replacementHead];
        this.replacementHead = (this.replacementHead + 1) % 4;
        replacement.copyFrom(item);
    }

    private peekAngles: Angle[] = [];

    execute(player: Player, killedObject?: GameObject, peek?: boolean) {
        this.replacementFinderOptions.obj = killedObject;

        const now = performance.now();
        const bestAngles = this.start(player, 4, this.replacementFinderOptions, peek);
        if (!bestAngles.length) return;

        let isSpikeTick = false;
        const totalActions = PacketTracker.request("PLACE", 4);
        let len = Math.min(bestAngles.length, totalActions);

        if (peek) {
            this.peekAngles.length = len;
            for (let i = 0; i < len; i++) {
                this.peekAngles[i] = bestAngles[i];
            }

            return this.peekAngles;
        }

        for (let i = 0; i < len; i++) {
            const item = bestAngles[i];
            if (this.shouldSkip(item)) continue;
            if (item.isSpike && item.spikeTick) isSpikeTick = true;

            this.place(item, PlacementTypes.REPLACE);
            this.appendReplacement(item);
        }

        if (isSpikeTick && CombatUtils.isAttackPrimary(player.weapons[0]))
            AttackManager.spikeTicker.consider = true;

        ModManager.activityList.push("autoReplace");
        const took = performance.now() - now;
        this.update(took.toFixed(2));
    }
}