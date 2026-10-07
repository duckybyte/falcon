import items, { LIST_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import ModManager from "@core/ModManager";
import withinDist from "@utils/geometry/withinDist";

export class PotentialObject {
    active: boolean = true;
    ticksOut = 0;
    isBreaking = false;
    willBreak = false;
    totalDamagePotential = 0;
    isFakeObject = true;

    readonly scale = 50;

    static readonly maxHealth = items.list[LIST_ID_MAP.PIT_TRAP].health!;
    health = PotentialObject.maxHealth;

    constructor(
        public x: number,
        public y: number,
        public ownerSID: number,
        public tick: number
    ) { }

    public redefine(x: number, y: number, ownerSID: number, tick: number): void {
        this.x = x;
        this.y = y;
        this.ownerSID = ownerSID;
        this.isBreaking = false;
        this.totalDamagePotential = 0;
        this.tick = tick;
        this.active = true;
        this.ticksOut = 0;
        this.willBreak = false;
        this.health = PotentialObject.maxHealth;
    }
}

export default class PotentialObjectManager {
    static allObjects: PotentialObject[] = [];
    static closeObjects: PotentialObject[] = [];
    static onRenderObjects: PotentialObject[] = [];

    private static tmpPos = { x: 0, y: 0 };

    static update(x: number, y: number, scale: number) {
        const allObjects = this.allObjects;
        const radius = 50 + scale;
        const pos = this.tmpPos;

        pos.x = x;
        pos.y = y;

        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj || !obj.active) continue;

            if (withinDist(obj, pos, radius)) {
                obj.active = false;
            }
        }
    }

    static remove(ownerSID: number) {
        const allObjects = this.allObjects;

        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj) continue;
            if (obj.ownerSID !== ownerSID) continue;
            obj.active = false;
        }
    }

    static add(x: number, y: number, ownerSID: number) {
        const allObjects = this.allObjects;
        const pos = this.tmpPos;
        let inactiveObj: PotentialObject | null = null;

        pos.x = x;
        pos.y = y;

        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj) continue;

            if (obj.active) {
                if (withinDist(obj, pos, 100)) {
                    return;
                }
            } else if (!inactiveObj) {
                inactiveObj = obj;
            }
        }

        if (inactiveObj) {
            inactiveObj.redefine(x, y, ownerSID, ModManager.tick);
            return;
        }

        allObjects.push(new PotentialObject(x, y, ownerSID, ModManager.tick));
    }

    static query() {
        const allObjects = this.allObjects;
        const closeObjects = this.closeObjects;
        const onRenderObjects = this.onRenderObjects;

        onRenderObjects.length = 0;
        closeObjects.length = 0;

        const player = Client.player;
        for (let i = 0; i < allObjects.length; i++) {
            const obj = allObjects[i];
            if (!obj || !obj.active) continue;

            if (!withinDist(player.real_position, obj, 800)) {
                obj.ticksOut++;
                if (obj.ticksOut >= 9 * 10) obj.active = false;
                continue;
            } else {
                obj.ticksOut = 0;
                onRenderObjects.push(obj);
            }

            if (!withinDist(player.real_position, obj, 200)) continue;
            closeObjects.push(obj);
        }
    }
}