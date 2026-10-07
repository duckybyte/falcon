import Player from "@constants/Player";

export default class PlayerEntityHandler {
    private playersIdMap: Map<string, Player> = new Map();
    private playersSidMap: Map<number, Player> = new Map();
    private playersList: Player[] = [];

    add(entity: Player) {
        entity.listHandlerIndex = this.playersList.length;
        this.playersSidMap.set(entity.sid, entity);
        this.playersIdMap.set(entity.id, entity);
        this.playersList.push(entity);
    }

    get(identifier: string | number) {
        return typeof identifier === "number" ? this.playersSidMap.get(identifier) : this.playersIdMap.get(identifier);
    }

    removeAll() {
        this.playersIdMap.clear();
        this.playersSidMap.clear();
        this.playersList.length = 0;
    }

    remove(identifier: string | number) {
        const entity = this.get(identifier);
        if (!entity) return;

        this.playersSidMap.delete(entity.sid);
        this.playersIdMap.delete(entity.id);

        const index = entity.listHandlerIndex;
        const lastEntity = this.playersList[this.playersList.length - 1];

        this.playersList[index] = lastEntity;
        lastEntity.listHandlerIndex = index;
        this.playersList.pop();
    }

    get all() { return this.playersList };
}