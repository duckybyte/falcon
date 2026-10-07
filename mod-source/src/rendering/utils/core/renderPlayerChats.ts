import PlayerManager from "@core/logic/players/PlayerManager";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";

export default function renderPlayerChats(delta: number) {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    const baseY = -115;
    const players = PlayerManager.players.visible.all;

    for (let i = 0, len = players.length; i < len; i++) {
        const player = players[i];

        mainContext.save();
        mainContext.translate(player.render_position.x - xOffset, player.render_position.y - yOffset);

        for (let i = 0; i < player.chatMessages.length; i++) {
            const chatMessage = player.chatMessages[i];

            if (chatMessage) {
                chatMessage.update(delta, i);
                chatMessage.render(baseY, mainContext);

                if (chatMessage.life <= 0) {
                    player.chatMessages.splice(i, 1);
                    i--;
                }
            }
        }

        mainContext.restore();
    }
}