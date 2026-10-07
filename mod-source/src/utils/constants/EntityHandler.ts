import { Entity } from "./Entity";

export default class EntityHandler<T extends Entity> {
    private entitiesMap: Map<number, T> = new Map();
    private entitiesList: T[] = [];

    constructor(private type: 0 | 1 = 0) { }

    add(entity: T) {
        if (this.entitiesMap.has(entity.sid)) return;

        if (this.type === 0) {
            entity.listHandlerIndex = this.entitiesList.length;
        } else {
            entity.turretHandlerIndex = this.entitiesList.length;
        }

        this.entitiesMap.set(entity.sid, entity);
        this.entitiesList.push(entity);
    }

    get(sid: number) {
        return this.entitiesMap.get(sid);
    }

    has(sid: number) {
        return this.entitiesMap.has(sid);
    }

    remove(sid: number) {
        const entity = this.get(sid);
        if (!entity) return;

        this.entitiesMap.delete(sid);

        const index = this.type === 0 ? entity.listHandlerIndex : entity.turretHandlerIndex;
        const lastEntity = this.entitiesList[this.entitiesList.length - 1];
        this.entitiesList[index] = lastEntity;

        if (this.type === 0) {
            lastEntity.listHandlerIndex = index;
        } else {
            lastEntity.turretHandlerIndex = index;
        }

        this.entitiesList.pop();
    }

    removeAll() {
        this.entitiesList.length = 0;
        this.entitiesMap.clear();
    }

    get all() { return this.entitiesList };
}