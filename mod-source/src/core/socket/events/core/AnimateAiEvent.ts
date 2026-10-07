import { ais } from "@constants/Ai";
import Client from "@core/Client";
import ModManager from "@core/ModManager";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import SocketListener from "@core/socket/SocketListener";
import PacketMap from "@root/utils/socket/PacketMap";

type AnimateAiPacket = typeof PacketMap.SERVER_TO_CLIENT.ANIMATE_AI;

export default class AnimateAiEvent extends MessageHandler<AnimateAiPacket> {
    run(sid: number) {
        const ai = ais.get(sid);

        if (ai && ai.name === "MOOSTAFA") {
            ai.animTime = ai.animSpeed = 600;
            ai.targetAngle = Math.PI * 0.8;
            ai.tmpRatio = 0;
            ai.animIndex = 0;

            const tmpB = Client.buildingsHit;
            Client.buildingsHit = [];

            ModManager.nextTick(() => {
                for (const obj of tmpB) {
                    obj.health -= 232;
                    if (obj.health <= 0) obj.health = obj.maxHealth - 232;

                    SocketListener.logPacket(
                        PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.UPDATE_OBJECT_HEALTH,
                        [obj.sid, obj.health]
                    );
                }
            });
        }
    }
}