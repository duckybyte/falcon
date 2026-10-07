import { ais } from "@constants/Ai";
import Client from "@core/Client";
import PlayerManager from "@core/logic/players/PlayerManager";
import { Point } from "@mod-types/index";
import RenderingConfig from "@rendering/RenderingConfig";
import getDirComp from "@utils/angle/getDirComp";
import lerpAngle from "@utils/angle/lerpAngle";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDist from "@utils/geometry/getDist";
import lerp from "@utils/math/lerp";

export default class CameraManager {
    static camX = ScriptConfig.MAP_SIZE / 2;
    static camY = ScriptConfig.MAP_SIZE / 2;

    private static offsetBuf = [0, 0];

    static getOffset() {
        const xOffset = this.camX - RenderingConfig.maxScreenWidth / 2;
        const yOffset = this.camY - RenderingConfig.maxScreenHeight / 2;

        this.offsetBuf[0] = xOffset;
        this.offsetBuf[1] = yOffset;

        return this.offsetBuf;
    }

    private static cameraPos: Point = { x: this.camX, y: this.camY };

    static lerpEntities(delta: number) {
        const player = Client.player;
        const cameraPos = this.cameraPos;

        if (player) {
            cameraPos.x = this.camX;
            cameraPos.y = this.camY;

            const tmpDist = getDist(cameraPos, player.render_position);
            const dir = getDirComp(player.render_position, cameraPos);
            const camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);

            if (tmpDist > 0.05) {
                this.camX += camSpd * dir.x;
                this.camY += camSpd * dir.y;
            } else {
                this.camX = player.render_position.x;
                this.camY = player.render_position.y;
            }
        }

        const players = PlayerManager.players.visible.all;
        const playersLen = players.length;
        const totalLen = playersLen + ais.all.length;

        for (let i = 0; i < totalLen; i++) {
            const entity = players[i] || ais.all[i - playersLen];

            if (entity.forcePos) {
                entity.render_position.x = entity.real_position.x;
                entity.render_position.y = entity.real_position.y;
                entity.dir = entity.d2;
            } else {
                entity.deltaTime += delta;
                const t = Math.min(entity.still ? 1 : 1.7, entity.deltaTime / 170);

                entity.render_position.x = lerp(entity.last_render_position.x, entity.real_position.x, t);
                entity.render_position.y = lerp(entity.last_render_position.y, entity.real_position.y, t);
                entity.dir = lerpAngle(entity.d1, entity.d2, t);
            }
        }
    }
}