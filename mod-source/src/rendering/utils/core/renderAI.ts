import Ai from "@constants/Ai";

const aiSprites: Record<number, HTMLImageElement> = {};

export default function renderAI(ai: Ai, ctx: CanvasRenderingContext2D) {
    const tmpIndex = ai.index;
    let tmpSprite = aiSprites[tmpIndex];

    if (!tmpSprite) {
        const tmpImage = new Image();
        tmpImage.crossOrigin = "anonymous";

        tmpImage.onload = () => {
            tmpImage.isLoaded = true;
        };

        tmpImage.src = `../../img/animals/${ai.src}.png`;

        tmpSprite = tmpImage;
        aiSprites[tmpIndex] = tmpSprite;
    }

    if (tmpSprite.isLoaded) {
        const tmpScale = ai.scale * 1.2 * (ai.spriteMlt || 1);
        ctx.drawImage(
            tmpSprite,
            -tmpScale,
            -tmpScale,
            tmpScale * 2,
            tmpScale * 2
        );
    }
}