import Client from "@core/Client";
import AutoBuyer from "@core/mod/utils/AutoBuyer";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import PacketMap from "@root/utils/socket/PacketMap";

type StoreItemsUpdatePacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS;

export default class StoreItemsUpdateEvent extends MessageHandler<StoreItemsUpdatePacket> {
    run(type: boolean, id: number, index: number) {
        const player = Client.player;

        if (index) {
            if (!type) {
                player.tails[id] = true;
            } else {
                player.tailIndex = id;
            }
        } else {
            if (!type) {
                player.skins[id] = true;
            } else {
                player.skinIndex = id;
            }
        }

        if (!type)
            AutoBuyer.main(player.points);
    }
}