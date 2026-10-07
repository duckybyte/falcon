import items from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import PotentialObjectManager from "@core/logic/PotentialObjectManager";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import ModManager from "@core/ModManager";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import SocketListener from "@core/socket/SocketListener";
import PacketMap from "@root/utils/socket/PacketMap";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";

type GatherAnimationPacket = typeof PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION;

export default class GatherAnimationEvent extends MessageHandler<GatherAnimationPacket> {
    run(sid: number, didHit: boolean, index: number) {
        const player = PlayerManager.get(sid);

        if (player) {
            PlayerCombatManager.update(player, index, undefined, true);
            player.reloads[index] = 0;

            const wpn = items.weapons[index];
            player.animTime = player.animSpeed = wpn.speed;
            player.targetAngle = (didHit ? -ScriptConfig.HIT_ANGLE : -Math.PI);
            player.tmpRatio = 0;
            player.animIndex = 0;

            player.justAttacked = true;
            ModManager.justAttacked.push(player);

            if (player.sid === Client.mySID) {
                player.next_state.slowMult -= wpn.hitSlow ?? .3;
                if (player.next_state.slowMult <= 0) player.next_state.slowMult = 0;
            }

            ModManager.nextTick(() => {
                const totalDamage = BreakerUtils.getObjectDamage(player, index < 9 ? 0 : 1, player.skinIndex !== STORE_HAT_MAP.TANK_GEAR);
                const onRenderObjects = PotentialObjectManager.onRenderObjects;

                for (let i = 0, len = onRenderObjects.length; i < len; i++) {
                    const obj = onRenderObjects[i];
                    if (!obj.active) continue;
                    if (!Client.isTeam(player, obj.ownerSID)) continue;

                    const tmpDir = getDir(obj, player.real_position);
                    if (getAngleDist(tmpDir, player.d2) > ScriptConfig.GATHER_ANGLE) continue;
                    obj.health -= totalDamage;
                }
            });

            if (didHit) {
                const tmpB = Client.buildingsHit;
                Client.buildingsHit = [];

                ModManager.nextTick(() => {
                    const totalDamage = BreakerUtils.getObjectDamage(player, index < 9 ? 0 : 1, player.skinIndex !== STORE_HAT_MAP.TANK_GEAR);

                    for (let i = 0, len = tmpB.length; i < len; i++) {
                        const obj = tmpB[i];

                        obj.health -= totalDamage;
                        if (obj.health <= 0) obj.health = obj.maxHealth - totalDamage;

                        if (sid === Client.mySID) {
                            obj.playerDamageDealt += totalDamage;
                        }

                        SocketListener.logPacket(
                            PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.UPDATE_OBJECT_HEALTH,
                            [obj.sid, obj.health]
                        );
                    }
                });
            }
        }
    }
}