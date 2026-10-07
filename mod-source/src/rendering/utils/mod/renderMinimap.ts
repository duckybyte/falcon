import Client from "@core/Client";
import RendererUtils from "@rendering/RendererUtils";
import getElem from "@utils/dom/getElem";
import ScriptConfig from "@utils/config/ScriptConfig";

const mapDisplay = getElem<"canvas">("map-canvas");
const mapContext = mapDisplay.getContext("2d")!;

mapDisplay.width = 300;
mapDisplay.height = 300;

export default function renderMinimap() {
    const player = Client.player;

    if (player) {
        mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#fff";
        RendererUtils.drawCircle(
            (player.render_position.x / ScriptConfig.MAP_SIZE) * mapDisplay.width,
            (player.render_position.y / ScriptConfig.MAP_SIZE) * mapDisplay.height,
            mapContext,
            7,
            true
        );

        if (Client.lastDeath) {
            const lastDeath = Client.lastDeath;

            mapContext.fillStyle = "#fc5553";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText(
                "x",
                (lastDeath.x / ScriptConfig.MAP_SIZE) * mapDisplay.width,
                (lastDeath.y / ScriptConfig.MAP_SIZE) * mapDisplay.height
            );
        }

        const minimapData = Client.minimapData;
        if (player.team && minimapData.length) {
            for (let i = 0; i < minimapData.length; i += 2) {
                mapContext.fillStyle = "rgba(255, 255, 255, 0.35)";

                RendererUtils.drawCircle(
                    (minimapData[i] / ScriptConfig.MAP_SIZE) * mapDisplay.width,
                    (minimapData[i + 1] / ScriptConfig.MAP_SIZE) * mapDisplay.width,
                    mapContext,
                    7,
                    true
                );
            }
        }
    }
}