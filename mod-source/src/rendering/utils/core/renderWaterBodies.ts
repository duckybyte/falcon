import ScriptConfig from "@utils/config/ScriptConfig";
import RendererUtils from "../../RendererUtils";
import RenderingConfig from "../../RenderingConfig";

export default function renderWaterBodies(xOffset: number, yOffset: number, ctx: CanvasRenderingContext2D, padding: number) {
    const riverWidth = RendererUtils.riverWidth + padding;
    const riverY = (ScriptConfig.MAP_SIZE / 2) - yOffset - (riverWidth / 2);

    const isOnScreen = riverY < RenderingConfig.maxScreenHeight && riverY + riverWidth > 0;
    if (!isOnScreen) return;

    ctx.fillRect(0, riverY, RenderingConfig.maxScreenWidth, riverWidth);
}