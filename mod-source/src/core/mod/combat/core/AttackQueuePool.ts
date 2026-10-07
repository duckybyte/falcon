export interface AttackAction {
    skinData: [id: number, isAccessory: boolean];
    wpnId: number;
    aimType: "nearest" | "enemy-trap";
    reason: string;
    customAim: number | undefined;
    tickMode: "to" | "away" | "stop" | undefined;
    noAttack: boolean | undefined;
    dontUse: boolean;
    isFromPool: boolean;
}

type AttackQueueCallback = () => void;

export interface AttackQueue {
    sequence: AttackAction[];
    cost: number;
    grade: number;
    onSelect: AttackQueueCallback | undefined;
}

export default class AttackQueuePool {
    private static createAttackAction(isFromPool = false): AttackAction {
        return {
            skinData: [-1, false],
            wpnId: 0,
            aimType: "nearest",
            reason: "no reason provided",
            customAim: undefined,
            tickMode: undefined,
            noAttack: undefined,
            dontUse: true,
            isFromPool
        };
    }

    static copySequenceOver(fromSeq: AttackAction[], toSeq: AttackAction[]) {
        // fromSeq and toSeq should be both length of 2, if not we fucked up

        for (let i = 0; i < 2; i++) {
            const fromAction = fromSeq[i];
            const toAction = toSeq[i];

            toAction.skinData[0] = fromAction.skinData[0];
            toAction.skinData[1] = fromAction.skinData[1];

            toAction.wpnId = fromAction.wpnId;
            toAction.aimType = fromAction.aimType;
            toAction.customAim = fromAction.customAim;
            toAction.dontUse = fromAction.dontUse;
            toAction.reason = fromAction.reason;
            toAction.tickMode = fromAction.tickMode;
            toAction.noAttack = fromAction.noAttack;
        }
    }

    static createAttackSequence(): AttackAction[] {
        const actionOne = this.createAttackAction();
        const actionTwo = this.createAttackAction();
        return [actionOne, actionTwo];
    }

    static createAttackQueue(): AttackQueue {
        return { sequence: this.createAttackSequence(), cost: 0, grade: 0, onSelect: undefined };
    }
}