import Menu from "@menu/Menu";
import RendererSystem, { gameCanvas, mainContext } from "../RendererSystem";
import RenderingConfig from "../RenderingConfig";

export default class WindowResizer {
    static resize() {
        Menu.menuElement.style.left = "calc(50% - 450px)";
        Menu.menuElement.style.top = "calc(50% - 300px)";

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        gameCanvas.width = screenWidth * RendererSystem.pixelDensity;
        gameCanvas.height = screenHeight * RendererSystem.pixelDensity;
        gameCanvas.style.width = `${screenWidth}px`;
        gameCanvas.style.height = `${screenHeight}px`;

        const scaleFillNative = Math.max(
            screenWidth / RenderingConfig.maxScreenWidth,
            screenHeight / RenderingConfig.maxScreenHeight
        ) * RendererSystem.pixelDensity;

        const transformX = (gameCanvas.width - (RenderingConfig.maxScreenWidth * scaleFillNative)) / 2;
        const transformY = (gameCanvas.height - (RenderingConfig.maxScreenHeight * scaleFillNative)) / 2;

        mainContext.setTransform(
            scaleFillNative, 0,
            0, scaleFillNative,
            transformX, transformY
        );
    }
    static init() {
        window.addEventListener("resize", () => this.resize());
        this.resize();
    }
}