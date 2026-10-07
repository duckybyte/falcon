import { ModBrainState } from "@root/core/ModManager";

export type IncomingServerPackets = {
    [K in keyof MOOMOO_SERVER_TO_CLIENT_MAP]: {
        type: K;
        data: MOOMOO_SERVER_TO_CLIENT_MAP[K];
    };
}[keyof MOOMOO_SERVER_TO_CLIENT_MAP];

export interface PacketLog {
    timestamp: number;
    brainState?: ModBrainState;
    packetData: IncomingServerPackets;
}