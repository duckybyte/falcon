import { Entity } from "@constants/Entity";
import items from "@constants/items";
import { GameObjectSimulationState } from "@simulation/SimulationStates";

export const spikeDamages = new Set([20, 35, 45, 30]);

export default class GameObject implements Entity {
    isFakeObject = false;

    sid: number = -1;
    listHandlerIndex: number = -1;
    turretHandlerIndex: number = -1;

    name: string;
    id: number;

    xWiggle: number = 0;
    yWiggle: number = 0;

    active: boolean = true;

    blocker: number;
    layer: number = 0;

    isItem: boolean;

    ignoreCollision: boolean;
    hideFromEnemy: boolean;
    isGhost: boolean = false;
    willBreak = false;
    totalDamagePotential = 0;
    isBreaking = false;

    dmg: number;
    pDmg: number;
    projDmg: boolean;
    colDiv: number;

    trap: boolean;
    zIndex: number;

    pps: number;
    turnSpeed: number;

    healCol: number;
    teleport: boolean;
    boostSpeed: number;
    projectile: number;
    shootRange: number;
    shootRate: number;
    spawnPoint: boolean;
    hasHealth: boolean;

    ownerSID: number | undefined;
    reload = 1;

    isGameObject: true = true;

    health: number;
    maxHealth: number;
    globalAlphaDelta = 1;
    playerDamageDealt = 0;

    constructor(
        public x: number,
        public y: number,
        public dir: number,
        public scale: number,
        public type: number,
        itemId: number,
        ownerSID?: number
    ) {
        const data = items.list[itemId] || {};
        const group = data.group;

        this.layer = 2;

        if (group) {
            this.layer = group.layer;
        } else if (this.type === 0) {
            this.layer = 3;
        } else if (this.type === 2) {
            this.layer = 0;
        } else if (this.type === 4) {
            this.layer = -1;
        }

        this.ownerSID = ownerSID;

        this.isItem = typeof itemId === "number";

        this.id = data.id!;
        this.blocker = data.blocker ?? 0;

        this.health = data.health ?? Infinity;
        this.maxHealth = data.health ?? Infinity;
        this.hasHealth = isFinite(this.health);

        this.name = data.name ?? "";
        this.colDiv = data.colDiv ?? 1;
        this.ignoreCollision = data.ignoreCollision ?? false;
        this.hideFromEnemy = data.hideFromEnemy ?? false;
        this.projDmg = data.projDmg ?? false;
        this.dmg = data.dmg ?? 0;
        this.pDmg = data.pDmg ?? 0;
        this.pps = data.pps ?? 0;
        this.zIndex = data.zIndex ?? 0;
        this.turnSpeed = data.turnSpeed ?? 0;
        this.trap = data.trap ?? false;
        this.healCol = data.healCol ?? 0;
        this.teleport = data.teleport ?? false;
        this.boostSpeed = data.boostSpeed ?? 0;
        this.projectile = data.projectile ?? -1;
        this.shootRange = data.shootRange ?? 0;
        this.shootRate = data.shootRate ?? 0;
        this.spawnPoint = data.spawnPoint ?? false;
    }

    private static typeIds = new Set([2, 3, 4]);

    getScale(sM = 1, ig = false): number {
        const isSimpleItem = this.isItem || GameObject.typeIds.has(this.type);
        const baseScale = this.scale * (isSimpleItem ? 1 : 0.6 * sM);
        return ig ? baseScale : baseScale * this.colDiv;
    }

    private simulationState: GameObjectSimulationState = {
        active: true,
        sid: 0,
        x: 0,
        y: 0,
        scale: 0,
        type: 0,
        dmg: 0,
        teleport: false,
        boostSpeed: 0,
        ignoreCollision: false,
        trap: false,
        health: Infinity,
        ownerSID: undefined,
        dir: 0,
        willBreak: false
    };

    getSimulationState(): Readonly<GameObjectSimulationState> {
        this.simulationState.active = this.isGhost ? false : this.active;
        this.simulationState.sid = this.sid;
        this.simulationState.x = this.x;
        this.simulationState.y = this.y;
        this.simulationState.type = this.type;
        this.simulationState.dmg = this.dmg;
        this.simulationState.teleport = this.teleport;
        this.simulationState.boostSpeed = this.boostSpeed;
        this.simulationState.scale = this.getScale();
        this.simulationState.trap = this.trap;
        this.simulationState.ignoreCollision = this.ignoreCollision;
        this.simulationState.dir = this.dir;
        this.simulationState.health = this.health;
        this.simulationState.ownerSID = this.ownerSID;
        this.simulationState.willBreak = this.willBreak;

        return this.simulationState;
    }

    getSimulationStateClone(): GameObjectSimulationState {
        return {
            active: this.isGhost ? false : this.active,
            sid: this.sid,
            x: this.x,
            y: this.y,
            type: this.type,
            dmg: this.dmg,
            teleport: this.teleport,
            boostSpeed: this.boostSpeed,
            scale: this.getScale(),
            trap: this.trap,
            health: this.health,
            ignoreCollision: this.ignoreCollision,
            dir: this.dir,
            ownerSID: this.ownerSID,
            willBreak: this.willBreak
        };
    }

    update(delta: number) {
        if (this.xWiggle) this.xWiggle *= Math.pow(0.99, delta);
        if (this.yWiggle) this.yWiggle *= Math.pow(0.99, delta);
        if (this.turnSpeed) this.dir += this.turnSpeed * delta;
    }
}