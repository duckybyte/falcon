import Client from "@core/Client";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import RendererUtils from "@rendering/RendererUtils";

export default function renderAutoPushVisuals() {
    const player = Client.player;

    if (!player) return;
    if (!AutoPusher.autoPushing) return;

    const visuals = AutoPusher.visuals;
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.save();
    mainContext.translate(visuals.target.x - xOffset, visuals.target.y - yOffset);
    mainContext.fillStyle = "rgba(255, 255, 255, 1)";
    RendererUtils.drawCircle(0, 0, mainContext, 4, true);
    mainContext.restore();
}