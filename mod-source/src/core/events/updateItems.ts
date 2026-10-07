import items from "@constants/items";
import Client from "@core/Client";
import getElem from "@utils/dom/getElem";

export default function updateItems(data: number[] | null, wpn: boolean) {
    const player = Client.player;

    if (data) {
        if (wpn) player.weapons = data;
        else player.items = data;
    }

    const itemSet = new Set(player.items);

    for (let i = 0; i < items.list.length; i++) {
        const tmpId = items.weapons.length + i;
        getElem<"div">(`action-bar-item-${tmpId}`).style.display = itemSet.has(items.list[i].id!) ? "inline-block" : "none";
    }

    for (let i = 0; i < items.weapons.length; i++) {
        getElem<"div">(`action-bar-item-${i}`).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
    }
}