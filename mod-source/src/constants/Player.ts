import { Entity } from "@constants/Entity";
import GameObject from "@constants/GameObject";
import items, { LIST_ID_MAP, Weapon, WEAPON_VARIANT_MAP } from "@constants/items";
import PlayerInitType from "@constants/PlayerInitType";
import store from "@constants/store";
import Client from "@core/Client";
import Angle from "@placing/Angle";
import AngleFinder from "@placing/AngleFinder";
import SpriteCache from "@rendering/core/SpriteCache";
import RendererUtils from "@rendering/RendererUtils";
import { renderProjectile } from "@rendering/utils/core/renderProjectiles";
import MovementPhysicsSimulator from "@simulation/MovementPhysicsSimulator";
import { PlayerSimulationState } from "@simulation/SimulationStates";
import ScriptConfig from "@utils/config/ScriptConfig";
import lerp from "@utils/math/lerp";

export interface IPlacePotential {
    onMe: Angle[];
    all: Angle[];
    objectScale: number;
    range: number;
    onMeBufferIndex: number;
    allBufferIndex: number;
}

function renderPlayerWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, weaponVariant: number) {
    RendererUtils.renderTool(weapon, ScriptConfig.WEAPON_VARIANTS[weaponVariant], 35, 0, ctx);

    if (weapon.projectile && !weapon.hideProjectile) {
        renderProjectile(35, 0, items.projectiles[weapon.projectile], ctx);
    }
}

export class ChatMessage {
    life: number = 3e3;

    yOff: number = 0;
    index: number = 0;

    maxOff: number = 0;

    constructor(
        public msg: string
    ) {
    }

    render(baseY: number, mainContext: CanvasRenderingContext2D) {
        mainContext.font = "28px Hammersmith One";

        const textWidth = mainContext.measureText(this.msg).width + 17;

        mainContext.fillStyle = "rgba(0, 0, 0, .25)";
        mainContext.roundRect(-textWidth / 2, baseY - 23.5 + this.yOff, textWidth, 42, 4);
        mainContext.fill();

        mainContext.fillStyle = "#ffffff";
        mainContext.lineJoin = "round";
        mainContext.textAlign = "center";
        mainContext.textBaseline = "middle";

        mainContext.fillText(this.msg, 0, baseY + this.yOff);
    }

    update(delta: number, index: number) {
        this.life -= delta;

        if (this.index != index) {
            this.maxOff = -47 * index;
        }

        this.index = index;

        const maxOff = Math.abs(this.maxOff);
        const yOff = Math.abs(this.yOff);

        this.yOff -= .3 * delta;

        if (yOff >= maxOff) {
            this.yOff = this.maxOff;
        }
    }
}

export default class Player implements Entity {
    turretHandlerIndex: number = -1;

    name: string = "unknown";
    listHandlerIndex: number = -1;

    render_position = { x: 0, y: 0 };
    real_position = { x: 0, y: 0 };
    last_render_position = { x: 0, y: 0 };
    last_position = { x: 0, y: 0 };
    next_position = { x: 0, y: 0 };
    next_state = Player.createSimState();

    hadProjDamages = false;
    projDamages: number[] = [];
    projFired = 0;
    damages: number[] = [];
    bullTick = 0;

    dir = 0;
    d1 = 0;
    d2 = 0;

    dirPlus = 0;

    animSpeed = 0;
    animTime = 0;
    targetAngle = 0;

    tmpRatio = 0;
    animIndex = 0;

    health = 100;
    maxHealth = 100;

    scale = 35;
    skinColor = 0;

    nameScale = 0;
    isPlayer: true = true;

    chatMessages: ChatMessage[] = [];

    lastSkinIndex = -1;
    skinIndex = -1;
    tailIndex = -1;

    buildIndex = -1;
    weaponIndex = 0;

    age = 1;
    XP = 0;
    maxXP = 300;

    weaponVariant = 0;
    team = "";

    isLeader = 0;
    iconIndex = -1;

    food = 100;
    wood = 100;
    stone = 100;
    points = 100;
    kills = 0;

    forcePos = false;
    visible = false;

    deltaTime = 0;
    zIndex = 0;

    skinRot = 0;

    turretThreats = 0;
    weapons: number[] = [0];
    items: number[] = [0, 3, 6, 10];

    skins: Record<number, boolean> = {};
    tails: Record<number, boolean> = {};

    placePotential: IPlacePotential = {
        onMe: Array.from({ length: AngleFinder.HIGHEST_ANGLE_COUNT }, () => new Angle(0, 0, 0, 0, 0)),
        all: Array.from({ length: AngleFinder.HIGHEST_ANGLE_COUNT }, () => new Angle(0, 0, 0, 0, 0)),
        objectScale: 52,
        range: Infinity,
        onMeBufferIndex: 0,
        allBufferIndex: 0
    };

    profilingData = {
        preHitAttacks: 0,
        randomHitAttacks: 0,
        latePreHitAttacks: 0,
        checkLateHit: false,
        tankUseHits: {} as Record<number, number[]>
    };

    constructor(
        public id: string,
        public sid: number
    ) {
        for (const hat of store.hats) {
            if (!hat.price || Client.mode === "replay") this.skins[hat.id] = true;
        }

        for (const acc of store.accessories) {
            if (!acc.price || Client.mode === "replay") this.tails[acc.id] = true;
        }

        for (let i = 0; i < 16; i++) {
            this.profilingData.tankUseHits[i] = [0, 1, 0, 0, 0, 0, 0, 0, 0];
        }
    }

    startShameTimer() {
        this.shameCount = 0;
        this.shameTimer = 30e3;
    }

    upgradePoints = 0;
    upgrAge = 2;
    clowned = false;

    private hatHistory: number[] = [-1, -1, -1, -1, -1, -1, -1, -1];
    private hatHead: number = 0;

    findHat(id: number) {
        const hatHistory = this.hatHistory;
        for (let i = 0, len = hatHistory.length; i < len; i++) {
            if (hatHistory[i] === id) return true;
        }

        return false;
    }

    appendHat(id: number) {
        this.hatHistory[this.hatHead] = id;
        this.hatHead = (this.hatHead + 1) % this.hatHistory.length;
    }

    isOwner: boolean = false;
    shameCount = 0;
    shameTimer = 30e3;
    spikeId: number = LIST_ID_MAP.SPINNING_SPIKES;

    weaponXP: number[] = [];
    reloads: Record<number, number> = {};
    itemCounts: Record<number, number> = {};

    potentialTrap?: GameObject;
    trap?: GameObject;
    wasTrapped = false;
    hitTime = 0;
    ticksNotNearby = 0;
    ignoreDamageConsideration = false;

    healthHealed = 0;
    damageTaken = 0;
    justAttacked = false;

    weaponData = {
        primary: 0,
        primaryVariant: 0,
        primaryConfirmed: false,
        lastTickSincePrimaryReloaded: 0,
        lastPrimaryTickHit: 0,
        lastPrimaryReload: 1,
        secondary: 15,
        secondaryVariant: 0,
        secondaryConfirmed: false,
        lastTickSinceSecondaryReloaded: 0,
        lastSecondaryTickHit: 0,
        lastTurretTickHit: 0,
        lastSecondaryReload: 1,
    };

    setData(data: PlayerInitType) {
        this.id = data[0];
        this.sid = data[1];
        this.name = data[2];

        this.last_position.x = this.last_render_position.x = this.real_position.x = this.render_position.x = data[3];
        this.last_position.y = this.last_render_position.y = this.real_position.y = this.render_position.y = data[4];

        this.dir = data[5];
        this.health = data[6];
        this.maxHealth = data[7];
        this.scale = data[8];
        this.skinColor = data[9];
    }

    getReload(group: 0 | 1 | 2) {
        if (group === 2) return this.reloads[53];
        return this.reloads[group === 1 ? this.weaponData.secondary : this.weaponData.primary];
    }

    getLastReload(group: 0 | 1) {
        return group === 1 ? this.weaponData.lastSecondaryReload : this.weaponData.lastPrimaryReload;
    }

    still = false;
    stateUpdate = {
        position: false,
        attribute: false
    };

    private resetProfile() {
        this.profilingData.preHitAttacks = 0;
        this.profilingData.latePreHitAttacks = 0;
        this.profilingData.randomHitAttacks = 0;
        this.profilingData.checkLateHit = false;

        this.weaponData.primaryConfirmed = false;
        this.weaponData.secondaryConfirmed = false;
    }

    spawn() {
        this.resetProfile();

        this.age = 1;
        this.XP = 0;
        this.maxXP = 300;
        this.justAttacked = false;

        this.upgradePoints = 0;
        this.upgrAge = 2;
        this.shameCount = 0;

        this.weapons = [0];
        this.items = [0, 3, 6, 10];
        this.spikeId = LIST_ID_MAP.SPINNING_SPIKES;

        this.weaponIndex = 0;
        this.buildIndex = -1;

        this.food = 100;
        this.wood = 100;
        this.stone = 100;
        this.points = 100;
        this.kills = 0;

        this.chatMessages.length = 0;
        this.shameCount = 0;

        for (let i = 0; i < this.weaponXP.length; i++) {
            this.weaponXP[i] = 0;
        }

        this.hitTime = 0;
        this.trap = undefined;
        this.wasTrapped = false;

        this.weaponData.primary = 0;
        this.weaponData.primaryVariant = 0;
        this.weaponData.primaryConfirmed = false;
        this.weaponData.lastPrimaryTickHit = 0;
        this.weaponData.lastPrimaryReload = 1;

        this.weaponData.secondary = 15;
        this.weaponData.secondaryVariant = 0;
        this.weaponData.secondaryConfirmed = false;
        this.weaponData.lastSecondaryTickHit = 0;
        this.weaponData.lastSecondaryReload = 1;

        this.weaponData.lastTurretTickHit = 0;
        this.resetReloads();
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

    render(mainContext: CanvasRenderingContext2D) {
        const weapon = items.weapons[this.weaponIndex];

        const handAngle = Math.PI / 4 * (weapon.armS ?? 1);
        const oHandAngle = (this.buildIndex === -1) ? (weapon.hndS ?? 1) : 1;
        const oHandDist = (this.buildIndex === -1) ? (weapon.hndD ?? 1) : 1;

        if (this.tailIndex > 0) {
            RendererUtils.renderTail(this.tailIndex, mainContext, this);
        }

        // RENDER WEAPON BELOW HANDS:
        if (this.buildIndex < 0 && !weapon.aboveHand) {
            renderPlayerWeapon(mainContext, weapon, this.weaponVariant);
        }

        mainContext.fillStyle = RendererUtils.skinColors[this.skinColor];

        RendererUtils.drawCircle(
            this.scale * Math.cos(handAngle),
            this.scale * Math.sin(handAngle),
            mainContext,
            14
        );

        RendererUtils.drawCircle(
            (this.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
            (this.scale * oHandDist) * Math.sin(-handAngle * oHandAngle),
            mainContext,
            14
        );

        // RENDER WEAPON ABOVE HAND:
        if (this.buildIndex < 0 && weapon.aboveHand) {
            renderPlayerWeapon(mainContext, weapon, this.weaponVariant);
        }

        if (this.buildIndex >= 0) {
            const item = items.list[this.buildIndex];
            const tmpSprite = SpriteCache.getItemSprite(item);

            mainContext.drawImage(tmpSprite, this.scale - item.holdOffset, -tmpSprite.width / 2);
        }

        RendererUtils.drawCircle(0, 0, mainContext, this.scale);

        if (this.skinIndex > 0) {
            mainContext.rotate(Math.PI / 2);
            RendererUtils.renderSkin(this.skinIndex, mainContext, this);
        }
    }

    resetReloads() {
        for (let i = 0; i < 16; i++) {
            this.reloads[i] = 1;
        }

        this.reloads[53] = 1;

        if (WEAPON_VARIANT_MAP.DIAMOND > this.weaponData.primaryVariant)
            this.weaponData.primaryVariant = WEAPON_VARIANT_MAP.DIAMOND;

        if (WEAPON_VARIANT_MAP.DIAMOND > this.weaponData.secondaryVariant)
            this.weaponData.secondaryVariant = WEAPON_VARIANT_MAP.DIAMOND;
    }

    // ok playerSim states should be short-lived/function scoped so yeah
    // if we use more than 50+ state instances in one module/function call then we suck at coding
    private static playerSimStateBufferHead = 0;
    private static playerSimStateBuffer: PlayerSimulationState[] = Array.from({ length: 50 }, () => this.createSimState());

    private static createSimState(): PlayerSimulationState {
        return { sid: -1, x: 0, y: 0, velX: 0, slowMult: 1, velY: 0, spikeDamages: 0, team: null, scale: 35, health: 100, skinIndex: 0, tailIndex: 0, maxHealth: 100, buildIndex: -1, weaponIndex: 0, lockMove: false };
    }

    static getEmptyState() {
        const state = this.playerSimStateBuffer[this.playerSimStateBufferHead];
        this.playerSimStateBufferHead = (this.playerSimStateBufferHead + 1) % this.playerSimStateBuffer.length;
        return state;
    }

    static copyStateTo(fromState: Readonly<PlayerSimulationState>, toState: PlayerSimulationState) {
        toState.sid = fromState.sid;
        toState.x = fromState.x;
        toState.y = fromState.y;
        toState.velX = fromState.velX;
        toState.velY = fromState.velY;
        toState.team = fromState.team;
        toState.health = fromState.health;
        toState.skinIndex = fromState.skinIndex;
        toState.tailIndex = fromState.tailIndex;
        toState.buildIndex = fromState.buildIndex;
        toState.weaponIndex = fromState.weaponIndex;
        toState.slowMult = fromState.slowMult;
        toState.lockMove = fromState.lockMove;
        toState.spikeDamages = fromState.spikeDamages;
    }

    static copyState(fromState: Readonly<PlayerSimulationState>) {
        const state = Player.getEmptyState();

        state.sid = fromState.sid;
        state.x = fromState.x;
        state.y = fromState.y;
        state.velX = fromState.velX;
        state.velY = fromState.velY;
        state.team = fromState.team;
        state.health = fromState.health;
        state.skinIndex = fromState.skinIndex;
        state.tailIndex = fromState.tailIndex;
        state.buildIndex = fromState.buildIndex;
        state.weaponIndex = fromState.weaponIndex;
        state.lockMove = fromState.lockMove;
        state.slowMult = fromState.slowMult;
        state.spikeDamages = fromState.spikeDamages;
        return state;
    }

    getSimulationState(): PlayerSimulationState {
        let velX = (this.next_position.x - this.real_position.x) / ScriptConfig.SERVER_UPDATE_SPEED;
        let velY = (this.next_position.y - this.real_position.y) / ScriptConfig.SERVER_UPDATE_SPEED;

        if (velX) {
            velX *= MovementPhysicsSimulator.PLAYER_DECELERATION;
            if (Math.abs(velX) <= 0.01) velX = 0;
        }

        if (velY) {
            velY *= MovementPhysicsSimulator.PLAYER_DECELERATION;
            if (Math.abs(velY) <= 0.01) velY = 0;
        }

        const state = Player.getEmptyState();

        state.sid = this.sid;
        state.x = this.real_position.x;
        state.y = this.real_position.y;
        state.velX = this.trap ? 0 : velX;
        state.velY = this.trap ? 0 : velY;
        state.team = this.team;
        state.health = this.health;
        state.skinIndex = this.skinIndex;
        state.tailIndex = this.tailIndex;
        state.buildIndex = this.buildIndex;
        state.weaponIndex = this.weaponIndex;
        state.lockMove = !!this.trap;
        state.spikeDamages = 0;
        state.slowMult = this.justAttacked ? 1 - (items.weapons[this.weaponIndex].hitSlow ?? .3) : 1;

        return state;
    }
}