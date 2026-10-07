export default class HealerUtils {
    static readonly RELOAD_BUFFER = 0.9;

    static getFoodValue(foodId: number) {
        if (foodId === 0) return 20;
        if (foodId === 1) return 40;
        return 30;
    }
}