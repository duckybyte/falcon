import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import Vec2 from "@mod-types/geometry/Vec2";
import { Point } from "@mod-types/index";
import { Input } from "@ui/Hook";
import getDir from "@utils/angle/getDir";
import getDist from "@utils/geometry/getDist";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";
import Pathfinder from "../../../../services/pathfinding/Pathfinder";

export default class AutoPusher {
    static moveDir: number | null = 0;
    static autoPushing = false;
    static theSpike: GameObject | undefined;

    static readonly AUTO_PUSH_DISTANCE = 70;

    static visuals = {
        target: { x: 0, y: 0 }
    };

    private static readonly VECTOR_POWER = 170;
    private static readonly DISTANCE_TO_MAINTAIN = 70;

    private static commit(playerPos: Point, target: Point) {
        this.moveDir = getDir(target, playerPos);
    }

    private static commitDir(dir: number | null) {
        this.moveDir = dir;
    }

    private static resetState() {
        if (!this.autoPushing && !this.findingPath) {
            this.currentPath.length = 0;
        }

        if (!this.autoPushing) {
            this.stopTicks = 0;
        }

        this.findingPath = false;
        this.theSpike = undefined;
        this.autoPushing = false;
    }

    private static shouldExecute() {
        const nearestEnemy = ModManager.enemyData.nearest;

        if (!Menu.getValue("autoPush")) return null;
        if (!nearestEnemy || !nearestEnemy.trap) return null;
        if (Input.keys["ShiftLeft"]) return null;

        const playerPos = Client.player.real_position;
        const enemyPos = nearestEnemy.real_position;
        const range = parseInt(Menu.getValue("autoPushRange"));

        if (!withinDist(enemyPos, playerPos, range) && !this.currentPath.length) return null;
        return { playerPos, enemyPos, enemyTrap: nearestEnemy.trap, nearestEnemy };
    }

    private static calculatePushVector(playerPos: Point, enemyPos: Point, enemyTrap: GameObject, nearestEnemy: Player) {
        const directDir = getDir(enemyPos, playerPos);

        const pushVector = new Vec2(Math.cos(directDir), Math.sin(directDir));
        const enemyToCenterVector = new Vec2(enemyTrap.x - enemyPos.x, enemyTrap.y - enemyPos.y);
        const allSpikes = ObjectManager.pool.allSpikes;

        let maxWeight = -Infinity;
        let closestSpike: GameObject | undefined;
        let closestDistance = Infinity;
        let target: GameObject | undefined;

        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObject = allSpikes[i];
            const distanceSq = getDistSq(enemyPos, gameObject);

            if (Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1)) continue;
            if (distanceSq >= closestDistance) continue;

            closestDistance = distanceSq;
            target = gameObject;
        }

        if (!target) return null;

        for (let i = 0, len = allSpikes.length + 1; i < len; i++) {
            // closestTarget should always be processed first
            const gameObject: GameObject = (i === 0 ? target : allSpikes[i - 1]);
            const distance = getDist(enemyTrap, gameObject);
            const radius = this.AUTO_PUSH_DISTANCE + gameObject.getScale();

            if (i > 0 && target === gameObject) continue;
            const isDangerousToEnemy = !Client.isTeam(nearestEnemy, gameObject.ownerSID ?? -1);

            if (isDangerousToEnemy && distance <= radius) {
                const tmpDir = getDir(gameObject, enemyPos);
                const spikeDirVec = new Vec2(Math.cos(tmpDir), Math.sin(tmpDir));
                const alignment = spikeDirVec.dot(pushVector);

                if (alignment > -0.1 || !closestSpike) {
                    const weight = this.VECTOR_POWER - distance + gameObject.scale;

                    if (weight > maxWeight) {
                        maxWeight = weight;
                        closestSpike = gameObject;
                    }

                    pushVector.add(
                        spikeDirVec.x * weight,
                        spikeDirVec.y * weight
                    );
                }

                const trapAlign = pushVector.dot(enemyToCenterVector);
                if (trapAlign > 0) {
                    pushVector.add(enemyToCenterVector.x * 2, enemyToCenterVector.y * 2);
                }
            }
        }

        const minPushMagSq = 5 * 5;
        if (!closestSpike || pushVector.magSq() < minPushMagSq) return null;

        return { closestSpike, pushVector };
    }

    private static calculateMoveTarget(enemyPos: Point, pushVector: Vec2, closestSpike: GameObject) {
        const totalScale = 35 + closestSpike.scale;
        const distanceFromSpike = getDist(closestSpike, enemyPos) - totalScale;

        const pushAngle = Math.atan2(pushVector.y, pushVector.x);
        const impactDist = 70 - Math.max(10, distanceFromSpike);

        const target: Point = {
            x: enemyPos.x - Math.cos(pushAngle) * impactDist,
            y: enemyPos.y - Math.sin(pushAngle) * impactDist
        };

        return target;
    }

    private static stopTicks = 0;

    private static shouldStop(playerPos: Point, enemyPos: Point, closestSpike: GameObject) {
        const nearestEnemy = ModManager.enemyData.nearest!;
        const enemyNext = nearestEnemy.real_position;
        const activityList = ModManager.activityList;

        const realScale = 35 + closestSpike.getScale();
        const totalScale = 35.7 + closestSpike.getScale();
        const distanceFromSpike = getDist(closestSpike, enemyPos) - totalScale;

        if (withinDist(enemyPos, playerPos, 95) && (withinDist(enemyNext, closestSpike, realScale) || distanceFromSpike <= 0)) {
            if (this.stopTicks > 0 && !nearestEnemy.damages.some(dmg => dmg === closestSpike.dmg * .75 || dmg === closestSpike.dmg)) {
                return false;
            }

            this.stopTicks++;
            this.commitDir(null);
            activityList.push("autoPushStop");
            return true;
        }

        return false;
    }

    private static refineTarget(playerPos: Point, enemyPos: Point, pushVector: Vec2, target: Point) {
        const moveVector = new Vec2(target.x - playerPos.x, target.y - playerPos.y);
        const moveAlignment = moveVector.dot(pushVector);

        if (moveAlignment < 0) {
            const angleFromEnemyToPlayer = getDir(playerPos, enemyPos);
            const distanceToMaintain = this.DISTANCE_TO_MAINTAIN;
            const pushDir = pushVector.normalize();

            let bestAlignment = moveAlignment;

            for (let i = -1; i <= 1; i += 2) {
                const angle = angleFromEnemyToPlayer + Math.PI / 2 * i;
                const tmp = {
                    x: enemyPos.x + Math.cos(angle) * distanceToMaintain,
                    y: enemyPos.y + Math.sin(angle) * distanceToMaintain
                };

                const testMoveDir = new Vec2(target.x - tmp.x, target.y - tmp.y).normalize();
                const moveAlignment = testMoveDir.dot(pushDir);

                if (moveAlignment > bestAlignment) {
                    target.x = tmp.x;
                    target.y = tmp.y;
                    bestAlignment = moveAlignment;
                }
            }
        }
    }

    static currentPath: Point[] = [];
    private static findingPath = false;

    private static async pathfind(start: Point, goal: Point): Promise<void> {
        const activityList = ModManager.activityList;

        if (!this.currentPath.length) {
            this.findingPath = true;
            activityList.push("calculatingPath");
            const path = await Pathfinder.find(start, goal);

            if (path) {
                this.currentPath = path;

                if (path.length === 0) {
                    this.autoPushing = false;
                    this.theSpike = undefined;
                }
            } else {
                this.autoPushing = false;
                this.theSpike = undefined;
            }

            return;
        }

        const path = this.currentPath;

        if (!withinDist(path[path.length - 1], goal, 35)) {
            this.currentPath.length = 0;
            return this.pathfind(start, goal);
        }

        let closestNode: Point | undefined;
        let closestNodeIndex = -1;
        let closestDistanceSq = Infinity;

        for (let i = 0, len = path.length; i < len; i++) {
            const node = path[i];
            const distanceSq = getDistSq(start, node);

            if (distanceSq < closestDistanceSq) {
                closestNode = node;
                closestNodeIndex = i;
                closestDistanceSq = distanceSq;
            }
        }

        if (!closestNode) return;

        const targetNode = path[closestNodeIndex + 1] ?? closestNode;

        activityList.push("pathfindingAutoPush");
        this.commit(start, targetNode);
    }

    static main() {
        this.resetState();

        const ctx = this.shouldExecute();
        const activityList = ModManager.activityList;
        if (!ctx) return;

        const { playerPos, enemyPos, enemyTrap, nearestEnemy } = ctx;

        const result = this.calculatePushVector(playerPos, enemyPos, enemyTrap, nearestEnemy);
        if (!result) return;

        const { pushVector, closestSpike } = result;
        const target = this.calculateMoveTarget(enemyPos, pushVector, closestSpike);

        this.visuals.target.x = target.x;
        this.visuals.target.y = target.y;

        if (this.shouldStop(playerPos, enemyPos, closestSpike)) {
            this.theSpike = closestSpike;
            this.autoPushing = true;
            return;
        }

        if (!withinDist(enemyPos, playerPos, 110)) {
            this.pathfind(playerPos, target);

            if (activityList[activityList.length - 1] === "pathfindingAutoPush") {
                this.theSpike = closestSpike;
                this.autoPushing = true;
            }

            return;
        }

        this.theSpike = closestSpike;
        this.autoPushing = true;

        activityList.push("autoPush");
        this.refineTarget(playerPos, enemyPos, pushVector, target);
        this.commit(playerPos, target);
    }
}