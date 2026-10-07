import items, { WEAPON_ID_MAP } from "@constants/items";
import { STORE_ACCESSORY_ID, STORE_ACCESSORY_MAP, STORE_HAT_ID, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AttackQueuePool, { AttackAction } from "@core/mod/combat/core/AttackQueuePool";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import ObjectBreaker from "@core/mod/defense/modules/ObjectBreaker";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import AutoGrinder from "@placing/modules/AutoGrinder";
import PacketMap from "@root/utils/socket/PacketMap";
import { Input } from "@ui/Hook";

type CombatControllerMode = "autobreak" | "tankspam" | "autobreakspike" | "bullspam" | "autogrind" | "object breaking" | "pit object breaking" | "none";

export default class CombatController {
    static tankSpam = false;
    static attackState = {
        confirm: false,
        status: false
    };

    static mustBeSoldier = false;
    static currentMode: CombatControllerMode = "none";
    static skinIndex: STORE_HAT_ID = STORE_HAT_MAP.IGNORE;
    static tailIndex: STORE_ACCESSORY_ID = STORE_ACCESSORY_MAP.IGNORE;

    static bestWeaponForBreak(): number;
    static bestWeaponForBreak(mode: "id"): number;
    static bestWeaponForBreak(mode: "group"): 0 | 1 | 2;

    static bestWeaponForBreak(mode: "id" | "group" = "id"): number | (0 | 1 | 2) {
        const weapons = Client.player.weapons;
        const hasHammer = weapons[1] === WEAPON_ID_MAP.GREAT_HAMMER;

        if (mode === "id")
            return hasHammer ? WEAPON_ID_MAP.GREAT_HAMMER : weapons[0];

        return (hasHammer ? 1 : 0) as (0 | 1 | 2);
    }

    static selectWeapon(id: number = Client.weaponIndex, requiredSwitchCheck?: boolean) {
        if (this.needsWeaponSwitch(id) && requiredSwitchCheck) return;
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD, id, true);
        Client.weaponIndex = id;
    }

    static needsWeaponSwitch(id: number) {
        return Client.weaponIndex === id && Client.player.weaponIndex === id;
    }

    static sendAutoGather() {
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.AUTO_GATHER, 1);
    }

    static hitOnce() {
        if (Client.player.health <= 0) return;
        this.attackState.confirm = true;
    }

    private static mainEnd() {
        ObjectBreaker.gameObjectQueue.length = 0;
    }

    private static manageHitAction(currentKillAction: Readonly<AttackAction | undefined>) {
        if (!currentKillAction) return false;
        const nearestEnemy = ModManager.enemyData.nearest;

        if (!HatSystem.allowHatSwitch()) {
            AttackManager.stopAttackAction();
            return false;
        }

        if (nearestEnemy && currentKillAction.reason === "oneTick") {
            const damages = nearestEnemy.damages;

            for (let i = 0; i < damages.length; i++) {
                const dmg = nearestEnemy.damages[i];
                const dmgAfterSoldier = dmg / .75;

                if (Math.abs(dmgAfterSoldier - 25) <= .001 || dmg === 25) {
                    // one tick failed (turret damage should register after all actions end lol)
                    AttackManager.stopAttackAction();
                    return false;
                }
            }
        }

        if (currentKillAction.reason !== "don't do 1234")
            ModManager.activityList.push(currentKillAction.reason);

        this.selectWeapon(currentKillAction.wpnId);
        if (!currentKillAction.noAttack)
            this.hitOnce();

        return true;
    }

    static postTick() {
        const player = Client.player;
        const currentKillAction = AttackManager.currentAttackAction;
        if (!currentKillAction) return;

        const wpnId = currentKillAction.wpnId;
        if (!currentKillAction.noAttack && player.weapons.includes(wpnId) && items.weapons[wpnId].projectile !== undefined)
            player.reloads[currentKillAction.wpnId] = 0;
    }

    private static bullHitSequence = AttackQueuePool.createAttackSequence();
    private static checkReload(group: 0 | 1) {
        const player = Client.player;
        const weapons = player.weapons;

        if (player.getReload(group) !== 1) {
            ModManager.activityList.push(`reloading${group === 1 ? "Secondary" : "Primary"}`);
            this.selectWeapon(weapons[group], true);
            return true;
        }

        return false;
    };

    static main() {
        try {
            const player = Client.player;
            const weapons = player.weapons;
            const activityList = ModManager.activityList;

            this.currentMode = "none";
            this.skinIndex = STORE_HAT_MAP.IGNORE;
            this.tailIndex = STORE_ACCESSORY_MAP.IGNORE;

            if (this.manageHitAction(AttackManager.currentAttackAction)) return;

            if (player.trap && AutoBreaker.main()) {
                activityList.push("autoBreak");
                return;
            }

            if (this.tankSpam) {
                this.currentMode = "tankspam";
                const bestId = Input.keys["ShiftLeft"] ? player.weapons[0] : this.bestWeaponForBreak();
                this.selectWeapon(bestId, true);
                activityList.push("tankSpam");

                if (player.getReload(bestId < 9 ? 0 : 1) === 1) {
                    this.skinIndex = STORE_HAT_MAP.TANK_GEAR;
                    this.hitOnce();
                }
                return;
            }

            if (AutoGrinder.main()) {
                this.currentMode = "autogrind";
                activityList.push("autoGrind");
                return;
            }

            if (Input.keys["Space"]) {
                this.currentMode = "bullspam";
                activityList.push("bullSpam");
                const id = player.weapons[0];
                this.selectWeapon(id, true);

                if (player.getReload(0) === 1) {
                    this.skinIndex = STORE_HAT_MAP.BULL_HELMET;
                    AttackManager.prepareBullHitSequence(this.bullHitSequence);
                    AttackManager.setAttackAction(this.bullHitSequence[0]);
                    this.manageHitAction(AttackManager.currentAttackAction);
                }

                return;
            }

            if (ObjectBreaker.main()) {
                this.currentMode = ObjectBreaker.isObjectBreaking ? "object breaking" : "pit object breaking";
                activityList.push("objectBreaker");
                return;
            }

            if (this.checkReload(1)) return;
            if (this.checkReload(0)) return;
            if (!Menu.getValue("selectBestWeapon")) return;

            if (weapons[1] === WEAPON_ID_MAP.GREAT_HAMMER && (weapons[0] === WEAPON_ID_MAP.POLEARM || weapons[0] === WEAPON_ID_MAP.KATANA)) {
                this.selectWeapon(weapons[1], true);
            } else {
                this.selectWeapon(weapons[0], true);
            }
        } finally {
            this.mainEnd();
        }
    }
}