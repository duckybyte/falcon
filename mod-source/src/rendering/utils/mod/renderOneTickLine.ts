import OneTicker from "@combat-modules/OneTicker";
import { WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Client from "@core/Client";
import AttackManager from "@core/mod/combat/core/AttackManager";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import { mainContext } from "@rendering/RendererSystem";
import getDirComp from "@utils/angle/getDirComp";

export default function renderOneTickLine(xOffset: number, yOffset: number) {
    const player = Client.player;
    const nearestEnemy = ModManager.enemyData.nearest;

    if (!Menu.getValue("dynamicOneTick")) return;
    if (!nearestEnemy) return;
    if (player.health <= 0) return;
    if (player.weapons[0] !== WEAPON_ID_MAP.POLEARM) return;
    if (player.weaponData.primaryVariant < WEAPON_VARIANT_MAP.DIAMOND) return;

    const dir = getDirComp(player.real_position, nearestEnemy.real_position);

    mainContext.save();
    mainContext.translate(nearestEnemy.real_position.x - xOffset, nearestEnemy.real_position.y - yOffset);
    mainContext.strokeStyle = AttackManager.oneTicker.tapMode ? "red" : "white";
    mainContext.lineWidth = 4.5;
    mainContext.lineCap = "round";
    mainContext.beginPath();

    mainContext.moveTo(dir.x * OneTicker.MIN_DIST, dir.y * OneTicker.MIN_DIST);
    mainContext.lineTo(dir.x * OneTicker.MAX_DIST, dir.y * OneTicker.MAX_DIST);

    mainContext.stroke();
    mainContext.restore();
}