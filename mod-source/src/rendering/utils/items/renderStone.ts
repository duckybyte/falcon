import GameObject from "@constants/GameObject";
import RendererUtils from "../../RendererUtils";

export default function renderStone(obj: GameObject, ctx: CanvasRenderingContext2D, bodyColor: string, innerBodyColor: string) {
    ctx.fillStyle = bodyColor;
    RendererUtils.drawPolygon(ctx, 6, 0, 0, obj.scale);

    ctx.fillStyle = innerBodyColor;
    RendererUtils.drawStar(ctx, 3, 0, 0, obj.scale * .55, obj.scale * .65, false, true);
}