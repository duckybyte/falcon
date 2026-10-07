import CombatUtils from "@combat-utils/CombatUtils";
import items, { LIST_ID_MAP, WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@constants/Player";
import { accessories, CORRUPT_X_WINGS_INDEX, hats, SPIKE_GEAR_INDEX, STORE_ACCESSORY_MAP, STORE_HAT_ID, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerCombatManager, { WeaponFetchData } from "@core/logic/players/core/PlayerCombatManager";
import PlayerStateManager from "@core/logic/players/core/PlayerStateManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import AutoHealer from "@core/mod/defense/defense-modules/AutoHealer";
import HatSystem from "@core/mod/defense/defense-modules/HatSystem";
import MovementManager from "@core/mod/defense/defense-modules/MovementManager";
import AutoBreaker from "@core/mod/defense/modules/AutoBreaker";
import DefenseUtils from "@core/mod/defense/utils/DefenseUtils";
import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import GameEventTracker from "@core/mod/utils/GameEventTracker";
import ModManager from "@core/ModManager";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import { Point } from "@mod-types/index";
import PacketMap from "@root/utils/socket/PacketMap";
import MovementPhysicsSimulator, { KnockbackSimAction, SimulationOptions } from "@simulation/MovementPhysicsSimulator";
import getAngleDist from "@utils/angle/getAngleDist";
import getDir from "@utils/angle/getDir";
import getDirComp from "@utils/angle/getDirComp";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import lineInCircle from "@utils/geometry/lineInCircle";
import withinDist from "@utils/geometry/withinDist";

interface EnemyProcessResult {
    primaryDamage: number;
    hasRuby: boolean;
    hasSecondaryHitRecently: boolean;
}

type KnockbackSimActions = [
    [KnockbackSimAction]
];

export interface DefenseContext {
    canEMP: boolean;
    canSoldier: boolean;
    totalDamage: number;
    empDamage: number;
    sources: string[];
    spikeThreats: number;
}

export interface ISpikeTickPatternRec {
    amount: number;
    resolveOccurances: number;
    hasOccuredBefore: boolean;
    currentMax: number;
    max: number;
    reset: boolean;
    resetTicks: number;
    lastOccured: number;
}

interface KnockbackVector {
    attacker?: number;
    pos: Point;
    kb: number;
    used: boolean;
    canceled: boolean;
}

function calculateKnockVector(enemyPos: Point, kb: number): KnockbackVector {
    return {
        pos: { x: enemyPos.x, y: enemyPos.y },
        kb, canceled: false, used: false
    };
}

export default class DefenseSystem {
    static state: DefenseContext = {
        canEMP: true,
        canSoldier: true,
        totalDamage: 0,
        empDamage: 0,
        sources: [],
        spikeThreats: 0
    };

    private static spikeTickPatternRec: ISpikeTickPatternRec = {
        amount: 0,
        resolveOccurances: 0,
        hasOccuredBefore: false,
        reset: false,
        lastOccured: Date.now(),
        currentMax: 3,
        resetTicks: 0,
        max: 3
    };

    static isBeingBowInstaed = false;
    static alreadyHealed = false;
    static canPlaceOnMe = false;

    static skinIndex: STORE_HAT_ID = STORE_HAT_MAP.IGNORE;
    static knockbackVectors: KnockbackVector[] = [];

    static delayedKnockbackVectorHead = 0;
    static delayedKnockbackVectorBuffers: KnockbackVector[][] = [
        [], [],
        [], []
    ];

    static delayedKnockbackVectors: KnockbackVector[] = this.delayedKnockbackVectorBuffers[0];

    static trapHitState = 0;
    static preHitChances = 0;
    private static previousOnMeState = false;

    private static processSpikeTickPotential(reset: boolean = false) {
        if (!Menu.getValue("usePatternRec")) return true;

        const data = this.spikeTickPatternRec;
        if (!reset && data.currentMax === 1 && Client.player.shameCount === 0) return true;

        if (reset) {
            data.resetTicks++;

            if (data.resetTicks >= 2) {
                data.amount = 0;
                data.currentMax = data.max;
                data.resolveOccurances = 0;
                data.hasOccuredBefore = false;
                data.reset = true;
                return true;
            }
        }

        if (data.resolveOccurances > 0) {
            data.resolveOccurances--;
            return false;
        }

        data.amount++;
        data.reset = false;

        if (data.amount >= data.currentMax) {
            if (data.hasOccuredBefore) {
                data.currentMax = Math.max(data.currentMax - 1, 1);
                data.resolveOccurances = Math.floor(Math.random() * 2) + 1;
            } else {
                data.resolveOccurances = 1;
            }

            data.amount = 0;
            data.hasOccuredBefore = true;
        }

        return true;
    }

    private static handleSpikePlacement(hasEnemyUseHammer: boolean, highestPrimaryDamage: number, highestSpikeDamage: number, isPlacingOnMe: boolean) {
        const player = Client.player;
        const state = this.state;
        const activityList = ModManager.activityList;
        const isLethalSpikeCombo = highestPrimaryDamage + highestSpikeDamage >= 100;
        const justGotOutOfTrap = player.wasTrapped && !player.trap;
        const justCanPlaceOnMe = (player.wasTrapped || !this.previousOnMeState) && isPlacingOnMe && !player.trap;

        if (justGotOutOfTrap || isPlacingOnMe) {
            state.canEMP = false;
            this.spikeTickPatternRec.lastOccured = Date.now();

            if (justGotOutOfTrap || justCanPlaceOnMe) {
                const spikeTickThreat = (isPlacingOnMe && isLethalSpikeCombo) || justCanPlaceOnMe;

                if (isLethalSpikeCombo && (justGotOutOfTrap || justCanPlaceOnMe))
                    this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;

                if (spikeTickThreat && this.processSpikeTickPotential(!hasEnemyUseHammer)) {
                    state.totalDamage += highestSpikeDamage;
                    state.sources.push(isLethalSpikeCombo ? "spikeTickSoldier" : "spikePlacement");
                } else if (!spikeTickThreat && !this.spikeTickPatternRec.reset) {
                    activityList.push("resetSpikeTickPR");
                    this.processSpikeTickPotential(true);
                }
            } else if (player.shameCount < Math.floor(Math.random() * 2) + 2) {
                state.totalDamage += highestSpikeDamage;
                state.sources.push("onMeSpike");
                state.canEMP = false;
            }
        } else if (Date.now() - this.spikeTickPatternRec.lastOccured >= 5e3 && !this.spikeTickPatternRec.reset) {
            activityList.push("resetSpikeTickPR+");
            this.processSpikeTickPotential(true);
        }
    }

    private static oldConsiderAutoBreakHit = false;

    private static isInRange(player: Player, enemy: Player, weapon: WeaponFetchData) {
        const wpnData = items.weapons[weapon.id];
        const HITBOX_OFFSET = 63;

        if (typeof wpnData.projectile !== "undefined") return true;
        const doesNotHaveProjectiles = !player.hadProjDamages && !player.projDamages.length;

        if (enemy.weaponData.primary !== WEAPON_ID_MAP.POLEARM || enemy.weaponData.primaryVariant < WEAPON_VARIANT_MAP.DIAMOND || doesNotHaveProjectiles) {
            // not elegant but works :)
            return withinDist(player.real_position, enemy.next_position, wpnData.range + HITBOX_OFFSET) ||
                withinDist(player.next_position, enemy.real_position, wpnData.range + HITBOX_OFFSET) ||
                withinDist(player.next_position, enemy.next_position, wpnData.range + HITBOX_OFFSET) ||
                withinDist(player.real_position, enemy.real_position, wpnData.range + HITBOX_OFFSET);
        }

        const playerPos = player.real_position;
        const enemyPos = enemy.real_position;

        const playerPrimarySpd = items.weapons[player.weaponData.primary].spdMult ?? 1;
        const playerSecondarySpd = items.weapons[player.weaponData.secondary].spdMult ?? 1;

        const enemyPrimarySpd = items.weapons[enemy.weaponData.primary].spdMult ?? 1;
        const enemySecondarySpd = items.weapons[enemy.weaponData.secondary].spdMult ?? 1;

        const fastestPlayerWeapon = !player.trap || !player.wasTrapped ? Math.max(playerPrimarySpd, playerSecondarySpd) : 0;
        const fastestEnemyWeapon = !enemy.trap || !enemy.wasTrapped ? Math.max(enemyPrimarySpd, enemySecondarySpd) : 0;
        const distSqBetween = getDistSq(playerPos, enemyPos);
        const dtSq = ScriptConfig.SERVER_UPDATE_SPEED * ScriptConfig.SERVER_UPDATE_SPEED;

        const boostMonkeyTailSpdBoost = 1.566;
        const enemyDt = fastestEnemyWeapon * boostMonkeyTailSpdBoost * dtSq * ScriptConfig.PLAYER_SPEED;
        const playerDt = fastestPlayerWeapon * boostMonkeyTailSpdBoost * dtSq * ScriptConfig.PLAYER_SPEED;
        const totalRange = wpnData.range + HITBOX_OFFSET + playerDt + enemyDt + 2;

        return distSqBetween <= (totalRange * totalRange);
    }

    private static processEnemy(
        enemy: Player,
        isGoingToAutoBreakHit: boolean,
        myPositionalSpot: number,
        knockbackVectors: KnockbackVector[],
        multipleNearbyEnemies: boolean,
        highestSpikeDamage: number
    ): EnemyProcessResult {
        if (enemy.ignoreDamageConsideration) {
            enemy.ignoreDamageConsideration = false;
            return { primaryDamage: 0, hasRuby: false, hasSecondaryHitRecently: false };
        }

        const player = Client.player;
        const state = this.state;
        const sources = state.sources;

        const primary = PlayerCombatManager.fetch(enemy, 0);
        const secondary = PlayerCombatManager.fetch(enemy, 1);
        const turret = PlayerCombatManager.fetch(enemy, 2);

        if (turret.reload < HealerUtils.RELOAD_BUFFER) {
            state.canEMP = false;
        }

        if (state.canEMP && !DefenseUtils.canUseEMP(enemy)) {
            state.canEMP = false;
        }

        const hasMonkeyTailOn = enemy.skinIndex !== STORE_HAT_MAP.BULL_HELMET && enemy.tailIndex === STORE_ACCESSORY_MAP.MONKEY_TAIL;
        const canThisEnemyPlaceOnMe = enemy.placePotential.onMeBufferIndex > 0;

        let primaryDamage = primary.reload >= HealerUtils.RELOAD_BUFFER && this.isInRange(player, enemy, primary) ? (hasMonkeyTailOn ? primary.dmg : primary.dmg * 1.5) : 0;
        let secondaryDamage = secondary.reload >= HealerUtils.RELOAD_BUFFER && this.isInRange(player, enemy, secondary) && DefenseUtils.isInLineOfSight(enemy, secondary) ? secondary.dmg : 0;
        const turretDamage = turret.reload >= HealerUtils.RELOAD_BUFFER && DefenseUtils.isInLineOfSight(enemy, turret) ? 25 : 0;

        if (primaryDamage > 0 && turretDamage > 0) {
            const priTurretDamage = hasMonkeyTailOn ?
                primary.dmg <= 31.25 ?
                    primary.dmg :
                    CombatUtils.getMonkeyDamage(primary.dmg) + turretDamage :
                primary.dmg + turretDamage;

            primaryDamage = Math.max(priTurretDamage, primaryDamage);
        }

        if (secondary.dmg > 0 && turretDamage === 0 && typeof items.weapons[secondary.id].projectile !== "number" && !hasMonkeyTailOn) {
            secondaryDamage *= 1.5;
        }

        const hasHammer = primary.id === WEAPON_ID_MAP.TOOL_HAMMER;
        if (primary.id === WEAPON_ID_MAP.TOOL_HAMMER) {
            primaryDamage = items.weapons[WEAPON_ID_MAP.POLEARM].dmg * (hasMonkeyTailOn ? 1 : 1.5);
        }

        const effectiveSecondary = hasHammer ? 0 : secondaryDamage + turretDamage;
        const effectivePrimary = primaryDamage + (primaryDamage > 0 && canThisEnemyPlaceOnMe ? highestSpikeDamage : 0);

        const hasDamage = primaryDamage > 0 || effectiveSecondary > 0;
        const correctHitState = enemy.profilingData.preHitAttacks > 1 || this.trapHitState > 2;
        const correctAttackState = (enemy.profilingData.preHitAttacks === 0 && this.preHitChances > 1) || !isGoingToAutoBreakHit;
        const isEnemyNotHittingRandomly = enemy.profilingData.randomHitAttacks < 1 && enemy.profilingData.latePreHitAttacks < 1;
        const wasReloaded = enemy.getLastReload(0) !== 1 && primary.reload === 1;
        const confirmationHits = enemy.profilingData.preHitAttacks < 2 && enemy.profilingData.randomHitAttacks === 0 && wasReloaded && primary.dmg + highestSpikeDamage >= 100;

        ModManager.brainState.randomHitStates.push({ sid: enemy.sid, hits: enemy.profilingData.randomHitAttacks });

        if (
            hasDamage && player.trap && correctHitState && AutoBreaker.allSpikesBuffer.length &&
            correctAttackState && isEnemyNotHittingRandomly && !confirmationHits &&
            !enemy.profilingData.checkLateHit
        ) {
            sources.push(`ignoredEnemy:${enemy.sid}`);
            return { primaryDamage: 0, hasRuby: false, hasSecondaryHitRecently: false };
        }

        const longestTickSinceHit = Math.max(enemy.weaponData.lastPrimaryTickHit, enemy.weaponData.lastSecondaryTickHit, enemy.weaponData.lastTurretTickHit);
        const hasNotEvenAttacked = ModManager.enemyData.nearest!.sid !== enemy.sid && multipleNearbyEnemies && !primary.recentlyHit && !secondary.recentlyHit && !turret.recentlyHit;
        const hasRuby = primary.variant === 3 || (secondary.id === WEAPON_ID_MAP.GREAT_HAMMER && secondary.variant === 3);

        if (hasDamage) {
            if (effectivePrimary >= effectiveSecondary) {
                state.totalDamage += primaryDamage * (hasNotEvenAttacked ? longestTickSinceHit > 18 ? .05 : .5 : 1);
                sources.push(hasNotEvenAttacked ? longestTickSinceHit > 18 ? `superReducedPrimaryDamage` : `reducedPrimaryDamage` : `primaryDamage`);
            } else {
                state.totalDamage += secondaryDamage * (hasNotEvenAttacked ? longestTickSinceHit > 18 ? .05 : .5 : 1);
                sources.push(hasNotEvenAttacked ? longestTickSinceHit > 18 ? `superReducedSecondaryDamage` : `reducedSecondaryDamage` : `secondaryDamage`);

                if (turretDamage > 0) {
                    state.totalDamage += 25;
                    state.empDamage += 25;
                    sources.push("turretDamage");
                }
            }
        }

        const primaryKB = primaryDamage > 0 || primary.recentlyHit ? primary.totalKnock : 0;
        const secondaryKB = secondaryDamage > 0 || secondary.recentlyHit ? secondary.totalKnock : 0;
        const turretKB = turret.recentlyHit || turretDamage > 0 ? .3 : 0;

        let kb = Math.max(primaryKB + turretKB, secondaryKB + turretKB);
        const enemyPositionalSpot = PlayerStateManager.placementMap.get(enemy.sid)!;
        const vec1 = calculateKnockVector(enemy.real_position, kb);
        const vec2 = calculateKnockVector(enemy.next_position, kb);

        if (enemyPositionalSpot > myPositionalSpot) {
            vec1.attacker = vec2.attacker = enemy.sid;
            this.delayedKnockbackVectors.push(vec1, vec2);
        } else {
            knockbackVectors.push(vec1, vec2);
        }

        return {
            primaryDamage, hasRuby,
            hasSecondaryHitRecently: !primary.recentlyHit && (secondary.recentlyHit || turret.recentlyHit)
        };
    }

    private static secondaryRHitTicks = 0;
    private static normalSpikeSoldiers = 0;
    private static tmpPoint = { x: 0, y: 0 };
    private static simActions: KnockbackSimActions = [
        [{ type: "knockback", pos: { x: 0, y: 0 }, knockPower: .2 }]
    ];

    private static scanEnvironment() {
        const player = Client.player;
        const myPos = player.real_position;
        const nextPos = player.next_position;

        const nearby = ModManager.enemyData.nearby;
        const state = this.state;
        const sources = this.state.sources;

        const gameObjectSet = new Set<number>();
        const allSpikes = ObjectManager.pool.allSpikes;
        const knockbackVectors = this.knockbackVectors;
        knockbackVectors.length = 0;

        const myPositionalSpot = PlayerStateManager.placementMap.get(player.sid)!;
        const additionalKnockbackVectors = this.delayedKnockbackVectorBuffers[this.delayedKnockbackVectorHead];
        const isAutoBreakableWeaponReloaded = player.getReload(AutoBreaker.currentBestGroup) === 1;
        const considerAutoBreakHit = isAutoBreakableWeaponReloaded;
        const isGoingToAutoBreakHit = !this.oldConsiderAutoBreakHit && considerAutoBreakHit;

        this.delayedKnockbackVectorHead = (this.delayedKnockbackVectorHead + 1) % this.delayedKnockbackVectorBuffers.length;
        this.delayedKnockbackVectors = this.delayedKnockbackVectorBuffers[this.delayedKnockbackVectorHead];
        this.delayedKnockbackVectors.length = 0;

        let highestPrimaryDamage = -Infinity;
        let hasEnemyUseHammer = false;
        let isPlacingOnMe = false;
        let hasRuby = false;
        let isSecondaryHitRecently = false;
        let highestSpikeDamage = 20;

        state.totalDamage += player.turretThreats * 25;
        if (player.turretThreats > 0) state.canEMP = false;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            const primary = PlayerCombatManager.fetch(enemy, 0);
            const secondary = PlayerCombatManager.fetch(enemy, 1);
            const turret = PlayerCombatManager.fetch(enemy, 2);

            if (enemy.placePotential.onMeBufferIndex > 0) {
                isPlacingOnMe = true;

                const spikeId = primary.id === WEAPON_ID_MAP.TOOL_HAMMER ? LIST_ID_MAP.SPIKES : enemy.spikeId;
                const spikeDamage = items.list[spikeId].dmg ?? 45;
                if (spikeDamage > highestSpikeDamage) highestSpikeDamage = spikeDamage;
            }

            if (secondary.recentlyHit && secondary.id === WEAPON_ID_MAP.GREAT_HAMMER) {
                hasEnemyUseHammer = true;
            }

            if (!primary.recentlyHit && !secondary.recentlyHit && !turret.recentlyHit) {
                for (let j = 0, vLen = additionalKnockbackVectors.length; j < vLen; j++) {
                    const vec = additionalKnockbackVectors[j];

                    if (vec && vec.attacker === enemy.sid) {
                        vec.canceled = true;
                    }
                }
            }
        }

        this.canPlaceOnMe = isPlacingOnMe;
        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            const result = this.processEnemy(enemy, isGoingToAutoBreakHit, myPositionalSpot, knockbackVectors, len > 1, highestSpikeDamage);

            if (result.primaryDamage > highestPrimaryDamage) {
                highestPrimaryDamage = result.primaryDamage;
            }

            if (result.hasRuby) hasRuby = true;
            if (result.hasSecondaryHitRecently) isSecondaryHitRecently = true;
        }

        if (!isSecondaryHitRecently) this.secondaryRHitTicks = 0;

        let hasSpikeDamage = false;
        const willStillBeInTrap = player.trap ? withinDist(nextPos, player.trap, 50) : false;
        const simOptions = SimulationOptions.get().toggleGatherRawDamage();
        const kbAction = this.simActions[0][0];

        for (let j = 0, len = knockbackVectors.length + additionalKnockbackVectors.length; j < len; j++) {
            const vector = knockbackVectors[j] ?? additionalKnockbackVectors[j - knockbackVectors.length];
            if (player.trap && willStillBeInTrap) break;
            if (vector.canceled) continue;

            kbAction.pos = vector.pos;
            kbAction.knockPower = vector.kb;
            const res = MovementPhysicsSimulator.simulate(player.getSimulationState(), this.simActions, 1, simOptions);

            if (res.spikesHit > 0) {
                let hasAlready = false;

                for (const sid of res.gameObjectsHit) {
                    if (gameObjectSet.has(sid)) {
                        hasAlready = true;
                        break;
                    }

                    gameObjectSet.add(sid);
                }

                if (hasAlready) continue;
                if (highestPrimaryDamage + res.totalDamage >= 100) {
                    this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                }

                state.totalDamage += res.totalDamage;
                state.canEMP = false;
                state.spikeThreats++;
                vector.used = true;
                sources.push(`kbSpike:${res.spikesHit}`);
            }
        }

        for (let i = 0, len = allSpikes.length; i < len; i++) {
            const gameObject = allSpikes[i];

            const objectScale = gameObject.getScale();
            const isDangerousSpike = !Client.isFriendly(gameObject.ownerSID ?? -1);
            const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;
            const objectDmg = isCactus ? 35 : gameObject.dmg;
            const isPoisonSpikes = gameObject.id === LIST_ID_MAP.POISON_SPIKES;

            if (!isDangerousSpike && !isCactus) continue;
            if (gameObjectSet.has(gameObject.sid)) continue;

            if (withinDist(myPos, gameObject, 36.2 + objectScale)) {
                state.totalDamage += objectDmg;
                sources.push(`spikeDamage`);
                state.canEMP = false;
                hasSpikeDamage = true;
                state.spikeThreats++;
                if (isPoisonSpikes) hasRuby = true;

                if (!player.trap && highestPrimaryDamage + objectDmg >= 100 && this.normalSpikeSoldiers === 0) {
                    this.normalSpikeSoldiers++;
                    this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                }

                if (isSecondaryHitRecently && player.damages.length > 1 && this.secondaryRHitTicks < 2 && highestPrimaryDamage + objectDmg >= 100) {
                    this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                    this.secondaryRHitTicks++;
                    sources.push(`spikeDamageF`);
                }

                gameObjectSet.add(gameObject.sid);
                continue;
            }

            if (gameObjectSet.has(gameObject.sid)) continue;

            for (let j = 0, len = knockbackVectors.length + additionalKnockbackVectors.length; j < len; j++) {
                const vector = knockbackVectors[j] ?? additionalKnockbackVectors[j - knockbackVectors.length];
                if (player.trap && willStillBeInTrap) break;
                if (vector.canceled || vector.used) continue;

                const dirComp = getDirComp(player.real_position, vector.pos);
                const kbPot = vector.kb * ScriptConfig.SERVER_UPDATE_SPEED;
                const tmpX = player.real_position.x + dirComp.x * kbPot;
                const tmpY = player.real_position.y + dirComp.y * kbPot;

                const nextDirComp = getDirComp(player.next_position, vector.pos);
                const nextTmpX = player.next_position.x + nextDirComp.x * kbPot;
                const nextTmpY = player.next_position.y + nextDirComp.y * kbPot;

                this.tmpPoint.x = tmpX;
                this.tmpPoint.y = tmpY;
                const isHitSpike = lineInCircle(player.real_position, this.tmpPoint, gameObject, 35 + objectScale);

                this.tmpPoint.x = nextTmpX;
                this.tmpPoint.y = nextTmpY;
                const willHitSpike = lineInCircle(player.real_position, this.tmpPoint, gameObject, 35 + objectScale);

                if (!isHitSpike && !willHitSpike) continue;

                state.totalDamage += objectDmg;
                sources.push(`kbSpikeR:${objectDmg}`);
                state.canEMP = false;
                state.spikeThreats++;
                vector.used = true;
                gameObjectSet.add(gameObject.sid);

                if (highestPrimaryDamage + objectDmg >= 100) this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
                break;
            }

            if (gameObjectSet.has(gameObject.sid)) continue;
            if (!lineInCircle(myPos, nextPos, gameObject, 36 + objectScale)) continue;

            state.totalDamage += objectDmg;
            sources.push(`spikeVelTick`);
            state.canEMP = false;
            state.spikeThreats++;

            if (highestPrimaryDamage + objectDmg >= 100) {
                this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
            }
        }

        if (this.skinIndex !== STORE_HAT_MAP.SOLDIER_HELMET && player.next_state.spikeDamages > 0) {
            state.totalDamage += player.next_state.spikeDamages;
            sources.push(`spikeVelTickN`);

            if (highestPrimaryDamage + player.next_state.spikeDamages >= 100) {
                this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
            }
        }

        if (!player.trap) {
            simOptions.clearVelocity = true;

            const res = MovementPhysicsSimulator.simulate(
                player.getSimulationState(),
                [],
                1,
                simOptions
            );

            if (res.spikesHit > 0 && res.totalDamage > 0) {
                const resDmg = res.totalDamage - (hasSpikeDamage ? highestSpikeDamage : 0);

                if (resDmg > 0) {
                    state.totalDamage += resDmg;
                    sources.push(`envDamage:${resDmg}`);
                }
            }
        }

        if (Menu.getValue("usePatternRec") && hasSpikeDamage && player.trap) {
            let hasHit = false;

            for (let i = 0, len = nearby.length; i < len; i++) {
                const enemy = nearby[i];

                if (
                    GameEventTracker.confirm(enemy.sid, PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION) ||
                    GameEventTracker.confirm(enemy.sid, PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE)
                ) {
                    if (this.oldConsiderAutoBreakHit && considerAutoBreakHit) {
                        enemy.profilingData.preHitAttacks++;
                    } else {
                        enemy.profilingData.randomHitAttacks++;
                    }

                    if (enemy.profilingData.checkLateHit) {
                        enemy.profilingData.preHitAttacks = 0;
                    }

                    this.preHitChances = 0;
                    hasHit = true;
                } else {
                    if (enemy.profilingData.checkLateHit) {
                        enemy.profilingData.latePreHitAttacks++;
                        enemy.profilingData.checkLateHit = false;
                    }

                    if (((enemy.profilingData.preHitAttacks < 2 && player.shameCount <= 3) || enemy.profilingData.preHitAttacks >= 2) && enemy.profilingData.latePreHitAttacks < 2 && this.oldConsiderAutoBreakHit && considerAutoBreakHit) {
                        enemy.profilingData.checkLateHit = true;
                        sources.push(`checkLateHit:${enemy.sid}`);
                        const res = this.processEnemy(enemy, isGoingToAutoBreakHit, myPositionalSpot, knockbackVectors, len > 1, highestSpikeDamage);

                        if (res.primaryDamage > highestPrimaryDamage) {
                            highestPrimaryDamage = res.primaryDamage;
                        }
                    }
                }

                ModManager.brainState.preHitStates.push({ sid: enemy.sid, hits: enemy.profilingData.preHitAttacks });
                ModManager.brainState.latePreHitStates.push({ sid: enemy.sid, hits: enemy.profilingData.latePreHitAttacks });
                if (enemy.getReload(0) !== 1 && enemy.getReload(1) !== 1 && enemy.getReload(2) !== 1) continue;
                GameEventTracker.track(enemy.sid, PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION);
                GameEventTracker.track(enemy.sid, PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE);
            }

            if (hasHit) {
                this.trapHitState = 0;
            } else {
                if (this.oldConsiderAutoBreakHit && considerAutoBreakHit) {
                    this.preHitChances++;
                }

                this.trapHitState++;
            }
        } else if (!Menu.getValue("usePatternRec")) {
            this.trapHitState = 0;
            this.preHitChances = 0;

            for (let i = 0, len = nearby.length; i < len; i++) {
                const enemy = nearby[i];
                enemy.profilingData.randomHitAttacks = 0;
                enemy.profilingData.latePreHitAttacks = 0;
            }
        }

        if (hasRuby) {
            state.totalDamage += 5;
            sources.push(`rubyTick`);
        }

        this.handleSpikePlacement(hasEnemyUseHammer, highestPrimaryDamage, highestSpikeDamage, isPlacingOnMe);

        if (state.spikeThreats === 0) {
            this.normalSpikeSoldiers = 0;
        }

        ModManager.brainState.preHitChances = this.preHitChances;
        ModManager.brainState.trapHitState = this.trapHitState;
        ModManager.brainState.canPlaceOnMe = isPlacingOnMe;
        ModManager.brainState.spikeTickPot = { ...this.spikeTickPatternRec };
        this.previousOnMeState = isPlacingOnMe;
        this.oldConsiderAutoBreakHit = considerAutoBreakHit;
        return highestPrimaryDamage;
    }

    private static considerProjectiles(highestPrimaryDamage: number) {
        const state = this.state;
        const projDamages = Client.player.projDamages;

        let totalProjDamage = 0;
        let oneTickThreat = false;

        for (let i = 0, len = projDamages.length; i < len; i++) {
            state.totalDamage += projDamages[i];
            totalProjDamage += projDamages[i];

            if (projDamages[i] === 25 && projDamages[i] + highestPrimaryDamage >= 100) {
                oneTickThreat = true;
                break;
            }
        }

        if (totalProjDamage > 0)
            state.sources.push("projectileDamage");

        if (this.isBeingBowInstaed) {
            state.sources.push("preProjectileDamage");
            state.totalDamage += 135 - totalProjDamage;
            totalProjDamage = 135;
        }

        if (totalProjDamage >= 100 || oneTickThreat)
            this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
    }

    private static processReflectionDamage() {
        const player = Client.player;
        const nearby = ModManager.enemyData.nearby;
        const aimDir = ModManager.getAttackDir(true);
        if (typeof aimDir !== "number") return;

        const weapon = PlayerCombatManager.fetch(player, Client.weaponIndex < 9 ? 0 : 1);
        if (weapon.reload !== 1) return;

        const weaponDamage = weapon.dmg * 1.5;
        const spikeGearReflection = hats[SPIKE_GEAR_INDEX].dmg!;
        const cxWingsReflection = accessories[CORRUPT_X_WINGS_INDEX].dmg!;
        const state = this.state;
        let hasChanged = false;

        for (let i = 0, len = nearby.length; i < len; i++) {
            const enemy = nearby[i];
            const tmpDir = getDir(enemy.real_position, player.real_position);
            if (getAngleDist(aimDir, tmpDir) > ScriptConfig.GATHER_ANGLE) continue;

            if (enemy.skinIndex === STORE_HAT_MAP.SPIKE_GEAR) {
                state.totalDamage += weaponDamage * spikeGearReflection;
                hasChanged = true;
            }

            if (enemy.tailIndex === STORE_ACCESSORY_MAP.CORRUPT_X_WINGS) {
                state.totalDamage += weaponDamage * cxWingsReflection;
                hasChanged = true;
            }
        }

        if (hasChanged) {
            state.canSoldier = false;
            state.canEMP = false;
            state.sources.push("reflectionDamage");
        }
    }

    static forceSoldierTicks = 0;

    static start() {
        this.skinIndex = STORE_HAT_MAP.IGNORE;
        PacketTracker.adjustFoodAllocation(Client.player.items[0]);

        if (this.forceSoldierTicks > 0) {
            this.skinIndex = STORE_HAT_MAP.SOLDIER_HELMET;
            this.forceSoldierTicks--;
        }

        const highestPrimaryDamage = this.scanEnvironment();
        this.considerProjectiles(highestPrimaryDamage);

        if (HatSystem.canTick(false) || Client.player.skinIndex === STORE_HAT_MAP.BULL_HELMET) {
            this.state.totalDamage += 5;
            ModManager.brainState.sources.push(`bTick`);
        }
    }

    static respond() {
        const isAutoBreakingImportant = CombatController.currentMode === "autobreak" || CombatController.currentMode === "autobreakspike";
        const doesAutoBreakWantTank = CombatController.skinIndex === STORE_HAT_MAP.TANK_GEAR;
        const dontUseHats = Menu.getValue("defensiveHatSwitching");

        if ((isAutoBreakingImportant && doesAutoBreakWantTank) || !dontUseHats || AttackManager.isAttacking()) {
            this.state.canSoldier = this.state.canEMP = false;
        }

        this.processReflectionDamage();
        ModManager.brainState.sources.push(...this.state.sources);
        ModManager.brainState.totalDamage = this.state.totalDamage;
        AutoHealer.main(this.state);

        if (!this.alreadyHealed) {
            PacketTracker.free("FOOD", "ALL");
        } else {
            PacketTracker.free("FOOD", PacketTracker.TOTAL_FOOD - ModManager.brainState.healingUsed);
        }
    }

    static resolve() {
        HatSystem.main();
        MovementManager.main();

        if (!HatSystem.sentHatPacket)
            PacketTracker.free("HAT_SWITCH", "ALL");

        if (MovementManager.sentMovePacket)
            PacketTracker.free("MOVE", "ALL");
    }

    static conclude() {
        Client.player.damages.length = 0;
        this.alreadyHealed = false;
        this.isBeingBowInstaed = false;

        this.state.canEMP = true;
        this.state.canSoldier = true;

        this.state.empDamage = 0;
        this.state.totalDamage = 0;
        this.state.spikeThreats = 0;

        this.state.sources.length = 0;
    }
}