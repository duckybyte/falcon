import { MOOMOO_CLIENT_TO_SERVER_MAP, MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";

type EventKey = keyof MOOMOO_SERVER_TO_CLIENT_MAP;
type EventCallback<K extends EventKey> = (...args: MOOMOO_SERVER_TO_CLIENT_MAP[K]) => void;

export default class FakeSocket {
    constructor() { }
    isPrivateServer = false;

    handlers: {
        [K in EventKey]?: EventCallback<K>
    } = {};

    on<K extends EventKey>(event: K, callback: EventCallback<K>) {
        (this.handlers as any)[event] = callback;
    }

    sendMsg<K extends keyof MOOMOO_CLIENT_TO_SERVER_MAP>(type: K, ...data: MOOMOO_CLIENT_TO_SERVER_MAP[K]) {
    }
}