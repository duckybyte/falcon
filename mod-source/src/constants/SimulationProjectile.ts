import { Entity } from "@constants/Entity";
import GameObject from "@constants/GameObject";
import items from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import lineInRect from "@utils/geometry/lineInRect";

export default class SimulationProjectile implements Entity {
    turretHandlerIndex: number = -1;

    dmg: number;
    scale: number;
    active = true;

    constructor(
        public sid: number,
        public indx: number,
        public x: number, public y: number,
        public dir: number,
        public speed: number,
        public range: number,
        public layer: number,
        public ownerSID: number
    ) {
        const data = items.projectiles[indx];
        this.dmg = data.dmg;
        this.scale = data.scale;
    }

    init(
        indx: number,
        x: number, y: number,
        dir: number,
        speed: number,
        range: number,
        layer: number,
        ownerSID: number
    ) {
        this.indx = indx;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.speed = speed;
        this.range = range;
        this.layer = layer;
        this.ownerSID = ownerSID;
        this.active = true;

        const data = items.projectiles[indx];
        this.dmg = data.dmg;
        this.scale = data.scale;
    }

    listHandlerIndex = -1;

    private handleMovement(dt: number) {
        let tmpSpeed = this.speed * dt;

        this.x += tmpSpeed * Math.cos(this.dir);
        this.y += tmpSpeed * Math.sin(this.dir);
        this.range -= tmpSpeed;

        if (this.range <= 0) {
            this.x += this.range * Math.cos(this.dir);
            this.y += this.range * Math.sin(this.dir);
            tmpSpeed = 1;
            this.range = 0;
            this.active = false;
        }

        return tmpSpeed;
    }

    private gatherCollisions(tmpSpeed: number) {
        const hitList: (GameObject | Player)[] = [];
        const players = PlayerManager.players.visible.all;
        const gameObjects = ObjectManager.pool.closeObjects;

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            const playerPos = player.real_position;
            const playerNext = player.next_position;
            const isEnemy = this.ownerSID === -1 ? Client.isFriendly(player.sid) : !Client.isTeam(player, this.ownerSID);

            if (player && isEnemy) {
                if (player.sid === Client.mySID && lineInRect(
                    playerNext.x - 35, playerNext.y - 35,
                    playerNext.x + 35, playerNext.y + 35,
                    this.x, this.y,
                    this.x + tmpSpeed * Math.cos(this.dir),
                    this.y + tmpSpeed * Math.sin(this.dir),
                )) {
                    hitList.push(player);
                    continue;
                }

                if (lineInRect(
                    playerPos.x - 35, playerPos.y - 35,
                    playerPos.x + 35, playerPos.y + 35,
                    this.x, this.y,
                    this.x + tmpSpeed * Math.cos(this.dir),
                    this.y + tmpSpeed * Math.sin(this.dir),
                )) {
                    hitList.push(player);
                }
            }
        }

        for (let i = 0, len = gameObjects.length; i < len; i++) {
            const gameObject = gameObjects[i];
            const tmpScale = gameObject.getScale();

            if (gameObject.active && this.layer <= gameObject.layer && !gameObject.ignoreCollision) {
                if (lineInRect(
                    gameObject.x - tmpScale, gameObject.y - tmpScale,
                    gameObject.x + tmpScale, gameObject.y + tmpScale,
                    this.x, this.y,
                    this.x + tmpSpeed * Math.cos(this.dir),
                    this.y + tmpSpeed * Math.sin(this.dir)
                )) {
                    hitList.push(gameObject);
                }
            }
        }

        return hitList;
    }

    private resolveCollisions(hitList: (GameObject | Player)[]) {
        if (hitList.length === 0) return;

        let hitObj: GameObject | Player = hitList[0];
        let shortDistSq = Infinity;

        for (let i = 0, len = hitList.length; i < len; i++) {
            const obj = hitList[i];
            const distSq = obj instanceof Player ?
                obj.sid === Client.mySID ?
                    Math.min(getDistSq(this, obj.next_position), getDistSq(this, obj.real_position)) :
                    getDistSq(this, obj.real_position) : getDistSq(this, obj);

            if (distSq <= shortDistSq) {
                shortDistSq = distSq;
                hitObj = obj;
            }
        }

        if (hitObj instanceof Player) {
            hitObj.projDamages.push(this.dmg);
        }

        this.active = false;
        this.range = 0;
    }

    update(dt: number = ScriptConfig.SERVER_UPDATE_SPEED) {
        const tmpSpeed = this.handleMovement(dt);
        const hitList = this.gatherCollisions(tmpSpeed);
        this.resolveCollisions(hitList);
    }
}