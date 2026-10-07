import Ai, { ais } from "@constants/Ai";
import aiTypes from "@constants/aiTypes";
import Client from "@core/Client";
import TextManager from "@core/logic/TextManager";
import PacketReplayer from "@core/PacketReplayer";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import Menu from "@menu/Menu";
import RendererUtils from "@rendering/RendererUtils";
import PacketMap from "@root/utils/socket/PacketMap";

type LoadAiPacket = typeof PacketMap.SERVER_TO_CLIENT.LOAD_AI;

export default class LoadAiEvent extends MessageHandler<LoadAiPacket> {
    run(data: number[], hidden: number[]) {
        const stackedText = Menu.getValue("stackedText");

        for (let i = 0; i < hidden.length; i++) {
            const ai = ais.get(hidden[i]);
            if (!ai) continue;
            ai.visible = false;
        }

        for (let i = 0; i < data.length; i += 8) {
            let ai = ais.get(data[i]);

            if (ai) {
                ai.forcePos = Client.mode === "replay" && PacketReplayer.slowTime !== 0 ? true : !ai.visible;
                ai.last_render_position.x = ai.render_position.x;
                ai.last_render_position.y = ai.render_position.y;

                ai.still = ai.real_position.x == data[i + 2] && ai.real_position.y == data[i + 3];

                ai.real_position.x = data[i + 2];
                ai.real_position.y = data[i + 3];
                ai.d1 = ai.d2;
                ai.d2 = data[i + 4] / 100;

                ai.lastHealth = ai.health;
                ai.health = data[i + 5];
                ai.deltaTime = 0;

                if (stackedText && ai.forcePos) {
                    const d = ai.health - ai.lastHealth;

                    if (d < 0) {
                        TextManager.add(ai.real_position.x, ai.real_position.y, -(~~d), 0);
                    }

                    if (d >= 0) {
                        TextManager.add(ai.real_position.x, ai.real_position.y, ~~d, 0);
                    }
                }
            } else {
                ai = new Ai(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                ai.lastHealth = data[i + 5];
                ai.health = data[i + 5];

                if (!aiTypes[data[i + 1]].name)
                    ai.name = RendererUtils.cowNames[data[i + 6]];

                ai.forcePos = true;
                ai.sid = data[i];

                if (!ais.has(data[i]))
                    ais.add(ai);
            }

            ai.visible = true;
        }
    }
}