import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import RendererUtils from "../../RendererUtils";

export default function renderWindmill(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#a5974c";
    RendererUtils.drawCircle(0, 0, ctx, obj.scale);

    ctx.fillStyle = "#c9b758";
    RendererUtils.drawCircleRect(ctx, 0, 0, obj.scale * 1.5, 29, 4);

    ctx.fillStyle = "#a5974c";
    RendererUtils.drawCircle(0, 0, ctx, obj.scale * .5);
}