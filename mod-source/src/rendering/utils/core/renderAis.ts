import { ais } from "@constants/Ai";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import renderAI from "@rendering/utils/core/renderAI";

export default function renderAis(dt: number) {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.globalAlpha = 1;

    for (let i = 0, len = ais.all.length; i < len; i++) {
        const ai = ais.all[i];

        if (ai && ai.active && ai.visible) {
            ai.animate(dt);

            mainContext.save();
            mainContext.translate(ai.render_position.x - xOffset, ai.render_position.y - yOffset);
            mainContext.rotate(ai.dir + ai.dirPlus - (Math.PI / 2));

            renderAI(ai, mainContext);
            mainContext.restore();
        }
    }
}