import aiTypes from "@constants/aiTypes";
import { Entity } from "@constants/Entity";
import EntityHandler from "@constants/EntityHandler";
import RendererUtils from "@rendering/RendererUtils";
import lerp from "@utils/math/lerp";
import randInt from "@utils/random/randInt";

export const ais = new EntityHandler<Ai>();

export default class Ai implements Entity {
    turretHandlerIndex: number = -1;

    lastHealth: number;
    health: number;
    maxHealth: number;

    still = false;
    animSpeed = 0;
    animTime = 0;
    targetAngle = 0;

    tmpRatio = 0;
    animIndex = 0;

    listHandlerIndex: number = -1;
    sid: number = -1;

    deltaTime: number = 0;

    isPlayer: false = false;

    forcePos: boolean = false;
    visible: boolean = false;
    weightM: number;

    dirPlus: number = 0;
    scale: number;

    index: number;
    src: string;

    name?: string;
    dmg: number;

    active: boolean = true;

    real_position = { x: 0, y: 0 };
    last_render_position = { x: 0, y: 0 };
    render_position = { x: 0, y: 0 };

    d1: number;
    d2: number;
    spriteMlt: number;
    nameScale: number;

    nameIndex = randInt(0, RendererUtils.cowNames.length - 1);

    constructor(
        x: number,
        y: number,
        public dir: number,
        id: number
    ) {
        const data = aiTypes[id];

        this.last_render_position.x = this.render_position.x = x;
        this.last_render_position.y = this.render_position.y = y;

        this.d1 = dir;
        this.d2 = dir;

        this.lastHealth = data.health;
        this.health = data.health;
        this.maxHealth = data.health;
        this.scale = data.scale;
        this.weightM = data.weightM;

        this.nameScale = data.nameScale ?? 0;

        this.index = id;
        this.src = data.src;

        this.name = data.name;
        this.dmg = data.dmg ?? 0;

        this.dirPlus = 0;
        this.spriteMlt = data.spriteMlt ?? 0;
    }

    animate(delta: number) {
        this.animTime -= delta;

        if (this.animTime <= 0) {
            this.animTime = 0;
            this.dirPlus = 0;
            this.tmpRatio = 0;
            this.animIndex = 0;
            return;
        }

        const directionProgress = delta / (this.animSpeed * (this.animIndex === 0 ? 0.25 : 0.75));
        this.tmpRatio += this.animIndex === 0 ? directionProgress : -directionProgress;

        this.tmpRatio = Math.max(0, Math.min(1, this.tmpRatio));
        this.dirPlus = lerp(0, this.targetAngle, this.tmpRatio);

        if (this.animIndex === 0 && this.tmpRatio >= 1) {
            this.animIndex = 1;
        }
    }
}