import GameObject from "@constants/GameObject";
import Player from "@constants/Player";
import { WeaponFetchData } from "@core/logic/players/core/PlayerCombatManager";

export interface PushStrikeContext {
    player: Player;
    primary: WeaponFetchData;
    nearestEnemy: Player;
    spike: GameObject;
    scale: number;
    tick: number;
}

export default abstract class PushSpikeMethod {
    abstract initialize(): void;
    abstract execute(ctx: PushStrikeContext): void;
}