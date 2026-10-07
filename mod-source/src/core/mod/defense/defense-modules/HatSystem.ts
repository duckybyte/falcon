import items, { WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@constants/Player";
import { STORE_ACCESSORY_ID, STORE_ACCESSORY_MAP, STORE_HAT_ID, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import CombatController from "@core/mod/combat/core/CombatController";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import BreakerUtils from "@core/mod/defense/utils/BreakerUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";

export default class HatSystem {
    static needTick = 0;
    static sentHatPacket = false;
    private static stopMoveDuration = 0;

    static allowHatSwitch() {
        return DefenseSystem.skinIndex === STORE_HAT_MAP.IGNORE;
    }

    static canTick(execute = true) {
        const player = Client.player;
        const tickOffset = (ModManager.tick - player.bullTick) % 9;

        if (tickOffset === 0 && execute) {
            Client.player.bullTick = ModManager.tick + 1;
        }

        if (DefenseSystem.state.totalDamage + 5 >= 100)
            return false; // don't bTick when we can get sync'd by 100+ dmg

        if (!player.skins[STORE_HAT_MAP.BULL_HELMET] || player.clowned)
            return false;

        if (tickOffset === 0 && execute && player.shameCount > 0) {
            this.needTick++;
        }

        return (player.shameCount > 0 && tickOffset === 0) || this.needTick > 1;
    }

    private static isDaggerInRange(enemy: Player) {
        const player = Client.player;
        const HITBOX_OFFSET = 63;
        const range = (items.weapons[WEAPON_ID_MAP.DAGGERS].range + HITBOX_OFFSET) * 1.3;

        const rangeSq = range * range;
        const distSq = getDistSq(player.real_position, enemy.real_position);
        if (distSq <= rangeSq) return true;

        const nextDistSq = getDistSq(player.next_position, enemy.next_position);
        return nextDistSq < distSq && nextDistSq <= rangeSq;
    }

    private static weaponDataArrayBuffer: [0 | 1, number][] = [[0, 0], [1, 15]];

    private static canDaggerEscape(enemy: Player) {
        const trap = enemy.trap;
        if (!trap) return true;

        const weaponData = enemy.weaponData;
        const breakWeapons = this.weaponDataArrayBuffer;
        let checkLength = 1;

        breakWeapons[0][1] = weaponData.primary;
        breakWeapons[1][1] = weaponData.secondary;

        if (weaponData.secondary === WEAPON_ID_MAP.GREAT_HAMMER) {
            checkLength++;
        }

        for (let i = 0; i < checkLength; i++) {
            const group = breakWeapons[i][0];
            const weaponId = breakWeapons[i][1];
            const hitsUntilBreak = BreakerUtils.hitsUntilBreak(enemy, weaponId, trap.health);
            if (hitsUntilBreak !== 1) continue;

            const reload = enemy.getReload(group);
            if (reload === 1) return true;
        }

        return false;
    }

    private static shouldUseDaggerSoldier(enemy: Player) {
        if (Client.player.trap) return true;
        if (!this.canDaggerEscape(enemy)) return false;
        return this.isDaggerInRange(enemy);
    }

    private static readonly POLEARM_SPEED = items.weapons[WEAPON_ID_MAP.POLEARM].speed;

    private static shouldUsePolearmSoldier(enemy: Player) {
        const player = Client.player;
        const state = DefenseSystem.state;

        if (player.trap || DefenseSystem.canPlaceOnMe || state.spikeThreats > 0) return true;
        if (player.turretThreats > 0 || ModManager.enemyData.rangedInstaThreats > 0) return true;

        for (let i = 0, len = state.sources.length; i < len; i++) {
            if (state.sources[i] !== "primaryDamage") return true;
        }

        if (ModManager.enemyData.nearby.length > 1) return true;
        const speed = ScriptConfig.SERVER_UPDATE_SPEED / this.POLEARM_SPEED;
        const reload = enemy.getReload(0);
        return reload + speed >= 1;
    }

    private static shouldUseDefensiveGear(enemy: Player) {
        const primaryId = enemy.weaponData.primary;

        if (primaryId === WEAPON_ID_MAP.DAGGERS) {
            return this.shouldUseDaggerSoldier(enemy);
        }

        if (getDistSq(Client.player.real_position, enemy.real_position) > 40000) return false;
        if (primaryId === WEAPON_ID_MAP.POLEARM) return this.shouldUsePolearmSoldier(enemy);
        return true;
    }

    private static fetchBestHat(): STORE_HAT_ID {
        const player = Client.player;
        const currentKillAction = AttackManager.currentAttackAction;
        const activityList = ModManager.activityList;
        const nearestEnemy = ModManager.enemyData.nearest;
        const rangedInstaThreats = ModManager.enemyData.rangedInstaThreats;
        const canUseSpikeGear = AttackManager.antiBuller.consider && !DefenseSystem.canPlaceOnMe && DefenseSystem.state.spikeThreats === 0 && player.tailIndex === STORE_ACCESSORY_MAP.CORRUPT_X_WINGS;

        if (typeof Client.lastMoveDir === "number")
            this.stopMoveDuration = 0;

        if (DefenseSystem.skinIndex !== STORE_HAT_MAP.IGNORE) {
            activityList.push(
                DefenseSystem.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET ?
                    "forceSoldier" : "forceEMP"
            );
            return DefenseSystem.skinIndex;
        }

        if (currentKillAction) {
            const id = currentKillAction.skinData[0];
            const isAccessory = currentKillAction.skinData[1];
            if (!isAccessory) return id as STORE_HAT_ID;
        }

        const tapModeHat = AttackManager.oneTicker.getMoveHat();
        if (AttackManager.oneTicker.tapMode && tapModeHat !== STORE_HAT_MAP.IGNORE) {
            return tapModeHat;
        }

        if (CombatController.skinIndex !== STORE_HAT_MAP.IGNORE) {
            if (CombatController.skinIndex !== STORE_HAT_MAP.TANK_GEAR) {
                if (CombatController.mustBeSoldier || DefenseSystem.state.spikeThreats > 0)
                    return STORE_HAT_MAP.SOLDIER_HELMET;

                if (player.skins[STORE_HAT_MAP.EMP_HELMET]) {
                    if (player.turretThreats > 0 || (!AutoBreaker.allSpikesBuffer.length && rangedInstaThreats > 0))
                        return STORE_HAT_MAP.EMP_HELMET;
                }

                if (this.canTick()) {
                    activityList.push("bullTick");
                    return STORE_HAT_MAP.BULL_HELMET;
                }

                if (canUseSpikeGear && !AutoBreaker.allSpikesBuffer.length && CombatController.currentMode !== "autobreakspike")
                    return STORE_HAT_MAP.SPIKE_GEAR;
            }

            return CombatController.skinIndex;
        }

        if (rangedInstaThreats > 0 && typeof Client.lastMoveDir !== "number" && player.skins[STORE_HAT_MAP.EMP_HELMET])
            return STORE_HAT_MAP.EMP_HELMET;

        if (this.canTick()) {
            activityList.push("bullTick");
            return STORE_HAT_MAP.BULL_HELMET;
        }

        if (player.turretThreats > 0 && player.skins[STORE_HAT_MAP.EMP_HELMET])
            return STORE_HAT_MAP.EMP_HELMET;

        if (canUseSpikeGear) return STORE_HAT_MAP.SPIKE_GEAR;

        if (player.real_position.y >= 6850 && player.real_position.y <= 7550) {
            return STORE_HAT_MAP.FLIPPER_HAT;
        }

        if (nearestEnemy && this.shouldUseDefensiveGear(nearestEnemy)) {
            if (typeof Client.lastMoveDir !== "number" && rangedInstaThreats > 0 && player.skins[STORE_HAT_MAP.EMP_HELMET])
                return STORE_HAT_MAP.EMP_HELMET;

            return STORE_HAT_MAP.SOLDIER_HELMET;
        }

        if (player.real_position.y <= 2400) {
            return STORE_HAT_MAP.WINTER_CAP;
        }

        if (typeof Client.lastMoveDir === "number") {
            return STORE_HAT_MAP.BOOSTER_HAT;
        }

        this.stopMoveDuration++;
        if (this.stopMoveDuration < 2)
            return STORE_HAT_MAP.IGNORE;

        return STORE_HAT_MAP.SOLDIER_HELMET;
    }

    private static readonly CLOSE_DISTANCE_SQ = 350 * 350;
    private static readonly SUPER_CLOSE_DISTANCE_SQ = 200 * 200;

    private static fetchBestAccessory(): STORE_ACCESSORY_ID {
        const currentKillAction = AttackManager.currentAttackAction;
        const player = Client.player;
        const nearestEnemy = ModManager.enemyData.nearest;
        const primaryId = player.weapons[0];

        if (currentKillAction) {
            const id = currentKillAction.skinData[0];
            const isAccessory = currentKillAction.skinData[1];
            if (isAccessory) return id as STORE_ACCESSORY_ID;
        }

        if (AttackManager.currentAttackAction?.tickMode) {
            return STORE_ACCESSORY_MAP.SHADOW_WINGS;
        }

        if (nearestEnemy && AutoPusher.theSpike && primaryId !== WEAPON_ID_MAP.STICK) {
            const daggerMethod = parseInt(Menu.getValue("attackInPush:dagger_method"));
            const isWithinRange = getDistSq(player.real_position, nearestEnemy.real_position) <= 15625;

            const daggerBullSpam = primaryId === WEAPON_ID_MAP.DAGGERS && daggerMethod === 1;
            const isNotDaggers = primaryId !== WEAPON_ID_MAP.DAGGERS;

            if ((isNotDaggers || daggerBullSpam) && isWithinRange) {
                ModManager.activityList.push("forceStrikeWings");
                return STORE_ACCESSORY_MAP.SHADOW_WINGS;
            }
        }

        if (nearestEnemy && CombatUtils.isAttackPrimary(player.weapons[0])) {
            const distSq = getDistSq(player.real_position, nearestEnemy.real_position);

            const isWithinRange = distSq <= this.CLOSE_DISTANCE_SQ;
            const isWithinClosestRange = distSq <= this.SUPER_CLOSE_DISTANCE_SQ;

            const enemyPrimaryId = nearestEnemy.weaponData.primary;
            const isAntiBullable = CombatUtils.isAntiBullablePrimary(enemyPrimaryId) ||
                (enemyPrimaryId === WEAPON_ID_MAP.DAGGERS && player.weapons[0] === WEAPON_ID_MAP.POLEARM && player.weaponData.primaryVariant >= WEAPON_VARIANT_MAP.DIAMOND);

            const hasAntiBullWeapon = CombatUtils.isAttackPrimary(player.weaponData.primary);
            const isAntiBullOn = Menu.getValue("antiBull");
            const canUseCXWings = isWithinClosestRange && isAntiBullOn && hasAntiBullWeapon && isAntiBullable;

            if (isWithinRange) {
                return canUseCXWings ? STORE_ACCESSORY_MAP.CORRUPT_X_WINGS : STORE_ACCESSORY_MAP.SHADOW_WINGS;
            }
        }

        return STORE_ACCESSORY_MAP.MONKEY_TAIL;
    }

    static storeEquip(id: number, isAccessory: boolean) {
        if (this.sentHatPacket) return;

        const player = Client.player;
        const pool = isAccessory ? player.tails : player.skins;
        const curr = isAccessory ? player.tailIndex : player.skinIndex;

        if ((id === 0 || pool[id]) && curr !== id) {
            this.sentHatPacket = true;
            Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.STORE, false, id, isAccessory);
            if (isAccessory) ModManager.brainState.accUsed = id;
            else ModManager.brainState.hatUsed = id;
            return;
        }

        if (pool[id]) return;
        if (curr === 0) return;

        this.sentHatPacket = true;
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.STORE, false, 0, isAccessory);

        if (isAccessory) ModManager.brainState.accUsed = 0;
        else ModManager.brainState.hatUsed = 0;
    }

    static storeBuy(id: number, isAccessory: boolean) {
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.STORE, true, id, isAccessory);
    }

    static main() {
        const hatId = this.fetchBestHat();
        const accId = this.fetchBestAccessory();

        if (hatId !== -1) this.storeEquip(hatId, false);
        if (accId !== -1) this.storeEquip(accId, true);
    }
}