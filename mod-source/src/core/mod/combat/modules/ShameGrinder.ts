import CombatModule from "@combat-utils/CombatModule";
import items from "@constants/items";
import Player from "@constants/Player";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import Angle from "@placing/Angle";
import withinDist from "@utils/geometry/withinDist";

export default class ShameGrinder extends CombatModule {
    protected initialize() { }

    process(angle: Angle, enemy: Player) { }

    private angleConfirm(enemy: Player) {
        const preplacement = PlacementSystem.AutoPlacer.potentialPreplacements;

        for (let i = 0; i < preplacement.count; i++) {
            const item = preplacement.placements[i];
            const itemData = items.list[item.id];
            const scale = itemData.scale;
            if (!itemData.trap || !item.shameGrind) continue;

            const isOverlapping = withinDist(item, enemy.next_position, scale + enemy.scale);
            if (isOverlapping) return true;
        }

        return false;
    }

    protected canExecute() {
        return false;
    }

    protected execute() { }

    update() { }
}