import GameObject from "@constants/GameObject";
import { LIST_ID_MAP } from "@constants/items";
import RenderingConfig from "@rendering/RenderingConfig";
import renderObjectBreakerVisuals from "@rendering/utils/mod/renderObjectBreakerVisuals";
import renderWillBreakVisuals from "@rendering/utils/mod/renderWillBreakVisuals";
import getDistSq from "@utils/geometry/getDistSq";
import Client from "../../../core/Client";
import ObjectManager from "../../../core/logic/ObjectManager";
import Menu from "../../../core/menu/Menu";
import CameraManager from "../../core/CameraManager";
import SpriteCache from "../../core/SpriteCache";
import RendererSystem, { mainContext } from "../../RendererSystem";
import RendererUtils, { isOnScreen } from "../../RendererUtils";

const config = {
    volcanoScale: 320,
    innerVolcanoScale: 100,
    volcanoAnimationDuration: 3200
};

interface VolcanoCanvas {
    animationTime: number;
    body: HTMLCanvasElement | null;
    inner: HTMLCanvasElement | null;
}

const volcanoCanvas: VolcanoCanvas = {
    animationTime: 0,
    body: null,
    inner: null
};

export function drawVolcanoImages() {
    const volcanoLand = document.createElement("canvas");
    const volcanoLandCanvasSize = config.volcanoScale * 2 * RendererSystem.pixelDensity;
    volcanoLand.width = volcanoLand.height = volcanoLandCanvasSize;

    const ctxLand = volcanoLand.getContext("2d")!;
    ctxLand.strokeStyle = "#3e3e3e";

    const strokeWidth = RendererUtils.outlineWidth * 2;
    ctxLand.lineWidth = strokeWidth;
    ctxLand.fillStyle = "#7f7f7f";

    RendererUtils.drawPolygon(
        ctxLand,
        10,
        volcanoLandCanvasSize / 2,
        volcanoLandCanvasSize / 2,
        (volcanoLandCanvasSize - strokeWidth) / 2
    );

    volcanoCanvas.body = volcanoLand;

    const volcanoInnerCanvasSize = config.innerVolcanoScale * 2 * RendererSystem.pixelDensity;
    const volcanoLava = document.createElement("canvas");
    volcanoLava.width = volcanoLava.height = volcanoInnerCanvasSize;

    const ctxLava = volcanoLava.getContext("2d")!;
    ctxLava.strokeStyle = RendererUtils.outlineColor;

    const innerStrokeWidth = RendererUtils.outlineWidth * 1.6;
    ctxLava.lineWidth = RendererUtils.outlineWidth * 1.6;
    ctxLava.fillStyle = "#f54e16";
    ctxLava.strokeStyle = "#f56f16";

    RendererUtils.drawPolygon(
        ctxLava,
        10,
        volcanoInnerCanvasSize / 2,
        volcanoInnerCanvasSize / 2,
        (volcanoInnerCanvasSize - innerStrokeWidth) / 2
    );

    volcanoCanvas.inner = volcanoLava;
}

const MAX_OBJECT_MARGIN = 400; // magic number!
const renderableGameObjects: GameObject[] = [];
const layerBuckets: GameObject[][] = [
    [], [], [], [], []
];

export function prepareGameObjects(delta: number) {
    renderableGameObjects.length = 0;
    for (let i = 0, len = layerBuckets.length; i < len; i++)
        layerBuckets[i].length = 0;

    const halfWidth = RenderingConfig.maxScreenWidth / 2;
    const halfHeight = RenderingConfig.maxScreenHeight / 2;

    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    const minX = CameraManager.camX - halfWidth - MAX_OBJECT_MARGIN;
    const maxX = CameraManager.camX + halfWidth + MAX_OBJECT_MARGIN;
    const minY = CameraManager.camY - halfHeight - MAX_OBJECT_MARGIN;
    const maxY = CameraManager.camY + halfHeight + MAX_OBJECT_MARGIN;

    ObjectManager.getObjectsByBounds(minX, minY, maxX, maxY, renderableGameObjects);

    for (let i = 0, len = renderableGameObjects.length; i < len; i++) {
        const gameObject = renderableGameObjects[i];
        if (!gameObject || !gameObject.active) continue;

        gameObject.update(delta);

        const tmpX = gameObject.x + gameObject.xWiggle - xOffset;
        const tmpY = gameObject.y + gameObject.yWiggle - yOffset;

        if (isOnScreen(tmpX, tmpY, gameObject.scale + gameObject.blocker)) {
            const targetLayer = gameObject.layer + 1;

            if (!layerBuckets[targetLayer]) {
                layerBuckets[targetLayer] = [];
            }

            layerBuckets[targetLayer].push(gameObject);
        }
    }

    volcanoCanvas.animationTime += delta;
    volcanoCanvas.animationTime %= config.volcanoAnimationDuration;
}

export default function renderGameObjects(delta: number, layer: number) {
    const layerBucket = layerBuckets[layer + 1];
    if (!layerBucket) return;

    const player = Client.player;
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];
    const renderOwnership = Menu.getValue("renderOwnership");

    for (let i = 0, len = layerBucket.length; i < len; i++) {
        const gameObject = layerBucket[i];
        const tmpX = gameObject.x + gameObject.xWiggle - xOffset;
        const tmpY = gameObject.y + gameObject.yWiggle - yOffset;

        mainContext.globalAlpha = gameObject.hideFromEnemy ? .6 : 1;

        if (gameObject.isItem) {
            const getAllyColor = Client.mySID === gameObject.ownerSID ? "#8ecc51" : Client.isFriendly(gameObject.ownerSID ?? -1) ? "#ffff00" : "#cc5151";
            const tmpSprite = SpriteCache.getItemSprite(gameObject);

            mainContext.save();
            mainContext.translate(tmpX, tmpY);
            mainContext.rotate(gameObject.dir);

            mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

            if (gameObject.blocker) {
                mainContext.strokeStyle = "#db6e6e";
                mainContext.globalAlpha = 0.3;
                mainContext.lineWidth = 6;

                RendererUtils.drawCircle(0, 0, mainContext, gameObject.blocker, false, true);
            }

            if (gameObject.id === LIST_ID_MAP.TURRET) {
                mainContext.save();
                mainContext.strokeStyle = getAllyColor;
                mainContext.beginPath();
                mainContext.arc(0, 0, gameObject.scale, 0, Math.PI * 2 * (gameObject.reload / 20));
                mainContext.stroke();
                mainContext.restore();
            }

            if (player) renderObjectBreakerVisuals(gameObject, mainContext);
            renderWillBreakVisuals(gameObject, mainContext, getAllyColor);

            if (renderOwnership && typeof gameObject.ownerSID === "number" && gameObject.ownerSID !== 6967) {
                mainContext.rotate(-gameObject.dir);
                mainContext.font = "16px Hammersmith One";
                mainContext.fillStyle = getAllyColor;
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                mainContext.lineWidth = 8;
                mainContext.lineJoin = "round";

                const text = gameObject.ownerSID.toString();
                mainContext.strokeText(text, 0, -10);
                mainContext.fillText(text, 0, -10);
            }

            mainContext.restore();
        } else {
            if (gameObject.type == 4) {
                mainContext.globalAlpha = 1;

                const halfAnimationDuration = config.volcanoAnimationDuration / 2;
                const scaleFactor = 1.7 + 0.3 * (Math.abs(halfAnimationDuration - volcanoCanvas.animationTime) / halfAnimationDuration);
                const innerVolcanoScale = config.innerVolcanoScale * scaleFactor;

                mainContext.drawImage(
                    volcanoCanvas.body!,
                    tmpX - config.volcanoScale,
                    tmpY - config.volcanoScale,
                    config.volcanoScale * 2,
                    config.volcanoScale * 2
                );

                mainContext.drawImage(
                    volcanoCanvas.inner!,
                    tmpX - innerVolcanoScale,
                    tmpY - innerVolcanoScale,
                    innerVolcanoScale * 2,
                    innerVolcanoScale * 2
                );
            } else {
                const tmpSprite = SpriteCache.getResSprite(gameObject);

                if (Client.player && gameObject.type === 0) {
                    mainContext.fillStyle = "rgba(0, 0, 0, .6)";
                    RendererUtils.drawCircle(tmpX, tmpY, mainContext, gameObject.scale * .6, true, false);

                    const distSq = getDistSq(gameObject, Client.player.real_position);
                    const totalRadius = gameObject.scale + player.scale * 3;

                    if (distSq <= totalRadius * totalRadius) {
                        gameObject.globalAlphaDelta = Math.max(gameObject.globalAlphaDelta - (delta * 0.0025), 0.3);
                        mainContext.globalAlpha = gameObject.globalAlphaDelta;
                    } else {
                        gameObject.globalAlphaDelta = Math.min(gameObject.globalAlphaDelta + (delta * 0.0025), 1);
                        mainContext.globalAlpha = gameObject.globalAlphaDelta;
                    }
                }

                mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
            }
        }
    }
}