import Client from "@core/Client";
import { encode } from "@msgpack/msgpack";
import { PacketLog } from "@root/utils/socket/PacketLogging";
import PacketMap from "@root/utils/socket/PacketMap";

export default class PacketRecorder {
    private static readonly TOTAL_SLOTS = 15;
    static readonly PERMANENT_PACKETS = new Set<string>([
        PacketMap.SERVER_TO_CLIENT.ADD_PLAYER,
        PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS,
        PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA,
        PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM,
        PacketMap.SERVER_TO_CLIENT.SET_UP_GAME
    ]);

    static readonly IGNORED_PACKETS = new Set<string>([
        PacketMap.SERVER_TO_CLIENT.UPDATE_STORE_ITEMS
    ]);

    private static permanentData = new Map<string, PacketLog>();
    private static timeSlots: PacketLog[][] = Array.from({ length: PacketRecorder.TOTAL_SLOTS }, () => []);

    private static slotIndex = 0;
    private static lastSlotTime = 0;
    private static intervalId: number | null = null;
    private static isInitialized = false;

    static init() {
        if (this.isInitialized) return;

        this.isInitialized = true;
        this.lastSlotTime = performance.now();
        this.intervalId = window.setInterval(() => this.advanceSlots(performance.now()), 1000);
    }

    private static advanceSlots(now: number) {
        const elapsed = Math.floor((now - this.lastSlotTime) / 1e3);
        if (elapsed <= 0) return;

        const slotsToClear = Math.min(elapsed, this.timeSlots.length);
        for (let i = 1; i <= slotsToClear; i++) {
            const index = (this.slotIndex + i) % this.timeSlots.length;
            this.updatePermanentData(this.timeSlots[index]);
            this.timeSlots[index].length = 0;
        }

        this.slotIndex = (this.slotIndex + elapsed) % this.timeSlots.length;
        this.lastSlotTime += elapsed * 1e3;
    }

    static destroy() {
        if (typeof this.intervalId !== "number") return;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    private static updatePermanentData(packetData: PacketLog[]) {
        for (let i = 0; i < packetData.length; i++) {
            const log = packetData[i];
            const packet = log.packetData!;

            if (packet.type === PacketMap.SERVER_TO_CLIENT.UPDATE_PLAYERS) {
                const data = packet.data as any[];

                for (let j = 0; j < data.length; j += 13) {
                    const sid = data[j];
                    const x = data[j + 1];
                    const y = data[j + 2];

                    const playerId = this.sidToIdMap[sid];
                    const logData = this.permanentData.get(`player_${playerId}`);
                    if (!logData) continue;

                    logData.packetData.data[3] = x;
                    logData.packetData.data[4] = y;
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.KILL_OBJECT) {
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);
                if (!gameObjectsMap) return;

                const packetData = gameObjectsMap.packetData!;
                if (packetData.type !== PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) return;

                const gameObjects = packetData.data[0];

                for (let i = 0; i < gameObjects.length; i += 8) {
                    if (gameObjects[i] === packet.data[0]) {
                        gameObjects.splice(i, 8);
                        break;
                    }
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.KILL_OBJECTS) {
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);
                if (!gameObjectsMap) return;

                const packetData = gameObjectsMap.packetData!;
                if (packetData.type !== PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) return;

                const gameObjects = packetData.data[0];

                for (let i = 0; i < gameObjects.length; i += 8) {
                    if (gameObjects[i + 7] === packet.data[0]) {
                        gameObjects.splice(i, 8);
                        i -= 8;
                    }
                }
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.ADD_PLAYER) {
                const playerId = packet.data[0];
                this.permanentData.set(`player_${playerId}`, log);
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.REMOVE_PLAYER) {
                const playerId = packet.data[0];
                const playerSid = this.idToSidMap[playerId];

                this.permanentData.delete(`player_${playerId}`);
                delete this.idToSidMap[playerId];
                delete this.sidToIdMap[playerSid];
            } else if (packet.type === PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) {
                const gameObjectsMap = this.permanentData.get(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT);

                if (!gameObjectsMap) {
                    this.permanentData.set(PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT, log);
                } else {
                    const packetData = gameObjectsMap.packetData!;

                    if (packetData.type == PacketMap.SERVER_TO_CLIENT.LOAD_GAME_OBJECT) {
                        packetData.data[0].push(...packet.data[0]);
                    }
                }
            }
        }
    }

    private static idToSidMap: Record<string, number> = {};
    private static sidToIdMap: Record<string, number> = {};

    static add(packetId: string, log: PacketLog) {
        if (!this.isInitialized) return;
        this.advanceSlots(log.timestamp);

        if (this.IGNORED_PACKETS.has(packetId)) {
            return;
        }

        if (!this.PERMANENT_PACKETS.has(packetId)) {
            this.timeSlots[this.slotIndex].push(log);
            return;
        }

        if (!log.packetData) throw new Error("");
        const { type, data } = log.packetData;

        if (type === PacketMap.SERVER_TO_CLIENT.ADD_PLAYER) {
            const playerId = data[0][0];
            const playerSid = data[0][1];

            this.idToSidMap[playerId] = playerSid;
            this.sidToIdMap[playerSid] = playerId;

            if (playerSid === Client.mySID) {
                log.timestamp = performance.now() - 15e3;
            }

            if (this.permanentData.has(`player_${playerId}`)) {
                this.timeSlots[this.slotIndex].push(log);
                return;
            }

            this.permanentData.set(`player_${playerId}`, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_UP_GAME) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_UP_GAME, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_INIT_DATA, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_ALLIANCE_PLAYERS, log);
        } else if (type === PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM) {
            this.permanentData.set(PacketMap.SERVER_TO_CLIENT.SET_PLAYER_TEAM, log);
        }
    }

    static compileBinaryLog(): Uint8Array | null {
        this.advanceSlots(performance.now());

        const historicalPackets = [
            ...this.timeSlots.slice(this.slotIndex + 1),
            ...this.timeSlots.slice(0, this.slotIndex + 1)
        ].flat();

        if (historicalPackets.length === 0) return null;

        const baseTimestamp = historicalPackets[0].timestamp;
        const permanentPackets = Array.from(this.permanentData.values());

        for (let i = 0; i < permanentPackets.length; i++) {
            if (permanentPackets[i].timestamp < baseTimestamp)
                permanentPackets[i].timestamp = baseTimestamp;
        }

        const allPackets = [...permanentPackets, ...historicalPackets].sort((a, b) => a.timestamp - b.timestamp);

        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        for (let i = 0, len = allPackets.length; i < len; i++) {
            const packet = allPackets[i];

            const timestampBuf = new Uint8Array(8);
            new DataView(timestampBuf.buffer).setFloat64(0, packet.timestamp, true);
            chunks.push(timestampBuf);
            totalLength += 8;

            const packetBuffer = new Uint8Array(encode([packet.packetData.type, packet.packetData.data]));
            const packetLengthBuf = new Uint8Array(4);
            new DataView(packetLengthBuf.buffer).setInt32(0, packetBuffer.length, true);

            chunks.push(packetLengthBuf, packetBuffer);
            totalLength += 4 + packetBuffer.length;

            if (packet.brainState) {
                const brainBuffer = new Uint8Array(encode(packet.brainState));

                const brainLengthBuf = new Uint8Array(4);
                new DataView(brainLengthBuf.buffer).setInt32(0, brainBuffer.length, true);

                chunks.push(brainLengthBuf, brainBuffer);
                totalLength += 4 + brainBuffer.length;
            } else {
                const zeroLengthBuf = new Uint8Array(4);
                new DataView(zeroLengthBuf.buffer).setInt32(0, 0, true);

                chunks.push(zeroLengthBuf);
                totalLength += 4;
            }
        }

        const resultBuffer = new Uint8Array(totalLength);

        let offset = 0;
        for (const chunk of chunks) {
            resultBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        return resultBuffer;
    }
}