import items from "@constants/items";
import Client from "@core/Client";
import SocketListener from "@core/socket/SocketListener";
import { MooMooProtocol } from "@core/utils/CaptchaManager";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import PacketMap, { clientToServerArr, serverToClientArr } from "@root/utils/socket/PacketMap";

const profanityList = [
    "cunt", "whore", "fuck", "shit", "faggot", "nigger", "mohmoh", "moh ",
    "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
    "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
    "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"
];

function createPRNG(seed: number) {
    return function nextRandom() {
        seed |= 0;
        seed = seed + 1831565813 | 0;

        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t,
            ((t ^ t >>> 14) >>> 0) / 4294967296
    };
}

function createMasks(key: Uint8Array) {
    const data = new DataView(key.buffer);

    return {
        c2s: (data.getUint32(0, true) ^ 3266489909) >>> 0,
        s2c: (data.getUint32(4, true) ^ 668265263) >>> 0,
    };
}

function createCipherMap(charArray: string[], seed: number) {
    const length = charArray.length;
    const indices = charArray.map((_, index) => index);
    const nextRandom = createPRNG(seed >>> 0);

    for (let i = length - 1; i > 0; i--) {
        const randomIndex = Math.floor(nextRandom() * (i + 1));
        const temp = indices[i];

        indices[i] = indices[randomIndex];
        indices[randomIndex] = temp;
    }

    const encryptMap: Record<string, number> = {};
    const decryptMap: Record<number, string> = {};

    for (let i = 0; i < length; i++) {
        const char = charArray[i];
        const shuffledIndex = indices[i];

        encryptMap[char] = shuffledIndex;
        decryptMap[shuffledIndex] = char;
    }

    return {
        encrypt: encryptMap,
        decrypt: decryptMap
    };
}

function hexToBytes(hexString: string) {
    const buffer = new Uint8Array(hexString.length / 2);

    for (let i = 0; i < buffer.length; i++) {
        const index = i * 2;
        const slice = hexString.slice(index, index + 2);

        buffer[i] = parseInt(slice, 16);
    }

    return buffer;
}

interface ICipherMap {
    encrypt: Record<string, number>;
    decrypt: Record<number, string>;
}

interface IPacketCipherMap {
    c2s: ICipherMap;
    s2c: ICipherMap;
}

interface IPacketMaskMap {
    c2s: number;
    s2c: number;
}

export function xorPacket(data: Uint8Array, seed: number) {
    let state = seed >>> 0;
    if (state === 0) state = 1831565813;

    for (let offset = 0; offset < data.length; offset += 4) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;

        data[offset] ^= state & 0xff;
        if (offset + 1 < data.length) data[offset + 1] ^= (state >>> 8) & 0xff;
        if (offset + 2 < data.length) data[offset + 2] ^= (state >>> 16) & 0xff;
        if (offset + 3 < data.length) data[offset + 3] ^= state >>> 24;
    }
}

export default class PacketManager {
    sequence = 0;
    received = 0;

    tables?: IPacketCipherMap;
    salt?: Uint8Array;
    masks?: IPacketMaskMap;

    static readonly PACKET_PADDING = 6;
    private SIGNATURE_BUFFER = new Uint8Array(PacketManager.PACKET_PADDING);

    maskIncoming(bytes: Uint8Array) {
        if (!this.tables || !this.tables.s2c) return;

        const sequence = ++this.received;
        const seed = (this.masks!.s2c ^ Math.imul(sequence, 2654435761)) >>> 0;
        xorPacket(bytes, seed);
    }

    maskOutcoming(bytes: Uint8Array, signatureUint: number) {
        if (!this.tables || !this.tables.c2s) return;
        const seed = (this.masks!.c2s ^ signatureUint) >>> 0;
        xorPacket(bytes.subarray(PacketManager.PACKET_PADDING), seed);
    }

    private initTable(seed: number, salt: number) {
        const c2sSeedBase = (seed ^ Math.imul(salt, 2654435761)) >>> 0;
        const s2cSeedBase = (c2sSeedBase ^ 2246822507) >>> 0;

        this.tables = {
            c2s: createCipherMap(clientToServerArr, c2sSeedBase),
            s2c: createCipherMap(serverToClientArr, s2cSeedBase),
        };
    }

    init(_id: string, seed: number, salt: string, protocol: MooMooProtocol) {
        seed = seed >>> 0;
        const key = hexToBytes(salt);

        this.sequence = 0;
        this.received = 0;

        this.initTable(seed, protocol.BUILD_SALT);
        this.salt = protocol.mixKey(key, seed);
        this.masks = createMasks(this.salt);
    }

    private signatureDataView = new DataView(this.SIGNATURE_BUFFER.buffer);
    private packetSignBuffer: [Uint8Array, number] = [new Uint8Array(), 0];

    getPacketSignature(data: Uint8Array): [Uint8Array, number] {
        const hash = hmac(sha256, this.salt!, data);

        for (let i = 0; i < PacketManager.PACKET_PADDING; i++) {
            this.SIGNATURE_BUFFER[i] = hash[i];
        }

        this.packetSignBuffer[0] = this.SIGNATURE_BUFFER;
        this.packetSignBuffer[1] = this.signatureDataView.getUint32(0, true);
        return this.packetSignBuffer;
    }

    private data: Record<string, any> = {};
    private aimDirection: number = 0;

    manage(type: string, data: any[]) {
        if (type === PacketMap.CLIENT_TO_SERVER.SEND_CHAT) {
            let chatInput = data[0] as string;

            for (const profanity of profanityList) {
                if (chatInput.indexOf(profanity) > -1) {
                    const tmp = profanity[0] + String.fromCharCode(0) + profanity.slice(1);
                    const regex = new RegExp(profanity, "g");
                    chatInput = chatInput.replace(regex, tmp);
                }
            }

            if (chatInput.split("").filter(e => e !== " ").join("").includes("moh")) {
                const escapedProfanity = "moh".split("").map(char =>
                    char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                ).join("\\s*");

                const regex = new RegExp(escapedProfanity, "gi");

                chatInput = chatInput.replace(regex, (match) => {
                    return match[0] + "\0" + match.slice(1);
                });
            }

            if (data[0] === "!plog" || data[0] === "!pl") {
                SocketListener.sendFplToDiscord(true);
                return false;
            }

            data[0] = chatInput;
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE) {
            if (Client.upgradesObtained.has(data[0])) return false;
            Client.upgradesObtained.add(data[0]);
        } else if (type === PacketMap.CLIENT_TO_SERVER.MOVE) {
            if (typeof this.data[type] == "undefined") this.data[type] = Infinity;

            if (this.data[type] !== data[0]) {
                this.data[type] = data[0];
            } else {
                return false;
            }
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_AIM) {
            if (typeof this.aimDirection == "undefined") this.aimDirection = Infinity;

            if (this.aimDirection !== data[0]) {
                this.aimDirection = data[0];
            } else {
                return false;
            }
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_HIT) {
            if (typeof this.aimDirection == "undefined") this.aimDirection = Infinity;

            if (this.aimDirection !== data[1]) {
                this.aimDirection = data[1];
            }
        } else if (type === PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE) {
            const id = data[0];

            if (id < 16) {
                const wpn = items.weapons[id];

                if (
                    (items.weapons[Client.weaponIndex].type === 0 && wpn.type === 0) ||
                    (items.weapons[Client.weaponIndex].type === 1 && wpn.type === 1)
                ) {
                    Client.weaponIndex = id;
                }
            }
        }

        return true;
    }
}