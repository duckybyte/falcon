import ModManager from "@core/ModManager";
import AngleFinder, { FinderOptions } from "@placing/AngleFinder";
import SpikeGrader from "@placing/grader-modules/SpikeGrader";
import TrapGrader from "@placing/grader-modules/TrapGrader";

export default class AngleGrader {
    private static spikeGrader = new SpikeGrader();
    private static trapGrader = new TrapGrader();

    static grade(index: number, options: Readonly<FinderOptions>) {
        const angleData = AngleFinder.angleBuffer[index];
        const nearby = ModManager.enemyData.nearby;
        const grader = angleData.isSpike ? this.spikeGrader : this.trapGrader;

        grader.prepare(angleData, nearby, !!options.preplace, options.obj);
        if (angleData.dontUse) return;

        for (let i = 0, len = nearby.length; i < len; i++) {
            grader.grade(angleData, nearby[i]);
            if (angleData.dontUse) return;
        }
    }
}