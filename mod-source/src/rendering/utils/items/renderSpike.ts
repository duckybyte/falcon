import GameObject from "@constants/GameObject";
import { ListItem } from "@constants/items";
import RendererUtils from "../../RendererUtils";

export default function renderSpike(obj: GameObject | ListItem, ctx: CanvasRenderingContext2D, bodyColor: string, innerBodyColor: string, spikeColor: string, spikes: number) {
    const tmpScale = obj.scale * .6;

    ctx.fillStyle = spikeColor;
    RendererUtils.drawStar(ctx, spikes, 0, 0, tmpScale, obj.scale);

    ctx.fillStyle = bodyColor;
    RendererUtils.drawCircle(0, 0, ctx, tmpScale);

    ctx.fillStyle = innerBodyColor;
    RendererUtils.drawCircle(0, 0, ctx, tmpScale / 2, true);
}