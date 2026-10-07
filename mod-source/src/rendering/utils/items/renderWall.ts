import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import RendererUtils from "@rendering/RendererUtils";

export default function renderWall(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D, bodyColor: string, innerBodyColor: string, sides: number) {
    ctx.fillStyle = bodyColor;
    RendererUtils.drawPolygon(ctx, sides, 0, 0, obj.scale * 1.1);

    ctx.fillStyle = innerBodyColor;
    RendererUtils.drawPolygon(ctx, sides, 0, 0, obj.scale * 0.65, false, true);
}