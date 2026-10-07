import GameObject from "@constants/GameObject";
import items, { ListItem } from "@constants/items";
import randFloat from "@utils/random/randFloat";
import ScriptConfig from "@utils/config/ScriptConfig";
import Client from "../../core/Client";
import Menu from "../../core/menu/Menu";
import RendererUtils, { itemRenderers, resRenderers } from "../RendererUtils";

export default class SpriteCache {
    private static gameResSprites: Record<string, HTMLCanvasElement> = {};

    static reset() {
        this.gameResSprites = {};
        this.iconSprites = {};
        this.itemSprites = {};
    }

    static getResSprite(obj: GameObject) {
        const biomeID = (obj.y >= ScriptConfig.MAP_SIZE - ScriptConfig.SNOW_BIOME_TOP) ? 2 : ((obj.y <= ScriptConfig.SNOW_BIOME_TOP) ? 1 : 0);
        const objId = (obj.type + "_" + obj.scale + "_" + biomeID);

        if (this.gameResSprites[objId])
            return this.gameResSprites[objId];

        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = (obj.scale * 2.1) + RendererUtils.outlineWidth;

        const tmpContext = canvas.getContext("2d");
        if (!tmpContext) return canvas;

        tmpContext.translate((canvas.width / 2), (canvas.height / 2));
        tmpContext.rotate(randFloat(0, Math.PI));

        tmpContext.strokeStyle = RendererUtils.outlineColor;
        tmpContext.lineWidth = RendererUtils.outlineWidth;

        const renderer = resRenderers[obj.type];
        if (renderer) renderer(obj, tmpContext, biomeID);

        this.gameResSprites[objId] = canvas;
        return canvas;
    }

    private static itemSprites: Record<string, HTMLCanvasElement> = {};

    static getItemSprite(obj: GameObject | ListItem, asIcon?: boolean) {
        let objId = `${obj.id}`;

        if (Menu.getValue("buildingOverlay") && obj.isGameObject && (obj.dmg || obj.trap)) {
            if (!Client.isFriendly(obj.ownerSID ?? -1)) {
                objId += ` red-overlay`;
            }
        }

        const objData = items.list[obj.id];

        if (!asIcon && this.itemSprites[objId] && this.itemSprites[objId])
            return this.itemSprites[objId];

        const scale = obj.scale;
        const padding = (objData.spritePadding || 0);
        const size = (scale * 2.5) + RendererUtils.outlineWidth + padding;

        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;

        const tmpContext = canvas.getContext("2d");
        if (!tmpContext) return canvas;

        tmpContext.translate(size / 2, size / 2);
        if (!asIcon) tmpContext.rotate(Math.PI / 2);

        tmpContext.strokeStyle = RendererUtils.outlineColor;
        tmpContext.lineWidth = RendererUtils.outlineWidth * (asIcon ? (size / 81) : 1);

        const renderer = itemRenderers[obj.name];
        if (renderer) renderer(obj, tmpContext, objId);

        if (!asIcon) this.itemSprites[objId] = canvas;
        return canvas;
    }

    private static icons: string[] = ["crosshair", "oneTickCrosshair", "crown", "skull"];
    static iconSprites: Record<string, HTMLImageElement> = {};

    static renderIcons() {
        for (const icon of this.icons) {
            const img = document.createElement("img");
            img.src = icon === "oneTickCrosshair" ? "https://i.imgur.com/0bpFKDO.png" : icon === "crosshair" ? "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg" : `../../img/icons/${icon}.png`;

            img.onload = () => {
                img.isLoaded = true;
            };

            this.iconSprites[icon] = img;
        }
    }
}