import { Entity } from "@constants/Entity";
import items from "@constants/items";

export default class Projectile implements Entity {
    turretHandlerIndex: number = -1;

    active: boolean = true;
    scale: number;
    src: string;

    dmg: number;

    constructor(
        public x: number,
        public y: number,
        public dir: number,
        public range: number,
        public speed: number,
        public sid: number,
        public layer: number,
        public indx: number
    ) {
        const data = items.projectiles[indx];

        this.scale = data.scale;
        this.src = data.src ?? "";
        this.dmg = data.dmg;
    }

    init(
        x: number,
        y: number,
        dir: number,
        range: number,
        speed: number,
        layer: number,
        indx: number
    ) {
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.range = range;
        this.speed = speed;
        this.layer = layer;
        this.indx = indx;
        this.active = true;

        const data = items.projectiles[indx];
        this.scale = data.scale;
        this.src = data.src ?? "";
        this.dmg = data.dmg;
    }

    listHandlerIndex: number = -1;
    skipMov: boolean = true;

    update(delta: number) {
        const tmpSpeed = this.speed * delta;

        if (!this.skipMov) {
            this.x += tmpSpeed * Math.cos(this.dir);
            this.y += tmpSpeed * Math.sin(this.dir);
            this.range -= tmpSpeed;

            if (this.range <= 0) {
                this.x += this.range * Math.cos(this.dir);
                this.y += this.range * Math.sin(this.dir);
                this.range = 0;
                this.active = false;
            }
        } else {
            this.skipMov = false;
        }
    }
}