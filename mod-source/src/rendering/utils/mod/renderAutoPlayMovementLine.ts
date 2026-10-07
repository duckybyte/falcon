import Client from "@core/Client";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import FakeSocket from "@core/socket/FakeSocket";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";

export default function renderAutoPlayMovementLine() {
    const player = Client.player;

    if (!player) return;
    if (Client.socket instanceof FakeSocket) return;
    if (!Menu.getValue("autoPlay")) return;

    const moveDir = MovementManager.getMoveDir();
    if (typeof moveDir !== "number") return;

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.save();
    mainContext.strokeStyle = "cyan";
    mainContext.beginPath();
    mainContext.moveTo(player.render_position.x - xOffset, player.render_position.y - yOffset);
    mainContext.lineTo(
        player.render_position.x + Math.cos(moveDir) * 70 - xOffset,
        player.render_position.y + Math.sin(moveDir) * 70 - yOffset
    );
    mainContext.stroke();
    mainContext.restore();
}