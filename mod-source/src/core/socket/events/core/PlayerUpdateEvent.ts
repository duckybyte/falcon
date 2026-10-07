
import { LIST_ID_MAP, WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import TextManager from "@core/logic/TextManager";
import DefenseUtils from "@core/mod/defense/utils/DefenseUtils";
import ModManager from "@core/ModManager";
import PacketReplayer from "@core/PacketReplayer";
import MessageHandler from "@core/socket/events/utils/MessageHandler";
import FakeSocket from "@core/socket/FakeSocket";
import SocketListener from "@core/socket/SocketListener";
import Menu from "@menu/Menu";
import CameraManager from "@rendering/core/CameraManager";
import PacketMap from "@root/utils/socket/PacketMap";
import getDir from "@utils/angle/getDir";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import inRange from "@utils/math/inRange";
type UpdatePlayerPacket = typeof PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS;

export default class PlayerUpdateEvent extends MessageHandler<UpdatePlayerPacket> {
    private tmpSidSet = new Set();
    static lastReceive = 0;

    private preTick() {
        Client.buildingsHit = [];

        ModManager.tick++;
        ModManager.enemyData.nearest = null;
        ModManager.enemyData.nearby.length = 0;
        ModManager.enemyData.all.length = 0;
        ModManager.enemyData.rangedInstaThreats = 0;
    }

    private onTick(positions: any[], attributes: any[]) {
        const player = Client.player;
        PlayerStateManager.placementMap.clear();

        let placement = 0;

        for (let i = 0; i < positions.length; i += 4) {
            const player = PlayerManager.get(positions[i]);
            if (!player) continue;

            PlayerStateManager.trackPlacement(positions[i], placement);
            placement++;

            const lastX = player.last_position.x = player.real_position.x;
            const lastY = player.last_position.y = player.real_position.y;

            player.last_render_position.x = player.render_position.x;
            player.last_render_position.y = player.render_position.y;

            player.still = player.real_position.x == positions[i + 1] && player.real_position.y == positions[i + 2];
            player.real_position.x = positions[i + 1];
            player.real_position.y = positions[i + 2];

            if (player.sid === Client.mySID && (PacketReplayer.slowTime !== 0 || PacketReplayer.quickTime)) {
                player.render_position.x = player.real_position.x;
                player.render_position.y = player.real_position.y;
                CameraManager.camX = player.real_position.x;
                CameraManager.camY = player.real_position.y;
            }

            const realX = player.real_position.x;
            const realY = player.real_position.y;
            player.next_position.x = realX * 2 - lastX;
            player.next_position.y = realY * 2 - lastY;

            player.d1 = player.d2;
            player.d2 = positions[i + 3] / 100;
            player.deltaTime = 0;

            PlayerManager.players.visible.add(player);
            player.forcePos = Client.mode === "replay" && PacketReplayer.slowTime !== 0 ? true : !player.visible;
            player.stateUpdate.position = true;
            player.visible = true;
        }

        for (let i = 0; i < attributes.length; i += 10) {
            const player = PlayerManager.get(attributes[i]);
            if (!player) continue;

            player.buildIndex = attributes[i + 1];
            player.weaponIndex = attributes[i + 2];
            player.weaponVariant = attributes[i + 3];

            const newTeam = attributes[i + 4];
            SocketListener.handleAllianceUpdates(player, newTeam);
            player.team = newTeam;

            player.isLeader = attributes[i + 5];
            if (player.skinIndex !== STORE_HAT_MAP.SHAME) player.lastSkinIndex = player.skinIndex;
            player.skinIndex = attributes[i + 6];

            player.tailIndex = attributes[i + 7];
            player.iconIndex = attributes[i + 8];
            player.zIndex = attributes[i + 9];

            player.next_state.sid = player.sid;
            player.next_state.x = player.real_position.x;
            player.next_state.y = player.real_position.y;
            player.stateUpdate.attribute = true;
            PlayerManager.players.visible.add(player);

            if (!player.clowned && player.skinIndex === STORE_HAT_MAP.SHAME) player.startShameTimer();
            player.clowned = player.skinIndex === STORE_HAT_MAP.SHAME;
        }

        if (player.team) {
            const allianceBucket = Client.allianceMap.get(player.team);
            const len = Client.alliancePlayers.length;
            if (!allianceBucket) return;

            allianceBucket.clear();
            allianceBucket.add(Client.mySID);

            for (let i = 0; i < len; i += 2) {
                const sid = Client.alliancePlayers[i] as number;
                allianceBucket.add(sid);
            }
        } else {
            Client.alliancePlayers.length = 0;
        }
    }

    private postTick(hidden: number[]) {
        let smallestDistance = Infinity;
        this.tmpSidSet.clear();

        const players = PlayerManager.players.handler.all;
        const stackedText = Menu.getValue("stackedText");
        const allVisible = PlayerManager.players.visible.all;
        const myPos = Client.player.real_position;

        for (let i = 0; i < hidden.length; i++) {
            const player = PlayerManager.get(hidden[i]);
            if (!player) continue;

            PlayerManager.players.visible.remove(player.sid);
            player.visible = false;
        }

        for (let i = 0; i < allVisible.length; i++) {
            const player = allVisible[i];
            if (!player) continue;

            if (player.clowned && player.skinIndex === STORE_HAT_MAP.SHAME)
                player.shameTimer -= ScriptConfig.SERVER_UPDATE_SPEED;

            player.last_render_position.x = player.render_position.x;
            player.last_render_position.y = player.render_position.y;

            if (!player.stateUpdate.attribute) {
                if (player.skinIndex !== STORE_HAT_MAP.SHAME) player.lastSkinIndex = player.skinIndex;
            }

            PlayerCombatManager.updateReloads(player, ScriptConfig.SERVER_UPDATE_SPEED);
            player.appendHat(player.skinIndex);
            PlayerCombatManager.update(player, player.weaponIndex, player.weaponVariant);

            if (myPos && !Client.isFriendly(player.sid)) {
                ModManager.enemyData.all.push(player);

                const pos = player.real_position;
                const distanceSq = getDistSq(pos, myPos);

                if (smallestDistance > getDistSq(pos, myPos)) {
                    smallestDistance = distanceSq;
                    ModManager.enemyData.nearest = player;
                }

                const primaryId = player.weaponData.primary;
                const secondaryId = player.weaponData.secondary;

                const isGreatHammer = secondaryId === WEAPON_ID_MAP.GREAT_HAMMER;
                const isShield = secondaryId === WEAPON_ID_MAP.WOODEN_SHIELD;
                const isMcGrabby = secondaryId === WEAPON_ID_MAP.MC_GRABBY;
                const isKatana = primaryId === WEAPON_ID_MAP.KATANA;
                const isMusket = secondaryId === WEAPON_ID_MAP.MUSKET && player.weaponData.secondaryConfirmed;
                const isHomoWeapon = (secondaryId === WEAPON_ID_MAP.CROSSBOW || secondaryId === WEAPON_ID_MAP.REPEATER_CROSSBOW) && player.weaponData.secondaryConfirmed;
                const hasNormalHammer = primaryId === WEAPON_ID_MAP.TOOL_HAMMER;
                const canBowInsta = !hasNormalHammer && !isGreatHammer && !isShield && !isKatana && !isMcGrabby && !isMusket && !isHomoWeapon;

                const hasDiaPolearm = player.weaponData.primary === WEAPON_ID_MAP.POLEARM && player.weaponData.primaryVariant >= WEAPON_VARIANT_MAP.DIAMOND;
                const hasCorrectBow = player.weaponData.secondary === WEAPON_ID_MAP.CROSSBOW || player.weaponData.secondary === WEAPON_ID_MAP.REPEATER_CROSSBOW;
                const canBoostTick = hasDiaPolearm && hasCorrectBow && player.getReload(0) === 1 && player.getReload(1) === 1 && player.getReload(2) === 1;

                // idk if these ranges are right, just guessed pls no attack me :(
                if (canBoostTick && inRange(distanceSq, 90_000, 136_900)) {
                    ModManager.enemyData.rangedInstaThreats++;
                }

                if (inRange(distanceSq, 250_000, 562_500) && canBowInsta && DefenseUtils.isInLineOfSight(player, PlayerCombatManager.fetch(player, 1))) {
                    ModManager.enemyData.rangedInstaThreats++;
                }

                if (distanceSq <= 136_900) {
                    player.ticksNotNearby = 0;
                    ModManager.enemyData.nearby.push(player);
                } else {
                    player.ignoreDamageConsideration = false;
                    player.ticksNotNearby++;

                    if (player.ticksNotNearby >= 18) {
                        player.profilingData.preHitAttacks = 0;
                        player.profilingData.latePreHitAttacks = 0;

                        if (player.spikeId !== LIST_ID_MAP.POISON_SPIKES)
                            player.spikeId = LIST_ID_MAP.SPINNING_SPIKES;
                    }
                }
            }

            player.deltaTime = 0;
            player.stateUpdate.attribute = false;
            player.stateUpdate.position = false;
            this.tmpSidSet.add(player.sid);
        }

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];

            if (!this.tmpSidSet.has(player.sid)) {
                player.resetReloads();
            }

            if (stackedText) {
                const healthHealed = ~~player.healthHealed;
                const damageTaken = ~~player.damageTaken;

                if (player.healthHealed > 0 && Client.mySID === player.sid)
                    TextManager.add(player.real_position.x, player.real_position.y, -healthHealed, 0);

                if (player.damageTaken > 0 && Client.mySID !== player.sid)
                    TextManager.add(player.real_position.x, player.real_position.y, damageTaken, 0);
            }

            player.healthHealed = 0;
            player.damageTaken = 0;
        }

        if (ModManager.enemyData.nearest)
            ModManager.enemyData.angle = getDir(ModManager.enemyData.nearest.real_position, Client.player.real_position);
    }

    run(positions: number[], attributes: any[], hidden: any[]) {
        this.preTick();
        this.onTick(positions, attributes);
        this.postTick(hidden);

        // run the mod brain regardless of socket instance but
        // log brainState to debug if changes result in correct response while in replay mode
        // used to fix healing issues and stuff :)

        ModManager.main();
        if (Client.socket instanceof FakeSocket)
            console.log(ModManager.brainState);

        for (const e of ModManager.enemyData.all) e.damages.length = 0;
    }
}