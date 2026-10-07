import Client from "@core/Client";
import CameraManager from "@rendering/core/CameraManager";
import RenderingConfig from "@rendering/RenderingConfig";
import ScriptConfig from "@utils/config/ScriptConfig";

interface IBiome {
    top: number;
    bottom: number;
    color: string;
}

class BiomeHandler {
    static data: IBiome[];

    static fetch(): IBiome[] {
        if (!this.data) {
            this.data = [{
                top: 0,
                bottom: ScriptConfig.SNOW_BIOME_TOP,
                color: "#ffffff"
            }, {
                top: ScriptConfig.SNOW_BIOME_TOP,
                bottom: ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP,
                color: "#b6db66"
            }, {
                top: ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP,
                bottom: ScriptConfig.MAP_SIZE,
                color: "#dbc666"
            }];
        }

        return this.data;
    }
}

export default function renderBackground(mainContext: CanvasRenderingContext2D) {
    const buf = CameraManager.getOffset();
    const yOffset = buf[1];

    const player = Client.player;

    const maxScreenWidth = RenderingConfig.maxScreenWidth;
    const maxScreenHeight = RenderingConfig.maxScreenHeight;

    const viewTop = yOffset;
    const viewBottom = yOffset + maxScreenHeight;

    const mapHeight = ScriptConfig.MAP_SIZE;
    const hasPlayer = !!player;

    for (const biome of BiomeHandler.fetch()) {
        if (viewBottom > biome.top && viewTop < biome.bottom) {
            const topCheck = hasPlayer && biome.top > 0 ? player.render_position.y - maxScreenHeight / 2 >= biome.top : hasPlayer;
            const bottomCheck = hasPlayer && biome.bottom < mapHeight ? player.render_position.y + maxScreenHeight / 2 <= biome.bottom : hasPlayer;

            if (player && topCheck && bottomCheck) {
                mainContext.fillStyle = biome.color;
                mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
            } else {
                mainContext.fillStyle = biome.color;

                if (biome.top === 0 && viewTop < 0) {
                    const y = viewTop - viewTop;
                    const height = biome.bottom - viewTop;

                    mainContext.fillRect(0, y, maxScreenWidth, height);
                    continue;
                }

                if (biome.bottom === mapHeight && viewBottom > mapHeight) {
                    const y = Math.max(0, biome.top - viewTop);
                    mainContext.fillRect(0, y, maxScreenWidth, viewBottom);
                    continue;
                }

                const y = Math.max(0, biome.top - viewTop);
                const height = Math.min(biome.bottom, viewBottom) - Math.max(biome.top, viewTop);
                mainContext.fillRect(0, y, maxScreenWidth, height);
            }
        }
    }
}