import { encode } from "@msgpack/msgpack";
import PacketMap, { MOOMOO_CLIENT_TO_SERVER_MAP } from "@root/utils/socket/PacketMap";

export default class CustomEncoder {
    private static DATA_BUFFER = new Uint8Array(256);
    private static DATA_VIEW = new DataView(CustomEncoder.DATA_BUFFER.buffer);

    private static TEMP_ARRAY: any[] = [null, null, null];
    private static textEncoder = new TextEncoder();

    private static stringByteCache: Record<string, Uint8Array> = {};
    private static packetDataLength = {
        [PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD]: 2,
        [PacketMap.CLIENT_TO_SERVER.MOVE]: 1,
        [PacketMap.CLIENT_TO_SERVER.SEND_HIT]: 2,
        [PacketMap.CLIENT_TO_SERVER.STORE]: 3,
        [PacketMap.CLIENT_TO_SERVER.SEND_AIM]: 1,
        [PacketMap.CLIENT_TO_SERVER.PING_SOCKET]: 0,
        [PacketMap.CLIENT_TO_SERVER.PING_MAP]: 0
    };

    static encode(type: keyof MOOMOO_CLIENT_TO_SERVER_MAP, encryptType: any, data: any[], seq?: number) {
        let offset = 0;
        const isSeqDefined = typeof seq === "number";
        const buf = this.DATA_BUFFER;
        const view = this.DATA_VIEW;

        if (type in this.packetDataLength) {
            buf[offset++] = 0x90 | (isSeqDefined ? 3 : 2); // main array header

            // packet id
            if (typeof encryptType === "number") {
                buf[offset++] = encryptType;
            } else {
                let bytes = this.stringByteCache[encryptType];

                if (!bytes) {
                    bytes = this.textEncoder.encode(encryptType);
                    this.stringByteCache[encryptType] = bytes;
                }

                buf[offset++] = 0xA0 | bytes.length;
                buf.set(bytes, offset);
                offset += bytes.length;
            }

            // data array header
            buf[offset++] = 0x90 | this.packetDataLength[type as keyof typeof CustomEncoder.packetDataLength];

            if (type === PacketMap.CLIENT_TO_SERVER.STORE) {
                buf[offset++] = data[0] ? 0xC3 : 0xC2; // isbuy
                buf[offset++] = data[1]; // id
                buf[offset++] = data[2] ? 0xC3 : 0xC2; // is acc
            } else if (type === PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD) {
                buf[offset++] = data[0]; // id
                buf[offset++] = data[1] ? 0xC3 : 0xC2; // weapon or not
            } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_HIT) {
                buf[offset++] = data[0]; // either 1 or 0

                buf[offset++] = 0xCA; // hit direction float
                view.setFloat32(offset, data[1], false);
                offset += 4;
            } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_AIM) {
                buf[offset++] = 0xCA;
                view.setFloat32(offset, data[0], false);
                offset += 4;
            } else if (type === PacketMap.CLIENT_TO_SERVER.MOVE) {
                if (typeof data[0] === "number") {
                    buf[offset++] = 0xCA; // moveDir
                    view.setFloat32(offset, data[0], false);
                    offset += 4;
                } else {
                    buf[offset++] = 0xC0;
                }
            }

            if (isSeqDefined) {
                buf[offset++] = 0xCE;
                view.setUint32(offset, seq, false);
                offset += 4;
            }

            return buf.subarray(0, offset);
        }

        this.TEMP_ARRAY[0] = encryptType;
        this.TEMP_ARRAY[1] = data;

        if (isSeqDefined) {
            this.TEMP_ARRAY[2] = seq;
            this.TEMP_ARRAY.length = 3;
        } else {
            this.TEMP_ARRAY.length = 2;
        }

        return encode(this.TEMP_ARRAY);
    }
}