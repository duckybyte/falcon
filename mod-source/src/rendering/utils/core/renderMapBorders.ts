import ScriptConfig from "@utils/config/ScriptConfig";
import CameraManager from "../../core/CameraManager";
import RenderingConfig from "../../RenderingConfig";

export default function renderMapBorders(mainContext: CanvasRenderingContext2D) {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    const maxScreenWidth = RenderingConfig.maxScreenWidth;
    const maxScreenHeight = RenderingConfig.maxScreenHeight;

    mainContext.save();

    mainContext.fillStyle = "#000";
    mainContext.globalAlpha = 0.25;

    const rightEdge = ScriptConfig.MAP_SIZE - xOffset;
    const bottomEdge = ScriptConfig.MAP_SIZE - yOffset;

    if (xOffset <= 0) {
        mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
    }

    if (rightEdge <= maxScreenWidth) {
        const top = Math.max(0, -yOffset);
        const width = maxScreenWidth - rightEdge;
        const height = maxScreenHeight - top;
        mainContext.fillRect(rightEdge, top, width, height);
    }

    if (yOffset <= 0) {
        mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
    }

    if (bottomEdge <= maxScreenHeight) {
        const left = Math.max(0, -xOffset);
        const bottom = ScriptConfig.MAP_SIZE - yOffset;
        const minRightClip = (rightEdge <= maxScreenWidth) ? (maxScreenWidth - rightEdge) : 0;
        const width = (maxScreenWidth - left) - minRightClip;
        const height = maxScreenHeight - bottom;

        mainContext.fillRect(left, bottom, width, height);
    }

    mainContext.restore();
}