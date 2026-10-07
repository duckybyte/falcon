
export default class PingTracker {
    private static pingHistory = new Float64Array(5);
    private static instantaneousPing = 50;

    private static head = 0;
    private static count = 0;

    static update(newPing: number) {
        this.instantaneousPing = newPing;

        this.pingHistory[this.head] = newPing;
        this.count = Math.min(this.count + 1, this.pingHistory.length);
        this.head = (this.head + 1) % this.pingHistory.length;
    }

    static getCurrentPing() {
        return this.instantaneousPing;
    }

    static getAveragePing() {
        if (this.count === 0) return this.instantaneousPing;
        let total = 0;

        for (let i = 0; i < this.count; i++) {
            total += this.pingHistory[i];
        }

        return total / this.count;
    }
}