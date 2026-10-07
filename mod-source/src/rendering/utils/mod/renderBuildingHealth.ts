import GameObject from "@constants/GameObject";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import RendererUtils from "@rendering/RendererUtils";
import withinDist from "@utils/geometry/withinDist";

const renderableGameObjects: GameObject[] = [];

export default function renderBuildingHealth() {
    if (!Menu.getValue("buildingHealthBar")) return;

    mainContext.globalAlpha = 1;

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    const alwaysShow = Menu.getValue("buildingHealthAlwaysShow");
    const healthBarWidth = RendererUtils.healthBarWidth * 1.25;
    const player = Client.player;

    renderableGameObjects.length = 0;
    ObjectManager.getObjects(CameraManager.camX, CameraManager.camY, renderableGameObjects);

    for (let i = 0, len = renderableGameObjects.length; i < len; i++) {
        const gameObject = renderableGameObjects[i];
        if (!gameObject) continue;

        const isDamaged = gameObject.health != gameObject.maxHealth;

        if (gameObject.active && gameObject.hasHealth && (alwaysShow || isDamaged) && withinDist(gameObject, player.render_position, 400)) {
            mainContext.fillStyle = RendererUtils.darkOutlineColor;
            mainContext.roundRect(
                gameObject.x + gameObject.xWiggle - xOffset - healthBarWidth / 2 - RendererUtils.healthBarPad,
                gameObject.y + gameObject.yWiggle - yOffset - RendererUtils.healthBarPad,
                healthBarWidth + RendererUtils.healthBarPad * 2,
                17,
                8
            );
            mainContext.fill();

            mainContext.fillStyle = Client.mySID === gameObject.ownerSID ? "#8ecc51" : Client.isFriendly(gameObject.ownerSID ?? -1) ? "#ffff00" : "#cc5151";
            mainContext.roundRect(
                gameObject.x + gameObject.xWiggle - xOffset - healthBarWidth / 2,
                gameObject.y + gameObject.yWiggle - yOffset,
                healthBarWidth * (Math.max(0, gameObject.health) / gameObject.maxHealth),
                17 - RendererUtils.healthBarPad * 2,
                7
            );
            mainContext.fill();
        }
    }
}