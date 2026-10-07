import AutoPusher from "@core/mod/combat/core/AutoPusher";
import Menu from "@menu/Menu";
import CameraManager from "../../core/CameraManager";
import { mainContext } from "../../RendererSystem";

export default function renderPathfindPath() {
    const path = AutoPusher.currentPath;

    if (!path.length) return;
    if (!Menu.getValue("renderAutoPushingPathfindingLine")) return;

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    for (let i = 0, len = path.length - 1; i < len; i++) {
        const node = path[i];
        const nextNode = path[i + 1];

        mainContext.save();
        mainContext.strokeStyle = "cyan";
        mainContext.lineWidth = 4;

        mainContext.beginPath();
        mainContext.moveTo(node.x - xOffset, node.y - yOffset);
        mainContext.lineTo(nextNode.x - xOffset, nextNode.y - yOffset);
        mainContext.stroke();

        mainContext.restore();
    }
}