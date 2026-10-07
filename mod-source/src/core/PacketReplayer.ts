import { ais } from "@constants/Ai";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PlayerManager from "@core/logic/players/PlayerManager";
import ProjectileManager from "@core/logic/ProjectileManager";
import TextManager from "@core/logic/TextManager";
import { ModBrainState } from "@core/ModManager";
import Socket from "@core/socket/Socket";
import { decode } from "@msgpack/msgpack";
import RendererSystem from "@rendering/RendererSystem";
import { PacketLog } from "@root/utils/socket/PacketLogging";
import PacketMap, { MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";
import { packetReplayerOptionsPage } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

export const packetReplayerUI = getElem("packet-replayer-ui");
const brainStateDump = getElem("brain-state-dumper");
const durationSlider = getElem<"input">("duration-slider");

const durationNow = getElem("duration-now");
const durationTotal = getElem("duration-total");
const durationSliderPadding = getElem("duration-slider-padding");
export const pauseIcon = getElem("paused-icon");
const replaySpeed = getElem("replay-speed");

pauseIcon.onclick = () => {
    PacketReplayer.isPaused = !PacketReplayer.isPaused;

    const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
    if (pauseMaterialIcon)
        pauseMaterialIcon.innerHTML = PacketReplayer.isPaused ? "play_arrow" : "pause";

    pauseIcon.blur();
};

function setDurationNow(now: number) {
    const formatNumber = Math.ceil(now / 1e3);
    durationNow.innerText = `00:${formatNumber < 10 ? "0" : ""}${formatNumber}`;
    durationSlider.value = now.toString();
}

durationSlider.onfocus = () => {
    PacketReplayer.isPaused = true;

    const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
    if (pauseMaterialIcon) pauseMaterialIcon.innerHTML = "play_arrow";
};

durationSlider.oninput = (ev) => {
    if (!ev.isTrusted) return;
    const delta = parseInt(durationSlider.value);

    setDurationNow(delta);
    durationSliderPadding.style.width = `${(delta / PacketReplayer.totalDuration) * 100}%`;
};

replaySpeed.onclick = (ev) => {
    if (!ev.isTrusted) return;

    PacketReplayer.isPaused = true;
    PacketReplayer.currentSpeedIndex = (PacketReplayer.currentSpeedIndex + 1) % PacketReplayer.speeds.length;
    replaySpeed.innerText = `x${PacketReplayer.speeds[PacketReplayer.currentSpeedIndex]}`;

    const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
    if (pauseMaterialIcon) pauseMaterialIcon.innerHTML = "play_arrow";
    replaySpeed.blur();
};

durationSlider.onchange = (ev) => {
    if (!ev.isTrusted) return;
    const delta = parseInt(durationSlider.value);

    setDurationNow(delta);
    PacketReplayer.isPaused = false;

    const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
    if (pauseMaterialIcon) pauseMaterialIcon.innerHTML = "pause";
    durationSliderPadding.style.width = `${(delta / PacketReplayer.totalDuration) * 100}%`;
    durationSlider.blur();

    if (delta < PacketReplayer.currentDelta) {
        PlayerManager.removeAll();
        TextManager.texts.clear();
        ObjectManager.removeAll();
        ProjectileManager.projectiles.removeAll();
        ais.removeAll();

        PacketReplayer.currentDelta = 0;
        PacketReplayer.currentIndex = 0;
        PacketReplayer.slowTime = delta;
        return;
    }

    PacketReplayer.currentDelta = delta;
    PacketReplayer.quickTime = true;
};

document.addEventListener("keyup", (ev) => {
    if (Client.mode === "replay" && (ev.code === "ArrowLeft" || ev.code === "ArrowRight")) {
        PacketReplayer.isPaused = false;

        if (ev.code === "ArrowRight") {
            PacketReplayer.runForOneTick = true;
        } else {
            PlayerManager.removeAll();
            TextManager.texts.clear();
            ObjectManager.removeAll();
            ProjectileManager.projectiles.removeAll();
            ais.removeAll();
            PacketReplayer.slowTime = PacketReplayer.currentDelta - (1e3 / RendererSystem.fps);
            PacketReplayer.runForOneTick = true;
            PacketReplayer.currentDelta = 0;
            PacketReplayer.currentIndex = 0;
        }
    }
});

export default class PacketReplayer {
    private static readonly MAX_DURATION = 15e3;

    static allData: PacketLog[] = [];
    static currentIndex = 0;
    static currentDelta = 0;

    static currentSpeedIndex = 3;
    static speeds = [.125, .25, .5, 1];

    static totalDuration = 0;
    static runForOneTick = false;

    static isPaused = false;
    static quickTime = false;
    static slowTime = 0;

    private static decompileBinaryFormat(bytes: ArrayBuffer) {
        let offset = 0;
        this.allData.length = 0;
        const viewer = new DataView(bytes);

        while (offset < bytes.byteLength) {
            if (offset + 8 > bytes.byteLength) break;
            const timestamp = viewer.getFloat64(offset, true);
            offset += 8;

            if (offset + 4 > bytes.byteLength) break;
            const packetLength = viewer.getInt32(offset, true);
            offset += 4;

            if (offset + packetLength > bytes.byteLength) break;
            const packetRawBytes = new Uint8Array(bytes, offset, packetLength);
            offset += packetLength;

            let packetData: any = null;
            const decoded = decode(packetRawBytes) as [string, any];

            packetData = {
                type: decoded[0],
                data: decoded[1]
            };

            if (offset + 4 > bytes.byteLength) break;
            const brainLength = viewer.getInt32(offset, true);
            offset += 4;

            let brainState: any = null;
            if (brainLength > 0) {
                if (offset + brainLength > bytes.byteLength) break;

                const brainRawBytes = new Uint8Array(bytes, offset, brainLength);
                brainState = decode(brainRawBytes);
                offset += brainLength;
            }

            this.allData.push({
                timestamp,
                packetData,
                brainState
            } as unknown as PacketLog);
        }
    }

    private static readonly IGNORE_PACKETS = new Set<string>([
        PacketMap.SERVER_TO_CLIENT.SHOW_TEXT,
        PacketMap.SERVER_TO_CLIENT.WIGGLE_GAME_OBJECT,
        PacketMap.SERVER_TO_CLIENT.SHOOT_TURRET,
        PacketMap.SERVER_TO_CLIENT.RECEIVE_CHAT,
        PacketMap.CUSTOM_PACKETS.SERVER_TO_CLIENT.ADD_PLACEMENT_MARKER,
        PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE,
        PacketMap.SERVER_TO_CLIENT.REMOVE_PROJECTILE
    ]);

    private static defaultVisualState: Readonly<ModBrainState> = {
        tick: -1000,
        damages: [676767],
        preHitChances: -1,
        modBrainRuntime: -1,
        sources: ["value is not defined"],
        healingResponse: "value not defined",
        activityList: ["value is undefined"],
        healingInternal: { currentHealth: -100, expectedDamage: -100, healthAfterDamage: -676767, willDieIfDoNothing: true, alreadyForcedHat: false, empDamage: 6967, healthAfterSoldier: Infinity },
        canPlaceOnMe: false,
        pingTime: -100,
        shameCount: 67,
        breakerInternal: { replaceSpike: false, replaceTrap: false, trapBreakFaster: false, isConsidering: false },
        packets: 1000000,
        healingUsed: 10000,
        totalDamage: 10000,
        trapHitState: -1,
        hatUsed: -1,
        accUsed: -1,
        effectiveBatchWindow: -.5,
        realBatchWindow: -.5,
        preHitStates: [],
        randomHitStates: [],
        latePreHitStates: [],
        trapData: { x: -1, y: -1 },
        isTrapped: false,
        wasTrapped: false,
        spikeTickPot: { amount: 0, resetTicks: -1, resolveOccurances: 0, hasOccuredBefore: false, currentMax: 0, max: 0, reset: false, lastOccured: 0 },
        modVersion: "unknown"
    };

    static update(dt: number) {
        try {
            if (Client.socket instanceof Socket) return;
            if (this.isPaused) return;

            this.currentDelta += dt;
            if (this.currentDelta >= this.totalDuration) {
                const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
                if (pauseMaterialIcon) pauseMaterialIcon.innerHTML = "play_arrow";

                this.currentDelta = this.totalDuration;
                this.isPaused = true;
            }

            setDurationNow(this.currentDelta);
            durationSliderPadding.style.width = `${(this.currentDelta / this.totalDuration) * 100}%`;

            for (let i = this.currentIndex; i < this.allData.length; i++) {
                const logData = this.allData[i];
                const packet = logData.packetData!;

                if (logData.timestamp > this.currentDelta) break;
                this.currentIndex = i + 1;
                if ((this.quickTime || this.slowTime) && this.IGNORE_PACKETS.has(packet.type)) continue;

                const type = packet.type as keyof MOOMOO_SERVER_TO_CLIENT_MAP;
                const callback = Client.socket.handlers[type];
                const data = packet.data as never[];

                if (!callback) continue;
                callback(...data);

                if (logData.brainState) {
                    const raw = logData.brainState as Partial<ModBrainState>;
                    const state = { ...this.defaultVisualState, ...raw };

                    brainStateDump.innerHTML = `
                    activityList: [${state.activityList.join(",")}]<br>
                    canPlaceOnMe: ${state.canPlaceOnMe}<br>
                    damages: [${state.damages.join(",")}]<br>
                    packets: ${state.packets}<br>
                    healingResponse: ${state.healingResponse}<br>
                    healingUsed: ${state.healingUsed}<br>
                    sources: [${state.sources.join(",")}]<br>
                    tick: ${state.tick}<br>
                    storeData: { hat: ${state.hatUsed}, acc: ${state.accUsed} }<br>
                    trapHitState: ${state.trapHitState}<br>
                    preHitChances: ${state.preHitChances}<br>
                    preHitStates: ${JSON.stringify(state.preHitStates)}<br>
                    randomHitStates: ${JSON.stringify(state.randomHitStates)}<br>
                    latePreHitStates: ${JSON.stringify(state.latePreHitStates)}<br>
                    effectiveBatchWindow: ${state.effectiveBatchWindow}<br>
                    realBatchWindow: ${state.realBatchWindow}<br>
                    health: ${state.healingInternal.currentHealth}<br>
                    totalDamage: ${state.totalDamage.toFixed(2)}<br>
                    breakerInternal: { ${!state.breakerInternal.isConsidering ? `` : `rSpike: ${state.breakerInternal.replaceSpike}, rTrap: ${state.breakerInternal.replaceTrap}, tBreakFaster: ${state.breakerInternal.trapBreakFaster}`} }<br>
                    healingInternal: { pDmg: ${state.healingInternal.expectedDamage}, hpADmg: ${state.healingInternal.healthAfterDamage}, fHat: ${state.healingInternal.alreadyForcedHat}, empDmg: ${state.healingInternal.empDamage}, hpAS: ${state.healingInternal.healthAfterSoldier}, willDie: ${state.healingInternal.willDieIfDoNothing} }<br>
                    spikeTickPot: { amt: ${state.spikeTickPot.amount}, max: ${state.spikeTickPot.currentMax}, res: ${state.spikeTickPot.resolveOccurances}, occured: ${state.spikeTickPot.hasOccuredBefore}, reTicks: ${state.spikeTickPot.resetTicks} }<br>
                    trapState: { is: ${state.isTrapped}, was: ${state.wasTrapped} }<br>
                    trap: { x: ${state.trapData.x}, y: ${state.trapData.y} }<br>
                    pingTime: ${state.pingTime.toFixed(3)}<br>
                    modRunTime: ${state.modBrainRuntime}<br>
                    modVersion: ${state.modVersion}
                    `;
                }
            }
        } finally {
            this.quickTime = false;
        }
    }

    static start(bytes: ArrayBuffer) {
        Client.mode = "replay";
        this.decompileBinaryFormat(bytes);

        const startTimestamp = this.allData.find(e => e.timestamp > 0)!.timestamp;
        const endTimestamp = this.allData[this.allData.length - 1].timestamp;
        const replayStart = Math.max(startTimestamp, endTimestamp - this.MAX_DURATION);

        this.currentIndex = 0;
        this.currentDelta = 0;
        this.slowTime = 0;
        this.quickTime = replayStart > startTimestamp;
        this.isPaused = false;

        for (let i = 0; i < this.allData.length; i++) {
            const current = this.allData[i];
            current.timestamp = current.timestamp === 0 ? 0 : current.timestamp - replayStart;
        }

        this.totalDuration = Math.min(this.MAX_DURATION, Math.max(0, this.allData[this.allData.length - 1].timestamp));
        durationSlider.max = this.totalDuration.toString();

        const parsed = Math.ceil(this.totalDuration / 1e3);
        durationTotal.innerText = `00:${parsed < 10 ? "0" : ""}${parsed}`;

        packetReplayerOptionsPage.style.display = "none";
        Client.connect();
    }
}