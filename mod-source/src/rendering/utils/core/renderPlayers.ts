import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import { Input } from "@ui/Hook";

export default function renderPlayers(delta: number, layer: number) {
    const players = PlayerManager.players.visible.all;
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.globalAlpha = 1;
    for (const player of players) {
        if (player.zIndex == layer) {
            player.animate(delta);
            player.skinRot += .002 * delta;

            mainContext.save();
            mainContext.translate(player.render_position.x - xOffset, player.render_position.y - yOffset);

            const dir = Client.mode === "normal" && Client.mySID === player.sid ? Menu.getValue("renderRealDir") ? player.dir : Input.getAttackDir() : player.dir;
            mainContext.rotate(dir + player.dirPlus);
            player.render(mainContext);
            mainContext.restore();
        }
    }
}