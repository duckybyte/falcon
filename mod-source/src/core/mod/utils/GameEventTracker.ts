import PacketMap from "@root/utils/socket/PacketMap";

type TrackableGameEvents = typeof PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION | typeof PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE;

export default class GameEventTracker {
    private static records = new Set<number>();
    private static confirmations = new Set<number>();

    private static textCache: Record<string, number> = {};
    private static textEncoder = new TextEncoder();

    static readonly TRACKABLE_PACKETS = new Set<TrackableGameEvents>([
        PacketMap.SERVER_TO_CLIENT.GATHER_ANIMATION,
        PacketMap.SERVER_TO_CLIENT.ADD_PROJECTILE
    ]);

    static prepare() {
        this.records.clear();
    }

    private static getKey(sid: number, eventType: TrackableGameEvents) {
        const type = this.textCache[eventType] ?? this.textEncoder.encode(eventType)[0];
        if (typeof this.textCache[eventType] !== "number") this.textCache[eventType] = type;
        return (sid << 16) | (type & 0xFFFF);
    }

    static updateTracker(sid: number, eventType: TrackableGameEvents) {
        const key = this.getKey(sid, eventType);
        if (!this.records.has(key)) return;
        this.confirmations.add(key);
    }

    static confirm(sid: number, eventType: TrackableGameEvents) {
        const key = this.getKey(sid, eventType);
        return this.confirmations.has(key);
    }

    static track(sid: number, eventType: TrackableGameEvents) {
        this.records.add(this.getKey(sid, eventType));
    }

    static clean() {
        this.confirmations.clear();
    }
}