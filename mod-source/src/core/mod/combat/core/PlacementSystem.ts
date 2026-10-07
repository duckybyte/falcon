import GameObject from "@constants/GameObject";
import items, { LIST_ID_MAP } from "@constants/items";
import Client, { Marker } from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import CombatController from "@core/mod/combat/core/CombatController";
import ModManager from "@core/ModManager";
import SocketListener from "@core/socket/SocketListener";
import PacketTracker from "@core/utils/PacketTracker";
import Menu from "@menu/Menu";
import Angle from "@placing/Angle";
import AutoGrinder from "@placing/modules/AutoGrinder";
import AutoMiller from "@placing/modules/AutoMiller";
import AutoPlacer, { Preplacement } from "@placing/modules/AutoPlacer";
import AutoReplacer, { Replacement } from "@placing/modules/AutoReplacer";
import { PlacementType, PlacementTypes } from "@placing/utils/Placer";
import PlacerUtils from "@placing/utils/PlacerUtils";
import PacketMap from "@root/utils/socket/PacketMap";
import { Input } from "@ui/Hook";
import getDistSq from "@utils/geometry/getDistSq";

export class Placement {
    tick: number = -1000000;
    angle: number = -1000000;

    redefine(angle: number, tick: number) {
        this.angle = angle;
        this.tick = tick;
    }
}

export default class PlacementSystem {
    static AutoPlacer = new AutoPlacer();
    static AutoReplacer = new AutoReplacer();

    private static placementBlock = { x: -111000, y: -111000, scale: 0, untilTick: -1 };

    static getTrapPlacementBlock(): Readonly<typeof PlacementSystem.placementBlock> {
        return this.placementBlock;
    }

    private static macro() {
        const player = Client.player;
        const angle = Input.getAttackDir();
        const keys = Input.keys;

        const activityList = ModManager.activityList;

        if (keys["KeyK"] && player.items.includes(20)) {
            const totalAllowedActions = PacketTracker.request("PLACE", 4);
            const len = Math.min(4, totalAllowedActions);

            for (let i = 0; i < len; i++) {
                this.checkPlace(20, angle + (Math.PI / 2) * i);
            }

            activityList.push("macroKeyK");
        }

        const totalAllowedActions = PacketTracker.request("PLACE", 1);
        if (totalAllowedActions <= 0) return;

        if (keys["KeyH"]) {
            this.checkPlace(PlacerUtils.placeSevenSlot(player), angle);
            this.totalPlacements++;
            activityList.push("macroKeyH");
        }

        if (keys["KeyQ"]) {
            this.place(player.items[0], ModManager.getAttackDir());
            activityList.push("macroKeyQ");
        }

        if (keys["KeyF"]) {
            this.checkPlace(player.items[4], angle);
            this.totalPlacements++;
            activityList.push("macroKeyF");
        }

        if (keys["KeyV"]) {
            this.checkPlace(player.items[2], angle);
            this.totalPlacements++;
            activityList.push("macroKeyV");
        }
    }

    static blockTrapPlacement(gameObject: GameObject, ticks: number = 2) {
        this.placementBlock.x = gameObject.x;
        this.placementBlock.y = gameObject.y;
        this.placementBlock.scale = gameObject.scale;
        this.placementBlock.untilTick = Math.max(this.placementBlock.untilTick, ModManager.tick + ticks);
    }

    private static bufferAngle = new Angle(0, 0, 0, 0, 0);

    static checkPlace(id: number, angle: number = Input.getAttackDir()) {
        const player = Client.player;

        if (!player.items.includes(id)) return;

        const item = items.list[id];
        const realPos = player.real_position;

        const tmpScale = 35 + item.scale + (item.placeOffset || 0);
        const tmpX = realPos.x + Math.cos(angle) * tmpScale;
        const tmpY = realPos.y + Math.sin(angle) * tmpScale;

        if (!ObjectManager.checkItem(tmpX, tmpY, item.scale, id)) return;
        this.bufferAngle.redefine(tmpX, tmpY, item.scale, angle, id);

        this.place(id, angle);
        this.sendMarker(this.bufferAngle, PlacementTypes.NORMAL);
    }

    static place(id: number, angle: number = Input.getAttackDir(), itemCount?: number) {
        const player = Client.player;
        if (!player.items.includes(id)) return 0;

        const item = items.list[id];
        let count = 0;

        if (typeof item.group.limit === "number" && !Client.socket.isPrivateServer) {
            const limit = item.group.sandboxLimit ?? 99;
            count = itemCount ?? player.itemCounts[item.group.id];
            const isFull = count + 1 > limit;

            if (isFull) return limit;
            count++;
        }

        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD, id, false);
        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_HIT, 1, angle);
        CombatController.selectWeapon();
        return count;
    }

    static addMarkerRaw(x: number, y: number, angle: number, id: number, placementType: PlacementType) {
        for (let i = 0; i < Client.markers.length; i++) {
            const marker = Client.markers[i];

            if (marker && !marker.active) {
                marker.redefine(x, y, angle, id, placementType);
                return;
            }
        }

        Client.markers.push(new Marker(x, y, angle, id, placementType));
    }

    static addMarker(angleData: Angle | Replacement | Preplacement, placementType: PlacementType) {
        for (let i = 0; i < Client.markers.length; i++) {
            const marker = Client.markers[i];

            if (marker && !marker.active) {
                marker.redefine(angleData.x, angleData.y, angleData.angle, angleData.id, placementType);
                return;
            }
        }

        Client.markers.push(new Marker(angleData.x, angleData.y, angleData.angle, angleData.id, placementType));
    }

    static sendMarker(angleData: Angle | Replacement | Preplacement, placementType: PlacementType) {
        this.addMarker(angleData, placementType);

        // allows the packet replayer to show where our player wanted to place
        SocketListener.logPacket(
            PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.ADD_PLACEMENT_MARKER,
            [angleData.x, angleData.y, angleData.angle, angleData.id, placementType]
        );
    }

    static bestAngles: Angle[] = [];
    static bestAnglesSet = new Set<Angle>();
    static angleCandidates: Angle[] = [];

    static usedAngles: Placement[] = Array.from({ length: 64 }, () => new Placement());
    static usedAnglesCount = 0;
    static usedAnglesHead = 0;
    static totalPlacements = 0;

    static main() {
        const nearestEnemy = ModManager.enemyData.nearest;
        const player = Client.player;

        if (player.health < 0) return;

        this.macro();

        AutoMiller.main();
        if (AutoGrinder.main()) return;

        if (Menu.getValue("autoPlacing") && nearestEnemy && player.items[4] === LIST_ID_MAP.PIT_TRAP) {
            const placementRange = parseInt(Menu.getValue("autoPlaceRange"));
            const placementRangeSq = placementRange * placementRange;
            const distanceSq = getDistSq(nearestEnemy.real_position, player.real_position);

            if (distanceSq <= placementRangeSq) {
                this.AutoPlacer.execute(player);
            }
        }
    }
}