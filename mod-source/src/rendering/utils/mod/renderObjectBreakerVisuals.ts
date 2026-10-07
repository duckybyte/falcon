import GameObject from "@constants/GameObject";
import items from "@constants/items";
import Client from "@core/Client";
import CombatController from "@core/mod/combat/core/CombatController";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import FakeSocket from "@core/socket/FakeSocket";
import RendererUtils from "@rendering/RendererUtils";

function isBreakingMode() {
    return CombatController.currentMode === "autobreak" || CombatController.currentMode === "autobreakspike" ||
        CombatController.currentMode === "object breaking" || CombatController.currentMode === "tankspam" ||
        CombatController.currentMode === "autogrind" || CombatController.currentMode === "pit object breaking";
}

function getHexCode(obj: GameObject) {
    if (CombatController.currentMode === "object breaking")
        return "#e10000";

    if (CombatController.currentMode === "tankspam" || CombatController.currentMode === "autogrind")
        return "#00d700";

    if (CombatController.currentMode === "pit object breaking")
        return "#ecec00";

    return "#0077ff";
}

export default function renderObjectBreakerVisuals(gameObject: GameObject, mainContext: CanvasRenderingContext2D) {
    if (Client.socket instanceof FakeSocket) return;
    if (!Client.player) return;

    const isObjectBreakingMode = isBreakingMode();
    const isWithinRange = BreakerUtils.getObjectAttackDistance(Client.player, gameObject, items.weapons[Client.weaponIndex].range);

    if (isObjectBreakingMode && gameObject.isBreaking && isWithinRange) {
        mainContext.save();
        mainContext.globalAlpha = 1;
        mainContext.strokeStyle = getHexCode(gameObject);
        mainContext.lineWidth = 5.5;
        RendererUtils.drawCircle(0, 0, mainContext, gameObject.scale, false, true);
        mainContext.restore();
    }
}