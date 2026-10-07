import items from "@constants/items";
import { PlacementTypes } from "@placing/utils/Placer";
import Client from "../../../core/Client";
import Menu from "../../../core/menu/Menu";
import CameraManager from "../../core/CameraManager";
import SpriteCache from "../../core/SpriteCache";
import { mainContext } from "../../RendererSystem";
import RendererUtils from "../../RendererUtils";

export default function renderPlacements(dt: number) {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    if (!Menu.getValue("renderPlacements")) return;
    const markers = Client.markers;

    for (let i = 0, len = markers.length; i < len; i++) {
        const marker = markers[i];
        if (!marker || !marker.active) continue;

        marker.life -= dt;
        if (marker.life <= 0) marker.active = false;

        const item = items.list[marker.id];
        if (!item) continue;
        const sprite = SpriteCache.getItemSprite(item);

        mainContext.save();
        mainContext.translate(marker.x - xOffset, marker.y - yOffset);

        mainContext.rotate(marker.dir);
        mainContext.globalAlpha = marker.type !== PlacementTypes.NORMAL ? 1 : marker.id === 15 ? .45 : .65;

        if (marker.type !== PlacementTypes.NORMAL) {
            if (marker.type === PlacementTypes.PREDICTIVE) {
                mainContext.strokeStyle = marker.id == 15 ? "rgba(251, 0, 255, .75)" : "rgba(255, 149, 0, 0.75)";
                mainContext.fillStyle = marker.id == 15 ? "rgba(251, 0, 255, .45)" : "rgba(255, 149, 0, .45)";
            } else if (marker.type === PlacementTypes.PREPLACE) {
                mainContext.strokeStyle = marker.id == 15 ? "rgba(0, 255, 255, .75)" : "rgba(255, 0, 0, .75)";
                mainContext.fillStyle = marker.id == 15 ? "rgba(0, 255, 255, .45)" : "rgba(255, 0, 0, .45)";
            } else if (marker.type === PlacementTypes.REPLACE) {
                mainContext.strokeStyle = marker.id == 15 ? "rgba(128, 255, 0, 0.75)" : "rgba(251, 255, 0, 0.75)";
                mainContext.fillStyle = marker.id == 15 ? "rgba(128, 255, 0, .45)" : "rgba(251, 255, 0, .45)";
            } else if (marker.type === PlacementTypes.RESERVED) {
                mainContext.strokeStyle = "rgba(251, 255, 0, 0.75)";
                mainContext.fillStyle = "rgba(128, 255, 0, .45)";
            }

            RendererUtils.drawCircle(0, 0, mainContext, item.scale);
        } else {
            mainContext.drawImage(
                sprite,
                -sprite.width / 2,
                -sprite.width / 2
            );
        }

        mainContext.restore();
    }
}