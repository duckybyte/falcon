import CombatUtils from "@combat-utils/CombatUtils";
import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import Angle from "@core/mod/combat/placing/Angle";
import Grader from "@core/mod/combat/placing/grader-modules/Grader";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import MovementPhysicsSimulator, { DamageSimAction, KnockbackSimAction, PlacementSimAction, SimulationOptions } from "@core/mod/simulation/MovementPhysicsSimulator";
import getAngleDist from "@utils/angle/getAngleDist";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";

type GraderSimActions = [
    [PlacementSimAction, DamageSimAction, KnockbackSimAction],
    [KnockbackSimAction]
];

export default class SpikeGrader extends Grader {
    private get trapsNearMap() { return this.internalCache.enemies.trapsNearMap; }
    private get spikesNearMap() { return this.internalCache.enemies.spikesNearMap; }
    private get distanceSqMap() { return this.internalCache.enemies.distanceSqMap; }
    private get directionMap() { return this.internalCache.enemies.directionMap; }

    private factorBlockedMovement(spike: Angle, enemy: Player) {
        const player = Client.player;
        const moveDir = MovementManager.getMoveDir(true);
        if (typeof moveDir !== "number") return;

        const projection = MovementManager.project(player, moveDir);
        const spikesNear = this.trapsNearMap.get(enemy.sid)!;
        const isEnemyInTrap = enemy.trap && enemy.trap.active && !enemy.trap.isGhost && (!spike.preplace || !enemy.trap.willBreak);

        if (!withinDist(projection, spike, spike.scale + 35)) return;
        spike.grade -= spikesNear > 0 && isEnemyInTrap ? 4 : 2.5;
    }

    private simulationActions: GraderSimActions = [
        [{
            type: "place",
            placementData: {
                pos: { x: 0, y: 0 },
                id: 9,
                ownerSID: -9999
            }
        }, {
            dontUse: true,
            type: "damage",
            damage: -1
        }, {
            dontUse: true,
            type: "knockback",
            pos: { x: 0, y: 0 },
            knockPower: 67.69
        }],
        [{
            dontUse: true,
            type: "knockback",
            pos: { x: 0, y: 0 },
            knockPower: 67.69
        }]
    ];

    private simulationOptions = new SimulationOptions();

    private factorSpikeBounce(spike: Angle, player: Player, enemy: Player) {
        const actions = this.simulationActions;
        const firstActions = actions[0];
        const secondActions = actions[1];

        const placementAction = firstActions[0];
        const damageAction = firstActions[1];
        const sameTickKbAction = firstActions[2];
        const nextTickKbAction = secondActions[0];

        const simulationObjects = ObjectManager.pool.simObjects;
        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(enemy.sid)!;
        const isEnemyInTrap = enemy.trap && enemy.trap.active && !enemy.trap.isGhost && (!spike.preplace || !enemy.trap.willBreak);

        placementAction.placementData.pos.x = spike.x;
        placementAction.placementData.pos.y = spike.y;
        placementAction.placementData.id = spike.id;
        placementAction.placementData.ownerSID = Client.mySID;
        const isAttackPrimary = CombatUtils.isAttackPrimary(player.weapons[0]);

        if (spike.spikeTick) {
            const primary = PlayerCombatManager.fetch(player, 0);
            damageAction.damage = CombatUtils.getMonkeyDamage(primary.dmg * 1.5);

            if (myPositionalSpot < enemyPositionalSpot) {
                sameTickKbAction.dontUse = false;
                nextTickKbAction.dontUse = true;
            } else {
                sameTickKbAction.dontUse = true;
                nextTickKbAction.dontUse = false;
            }

            sameTickKbAction.pos = player.real_position;
            nextTickKbAction.pos = player.real_position;
            sameTickKbAction.knockPower = primary.totalKnock;
            nextTickKbAction.knockPower = primary.totalKnock;
        } else {
            damageAction.dontUse = true;
            sameTickKbAction.dontUse = true;
            nextTickKbAction.dontUse = true;
        }

        this.simulationOptions.ignoreObject(spike.preplace ? enemy.trap?.sid ?? -1 : -1);

        const simResult = MovementPhysicsSimulator.simulate(
            enemy.getSimulationState(),
            actions,
            spike.spikeTick ? 2 : 1, this.simulationOptions
        );

        if (simResult.teleported) {
            spike.dontUse = true;
            return;
        }

        if (simResult.pitTrapped || simResult.oneTicked) {
            spike.grade += 3;
            spike.kill.add(enemy.sid);
            if (isAttackPrimary && spike.spikeTick) spike.grade += 2.5;
        }

        if (simResult.totalDamage > 133) {
            spike.grade += .25;
        }

        if (simResult.spikesHit > 1) {
            spike.grade += (simResult.spikesHit - 1) * .5;

            if (simResult.spikesHit > 2) {
                spike.grade += .5;

                if (isAttackPrimary) {
                    spike.kill.add(enemy.sid);
                    if (spike.spikeTick) spike.grade += 2;
                }
            }
        }

        if (simResult.trapped && !isEnemyInTrap) {
            const trap = simResult.trap!;
            const goldHammerDamage = 7.5 * 3.3 * 10 * 1.1;
            spike.grade += 1.5;

            for (let i = 0; i < simulationObjects.length; i++) {
                const obj = simulationObjects[i];
                if (!obj) continue;
                if (obj.sid === trap.sid) continue;
                if (!obj.active) continue;
                if (!withinDist(trap, obj, AutoPusher.AUTO_PUSH_DISTANCE + obj.scale)) continue;

                const ownerSID = obj.ownerSID ?? -1;
                const isEnemy = !Client.isTeam(enemy, ownerSID);
                const isCactus = obj.type === 1 && obj.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
                const isSpike = isEnemy && obj.dmg;
                const isTrap = isEnemy && obj.trap;

                if ((isTrap || isSpike) && obj.health <= goldHammerDamage) continue;

                if (isSpike || isCactus) spike.grade += .5;
                if (isTrap) spike.grade += .25;
                if (obj.teleport) spike.grade -= 1;
            }

            if (!player.trap || (player.trap.active && player.trap.willBreak)) {
                spike.grade += .5;
            } else {
                spike.grade--;
            }
        }

        const isImportant = spike.kill.size > 0 || spike.pitSpike.size > 0;
        if (!isAttackPrimary && !isImportant) {
            spike.spikeTick = false;
            spike.appleInsta = false;
        }
    }

    private factorSpikeHit(spike: Angle, enemy: Player) {
        const distanceSq = this.distanceSqMap.get(enemy.sid)!;
        const placeReach = enemy.placePotential.range + spike.scale;
        const placeReachSq = placeReach * placeReach;

        if (this.internalCache.canAbuse && distanceSq <= placeReachSq) {
            spike.grade++;
        }

        const closeDistSq = 150 * 150;
        const isEnemyInTrap = enemy.trap && enemy.trap.active && !enemy.trap.isGhost && (!spike.preplace || !enemy.trap.willBreak);

        if (isEnemyInTrap && distanceSq <= closeDistSq)
            spike.grade += .5;

        const hitScale = spike.scale + 34.5;
        if (distanceSq >= hitScale * hitScale) return;
        if (enemy.clowned) spike.grade += .25;

        if (spike.replace || spike.preplace) {
            AttackManager.spikeTicker.process(spike, enemy);
            AttackManager.appleInstakiller.process(spike, enemy);
        }

        if (isEnemyInTrap) {
            spike.pitSpike.add(enemy.sid);
            spike.grade += 2;
            spike.appleInsta = false;
            spike.spikeTick = false;
            return;
        }

        this.factorSpikeBounce(spike, Client.player, enemy);
    }

    private factorNearTrap(spike: Angle, enemySid: number, trap: GameObject | undefined) {
        if (!trap || spike.preplace) return;

        const distanceSq = getDistSq(trap, spike);
        const radius = 85 + spike.scale;
        const radiusSq = radius * radius;

        const preferedRadius = AutoPusher.AUTO_PUSH_DISTANCE + spike.scale;
        const preferedRadiusSq = preferedRadius * preferedRadius;
        if (distanceSq > radiusSq) return;

        const spikesNear = this.spikesNearMap.get(enemySid)!;
        if (!spikesNear) spike.spikePush.add(enemySid);

        spike.grade += !spikesNear ? .5 : .25;
        if (distanceSq <= preferedRadiusSq) spike.grade += spikesNear ? 1.5 : .75;
    }

    grade(spike: Angle, enemy: Player) {
        this.factorBlockedMovement(spike, enemy);

        const trapsNear = this.trapsNearMap.get(enemy.sid)!;
        if (trapsNear) spike.grade += .5;
        spike.grade += trapsNear;

        if (!spike.preplace) {
            const direction = this.directionMap.get(enemy.sid)!;
            spike.grade += (Math.PI - getAngleDist(spike.angle, direction)) / (Math.PI * 2);
        }

        this.factorNearTrap(spike, enemy.sid, enemy.trap);
        if (!enemy.trap) this.factorNearTrap(spike, enemy.sid, enemy.potentialTrap);
        this.factorSpikeHit(spike, enemy);
    }
}