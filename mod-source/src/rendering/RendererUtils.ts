import GameObject from "@constants/GameObject";
import { ListItem, Weapon } from "@constants/items";
import Player from "@constants/Player";
import store, { Accessory, Hat } from "@constants/store";
import RenderingConfig from "@rendering/RenderingConfig";
import renderDottedCircle from "@rendering/utils/items/renderDottedCircle";
import renderSpike from "@rendering/utils/items/renderSpike";
import renderStone from "@rendering/utils/items/renderStone";
import renderWall from "@rendering/utils/items/renderWall";
import renderWindmill from "@rendering/utils/items/renderWindmill";
import { WeaponVariant } from "@utils/config/scriptConfigTypes";
import randInt from "@utils/random/randInt";

export function isOnScreen(x: number, y: number, s: number) {
    return (x + s >= 0 && x - s <= RenderingConfig.maxScreenWidth && y + s >= 0 && y - s <= RenderingConfig.maxScreenHeight)
}

const RED_OVERLAY_HEX = "#890e0e";

export const itemRenderers: Record<string, (obj: GameObject | ListItem, ctx: CanvasRenderingContext2D, objId: string) => void> = {
    apple: (obj, ctx) => {
        const leafDir = -(Math.PI / 2);

        ctx.fillStyle = "#c15555";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale);

        ctx.fillStyle = "#89a54c";
        RendererUtils.drawLeaf(
            obj.scale * Math.cos(leafDir),
            obj.scale * Math.sin(leafDir),
            25,
            leafDir + Math.PI / 2,
            ctx
        );
    },
    cookie: (obj, ctx) => renderDottedCircle(obj, ctx, "#cca861", "#937c4b"),
    cheese: (obj, ctx) => renderDottedCircle(obj, ctx, "#f4f3ac", "#c3c28b"),

    "wood wall": (obj, ctx) => renderWall(obj, ctx, "#a5974c", "#c9b758", 6),
    "stone wall": (obj, ctx) => renderWall(obj, ctx, "#939393", "#bcbcbc", 6),
    "castle wall": (obj, ctx) => renderWall(obj, ctx, "#83898e", "#9da4aa", 8),

    spikes: (obj, ctx, objId) => renderSpike(obj, ctx, "#a5974c", objId.includes("red-overlay") ? RED_OVERLAY_HEX : "#c9b758", "#939393", 5),
    "greater spikes": (obj, ctx, objId) => renderSpike(obj, ctx, "#a5974c", objId.includes("red-overlay") ? RED_OVERLAY_HEX : "#c9b758", "#939393", 6),
    "poison spikes": (obj, ctx, objId) => renderSpike(obj, ctx, "#a5974c", objId.includes("red-overlay") ? RED_OVERLAY_HEX : "#c9b758", "#7b935d", 6),
    "spinning spikes": (obj, ctx, objId) => renderSpike(obj, ctx, "#a5974c", objId.includes("red-overlay") ? RED_OVERLAY_HEX : "#c9b758", "#939393", 6),

    windmill: (obj, ctx) => renderWindmill(obj, ctx),
    "faster windmill": (obj, ctx) => renderWindmill(obj, ctx),
    "power mill": (obj, ctx) => renderWindmill(obj, ctx),

    mine: (obj, ctx) => {
        ctx.fillStyle = "#939393";
        RendererUtils.drawStar(ctx, 3, 0, 0, obj.scale, obj.scale);

        ctx.fillStyle = "#bcbcbc";
        RendererUtils.drawStar(ctx, 3, 0, 0, obj.scale * .55, obj.scale * .65, false, true);
    },
    sapling: (obj, ctx) => {
        for (let i = 0; i < 2; i++) {
            const tmpScale = obj.scale * (!i ? 1 : .5);

            ctx.fillStyle = !i ? "#9ebf57" : "#b4db62";
            RendererUtils.drawStar(ctx, 7, 0, 0, tmpScale * .7, tmpScale, false, !!i);
        }
    },

    "pit trap": (obj, ctx, objId) => {
        ctx.fillStyle = "#a5974c";
        RendererUtils.drawPolygon(ctx, 6, 0, 0, obj.scale * 1.1);

        ctx.fillStyle = objId.includes("red-overlay") ? RED_OVERLAY_HEX : RendererUtils.outlineColor;
        RendererUtils.drawPolygon(ctx, 6, 0, 0, obj.scale * .65, false, true);
    },
    "boost pad": (obj, ctx) => {
        const rectSize = obj.scale * 2;

        ctx.fillStyle = "#7e7f82";
        RendererUtils.drawRect(ctx, 0, 0, rectSize, rectSize);

        ctx.fillStyle = "#dbd97d";
        RendererUtils.drawTriangle(obj.scale, ctx);
    },

    turret: (obj, ctx) => {
        ctx.fillStyle = "#a5974c";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale);

        const tmpLen = 50;

        ctx.fillStyle = "#939393";
        RendererUtils.drawRect(ctx, 0, -tmpLen / 2, obj.scale * .9, tmpLen);
        RendererUtils.drawCircle(0, 0, ctx, obj.scale * .6);
    },

    platform: (obj, ctx) => {
        ctx.fillStyle = "#cebd5f";

        const tmpCount = 4;
        const tmpS = obj.scale * 2;
        const tmpW = tmpS / tmpCount;

        let tmpX = -(obj.scale / 2);

        for (var i = 0; i < tmpCount; ++i) {
            RendererUtils.drawRect(ctx, tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2);
            tmpX += tmpS / tmpCount;
        }
    },

    "healing pad": (obj, ctx) => {
        const rectSize = obj.scale * 2;

        ctx.fillStyle = "#7e7f82";
        RendererUtils.drawRect(ctx, 0, 0, rectSize, rectSize);

        ctx.fillStyle = "#db6e6e";
        RendererUtils.drawCircleRect(ctx, 0, 0, obj.scale * .65, 20, 4, true);
    },

    "spawn pad": (obj, ctx) => {
        const rectSize = obj.scale * 2;

        ctx.fillStyle = "#7e7f82";
        RendererUtils.drawRect(ctx, 0, 0, rectSize, rectSize);

        ctx.fillStyle = "#71aad6";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale * .6);
    },

    blocker: (obj, ctx) => {
        ctx.fillStyle = "#7e7f82";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale);

        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = "#db6e6e";
        RendererUtils.drawCircleRect(ctx, 0, 0, obj.scale * .65, 20, 4, true);
    },

    teleporter: (obj, ctx) => {
        ctx.fillStyle = "#7e7f82";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale);

        ctx.fillStyle = "#d76edb";
        RendererUtils.drawCircle(0, 0, ctx, obj.scale * .5, true);
    }
};

export const resRenderers: Record<number, (obj: GameObject, ctx: CanvasRenderingContext2D, biomeID: number) => void> = {
    0: (obj, ctx, biomeID) => {
        for (let i = 0; i < 2; i++) {
            const tmpScale = obj.scale * (!i ? 1 : .5);

            ctx.fillStyle = !biomeID ? (!i ? "#9ebf57" : "#b4db62") : (!i ? "#e3f1f4" : "#fff");
            RendererUtils.drawStar(ctx, 7, 0, 0, tmpScale * .7, tmpScale, false, !!i);
        }
    },

    1: (obj, ctx, biomeID) => {
        if (biomeID == 2) {
            ctx.fillStyle = "#606060";
            RendererUtils.drawStar(ctx, 6, 0, 0, obj.scale * .3, obj.scale * .71);

            ctx.fillStyle = "#89a54c";
            RendererUtils.drawCircle(0, 0, ctx, obj.scale * .55);

            ctx.fillStyle = "#a5c65b";
            RendererUtils.drawCircle(0, 0, ctx, obj.scale * .3, true);
        } else {
            ctx.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
            RendererUtils.drawBlob(ctx, 6, obj.scale, obj.scale * .7);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = biomeID ? "#6a64af" : "#c15555";

            const berries = 4;
            const rotVal = Math.PI * 2 / berries;

            for (var i = 0; i < berries; ++i) {
                const tmpRange = randInt(obj.scale / 3.5, obj.scale / 2.3);

                RendererUtils.drawCircle(
                    tmpRange * Math.cos(rotVal * i),
                    tmpRange * Math.sin(rotVal * i),
                    ctx,
                    randInt(10, 12)
                );
            }
        }
    },

    2: (obj, ctx, biomeID) => renderStone(obj, ctx, biomeID == 2 ? "#938d77" : "#939393", biomeID == 2 ? "#b2ab90" : "#bcbcbc"),
    3: (obj, ctx) => renderStone(obj, ctx, "#e0c655", "#ebdca3")
};

export const buildingHealthRenders: Record<string, (obj: GameObject, ctx: CanvasRenderingContext2D) => void> = {
    "wood wall": (obj, ctx) => {
        const angleRot = Math.PI / 6;

        ctx.rotate(angleRot);
        RendererUtils.drawPartialPolygonStroke(ctx, 6, 0, 0, obj.scale * 1.1, obj.health / obj.maxHealth);
        ctx.rotate(-angleRot);
    },
    "stone wall": (obj, ctx) => {
        const angleRot = Math.PI / 6;

        ctx.rotate(angleRot);
        RendererUtils.drawPartialPolygonStroke(ctx, 6, 0, 0, obj.scale * 1.1, obj.health / obj.maxHealth);
        ctx.rotate(-angleRot);
    },
    "castle wall": (obj, ctx) => {
        const angleRot = Math.PI / 8;

        ctx.rotate(angleRot);
        RendererUtils.drawPartialPolygonStroke(ctx, 8, 0, 0, obj.scale * 1.1, obj.health / obj.maxHealth);
        ctx.rotate(-angleRot);
    },

    spikes: (obj, ctx) => RendererUtils.drawPartialCircleStroke(0, 0, ctx, obj.scale * .6, obj.health / obj.maxHealth),
    "greater spikes": (obj, ctx) => RendererUtils.drawPartialCircleStroke(0, 0, ctx, obj.scale * .6, obj.health / obj.maxHealth),
    "poison spikes": (obj, ctx) => RendererUtils.drawPartialCircleStroke(0, 0, ctx, obj.scale * .6, obj.health / obj.maxHealth),
    "spinning spikes": (obj, ctx) => RendererUtils.drawPartialCircleStroke(0, 0, ctx, obj.scale * .6, obj.health / obj.maxHealth),

    "pit trap": (obj, ctx) => {
        const angleRot = Math.PI / 6;

        ctx.rotate(angleRot);
        RendererUtils.drawPartialPolygonStroke(ctx, 6, 0, 0, obj.scale * 1.1, obj.health / obj.maxHealth);
        ctx.rotate(-angleRot);
    },
    "boost pad": (obj, ctx) => {
        const angleRot = Math.PI / 4;
        const rectSize = obj.scale * 1.425;

        ctx.rotate(angleRot);
        RendererUtils.drawPartialPolygonStroke(ctx, 4, 0, 0, rectSize, obj.health / obj.maxHealth)
        ctx.rotate(-angleRot);
    },
};

export default class RendererUtils {
    static outlineWidth = 5.5;
    static outlineColor = "#525252";
    static darkOutlineColor = "#3d3f42";

    static riverWidth = 724;
    static riverPadding = 114;

    static healthBarWidth = 50;
    static healthBarPad = 4.5;


    static nameY = 34;

    static waterCurrent = 0.0011;
    static waveSpeed = 0.0001;
    static waveMax = 1.3;

    static skinColors = [
        "#bf8f54", "#cbb091", "#896c4b",
        "#fadadc", "#ececec", "#c37373",
        "#4c4c4c", "#ecaff7", "#738cc3",
        "#8bc373"
    ];

    static cowNames = [
        "Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona",
        "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis",
        "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff",
        "Jimmy", "Helena", "Reaper", "Ben", "Alan", "Naomi", "XYZ",
        "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison",
        "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo",
        "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"
    ];

    static itemSprites = {};

    static drawBlob(ctx: CanvasRenderingContext2D, spikeCount: number, outerRadius: number, innerRadius: number) {
        const angleStep = Math.PI / spikeCount;
        let angle = (3 * Math.PI) / 2;

        ctx.beginPath();
        ctx.moveTo(0, -innerRadius);

        for (let i = 0; i < spikeCount; i++) {
            const randomOuter = randInt(outerRadius + .9, outerRadius * 1.2);

            const controlX = Math.cos(angle + angleStep) * randomOuter;
            const controlY = Math.sin(angle + angleStep) * randomOuter;

            const endX = Math.cos(angle + 2 * angleStep) * innerRadius;
            const endY = Math.sin(angle + 2 * angleStep) * innerRadius;

            ctx.quadraticCurveTo(controlX, controlY, endX, endY);
            angle += 2 * angleStep;
        }

        ctx.closePath();
    }

    static drawCircle(x: number, y: number, mainContext: CanvasRenderingContext2D, radius: number, dontStroke?: boolean, dontFill?: boolean) {
        mainContext.beginPath();
        mainContext.arc(x, y, radius, 0, Math.PI * 2);

        if (!dontFill) mainContext.fill();
        if (!dontStroke) mainContext.stroke();
    }

    static makeDarker(hex: string, percent: number) {
        const factor = 1 - Math.min(Math.max(percent, 0), 1);
        if (factor === 0) return "#000000";

        let cleanHex = hex.replace(/^#/, "");
        if (cleanHex.length === 3) {
            cleanHex = cleanHex
                .split("")
                .map((char) => char + char)
                .join("");
        }

        if (cleanHex.length !== 6) {
            return hex.startsWith("#") ? hex : `#${hex}`;
        }

        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);

        const darkR = Math.round(r * factor);
        const darkG = Math.round(g * factor);
        const darkB = Math.round(b * factor);

        const toHex = (val: number): string => val.toString(16).padStart(2, "0");
        return `#${toHex(darkR)}${toHex(darkG)}${toHex(darkB)}`;
    }

    static drawPartialCircleStroke(
        x: number,
        y: number,
        mainContext: CanvasRenderingContext2D,
        radius: number,
        percent: number
    ) {
        mainContext.beginPath();
        mainContext.arc(x, y, radius, 0, Math.PI * 2 * percent);
        mainContext.stroke();
    }

    static accessSprites: Record<number, HTMLImageElement> = {};
    static accessPointers: Record<number, Accessory> = {};

    static renderTail(id: number, mainContext: CanvasRenderingContext2D, owner: Player) {
        let tmpAccessory = this.accessSprites[id];

        if (!tmpAccessory) {
            const tmpImage = new Image();
            tmpImage.crossOrigin = "anonymous";

            tmpImage.onload = () => {
                tmpImage.isLoaded = true;
            };

            tmpImage.src = `../../img/accessories/access_${id}.png`;
            this.accessSprites[id] = tmpImage;
            tmpAccessory = tmpImage;
        }

        let tmpObj = this.accessPointers[id];

        if (!tmpObj) {
            tmpObj = store.accessories.find(e => e.id == id)!;
            this.accessPointers[id] = tmpObj;
        }

        if (tmpAccessory.isLoaded) {
            mainContext.save();
            mainContext.translate(-20 - (tmpObj.xOff ?? 0), 0);
            mainContext.drawImage(tmpAccessory, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
            mainContext.restore();
        }
    }

    static skinSprites: Record<string, HTMLImageElement> = {};
    static skinPointers: Record<number, Hat> = {};

    static renderSkin(id: number, mainContext: CanvasRenderingContext2D, owner: Player, parent?: Hat, isTopSprite?: boolean) {
        const hatId = id + (isTopSprite ? "_top" : "");
        let tmpSkin = this.skinSprites[hatId];

        if (!tmpSkin) {
            const tmpImage = new Image();
            tmpImage.crossOrigin = "anonymous";

            tmpImage.onload = () => {
                tmpImage.isLoaded = true;
            };

            tmpImage.src = `../../img/hats/hat_${hatId}.png`;
            this.skinSprites[hatId] = tmpImage;
            tmpSkin = tmpImage;
        }

        let tmpObj = parent || this.skinPointers[id];
        if (!tmpObj) {
            tmpObj = store.hatMap.get(+id)!;
            this.skinPointers[id] = tmpObj;
        }

        if (tmpSkin.isLoaded) {
            mainContext.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
        }

        if (!parent && tmpObj.topSprite) {
            mainContext.save();
            mainContext.rotate(owner.skinRot);
            this.renderSkin(id, mainContext, owner, tmpObj, true);
            mainContext.restore();
        }
    }

    static drawLeaf(x: number, y: number, length: number, rotation: number, ctx: CanvasRenderingContext2D) {
        const endX = x + length * Math.cos(rotation);
        const endY = y + length * Math.sin(rotation);
        const width = length * 0.4;
        const midX = (x + endX) / 2;
        const midY = (y + endY) / 2;
        const perpAngle = rotation + Math.PI / 2;

        const controlX1 = midX + width * Math.cos(perpAngle);
        const controlY1 = midY + width * Math.sin(perpAngle);
        const controlX2 = midX - width * Math.cos(perpAngle);
        const controlY2 = midY - width * Math.sin(perpAngle);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(controlX1, controlY1, endX, endY);
        ctx.quadraticCurveTo(controlX2, controlY2, x, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    static drawPartialPolygonStroke(
        ctx: CanvasRenderingContext2D,
        sides: number,
        centerX: number,
        centerY: number,
        radius: number,
        percent: number
    ) {
        if (sides < 3) {
            throw new Error("Polygon must have at least 3 sides");
        }

        const angleStep = (2 * Math.PI) / sides;

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const x = centerX + radius * Math.cos(i * angleStep - Math.PI / 2);
            const y = centerY + radius * Math.sin(i * angleStep - Math.PI / 2);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();

        if (percent < 1) {
            const sideLength = Math.sqrt(2 * radius * radius * (1 - Math.cos(angleStep)));
            const totalPerimeter = sideLength * sides;

            ctx.setLineDash([totalPerimeter * percent, totalPerimeter]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);
    }

    static drawPolygon(ctx: CanvasRenderingContext2D, sides: number, centerX: number, centerY: number, radius: number, dontFill?: boolean, dontStroke?: boolean) {
        if (sides < 3) {
            throw new Error("Polygon must have at least 3 sides");
        }

        const angleStep = (2 * Math.PI) / sides;

        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const x = centerX + radius * Math.cos(i * angleStep - Math.PI / 2);
            const y = centerY + radius * Math.sin(i * angleStep - Math.PI / 2);

            if (i == 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();

        if (!dontFill) ctx.fill();
        if (!dontStroke) ctx.stroke();
    }

    static drawStar(mainContext: CanvasRenderingContext2D, points: number, centerX: number, centerY: number, innerRadius: number, outerRadius: number, dontFill?: boolean, dontStroke?: boolean) {
        if (points < 2) {
            throw new Error("Star must have at least 2 points");
        }

        const step = Math.PI / points;

        mainContext.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 == 0 ? outerRadius : innerRadius;
            const angle = i * step - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            if (i == 0) {
                mainContext.moveTo(x, y);
            } else {
                mainContext.lineTo(x, y);
            }
        }

        mainContext.closePath();

        if (!dontFill) mainContext.fill();
        if (!dontStroke) mainContext.stroke();
    }

    static drawTriangle(size: number, ctx: CanvasRenderingContext2D): void {
        const height = size * (Math.sqrt(3) / 2);

        ctx.beginPath();
        ctx.moveTo(0, -height / 2);
        ctx.lineTo(-size / 2, height / 2);
        ctx.lineTo(size / 2, height / 2);
        ctx.closePath();
        ctx.fill();
    }

    static drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, stroke = true) {
        const left = x - width / 2;
        const top = y - height / 2;

        ctx.fillRect(left, top, width, height);
        if (stroke) ctx.strokeRect(left, top, width, height);
    }

    static drawCircleRect(ctx: CanvasRenderingContext2D, x: number, y: number, rectWidth: number, rectHeight: number, segments: number, stroke = true) {
        ctx.save();
        ctx.translate(x, y);

        const halfSegs = Math.ceil(segments / 2);
        const angleStep = Math.PI / halfSegs;

        for (let i = 0; i < halfSegs; i++) {
            this.drawRect(ctx, 0, 0, rectWidth * 2, rectHeight, stroke);
            ctx.rotate(angleStep);
        }

        ctx.restore();
    }

    static toolSprites: Record<string, HTMLImageElement> = {};

    static renderTool(obj: Weapon, variant: WeaponVariant, x: number, y: number, ctx: CanvasRenderingContext2D) {
        const tmpSrc = obj.src + variant.src;
        let tmpSprite = this.toolSprites[tmpSrc];

        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.crossOrigin = "anonymous";

            tmpSprite.onload = () => {
                tmpSprite.isLoaded = true;
            };

            tmpSprite.src = `../../img/weapons/${tmpSrc}.png`;
            this.toolSprites[tmpSrc] = tmpSprite;
        }

        if (tmpSprite.isLoaded) {
            ctx.drawImage(
                tmpSprite,
                x + obj.xOff - (obj.length / 2),
                y + obj.yOff - (obj.width / 2),
                obj.length,
                obj.width
            );
        }
    }
}