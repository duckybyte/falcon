import items, { IProjectile } from "@constants/items";
import Projectile from "@constants/Projectile";
import ProjectileManager from "@core/logic/ProjectileManager";
import ModManager from "@core/ModManager";
import CameraManager from "@rendering/core/CameraManager";
import { mainContext } from "@rendering/RendererSystem";
import RendererUtils, { isOnScreen } from "@rendering/RendererUtils";

const projectileSprites: Record<string, HTMLImageElement> = {};

export function renderProjectile(x: number, y: number, obj: Projectile | IProjectile, ctx: CanvasRenderingContext2D) {
    if (obj.src) {
        const tmpSrc = items.projectiles[obj.indx].src!;
        let tmpSprite = projectileSprites[tmpSrc];

        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.crossOrigin = "anonymous";

            tmpSprite.onload = () => {
                tmpSprite.isLoaded = true;
            }

            tmpSprite.src = `../../img/weapons/${tmpSrc}.png`;
            projectileSprites[tmpSrc] = tmpSprite;
        }

        if (tmpSprite.isLoaded) {
            ctx.drawImage(
                tmpSprite,
                x - (obj.scale / 2),
                y - (obj.scale / 2),
                obj.scale,
                obj.scale
            );
        }
    } else if (obj.indx == 1) {
        ctx.fillStyle = "#939393";
        RendererUtils.drawCircle(x, y, ctx, obj.scale);
    }
}

export default function renderProjectiles(delta: number, layer: number) {
    const projectiles = ProjectileManager.projectiles.all;
    const buf = CameraManager.getOffset();
    const xOffset = buf[0];
    const yOffset = buf[1];

    for (let i = 0, len = projectiles.length; i < len; i++) {
        const proj = projectiles[i];

        if (proj && proj.active && proj.layer == layer) {
            proj.update(delta);

            const tmpX = proj.x - xOffset;
            const tmpY = proj.y - yOffset;

            if (isOnScreen(tmpX, tmpY, proj.scale)) {
                mainContext.save();
                mainContext.translate(tmpX, tmpY);
                mainContext.rotate(proj.dir);

                renderProjectile(0, 0, proj, mainContext);

                mainContext.restore();
            }
        }
    }

    if (layer === 1 && ModManager.tick % 90 === 0) {
        let totalInactive = 0;

        for (let i = 0, len = projectiles.length; i < len; i++) {
            const proj = projectiles[i];

            if (proj && !proj.active) {
                totalInactive++;
            }
        }

        if (totalInactive === projectiles.length) {
            ProjectileManager.projectiles.removeAll();
            ProjectileManager.simulationProjectiles.removeAll();
        }
    }
}