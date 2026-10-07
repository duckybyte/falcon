import Player from "@constants/Player";
import Angle from "@core/mod/combat/placing/Angle";
import Grader from "@core/mod/combat/placing/grader-modules/Grader";
import getAngleDist from "@utils/angle/getAngleDist";

export default class TrapGrader extends Grader {
    private get spikesNearMap() { return this.internalCache.enemies.spikesNearMap; }
    private get distanceSqMap() { return this.internalCache.enemies.distanceSqMap; }
    private get directionMap() { return this.internalCache.enemies.directionMap; }

    private readonly CLOSEST_OBJ_DISTANCE_SQ = 20 * 20;
    private readonly TRAP_SCALE_SQ = 49 * 49;

    private factorTrapHit(trap: Angle, enemy: Player) {
        const distance = this.distanceSqMap.get(enemy.sid)!;

        if (distance < this.TRAP_SCALE_SQ) {
            trap.grade++;
        }

        if (distance < this.CLOSEST_OBJ_DISTANCE_SQ) trap.grade += .5;
        if (distance <= enemy.placePotential.range + trap.scale) {
            if (this.internalCache.canAbuse) trap.grade++;
            else trap.grade += .5;
        }
    }

    grade(trap: Angle, enemy: Player) {
        if (!trap.preplace) {
            const spikesNear = this.spikesNearMap.get(enemy.sid)!;
            trap.grade += spikesNear;
        }

        if (!trap.preplace) {
            const direction = this.directionMap.get(enemy.sid)!;
            trap.grade += (Math.PI - getAngleDist(trap.angle, direction)) / (Math.PI * 2);
        }

        if (!enemy.trap || !enemy.trap.active || enemy.trap.isGhost || (trap.preplace && enemy.trap.willBreak)) {
            trap.grade += .5;
            if (enemy.wasTrapped) trap.grade += .5;
        }

        this.factorTrapHit(trap, enemy);
    }
}