import CombatUtils from "@combat-utils/CombatUtils";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import CombatController from "@core/mod/combat/core/CombatController";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import Menu from "@menu/Menu";
import PlacerUtils from "@placing/utils/PlacerUtils";
import { Input } from "@ui/Hook";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";

const HALF_PI = Math.PI / 2;

export default class AutoGrinder {
    static weaponIndex = 0;
    static aimDir = 0;

    static main(): boolean {
        const player = Client.player;
        if (!Menu.getValue("autoGrind")) {
            this.weaponIndex = Client.weaponIndex;
            return false;
        }

        const tpId = PlacerUtils.placeSevenSlot(player);
        const offset = Math.PI * .45;

        const primaryLimit = parseInt(Menu.getValue("grindPrimaryLimit"));
        const secondaryLimit = parseInt(Menu.getValue("grindSecondaryLimit"));
        const hasPrimaryReached = player.weaponData.primaryVariant >= primaryLimit;

        const primaryId = player.weapons[0];
        const secondaryId = player.weapons[1];

        const haveSecondary = typeof secondaryId === "number";
        const isProjectile = haveSecondary && items.weapons[secondaryId].projectile !== undefined;
        const hasSecondaryReached = !haveSecondary || isProjectile || player.weaponData.secondaryVariant >= secondaryLimit;

        if (hasPrimaryReached && hasSecondaryReached) {
            Menu.setValue("autoGrind", false);
            return false;
        }

        let targetId = this.weaponIndex;

        if (this.weaponIndex < 9) {
            if (hasPrimaryReached && !hasSecondaryReached) {
                this.weaponIndex = secondaryId;
                targetId = secondaryId;
            }
        } else {
            if (hasSecondaryReached && !hasPrimaryReached) {
                this.weaponIndex = primaryId;
                targetId = primaryId;
            }
        }

        const rawAimDir = Input.getAttackDir();
        const aimDir = Math.round(rawAimDir / HALF_PI) * HALF_PI;
        const shouldUseSecondaryAssist = tpId === LIST_ID_MAP.TURRET && CombatUtils.isAttackPrimary(primaryId) && targetId === primaryId && secondaryId === WEAPON_ID_MAP.GREAT_HAMMER;
        this.aimDir = aimDir;

        if (shouldUseSecondaryAssist) targetId = secondaryId;
        const closeObjects = ObjectManager.pool.closeObjects;
        const secondaryHitDamage = BreakerUtils.getObjectDamage(player, 1, !player.skins[STORE_HAT_MAP.TANK_GEAR]);
        const wpnRange = items.weapons[primaryId].range - 1;
        let hasTurrets = false;

        for (let i = 0, len = closeObjects.length; i < len; i++) {
            const gameObject = closeObjects[i];
            if (tpId !== LIST_ID_MAP.TURRET) break;
            if (!gameObject || gameObject.id !== LIST_ID_MAP.TURRET) continue;

            const tmpDir = getDir(gameObject, player.real_position);
            if (getAngleDist(aimDir, tmpDir) > ScriptConfig.GATHER_ANGLE) continue;
            if (gameObject.health > secondaryHitDamage) continue;
            if (!BreakerUtils.getObjectAttackDistance(player, gameObject, wpnRange)) continue;

            if (shouldUseSecondaryAssist) targetId = primaryId;
            hasTurrets = true;
            break;
        }

        if (tpId === LIST_ID_MAP.TURRET) {
            if (!hasTurrets) {
                PlacementSystem.checkPlace(tpId, aimDir);
                PlacementSystem.checkPlace(tpId, aimDir + offset);
                PlacementSystem.checkPlace(tpId, aimDir - offset);
            }
        } else {
            const Q_PI = Math.PI * .25;
            PlacementSystem.checkPlace(tpId, aimDir + Q_PI);
            PlacementSystem.checkPlace(tpId, aimDir - Q_PI);
        }

        CombatController.selectWeapon(targetId, true);
        if (player.getReload(targetId < 9 ? 0 : 1) === 1) {
            CombatController.skinIndex = STORE_HAT_MAP.TANK_GEAR;
            CombatController.hitOnce();
        }
        return true;
    }
}