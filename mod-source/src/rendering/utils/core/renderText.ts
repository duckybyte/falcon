import TextManager from "../../../core/logic/TextManager";
import CameraManager from "../../core/CameraManager";
import { mainContext } from "../../RendererSystem";

export default function renderText(delta: number) {
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    mainContext.globalAlpha = 1;
    for (const text of TextManager.texts.values()) {
        text.update(delta);

        if (text.life <= 0) {
            TextManager.texts.delete(text.id);
            continue;
        }

        mainContext.save();
        mainContext.globalAlpha = text.alpha;
        mainContext.translate(text.x - xOffset, text.y - yOffset);
        text.render(mainContext);
        mainContext.restore();
    }
}