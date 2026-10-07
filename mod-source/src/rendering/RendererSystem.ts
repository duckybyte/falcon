import Client, { pingDisplay } from "@core/Client";
import PacketReplayer, { pauseIcon } from "@core/PacketReplayer";
import PacketBatcher from "@core/utils/PacketBatcher";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import SpriteCache from "@rendering/core/SpriteCache";
import WindowResizer from "@rendering/core/WindowResizer";
import RendererUtils from "@rendering/RendererUtils";
import RenderingConfig from "@rendering/RenderingConfig";
import renderAis from "@rendering/utils/core/renderAis";
import renderBackground from "@rendering/utils/core/renderBackground";
import renderGameObjects, { drawVolcanoImages, prepareGameObjects } from "@rendering/utils/core/renderGameObjects";
import renderMapBorders from "@rendering/utils/core/renderMapBorders";
import renderNames from "@rendering/utils/core/renderNames";
import renderPlayerChats from "@rendering/utils/core/renderPlayerChats";
import renderPlayers from "@rendering/utils/core/renderPlayers";
import renderProjectiles from "@rendering/utils/core/renderProjectiles";
import renderText from "@rendering/utils/core/renderText";
import renderWaterBodies from "@rendering/utils/core/renderWaterBodies";
import renderAutoPlayMovementLine from "@rendering/utils/mod/renderAutoPlayMovementLine";
import renderAutoPushVisuals from "@rendering/utils/mod/renderAutoPushVisuals";
import renderBuildingHealth from "@rendering/utils/mod/renderBuildingHealth";
import renderGrid from "@rendering/utils/mod/renderGrid";
import renderMinimap from "@rendering/utils/mod/renderMinimap";
import renderOneTickLine from "@rendering/utils/mod/renderOneTickLine";
import renderPathfindPath from "@rendering/utils/mod/renderPathfindPath";
import renderPlacements from "@rendering/utils/mod/renderPlacements";
import getElem from "@utils/dom/getElem";

CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, width: number, height: number, radius: number): CanvasRenderingContext2D {
    radius = Math.max(0, Math.min(radius, width / 2, height / 2));

    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + width, y, x + width, y + height, radius);
    this.arcTo(x + width, y + height, x, y + height, radius);
    this.arcTo(x, y + height, x, y, radius);
    this.arcTo(x, y, x + width, y, radius);
    this.closePath();

    return this;
};

export const gameCanvas = getElem<"canvas">("game-canvas");
export const mainContext = gameCanvas.getContext("2d")!;

export default class RendererSystem {
    static pixelDensity = window.devicePixelRatio || 1;

    private static waterMult = 1;
    private static waterPlus = 0;

    private static lastUpdate = Date.now();
    private static lastSent = Date.now();

    static fps = 0;
    private static fpsCount = 0;
    private static lastUpdateFrames = 0;

    private static updateFPS() {
        this.fpsCount++;

        if (Date.now() - this.lastUpdateFrames >= 1e3) {
            this.fps = this.fpsCount;
            this.lastUpdateFrames = Date.now();
            this.fpsCount = 0;

            pingDisplay.innerText = `Ping: ${Client.pingTime} ms | FPS: ${this.fps} | BWin: ${PacketBatcher.effectiveBatchWindow.toFixed(1)} ms`;
        }
    }

    private static updateDirection(now: number) {
        if (!this.lastSent || now - this.lastSent >= 200) {
            this.lastSent = now;
            //   Client.socket.sendMsg(PacketMap.MOOMOO.CLIENT_TO_SERVER.UPDATE_DIRECTION, Input.getAttackDir());
        }
    }

    private static updateWaterBodies(delta: number) {
        this.waterMult += this.waterPlus * RendererUtils.waveSpeed * delta;

        if (this.waterMult >= RendererUtils.waveMax) {
            this.waterMult = RendererUtils.waveMax;
            this.waterPlus = -1;
        } else if (this.waterMult <= 1) {
            this.waterMult = this.waterPlus = 1;
        }
    }

    static renderGame() {
        const now = Date.now();
        let delta = Client.mode === "replay" && PacketReplayer.isPaused ? 0 : now - this.lastUpdate;

        if (Client.mode === "replay" && !PacketReplayer.runForOneTick)
            delta *= PacketReplayer.speeds[PacketReplayer.currentSpeedIndex];

        if (delta > 0 && PacketReplayer.slowTime !== 0) {
            delta = PacketReplayer.slowTime;
        }

        this.lastUpdate = now;

        try {
            if (Client.mode === "replay")
                PacketReplayer.update(delta);

            this.updateFPS();

            const player = Client.player;
            if (player) this.updateDirection(now);

            CameraManager.lerpEntities(delta);
            const buf = CameraManager.getOffset();
            const xOffset = buf[0];
            const yOffset = buf[1];

            renderBackground(mainContext);
            this.updateWaterBodies(delta);

            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#dbc666";
            renderWaterBodies(xOffset, yOffset, mainContext, RendererUtils.riverPadding);

            mainContext.fillStyle = "#91b2db";
            renderWaterBodies(xOffset, yOffset, mainContext, (this.waterMult - 1) * 250);

            renderGrid(xOffset, yOffset);

            mainContext.globalAlpha = 1;
            mainContext.strokeStyle = RendererUtils.outlineColor;
            prepareGameObjects(delta);
            renderGameObjects(delta, -1);

            mainContext.globalAlpha = 1;
            mainContext.lineWidth = RendererUtils.outlineWidth;
            renderProjectiles(delta, 0);

            renderPlayers(delta, 0);
            renderAis(delta);
            renderGameObjects(delta, 0);

            renderProjectiles(delta, 1);
            renderGameObjects(delta, 1);
            renderPlayers(delta, 1);

            renderGameObjects(delta, 2);
            renderGameObjects(delta, 3);

            renderBuildingHealth();
            renderPlacements(delta);
            renderMapBorders(mainContext);

            mainContext.globalAlpha = 1;
            mainContext.fillStyle = `rgba(0, 0, 70, ${Menu.getValue("nightMode") ? .55 : .35})`;
            mainContext.fillRect(0, 0, RenderingConfig.maxScreenWidth, RenderingConfig.maxScreenHeight);

            renderAutoPlayMovementLine();
            renderAutoPushVisuals();
            renderPathfindPath();

            renderNames();
            renderPlayerChats(delta);
            renderText(delta);
            renderOneTickLine(xOffset, yOffset);

            if (Client.mode === "replay" && Client.player) {
                mainContext.save();
                mainContext.translate(Client.player.real_position.x - xOffset, Client.player.real_position.y - yOffset);
                mainContext.fillStyle = "rgba(251, 0, 255, 0.15)";
                RendererUtils.drawCircle(0, 0, mainContext, 35, true);
                mainContext.restore();
            }

            renderMinimap();
        } finally {
            if (PacketReplayer.slowTime !== 0)
                PacketReplayer.slowTime = 0;

            if (PacketReplayer.runForOneTick) {
                PacketReplayer.runForOneTick = false;
                PacketReplayer.isPaused = true;

                const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
                if (pauseMaterialIcon) pauseMaterialIcon.innerHTML = "play_arrow";
            }

            requestAnimationFrame(() => this.renderGame());
        }
    }

    static async init() {
        drawVolcanoImages();
        SpriteCache.renderIcons();
        WindowResizer.init();
        this.renderGame();
    }
}