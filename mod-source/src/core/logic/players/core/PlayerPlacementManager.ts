import items, { WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import Client from "@core/Client";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import AngleFinder, { FinderOptions } from "@placing/AngleFinder";
import withinDist from "@utils/geometry/withinDist";

type PlacementArrs = "onMe" | "all";
type PlacementBuffers = `${PlacementArrs}BufferIndex`;

export default class PlayerPlacementManager {
    private static finderOptions: FinderOptions = { spike: true, preplace: true };

    private static computeFor(player: Player, arrType: PlacementArrs, bufType: PlacementBuffers) {
        const myPlayer = Client.player;
        const myPos = myPlayer.real_position;

        const count = AngleFinder.compute(player, this.finderOptions);
        const buffer = AngleFinder.angleBuffer;

        if (count === 0) return;

        const spikeItem = items.list[9];
        const spikeScale = spikeItem.scale;
        const totalScale = spikeScale + 35;
        const placeScale = totalScale + (spikeItem.placeOffset ?? 0);
        const placePotential = player.placePotential;
        const arr = placePotential[arrType];

        placePotential.range = placeScale;
        placePotential.objectScale = spikeScale;

        for (let i = 0; i < count; i++) {
            const item = buffer[i];

            if (arrType === "onMe") {
                if (withinDist(myPos, item, 35 + item.scale))
                    arr[placePotential[bufType]++].redefine(item.x, item.y, item.scale, item.angle, item.id);

                continue;
            }

            arr[placePotential[bufType]++].redefine(item.x, item.y, item.scale, item.angle, item.id);

            if (player.weaponData.primary !== WEAPON_ID_MAP.TOOL_HAMMER && !item.preplace) {
                PotentialObjectManager.add(item.x, item.y, player.sid);
            }
        }
    }

    static update(player: Player) {
        player.placePotential.onMeBufferIndex = 0;
        player.placePotential.allBufferIndex = 0;

        this.computeFor(player, "all", "allBufferIndex");

        this.finderOptions.preplace = false;
        this.computeFor(player, "onMe", "onMeBufferIndex");
        this.finderOptions.preplace = true;
    }
}