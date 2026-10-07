import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import PlayerManager from "@core/logic/players/PlayerManager";
import { PlayerSimulationState } from "@core/mod/simulation/SimulationStates";
import FakeSocket from "@core/socket/FakeSocket";
import Socket from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import CaptchaManager from "@core/utils/CaptchaManager";
import PacketTracker from "@core/utils/PacketTracker";
import { AllianceDataType, AllianceNotifi, Point } from "@mod-types/index";
import { PlacementType } from "@placing/utils/Placer";
import TaskScheduler from "@services/event-timer/TaskScheduler";
import { resetScreenSize } from "@ui/Hook";
import { loadingCirclePage, mainMenu, respawnPage } from "@ui/Loader";
import ServerBrowser, { serverBrowserPage } from "@ui/ServerBrowser";
import ScriptConfig from "@utils/config/ScriptConfig";
import getElem from "@utils/dom/getElem";

export class Marker {
    active = true;
    life = ScriptConfig.SERVER_UPDATE_SPEED;

    constructor(
        public x: number,
        public y: number,
        public dir: number,
        public id: number,
        public type: PlacementType
    ) {
    }

    redefine(x: number, y: number, dir: number, id: number, type: PlacementType) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.dir = dir;
        this.id = id;
        this.type = type;
        this.life = ScriptConfig.SERVER_UPDATE_SPEED;
    }
}

const gameInformationMetadata = getElem("game-information-metadata");

export const pingDisplay = getElem<"div">("ping-display");
export const deathText = getElem("death-text");

export default class Client {
    static socket: Socket | FakeSocket;
    static player: Player;

    static mySID: number = -1;

    static lastDeath: Point;
    static lastMoveDir: number | null;

    static alliancePlayers: (string | number)[] = [];
    static alliances: AllianceDataType[] = [];
    static allianceNotifications: AllianceNotifi[] = [];
    static markers: Marker[] = [];
    static buildingsHit: GameObject[] = [];

    static weaponIndex = 0;

    static allianceMap = new Map<string, Set<number>>();
    static mode: "replay" | "normal" = "normal";
    static upgradesObtained = new Set<number>();

    static async connect(key?: string, region?: string, name?: string) {
        loadingCirclePage.style.display = "none";
        serverBrowserPage.style.display = "none";
        respawnPage.style.display = "flex";
        mainMenu.style.display = "none";

        if (this.mode === "replay") {
            this.socket = new FakeSocket();
            resetScreenSize();
            SocketListener.hookEvents(this.socket);
            return;
        }

        const selection = ServerBrowser.selectedOption;
        const wsAddress = key && region ?
            `${key}.${region}.moomoo.io` :
            typeof selection === "undefined" ?
                "localhost:1234" :
                `${selection.key}.${selection.region}.moomoo.io`;

        if (selection?.region) {
            localStorage.setItem("falcon-recent-server", `${selection.key}:${selection.region}:${selection.name}`);
        }

        gameInformationMetadata.innerText = `region: ${region ?? selection?.region ?? "local"} | NAME: ${name ?? selection?.name ?? "n/a"}`;
        PacketTracker.init();
        TaskScheduler.init();
        CaptchaManager.renderChallenge(wsAddress);
    }

    static isFriendly(sid: number) {
        return this.mySID === sid || (Client.player?.team && this.alliancePlayers.includes(sid));
    }

    static isTeam(player: Player | PlayerSimulationState, sid: number) {
        if (player.sid === sid) return true;

        const owner = PlayerManager.get(sid);

        if (!owner) return false;
        if (player.team === null || owner.team === null) {
            return player.sid === owner.sid;
        }

        return this.allianceMap.get(owner.team)?.has(player.sid) ?? false;
    }

    static pingTime: number = 0;
    static minimapData: number[] = [];
    static placementTime = ["0", "0", "0", "0", "0"];
    static placementTimeHead = 0;
}