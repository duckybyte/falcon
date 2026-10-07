export interface PlayerSimulationState {
    sid: number;
    x: number;
    y: number;
    team: string | null;
    velX: number;
    velY: number;
    scale: number;
    health: number;
    maxHealth: number;
    skinIndex: number;
    tailIndex: number;
    lockMove: boolean;
    weaponIndex: number;
    buildIndex: number;
    slowMult: number;
    spikeDamages: number;
}

export interface GameObjectSimulationState {
    active: boolean;
    sid: number;
    x: number;
    y: number;
    scale: number;
    type: number;
    dmg: number;
    health: number;
    teleport: boolean;
    boostSpeed: number;
    ignoreCollision: boolean;
    trap: boolean;
    ownerSID: number | undefined;
    dir: number;
    willBreak: boolean;
}