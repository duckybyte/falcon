import items from "@constants/items";
import Player from "@constants/Player";
import { accessoryMap, hatMap } from "@constants/store";
import ScriptConfig from "@utils/config/ScriptConfig";

export default class MovementUtils {
    static getFrictionMult(accelX: number, accelY: number, delta: number) {
        const r = Math.pow(0.993, delta);
        const logR = Math.log(r);
        const invOneMinusR = 1 / (1 - r);

        const accelMagSq = accelX * accelX + accelY * accelY;

        let frictionMult = 0;

        if (accelMagSq >= .0001) {
            const n = Math.ceil(Math.log(.0001 / accelMagSq) / logR);
            frictionMult = (1 - Math.pow(r, n)) * invOneMinusR;
        }

        return frictionMult;
    }

    static getMovementDt(player: Player, skinIndex: number, tailIndex: number) {
        const wpn = items.weapons[player.weaponIndex];
        const skin = hatMap.get(skinIndex)!;
        const tail = accessoryMap.get(tailIndex)!;
        const dt = ScriptConfig.SERVER_UPDATE_SPEED;
        const spdMult = (wpn?.spdMult || 1) * (skin ? (skin.spdMult || 1) : 1) * (tail ? (tail.spdMult || 1) : 1);
        return ScriptConfig.PLAYER_SPEED * spdMult * dt * dt;
    }
}