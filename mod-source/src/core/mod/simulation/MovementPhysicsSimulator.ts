import GameObject from "@constants/GameObject";
import items from "@constants/items";
import Player from "@constants/Player";
import { accessoryMap, hatMap, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import { Point } from "@mod-types/index";
import { GameObjectSimulationState, PlayerSimulationState } from "@simulation/SimulationStates";
import getDirComp from "@utils/angle/getDirComp";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import getMag from "@utils/geometry/getMag";
import getMagSq from "@utils/geometry/getMagSq";

interface BaseSimAction {
    dontUse?: boolean;
}

export interface PlacementSimAction extends BaseSimAction {
    type: "place";
    placementData: {
        id: number;
        pos: Point;
        ownerSID: number;
    };
}

export interface KnockbackSimAction extends BaseSimAction {
    type: "knockback";
    damage?: number;
    pos: Point;
    knockPower: number;
}

export interface DamageSimAction extends BaseSimAction {
    type: "damage";
    damage: number;
}

export type SimulationAction = DamageSimAction | KnockbackSimAction | PlacementSimAction;

export interface SimulationResult {
    spikesHit: number;
    gameObjectsHit: Set<number>;
    oneTicked: boolean;
    pos: Point;
    trapped: boolean;
    trap: Readonly<GameObjectSimulationState> | undefined;
    pitTrapped: boolean;
    teleported: boolean;
    totalDamage: number;
}

export class SimulationOptions {
    clearVelocity = false;
    ignoreObjectSID = -1;
    gatherRawDamage = false;

    private static optionsBufferHead = 0;
    private static optionsBuffer: SimulationOptions[] = [
        this.create(), this.create(), this.create(),
        this.create(), this.create(), this.create(),
        this.create(), this.create()
    ];

    static get() {
        const options = this.optionsBuffer[this.optionsBufferHead];
        this.optionsBufferHead = (this.optionsBufferHead + 1) % this.optionsBuffer.length;

        options.clearVelocity = false;
        options.ignoreObjectSID = -1;
        options.gatherRawDamage = false;
        return options;
    }

    private static create() {
        return new SimulationOptions();
    }

    ignoreObject(sid: number) {
        this.ignoreObjectSID = sid;
        return this;
    }

    toggleGatherRawDamage() {
        this.gatherRawDamage = true;
        return this;
    }
}

export default class MovementPhysicsSimulator {
    static readonly PLAYER_DECELERATION = Math.pow(0.993, ScriptConfig.SERVER_UPDATE_SPEED);
    private static internalTmpObjects: Readonly<GameObjectSimulationState>[] = [];

    private static collisionMap: number[] = [];
    private static collisionMarker = 1;

    private static markCollision(sid: number) {
        this.collisionMap[sid] = this.collisionMarker;
    }

    private static hasAlreadyCollided(sid: number) {
        return this.collisionMap[sid] == this.collisionMarker;
    }

    private static clearCollisionMap() {
        this.collisionMarker++;
    }

    private static getGameObjects(): Readonly<GameObjectSimulationState>[] {
        return ObjectManager.pool.simObjects;
    }

    // only really need five, since result objects are super short-term and not used 5+ times (if it is we have worse problems than buffer overflow)
    private static resultBufferHead = 0;
    private static resultBuffer: SimulationResult[] = [
        this.createEmptyResult(),
        this.createEmptyResult(),
        this.createEmptyResult(),
        this.createEmptyResult(),
        this.createEmptyResult()
    ];

    private static getEmptyResult() {
        const head = this.resultBufferHead;
        this.resultBufferHead = (this.resultBufferHead + 1) % this.resultBuffer.length;

        const res = this.resultBuffer[head];
        res.spikesHit = 0;
        res.trap = undefined;
        res.gameObjectsHit.clear();
        res.oneTicked = false;
        res.pos.x = res.pos.y = 0;
        res.trapped = false;
        res.pitTrapped = false;
        res.teleported = false;
        res.totalDamage = 0;

        return this.resultBuffer[head];
    }

    private static createEmptyResult(): SimulationResult {
        const pos = { x: 0, y: 0 };
        return { spikesHit: 0, trap: undefined, gameObjectsHit: new Set(), oneTicked: false, pos, trapped: false, pitTrapped: false, teleported: false, totalDamage: 0 };
    }

    private static resolveSimulationAction(victim: PlayerSimulationState, actions: SimulationAction[][], actionsIndex: number, res: SimulationResult, options: SimulationOptions) {
        const actionsQueue = actions[actionsIndex];
        if (!actionsQueue) return;

        for (let i = 0, len = actionsQueue.length; i < len; i++) {
            const action = actionsQueue[i];
            if (action.dontUse) continue;

            if (action.type === "knockback") {
                const pos = action.pos;
                const knock = action.knockPower;
                const dir = getDirComp(victim, pos);

                victim.velX += dir.x * knock;
                victim.velY += dir.y * knock;

                if (action.damage)
                    this.damageVictim(victim, action.damage, res, options);
            } else if (action.type === "place") {
                const data = action.placementData!;
                const item = items.list[data.id];
                const gameObject = new GameObject(data.pos.x, data.pos.y, 0, item.scale, item.type!, data.id, data.ownerSID);
                this.internalTmpObjects.push(gameObject.getSimulationState());
            } else if (action.type === "damage") {
                this.damageVictim(victim, action.damage, res, options);
            }
        }
    }

    private static damageVictim(victim: PlayerSimulationState, amt: number, res: SimulationResult, options: SimulationOptions) {
        const dmg = amt * (victim.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET ? .75 : 1);
        victim.health -= dmg;
        res.totalDamage += (options.gatherRawDamage ? amt : dmg);
    }

    private static postTick(victim: PlayerSimulationState) {
        if (victim.velX) {
            victim.velX *= MovementPhysicsSimulator.PLAYER_DECELERATION;
            if (Math.abs(victim.velX) <= 0.01) victim.velX = 0;
        }

        if (victim.velY) {
            victim.velY *= MovementPhysicsSimulator.PLAYER_DECELERATION;
            if (Math.abs(victim.velY) <= 0.01) victim.velY = 0;
        }

        const scale = victim.scale;
        const MAP_SIZE = ScriptConfig.MAP_SIZE;

        if (victim.x - scale < 0) {
            victim.x = scale;
        } else if (victim.x + scale > MAP_SIZE) {
            victim.x = MAP_SIZE - scale;
        }

        if (victim.y - scale < 0) {
            victim.y = scale;
        } else if (victim.y + scale > MAP_SIZE) {
            victim.y = MAP_SIZE - scale;
        }
    }

    private static handleCollision(victim: PlayerSimulationState, gameObject: Readonly<GameObjectSimulationState>, tMlt: number, result: SimulationResult, options: SimulationOptions) {
        const ownerSID = gameObject.ownerSID ?? -1;
        const isEnemy = !Client.isTeam(victim, ownerSID);
        const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;

        const isDangerous = isCactus || (gameObject.dmg && isEnemy);
        const isMe = victim.sid === Client.mySID;
        const isMeAndEnemySpike = isMe && isDangerous;

        const scalePadding = isMeAndEnemySpike ? 1 : !isMe && (gameObject.trap || isDangerous) ? .5 : 0;
        const totalScale = victim.scale + gameObject.scale;
        const totalEffectiveScale = totalScale + scalePadding

        const totalEffectiveScaleSq = totalEffectiveScale * totalEffectiveScale;
        const distSq = getDistSq(gameObject, victim);
        const dir = getDirComp(victim, gameObject);
        const hasAlreadyCollided = this.hasAlreadyCollided(gameObject.sid);

        if (distSq > totalEffectiveScaleSq) return;

        if (!gameObject.ignoreCollision) {
            victim.x = gameObject.x + (totalScale * dir.x);
            victim.y = gameObject.y + (totalScale * dir.y);
            victim.velX *= 0.75;
            victim.velY *= 0.75;

            const isDamageSpike = (isEnemy && gameObject.dmg) || isCactus;
            if (!hasAlreadyCollided && isDamageSpike) {
                const tmpSpd = 1.5;

                this.damageVictim(victim, gameObject.dmg || 35, result, options);
                victim.velX += tmpSpd * dir.x;
                victim.velY += tmpSpd * dir.y;
                victim.spikeDamages += gameObject.dmg || 35;
                result.spikesHit++;
                result.gameObjectsHit.add(gameObject.sid);
            }
        } else if (isEnemy && gameObject.trap) {
            victim.lockMove = true;
            result.trapped = true;
            result.trap = gameObject;
        } else if (gameObject.teleport) {
            result.teleported = true;
        } else if (gameObject.boostSpeed) {
            const mag = tMlt * gameObject.boostSpeed;
            victim.velX += mag * Math.cos(gameObject.dir);
            victim.velY += mag * Math.sin(gameObject.dir);
        }

        this.markCollision(gameObject.sid);
    }

    private static handleMovement(victim: PlayerSimulationState, moveDir: number | null, dt: number, currentSpikeHits: number, result: SimulationResult) {
        if (victim.slowMult < 1) {
            victim.slowMult += 0.0888;
            if (victim.slowMult > 1) victim.slowMult = 1;
        }

        if (victim.lockMove) {
            victim.velX = 0;
            victim.velY = 0;
            if (currentSpikeHits !== result.spikesHit) result.pitTrapped = true;
            return;
        }

        result.trapped = false;
        result.pitTrapped = false;
        result.trap = undefined;

        const wpn = items.weapons[victim.weaponIndex];
        const skin = hatMap.get(victim.skinIndex)!;
        const tail = accessoryMap.get(victim.tailIndex)!;

        const halfRiverWidth = 362;
        const mapScaleHalf = ScriptConfig.MAP_SIZE / 2;

        const isOnRiver = victim.y >= mapScaleHalf - halfRiverWidth && victim.y <= mapScaleHalf + halfRiverWidth;
        let spdMult = (victim.buildIndex >= 0 ? .5 : 1) * (wpn?.spdMult || 1) * (skin?.spdMult ?? 1) * (tail?.spdMult ?? 1) * victim.slowMult;

        if (isOnRiver) {
            const waterCurrent = .0011;

            if (skin && skin.watrImm) {
                spdMult *= 0.75;
                victim.velX += waterCurrent * 0.4 * dt;
            } else {
                spdMult *= 0.33;
                victim.velX += waterCurrent * dt;
            }
        }

        if (typeof moveDir !== "number") return;
        const isInSnow = victim.y <= ScriptConfig.SNOW_BIOME_TOP;
        const snowMult = (isInSnow ? (skin?.coldM ?? .75) : 1);
        const spdMag = ScriptConfig.PLAYER_SPEED * spdMult * snowMult * dt;

        const xVel = Math.cos(moveDir);
        const yVel = Math.sin(moveDir);

        victim.velX += xVel * spdMag;
        victim.velY += yVel * spdMag;
    }

    private static checkPlayerCollision(victim: PlayerSimulationState, other: Player) {
        const dx = victim.x - other.real_position.x;
        const dy = victim.y - other.real_position.y;
        const tmpLen = 70;

        if (victim.sid === Client.mySID) return;
        if (Math.abs(dx) > tmpLen || Math.abs(dy) > tmpLen) return;

        const distSq = getMagSq(dx, dy);
        const tmpLenSq = tmpLen * tmpLen;
        if (distSq >= tmpLenSq || distSq === 0) return;

        const dist = Math.sqrt(distSq);
        const factor = 0.5 * (tmpLen / dist - 1);
        victim.x += dx * factor;
        victim.y += dy * factor;
    }

    static simTick(
        oldState: PlayerSimulationState,
        moveDir: number | null,
        options: SimulationOptions = SimulationOptions.get()
    ): PlayerSimulationState {
        const result = this.getEmptyResult();
        const dt = ScriptConfig.SERVER_UPDATE_SPEED;
        const newState = Player.copyState(oldState);
        const gameObjects = this.getGameObjects();

        if (options.clearVelocity) {
            newState.velX = 0;
            newState.velY = 0;
        }

        this.handleMovement(newState, moveDir, dt, 0, result);

        const tmpSpeed = getMag(newState.velX * dt, newState.velY * dt);
        const depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
        const tMlt = 1 / depth;
        const totalLength = gameObjects.length;
        newState.lockMove = false;

        for (let i = 0; i < depth; i++) {
            if (newState.velX) newState.x += newState.velX * tMlt * dt;
            if (newState.velY) newState.y += newState.velY * tMlt * dt;

            for (let j = 0; j < totalLength; j++) {
                const item = gameObjects[j];
                if (item.sid === options.ignoreObjectSID || !item.active) continue;
                this.handleCollision(newState, item, tMlt, result, options);
            }
        }

        const index = PlayerStateManager.placementMap.get(newState.sid)! + 1;
        const players = PlayerManager.players.visible.all;
        const playersLength = players.length;

        for (let i = index; i < playersLength; i++) {
            this.checkPlayerCollision(newState, players[i]);
        }

        this.postTick(newState);
        return newState;
    }

    static simulate(
        victim: Player | PlayerSimulationState,
        actions: SimulationAction[][],
        ticks: number = 9, // ONE FULL SECOND (GAME RUNS AT 9HZ)
        options: SimulationOptions = SimulationOptions.get()
    ): Readonly<SimulationResult> {
        const result = this.getEmptyResult();
        if (ticks <= 0) return result;

        const internalTmpObjects = this.internalTmpObjects;
        const gameObjects = this.getGameObjects();
        const gameObjectsLength = gameObjects.length;
        internalTmpObjects.length = 0;

        victim = (victim instanceof Player ? victim.getSimulationState() : victim) as PlayerSimulationState;
        let actionsIndex = 0;
        let currentSpikeHits = 0;
        const dt = ScriptConfig.SERVER_UPDATE_SPEED;

        const index = PlayerStateManager.placementMap.get(victim.sid)! + 1;
        const players = PlayerManager.players.visible.all;
        const playersLength = players.length;

        if (options.clearVelocity) {
            victim.velX = 0;
            victim.velY = 0;
        }

        for (let tick = 0; tick < ticks; tick++) {
            victim.health = victim.maxHealth;
            this.resolveSimulationAction(victim, actions, actionsIndex, result, options);
            result.pitTrapped = false;
            actionsIndex++;

            this.handleMovement(victim, null, dt, currentSpikeHits, result);

            const tmpSpeed = getMag(victim.velX * dt, victim.velY * dt);
            const depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
            const tMlt = 1 / depth;
            const internalTmpObjectsLength = internalTmpObjects.length;

            victim.lockMove = false;
            currentSpikeHits = result.spikesHit;
            this.clearCollisionMap();

            for (let i = 0; i < depth; i++) {
                if (victim.velX) victim.x += victim.velX * tMlt * dt;
                if (victim.velY) victim.y += victim.velY * tMlt * dt;

                for (let j = 0; j < gameObjectsLength; j++) {
                    const item = gameObjects[j];
                    if (item.sid === options.ignoreObjectSID || !item.active) continue;
                    this.handleCollision(victim, item, tMlt, result, options);
                }

                for (let j = 0; j < internalTmpObjectsLength; j++) {
                    const item = internalTmpObjects[j];
                    if (item.sid === options.ignoreObjectSID || !item.active) continue;
                    this.handleCollision(victim, item, tMlt, result, options);
                }
            }

            for (let i = index; i < playersLength; i++) {
                this.checkPlayerCollision(victim, players[i]);
            }

            if (victim.health <= 0 || result.teleported) {
                if (victim.health <= 0) result.oneTicked = true;
                break;
            }

            victim.skinIndex = 6;
            this.postTick(victim);
        }

        result.pos.x = victim.x;
        result.pos.y = victim.y;
        return result;
    }
}