import EntityHandler from "@constants/EntityHandler";
import items, { WEAPON_ID_MAP, WEAPON_VARIANT_MAP } from "@constants/items";
import Player from "@constants/Player";
import Projectile from "@constants/Projectile";
import SimulationProjectile from "@constants/SimulationProjectile";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import DefenseSystem from "@core/mod/defense/DefenseSystem";
import ModManager from "@core/ModManager";
import ScriptConfig from "@utils/config/ScriptConfig";
import getDistSq from "@utils/geometry/getDistSq";
import withinDist from "@utils/geometry/withinDist";
import inRange from "@utils/math/inRange";

export default class ProjectileManager {
    static simulationProjectiles = new EntityHandler<SimulationProjectile>();
    static projectiles = new EntityHandler<Projectile>();

    static update() {
        const projectiles = this.simulationProjectiles.all;

        for (let i = 0, len = projectiles.length; i < len; i++) {
            if (projectiles[i].active) projectiles[i].update();
        }
    }

    private static bulletPositionBuffer = { x: 0, y: 0 };
    private static turretPositionBuffer = { x: 0, y: 0 };

    static add(x: number, y: number, dir: number, range: number, speed: number, indx: number, layer: number, sid: number) {
        const tick = ModManager.tick;
        const visiblePlayers = PlayerManager.players.visible.all;
        const bulletPosition = this.bulletPositionBuffer;
        const turretPosition = this.turretPositionBuffer;

        bulletPosition.x = x - Math.cos(dir) * 70;
        bulletPosition.y = y - Math.sin(dir) * 70;

        turretPosition.x = x;
        turretPosition.y = y;

        let source: Player | null = null;
        let isTurret = false;

        for (const player of visiblePlayers) {
            const secondary = items.weapons[player.weaponData.secondary];
            const realPosition = player.real_position;
            const nextPosition = player.next_position;

            if (speed === 1.5 && (withinDist(realPosition, turretPosition, 35) || withinDist(nextPosition, turretPosition, 35))) {
                source = player;
                isTurret = true;
                break;
            } else if (secondary && typeof secondary.projectile == "number" && withinDist(realPosition, bulletPosition, 35)) {
                source = player;
                break;
            }
        }

        let assigned = false;

        if (source) {
            const simProj = this.simulationProjectiles.get(sid);

            if (simProj && !simProj.active) {
                simProj.init(indx, x, y, dir, speed, range, layer, source.sid);
            } else {
                this.simulationProjectiles.add(new SimulationProjectile(sid, indx, x, y, dir, speed, range, layer, source.sid));
            }

            if (!Client.isFriendly(source.sid) && !isTurret) {
                source.projFired++;

                if (source.projFired > 1) {
                    DefenseSystem.isBeingBowInstaed = true;
                }

                setTimeout(() => {
                    source.projFired--;
                }, ScriptConfig.SERVER_UPDATE_SPEED * 4);
            }

            if (isTurret) {
                source.reloads[53] = 0;
                source.weaponData.lastTurretTickHit = tick;
            } else {
                const weaponID = speed == 1.6 ? 9 : speed == 2.5 ? 12 : speed == 2 ? 13 : 15;

                if (!Client.isFriendly(source.sid)) {
                    const isDiaPolearm = source.weaponData.primary === WEAPON_ID_MAP.POLEARM && source.weaponData.primaryVariant >= WEAPON_VARIANT_MAP.DIAMOND;
                    const isUsingOneTickSecondary = weaponID === WEAPON_ID_MAP.CROSSBOW || weaponID === WEAPON_ID_MAP.REPEATER_CROSSBOW;
                    const distanceSq = getDistSq(source.real_position, Client.player.real_position);
                    const rangedThreats = ModManager.enemyData.rangedInstaThreats > 0;

                    if (isDiaPolearm && inRange(distanceSq, 90000, 136900) && rangedThreats && isUsingOneTickSecondary) {
                        DefenseSystem.isBeingBowInstaed = true;
                        DefenseSystem.forceSoldierTicks += 3;
                        source.ignoreDamageConsideration = true;
                    }
                }

                source.reloads[weaponID] = 0;
                source.weaponData.secondary = weaponID;
                source.weaponData.secondaryConfirmed = true;
                source.weaponData.lastSecondaryTickHit = tick;
            }

            assigned = true;
        } else if (speed === 1.5) {
            const allTurrets = ObjectManager.allTurrets.all;

            for (let i = 0, len = allTurrets.length; i < len; i++) {
                const gameObject = allTurrets[i];
                if (getDistSq(turretPosition, gameObject) > 5) continue;

                // turret object always has ownerSID defined (at least it should)
                const simProj = this.simulationProjectiles.get(sid);
                if (simProj && !simProj.active) {
                    simProj.init(indx, x, y, dir, speed, range, layer, gameObject.ownerSID!);
                } else {
                    this.simulationProjectiles.add(new SimulationProjectile(sid, indx, x, y, dir, speed, range, layer, gameObject.ownerSID!));
                }

                assigned = true;
                break;
            }
        }

        // did not assign source to projectile so just assume it is enemy
        if (!assigned) {
            const simProj = this.simulationProjectiles.get(sid);

            if (simProj && !simProj.active) {
                simProj.init(indx, x, y, dir, speed, range, layer, -1);
            } else {
                this.simulationProjectiles.add(new SimulationProjectile(sid, indx, x, y, dir, speed, range, layer, -1));
            }
        }

        const hadProj = this.projectiles.get(sid);
        if (hadProj && !hadProj.active) {
            hadProj.init(x, y, dir, range, speed, layer, indx);
        } else {
            const proj = new Projectile(x, y, dir, range, speed, sid, layer, indx);
            this.projectiles.add(proj);
        }
    }

    static remove(sid: number, range: number) {
        const proj = this.projectiles.get(sid);
        const simProj = this.simulationProjectiles.get(sid);

        if (proj) proj.range = range;
        if (simProj) simProj.active = false;
    }
}