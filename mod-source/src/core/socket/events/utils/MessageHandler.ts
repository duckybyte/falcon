import FakeSocket from "@core/socket/FakeSocket";
import Socket from "@core/socket/Socket";
import { MOOMOO_CLIENT_TO_SERVER_MAP, MOOMOO_SERVER_TO_CLIENT_MAP } from "@root/utils/socket/PacketMap";

export default abstract class MessageHandler<T extends keyof MOOMOO_SERVER_TO_CLIENT_MAP> {
    constructor(
        protected socket: Socket | FakeSocket
    ) {
    }

    abstract run(...args: MOOMOO_SERVER_TO_CLIENT_MAP[T]): any;

    protected sendMsg<K extends keyof MOOMOO_CLIENT_TO_SERVER_MAP>(type: K, ...data: MOOMOO_CLIENT_TO_SERVER_MAP[K]) {
        this.socket.sendMsg(type, ...data);
    }
}