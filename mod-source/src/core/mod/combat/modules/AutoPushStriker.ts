import items, { WEAPON_ID_MAP } from "@constants/items";
import Client from "@core/Client";
import PlayerCombatManager from "@core/logic/players/core/PlayerCombatManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import BullspamMethod from "@core/mod/combat/modules/push-strikes/modules/BullspamMethod";
import PredictiveMethod from "@core/mod/combat/modules/push-strikes/modules/PredictiveMethod";
import ShameStrikeMethod from "@core/mod/combat/modules/push-strikes/modules/ShameStrikeMethod";
import { PushStrikeContext } from "@core/mod/combat/modules/push-strikes/utils/PushStrikeMethod";
import CombatModule from "@core/mod/combat/utils/CombatModule";
import CombatUtils from "@core/mod/combat/utils/CombatUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";

type AutoPushStrikeTypes = "7shame" | "bullspam" | "predictive" | "disabled";

export default class AutoPusherStriker extends CombatModule {
    protected initialize() {
        this.bullspamMethod.initialize();
        this.sevenShameMethod.initialize();
        this.predictiveMethod.initialize();
    }

    protected canExecute() {
        if (!AutoPusher.theSpike) return false;
        if (!ModManager.enemyData.nearest) return false;
        return true;
    }

    private bullspamMethod = new BullspamMethod();
    private sevenShameMethod = new ShameStrikeMethod();
    private predictiveMethod = new PredictiveMethod();
    private ctx: Partial<PushStrikeContext> = {};

    protected execute() {
        const player = Client.player;
        if (!Menu.getValue("attackInPush")) return;

        const daggerMethod = parseInt(Menu.getValue("attackInPush:dagger_method"));
        const highDmgMethod = parseInt(Menu.getValue("attackInPush:polearm_katana_method"));
        const genericMethod = parseInt(Menu.getValue("attackInPush:generic_method"));

        const primaryId = player.weapons[0];
        const isDaggers = primaryId === WEAPON_ID_MAP.DAGGERS;
        const isHighDmg = primaryId === WEAPON_ID_MAP.POLEARM || primaryId === WEAPON_ID_MAP.KATANA;
        const primary = PlayerCombatManager.fetch(player, 0);

        let attackMethod: AutoPushStrikeTypes = "disabled";

        if (isDaggers) {
            attackMethod = (["7shame", "bullspam", "disabled"][daggerMethod] ?? "disabled") as AutoPushStrikeTypes;
        } else if (isHighDmg) {
            attackMethod = (["predictive", "bullspam", "disabled"][highDmgMethod] ?? "disabled") as AutoPushStrikeTypes;
        } else {
            attackMethod = (["bullspam", "disabled"][genericMethod] ?? "disabled") as AutoPushStrikeTypes;
        }

        if (attackMethod === "disabled") return;
        if (primary.id === WEAPON_ID_MAP.STICK) return;

        const nearestEnemy = ModManager.enemyData.nearest!;
        const isEnemyInRange = CombatUtils.getCombatDistance(nearestEnemy, player, items.weapons[primary.id].range);
        if (!isEnemyInRange) return;

        const spike = AutoPusher.theSpike!;
        const tick = ModManager.tick;
        const ctx = this.ctx;

        ctx.primary = primary;
        ctx.tick = tick;
        ctx.player = player;
        ctx.nearestEnemy = nearestEnemy;
        ctx.spike = spike;
        ctx.scale = spike.scale + 35.8;

        switch (attackMethod) {
            case "7shame":
                this.sevenShameMethod.execute(ctx as PushStrikeContext);
                break;
            case "bullspam":
                this.bullspamMethod.execute(ctx as PushStrikeContext);
                break;
            case "predictive":
                this.predictiveMethod.execute(ctx as PushStrikeContext);
                break;
        }
    }

    update() {
        this.predictiveMethod.update();
    }
}