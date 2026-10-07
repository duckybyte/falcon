import store, { STORE_ACCESSORY_MAP, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import Menu from "@menu/Menu";

interface ShopItem {
    id: number;
    isAccessory: boolean;
}

export default class AutoBuyer {
    private static shopList: ShopItem[] = [{
        id: STORE_ACCESSORY_MAP.MONKEY_TAIL,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.WINTER_CAP,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.SOLDIER_HELMET,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.BULL_HELMET,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.TANK_GEAR,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.TURRET_GEAR,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.FLIPPER_HAT,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.BOOSTER_HAT,
        isAccessory: false
    }, {
        id: STORE_HAT_MAP.EMP_HELMET,
        isAccessory: false
    }, {
        id: STORE_ACCESSORY_MAP.SHADOW_WINGS,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.SPIKE_GEAR,
        isAccessory: false
    }, {
        id: STORE_ACCESSORY_MAP.CORRUPT_X_WINGS,
        isAccessory: true
    }, {
        id: STORE_HAT_MAP.BARBARIAN_ARMOR,
        isAccessory: false
    }];

    static main(points: number) {
        if (points <= 0) return;
        if (!Menu.getValue("autoBuy")) return;

        const currentItem = this.shopList[0];
        if (!currentItem) return;

        const player = Client.player;
        if (!player) return;

        const items = currentItem.isAccessory ? store.accessories : store.hats;
        const item = items.find(e => e.id === currentItem.id);
        const group = currentItem.isAccessory ? player.tails : player.skins;

        if (item && item.price <= points) {
            if (group[currentItem.id]) {
                this.shopList.shift();
                this.main(points);
                return;
            }

            HatSystem.storeBuy(item.id, currentItem.isAccessory);
        }
    }
}