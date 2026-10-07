import { STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import PlacementSystem from "@core/mod/combat/core/PlacementSystem";
import DefenseSystem, { DefenseContext } from "@core/mod/defense/DefenseSystem";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

export interface AutoHealerInternal {
    healthAfterDamage: number;
    willDieIfDoNothing: boolean;
    alreadyForcedHat: boolean;
    empDamage: number;
    healthAfterSoldier: number;
    currentHealth: number;
    expectedDamage: number;
}

export default class AutoHealer {
    static heal() {
        if (DefenseSystem.alreadyHealed || !Menu.getValue("autoHeal"))
            return;

        const player = Client.player;
        const remainingHealth = player.maxHealth - player.health;

        const foodId = player.items[0];
        const amount = HealerUtils.getFoodValue(foodId);
        const times = Math.ceil(remainingHealth / amount);

        DefenseSystem.alreadyHealed = true;
        for (let i = 0; i < times; i++) PlacementSystem.place(foodId);
        ModManager.brainState.healingUsed = times;
        ModManager.activityList.push(`autoHealing x${times}`);
    }

    private static healIfNoShame() {
        if (ModManager.tick - Client.player.hitTime <= 1)
            return;

        this.heal();
        ModManager.brainState.healingResponse = "0shame heal";
    }

    static main(ctx: DefenseContext) {
        const player = Client.player;
        ModManager.brainState.healingInternal.currentHealth = player.health;
        if (player.health === 100 || player.health <= 0 || player.clowned) return;

        const healthAfterDamage = player.health - ctx.totalDamage;
        const willDieIfDoNothing = healthAfterDamage <= 0;
        const alreadyForcedHat = DefenseSystem.skinIndex !== STORE_HAT_MAP.IGNORE;

        ModManager.brainState.healingInternal.healthAfterDamage = healthAfterDamage;
        ModManager.brainState.healingInternal.willDieIfDoNothing = willDieIfDoNothing;
        ModManager.brainState.healingInternal.alreadyForcedHat = alreadyForcedHat;
        ModManager.brainState.healingInternal.empDamage = ctx.empDamage;
        ModManager.brainState.healingInternal.healthAfterSoldier = player.health - ctx.totalDamage * .75;
        ModManager.brainState.healingInternal.expectedDamage = ctx.totalDamage;

        if (willDieIfDoNothing && alreadyForcedHat) {
            if (DefenseSystem.skinIndex === STORE_HAT_MAP.SOLDIER_HELMET) {
                if (player.health - ctx.totalDamage * .75 <= 0) {
                    this.heal();
                    ModManager.brainState.healingResponse = "instant soldier + heal";
                    return;
                } else {
                    ModManager.brainState.healingResponse = "instant soldier + no heal";
                    return;
                }
            } else {
                this.heal();
                ModManager.brainState.healingResponse = "instant random hat + heal";
                return;
            }
        }

        if (willDieIfDoNothing) {
            if (ctx.canEMP && ctx.empDamage > 0 && healthAfterDamage + ctx.empDamage > 0 && player.skins[STORE_HAT_MAP.EMP_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.EMP_HELMET;
                ModManager.brainState.healingResponse = "0shame emp anti";
            } else if (ctx.canSoldier && player.health - ctx.totalDamage * .75 > 0 && player.skins[STORE_HAT_MAP.SOLDIER_HELMET]) {
                DefenseSystem.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                ModManager.brainState.healingResponse = "0shame soldier anti";
            } else {
                this.heal();
                ModManager.brainState.healingResponse = "instant heal";
                return;
            }
        }

        this.healIfNoShame();
    }
}