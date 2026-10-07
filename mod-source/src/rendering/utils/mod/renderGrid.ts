import Menu from "../../../core/menu/Menu";
import CameraManager from "../../core/CameraManager";
import { mainContext } from "../../RendererSystem";
import RenderingConfig from "../../RenderingConfig";

export default function renderGrid(xOffset: number, yOffset: number) {
    if (!Menu.getValue("renderGrid")) return;

    mainContext.save();

    mainContext.lineWidth = 4;
    mainContext.strokeStyle = "#000";
    mainContext.globalAlpha = 0.06;
    mainContext.beginPath();

    if (Menu.getValue("staticGrid")) {
        const gridSpacing = RenderingConfig.baseScreenHeight / 18;
        const startX = Math.ceil(xOffset / gridSpacing) * gridSpacing;
        const startY = Math.ceil(yOffset / gridSpacing) * gridSpacing;

        for (let wx = startX; wx <= xOffset + RenderingConfig.maxScreenWidth; wx += gridSpacing) {
            const sx = wx - xOffset;
            mainContext.moveTo(sx, 0);
            mainContext.lineTo(sx, RenderingConfig.maxScreenHeight);
        }

        for (let wy = startY; wy <= yOffset + RenderingConfig.maxScreenHeight; wy += gridSpacing) {
            const sy = wy - yOffset;
            mainContext.moveTo(0, sy);
            mainContext.lineTo(RenderingConfig.maxScreenWidth, sy);
        }
    } else {
        const gridSize = RenderingConfig.maxScreenHeight / 14;

        for (let x = -CameraManager.camX; x < RenderingConfig.maxScreenWidth; x += gridSize) {
            if (x > 0) {
                mainContext.moveTo(x, 0);
                mainContext.lineTo(x, RenderingConfig.maxScreenHeight);
            }
        }

        for (let y = -CameraManager.camY; y < RenderingConfig.maxScreenHeight; y += gridSize) {
            if (y > 0) {
                mainContext.moveTo(0, y);
                mainContext.lineTo(RenderingConfig.maxScreenWidth, y);
            }
        }
    }

    mainContext.stroke();
    mainContext.restore();
}