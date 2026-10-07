export interface WeaponVariant {
    id: number;
    src: string;
    xp: number;
    val: number;
    poison?: boolean;
}

export interface ScriptConfigType {
    MAP_SIZE: number;
    SNOW_BIOME_TOP: number;
    PLAYER_SPEED: number;
    WEAPON_VARIANTS: WeaponVariant[];
    HIT_ANGLE: number;
    GATHER_WIGGLE: number;
    SERVER_UPDATE_SPEED: number;
    GATHER_ANGLE: number;
    TURRET_GEAR_RELOAD: number;
    SHIELD_ANGLE: number;
    HEALING_DEBUG_MODE: boolean;
    IS_DEVELOPMENT_MODE: boolean;
}