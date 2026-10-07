import GameObject from "@constants/GameObject";
import RendererUtils from "@rendering/RendererUtils";

export default function renderWillBreakVisuals(gameObject: GameObject, mainContext: CanvasRenderingContext2D, color: string) {
    if (!gameObject.willBreak) return;

    mainContext.save();
    mainContext.globalAlpha = .85;
    mainContext.strokeStyle = RendererUtils.makeDarker(color, .25);
    mainContext.lineWidth = 5.5;

    const totalArcs = 6;
    const segmentAngle = (Math.PI * 2) / totalArcs;
    const gapRatio = 0.35;

    const arcLength = segmentAngle * (1 - gapRatio);

    for (let i = 0; i < totalArcs; i++) {
        const startAngle = i * segmentAngle;
        const endAngle = startAngle + arcLength;

        mainContext.beginPath();
        mainContext.arc(0, 0, gameObject.scale + 10, startAngle, endAngle);
        mainContext.stroke();
    }

    mainContext.restore();
}