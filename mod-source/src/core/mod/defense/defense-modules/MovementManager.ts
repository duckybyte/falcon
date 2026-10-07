import items from "@constants/items";
import Player from "@constants/Player";
import { accessoryMap, hatMap, STORE_HAT_MAP } from "@constants/store";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import AutoPusher from "@core/mod/combat/core/AutoPusher";
import MovementUtils from "@core/mod/defense/utils/MovementUtils";
import ModManager from "@core/ModManager";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import { Input } from "@ui/Hook";
import ScriptConfig from "@utils/config/ScriptConfig";
import lineInCircle from "@utils/geometry/lineInCircle";

export default class MovementManager {
    private static lastMoveDir: number | null = null;
    static sentMovePacket = false;

    private static move(moveDir: number | null) {
        if (moveDir === this.lastMoveDir) return;
        this.lastMoveDir = moveDir;
        this.sentMovePacket = true;
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.MOVE, moveDir);
    }

    static project(
        player: Player,
        moveDir: number,
        includeDecel?: boolean,
        customData?: [skinIndex: number | undefined, tailIndex: number | undefined, weaponIndex: number | undefined]
    ) {
        if (typeof customData === "undefined") customData = [undefined, undefined, undefined];
        const skinIndex = customData[0] ?? player.skinIndex;
        const tailIndex = customData[1] ?? player.tailIndex;
        const weaponIndex = customData[2] ?? player.weaponIndex;
        const delta = ScriptConfig.SERVER_UPDATE_SPEED;

        const wpn = items.weapons[weaponIndex];
        const skin = hatMap.get(skinIndex)!;
        const tail = accessoryMap.get(tailIndex)!;

        const spdMult = (player.buildIndex >= 0 ? .5 : 1) * (wpn?.spdMult || 1) *
            (skin ? (skin.spdMult || 1) : 1) *
            (tail ? (tail.spdMult || 1) : 1);

        const realPos = player.real_position;
        const momentumX = player.next_position.x - realPos.x;
        const momentumY = player.next_position.y - realPos.y;

        const accelDist = ScriptConfig.PLAYER_SPEED * spdMult * delta * delta;
        const accelX = Math.cos(moveDir) * accelDist;
        const accelY = Math.sin(moveDir) * accelDist;

        let travelX: number;
        let travelY: number;

        if (includeDecel) {
            const frictionMult = MovementUtils.getFrictionMult(accelX, accelY, delta);

            travelX = momentumX + accelX * frictionMult;
            travelY = momentumY + accelY * frictionMult;
        } else {
            travelX = momentumX + accelX;
            travelY = momentumY + accelY;
        }

        return { x: realPos.x + travelX, y: realPos.y + travelY };
    }

    static getMoveDir(peek = false) {
        const action = AttackManager.currentAttackAction;

        if (action && action.reason === "oneTick") {
            const mode = action.tickMode!;
            const ang = ModManager.enemyData.angle;
            return mode === "away" ? ang + Math.PI : mode === "stop" ? null : ang;
        }

        if (AttackManager.oneTicker.tapMode) {
            return AttackManager.oneTicker.getMoveDir(peek);
        }

        if (AutoPusher.autoPushing) {
            return AutoPusher.moveDir;
        }

        return Client.lastMoveDir;
    }

    private static checkAngleCollision(moveDir: number) {
        const closeObjects = ObjectManager.pool.closeObjects;
        const player = Client.player;

        const decentGear: [number, number, number] = [
            STORE_HAT_MAP.BOOSTER_HAT,
            player.tailIndex,
            player.weaponIndex
        ];

        const realPos = player.real_position;
        const project = this.project(player, moveDir, false, decentGear);
        const finalProjection = this.project(player, moveDir, true, decentGear);
        const shouldIgnoreMyTeleports = Menu.getValue("safeWalkIgnoreMyTps");
        const safeWalkIgnoreAllyBoostPads = Menu.getValue("safeWalkIgnoreAllyBoostPads");

        for (let i = 0; i < closeObjects.length; i++) {
            const gameObject = closeObjects[i];

            const isEnemy = !Client.isFriendly(gameObject.ownerSID ?? -1);
            const isSpike = gameObject.dmg;
            const isBoostPad = gameObject.boostSpeed && (safeWalkIgnoreAllyBoostPads ? isEnemy : true);
            const isCactus = gameObject.type === 1 && gameObject.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP;

            const isDangerousObject = isCactus || (isSpike && isEnemy);
            const isTeleport = gameObject.teleport && (shouldIgnoreMyTeleports ? isEnemy : true);

            if (!isBoostPad && !isTeleport && !isDangerousObject)
                continue;

            const scale = 35 + gameObject.getScale();
            const projectCollision = lineInCircle(realPos, project, gameObject, scale);
            const finalProjectCollision = lineInCircle(realPos, finalProjection, gameObject, scale);

            if (projectCollision || finalProjectCollision) {
                return true;
            }
        }

        return false;
    }

    static main() {
        let moveDir = this.getMoveDir();
        this.sentMovePacket = false;

        try {
            if (typeof moveDir !== "number") return;
            if (!Menu.getValue("safeWalk")) return;
            if (Input.keys["ShiftLeft"]) return;

            const activityList = ModManager.activityList;
            const isBlocked = this.checkAngleCollision(moveDir);
            if (!isBlocked) return;

            activityList.push("moveStop");
            moveDir = null;
        } finally {
            this.move(moveDir);
        }
    }
}