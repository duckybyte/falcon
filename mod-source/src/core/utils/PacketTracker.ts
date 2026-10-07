import HealerUtils from "@core/mod/defense/utils/HealerUtils";
import PingTracker from "@core/mod/utils/PingTracker";
import Menu from "@menu/Menu";
import ScriptConfig from "@utils/config/ScriptConfig";

export const PacketAllocationPool = {
    ATTACK: 1,
    FOOD: 3,
    PLACE: 3,
    // PREPLACE: 4,
    AIM: 1,
    HAT_SWITCH: 1,
    MOVE: 1,
    WEAPON_SELECT: 1
} as const;

interface AllocationPool {
    ATTACK: number;
    AIM: number;
    HAT_SWITCH: number;
    FOOD: number;
    MOVE: number;
    WEAPON_SELECT: number;
}

export default class PacketTracker {
    private static isInitialized = false;
    private static history = new Float64Array(500);

    private static head = 0;
    private static count = 0;
    private static BASELINE = 14;
    private static currentBaseline = 14;
    private static reservedPackets = 0;
    static TOTAL_FOOD = 3;

    private static get maxCapacity() {
        const parsed = parseInt(Menu.getValue("packetBudgetLimit"));
        return isNaN(parsed) ? 110 : parsed;
    };

    private static preallocationPool: AllocationPool = {
        ATTACK: PacketAllocationPool.ATTACK,
        AIM: PacketAllocationPool.AIM,
        HAT_SWITCH: PacketAllocationPool.HAT_SWITCH,
        FOOD: PacketAllocationPool.FOOD * this.TOTAL_FOOD,
        MOVE: PacketAllocationPool.MOVE,
        WEAPON_SELECT: PacketAllocationPool.WEAPON_SELECT
    };

    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
    }

    static use(type: keyof typeof PacketAllocationPool, amount: number) {
        this.reservedPackets += PacketAllocationPool[type] * amount;
    }

    static adjustFoodAllocation(foodID: number) {
        const val = HealerUtils.getFoodValue(foodID);
        const total = Math.ceil(100 / val);

        if (total !== this.TOTAL_FOOD) return;
        this.TOTAL_FOOD = total;

        const totalFoodCost = PacketAllocationPool.FOOD * this.TOTAL_FOOD;
        this.BASELINE = PacketAllocationPool.ATTACK + PacketAllocationPool.AIM +
            PacketAllocationPool.HAT_SWITCH + totalFoodCost +
            PacketAllocationPool.MOVE + PacketAllocationPool.WEAPON_SELECT;
    }

    static allocate() {
        if (!this.isInitialized) return;
        this.currentBaseline = this.BASELINE;

        this.preallocationPool.ATTACK = PacketAllocationPool.ATTACK;
        this.preallocationPool.AIM = PacketAllocationPool.AIM;
        this.preallocationPool.HAT_SWITCH = PacketAllocationPool.HAT_SWITCH;
        this.preallocationPool.FOOD = PacketAllocationPool.FOOD * this.TOTAL_FOOD;
        this.preallocationPool.MOVE = PacketAllocationPool.MOVE;
        this.preallocationPool.WEAPON_SELECT = PacketAllocationPool.WEAPON_SELECT;
    }

    static freeAfterUse(type: keyof typeof PacketAllocationPool, amount: number) {
        const totalAmount = PacketAllocationPool[type] * amount;
        this.reservedPackets = Math.max(0, this.reservedPackets - totalAmount);
    }

    static free(type: keyof AllocationPool, amount: number | "ALL") {
        if (!this.isInitialized) return;
        let totalCost = 0;

        if (amount === "ALL") {
            totalCost = this.preallocationPool[type];
        } else if (typeof amount === "number" && amount > 0) {
            totalCost = PacketAllocationPool[type] * amount;
            if (this.preallocationPool[type] - totalCost < 0) return;
        } else {
            return;
        }

        this.preallocationPool[type] -= totalCost;
        this.currentBaseline -= totalCost;
    }

    static request(type: keyof typeof PacketAllocationPool, amount: number, paddingAmount: number = 0) {
        if (!this.isInitialized) return 0;
        if (amount <= 0) return 0;

        const halfAvgPing = PingTracker.getAveragePing() / 2;
        const realNow = performance.now() - halfAvgPing;
        const unitCost = PacketAllocationPool[type];

        const currentUsage = this.getCurrent() + this.currentBaseline + this.reservedPackets;
        let maxAllowedCost = this.maxCapacity - currentUsage;
        if (maxAllowedCost < unitCost) return 0;

        amount = Math.min(amount, Math.floor(maxAllowedCost / unitCost));
        const ticksAhead = parseInt(Menu.getValue("packetBudgetStrictness"));
        const ticksToPredict = isNaN(ticksAhead) ? 2 : ticksAhead;

        for (let i = 1; i <= ticksToPredict; i++) {
            const futureTime = realNow + (ScriptConfig.SERVER_UPDATE_SPEED * i) - (halfAvgPing * i);
            const totalLength = this.history.length;
            let survivingHistory = 0;

            for (let j = 0; j < this.count; j++) {
                const index = (this.head - 1 - j + totalLength) % totalLength;
                const time = this.history[index];

                if (futureTime - time > 1e3) break;
                survivingHistory++;
            }

            const futureGuaranteedBaseline = this.currentBaseline + this.reservedPackets + (i * this.BASELINE);
            const futureLoadBeforeRequest = survivingHistory + futureGuaranteedBaseline;
            const futureHeadroom = this.maxCapacity - futureLoadBeforeRequest;

            if (futureHeadroom < unitCost + paddingAmount) return 0;
            amount = Math.min(amount, Math.floor(futureHeadroom / unitCost));
        }

        return amount;
    }

    static add() {
        if (!this.isInitialized) return;

        const now = performance.now();
        if (now - this.history[this.head] <= 1e3) return;

        this.history[this.head] = now
        this.head = (this.head + 1) % this.history.length;
        this.count = Math.min(this.count + 1, this.history.length);
    }

    static getCurrent() {
        if (!this.isInitialized) return 0;

        const now = performance.now();
        const totalLength = this.history.length;
        let packets = 0;

        for (let i = 0; i < this.count; i++) {
            const index = (this.head - 1 - i + totalLength) % totalLength;
            const time = this.history[index];

            if (now - time > 1e3) break;
            packets++;
        }

        return packets;
    }
}