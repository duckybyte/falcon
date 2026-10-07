import EntityHandler from "@constants/EntityHandler";
import GameObject from "@constants/GameObject";
import { LIST_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import ObjectPool from "@core/logic/ObjectPool";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import ScriptConfig from "@utils/config/ScriptConfig";
import withinDist from "@utils/geometry/withinDist";

export const gameObjects = new EntityHandler<GameObject>();

const riverWidth = 724;

export default class ObjectManager {
    private static readonly riverMinY = (ScriptConfig.MAP_SIZE / 2) - (riverWidth / 2);
    private static readonly riverMaxY = (ScriptConfig.MAP_SIZE / 2) + (riverWidth / 2);

    static pool = new ObjectPool();
    static allTurrets = new EntityHandler<GameObject>(1);

    private static gridMap: Map<number, GameObject[]> = new Map();
    private static chunkSize = 1440;

    static add(sid: number, x: number, y: number, dir: number, scale: number, type: number, id: number, setSID: boolean, owner?: number) {
        const gameObject = new GameObject(x, y, dir, scale, type, id, owner);
        if (setSID) gameObject.sid = sid;

        gameObjects.add(gameObject);
        if (gameObject.id === LIST_ID_MAP.TURRET) this.allTurrets.add(gameObject);
        PotentialObjectManager.update(x, y, scale);

        if (owner !== undefined) {
            const player = PlayerManager.get(owner);
            if (player) player.spikeId = id;
        }

        if (AutoPusher.currentPath.length && !gameObject.ignoreCollision) {
            const path = AutoPusher.currentPath;

            for (let i = 0, len = path.length; i < len; i++) {
                const node = path[i];

                if (withinDist(node, gameObject, 35 + gameObject.scale)) {
                    path.length = 0;
                    break;
                }
            }
        }

        const key = this.getKey(x, y);
        if (!this.gridMap.has(key)) this.gridMap.set(key, []);
        this.gridMap.get(key)!.push(gameObject);
    }

    static getObject(sid: number) {
        return gameObjects.get(sid);
    }

    private static getKey(x: number, y: number) {
        const cx = (x / this.chunkSize) | 0;
        const cy = (y / this.chunkSize) | 0;

        return (cx << 16) | (cy & 0xFFFF);
    }

    static getObjectsByBounds(minX: number, minY: number, maxX: number, maxY: number, targetArray: GameObject[] = []): GameObject[] {
        const minChunkX = (minX / this.chunkSize) | 0;
        const maxChunkX = (maxX / this.chunkSize) | 0;
        const minChunkY = (minY / this.chunkSize) | 0;
        const maxChunkY = (maxY / this.chunkSize) | 0;

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                const searchKey = (cx << 16) | (cy & 0xFFFF);
                const objects = this.gridMap.get(searchKey);

                if (objects && objects.length) {
                    for (let i = 0, len = objects.length; i < len; i++) {
                        targetArray.push(objects[i]);
                    }
                }
            }
        }

        return targetArray;
    }

    static getObjects(x: number, y: number, targetArray: GameObject[] = [], chunkStart: number = -1, chunkEnd: number = 1) {
        const chunkX = (x / this.chunkSize) | 0;
        const chunkY = (y / this.chunkSize) | 0;

        for (let dx = chunkStart; dx <= chunkEnd; dx++) {
            for (let dy = chunkStart; dy <= chunkEnd; dy++) {
                const searchKey = ((chunkX + dx) << 16) | ((chunkY + dy) & 0xFFFF);
                const objects = this.gridMap.get(searchKey);

                if (objects && objects.length) {
                    for (let i = 0, len = objects.length; i < len; i++) {
                        targetArray.push(objects[i]);
                    }
                }
            }
        }

        return targetArray;
    }

    private static removeObjectFromChunks(gameObject: GameObject | undefined) {
        if (!gameObject) return;

        const key = this.getKey(gameObject.x, gameObject.y);
        const objects = this.gridMap.get(key);

        if (objects) {
            const index = objects.indexOf(gameObject);

            if (index >= 0) {
                objects[index] = objects[objects.length - 1];
                objects.pop();
            }
        }
    }

    static checkItem(x: number, y: number, scale: number, id: number) {
        const gameObjects = this.pool.closeObjects;
        const pos = { x, y };

        for (const gameObject of gameObjects) {
            if (!gameObject || !gameObject.active) continue;

            const blockS = gameObject.blocker ? gameObject.blocker : gameObject.getScale(.6, gameObject.isItem);
            const combinedScale = scale + blockS;

            if (withinDist(pos, gameObject, combinedScale)) {
                return false;
            }
        }

        if (id != 18 && y >= this.riverMinY && y <= this.riverMaxY) {
            return false;
        }

        return true;
    }

    static remove(sid: number) {
        const gameObject = gameObjects.get(sid);

        if (gameObject) {
            const playerTrap = Client.player.trap;
            gameObject.active = false;
            gameObjects.remove(sid);

            if (gameObject.id === LIST_ID_MAP.TURRET)
                this.allTurrets.remove(sid);

            if (playerTrap && gameObject.dmg && !Client.isFriendly(gameObject.ownerSID ?? -1) && withinDist(gameObject, playerTrap, 75 + gameObject.scale)) {
                DefenseSystem.trapHitState = 0;
                DefenseSystem.preHitChances = 0;
            }

            if (gameObject === playerTrap) {
                const nearby = ModManager.enemyData.nearby;
                DefenseSystem.trapHitState = 0;
                DefenseSystem.preHitChances = 0;

                for (let i = 0, len = nearby.length; i < len; i++) {
                    const enemy = nearby[i];
                    enemy.profilingData.randomHitAttacks = 0;
                }
            }

            if (Menu.getValue("autoPlacing") && Menu.getValue("replacer") && ModManager.enemyData.nearest) {
                const placementRange = parseInt(Menu.getValue("autoPlaceRange"));
                const nearestEnemy = ModManager.enemyData.nearest;
                const player = Client.player;

                const playerPos = player.real_position;
                const enemyPos = nearestEnemy.real_position;

                if (withinDist(gameObject, playerPos, 200) && withinDist(enemyPos, playerPos, placementRange) && player.items[4] === LIST_ID_MAP.PIT_TRAP) {
                    PlacementSystem.AutoReplacer.execute(player, gameObject);
                }
            }
        }

        this.removeObjectFromChunks(gameObject);
    }

    static removeAll(ownerSID?: number) {
        if (typeof ownerSID !== "number") {
            this.gridMap.clear();
            gameObjects.removeAll();
            return;
        }

        const allObjects = gameObjects.all;
        const allTurrets = this.allTurrets;

        for (let i = allObjects.length - 1; i >= 0; i--) {
            const obj = allObjects[i];

            if (obj && obj.ownerSID === ownerSID) {
                this.removeObjectFromChunks(obj);
                gameObjects.remove(obj.sid);

                if (obj.id === LIST_ID_MAP.TURRET)
                    allTurrets.remove(obj.sid);
            }
        }
    }
}