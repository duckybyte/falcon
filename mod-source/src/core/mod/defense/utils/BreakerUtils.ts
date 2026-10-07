import GameObject from "@constants/GameObject";
import items, { LIST_ID_MAP, WEAPON_ID_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import { PotentialObject } from "@core/logic/PotentialObjectManager";
import { Point } from "@mod-types/index";

export default class BreakerUtils {
    static getObjectDamage(player: Player, group: 0 | 1, dontUseTank?: boolean) {
        const haveTankGear = player.sid === Client.mySID ? player.skins[STORE_HAT_MAP.TANK_GEAR] : true;
        const wpn = PlayerCombatManager.fetch(player, group);
        const wpnData = items.weapons[wpn.id];

        let dmg = wpn.dmg;
        if (!dontUseTank && haveTankGear) dmg *= 3.3;
        dmg *= (wpnData.sDmg ?? 1);

        return dmg;
    }

    static hitsUntilBreak(player: Player, id: number, health: number) {
        const damage = this.getObjectDamage(player, id < 9 ? 0 : 1);
        const raw = health / damage;
        return (raw + 1) | 0;
    }

    static getObjectAttackDistance(a: Player | Point, b: GameObject | PotentialObject, range: number) {
        const HITBOX_OFFSET = b.scale;
        const totalRange = range + HITBOX_OFFSET;

        const posA = a instanceof Player ? a.real_position : a;

        const dx = posA.x - b.x;
        const dy = posA.y - b.y;

        return (dx * dx + dy * dy) < (totalRange * totalRange);
    }

    static isDoubleHitPrimary(id: number, targetObjectId?: number) {
        if (targetObjectId === LIST_ID_MAP.POISON_SPIKES && Client.player.shameCount >= 4 && id === WEAPON_ID_MAP.POLEARM) return true;
        return id !== WEAPON_ID_MAP.POLEARM;
    }
}