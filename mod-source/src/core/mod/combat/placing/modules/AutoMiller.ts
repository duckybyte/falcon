import items from "@constants/items";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import ModManager from "@core/ModManager";
import getDistSq from "@utils/geometry/getDistSq";

export default class AutoMiller {
    private static readonly DISTANCE_TO_MAINTAIN = 99 * 99;

    static data = {
        status: false,
        x: 0,
        y: 0
    };

    static main() {
        const player = Client.player;
        const playerPos = player.real_position;

        if (getDistSq(this.data, playerPos) > this.DISTANCE_TO_MAINTAIN) {
            if (typeof Client.lastMoveDir == "number" && this.data.status && (player.itemCounts[3] < 299 || !player.itemCounts[3])) {
                const direction = Client.lastMoveDir + Math.PI;
                const item = items.list[player.items[3]];
                let count = player.itemCounts[item.group.id];

                count = PlacementSystem.place(player.items[3], direction, count);
                count = PlacementSystem.place(player.items[3], direction - 1.20427718, count);
                PlacementSystem.place(player.items[3], direction + 1.20427718, count);

                ModManager.activityList.push("autoMills");
            } else if (!(player.itemCounts[3] < 299 || !player.itemCounts[3])) {
                this.data.status = false;
            }

            this.data.x = player.real_position.x;
            this.data.y = player.real_position.y;
        }
    }
}