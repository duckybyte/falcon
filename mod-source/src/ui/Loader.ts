import items from "@constants/items";
import Client from "@core/Client";
import ObjectManager from "@core/logic/ObjectManager";
import PacketReplayer from "@core/PacketReplayer";
import CameraManager from "@rendering/core/CameraManager";
import SpriteCache from "@rendering/core/SpriteCache";
import RenderingConfig from "@rendering/RenderingConfig";
import AllTemporaryObjects from "@ui/data/AllTemporaryObjects";
import DisclaimerDisplay from "@ui/DisclaimerDisplay";
import Hook from "@ui/Hook";
import ServerBrowser from "@ui/ServerBrowser";
import getElem from "@utils/dom/getElem";
import Menu from "../core/menu/Menu";
import RendererSystem from "../rendering/RendererSystem";

declare global {
    interface HTMLImageElement {
        isLoaded: boolean;
    }
}

export const mainMenu = getElem<"div">("main-menu");
export const gameUI = getElem<"div">("game-ui");
export const respawnPage = getElem<"div">("respawn-page");
export const loadingCirclePage = getElem<"div">("loading-page");

const singleplayerBtn = getElem<"button">("singleplayer-btn");
const multiplayerBtn = getElem<"button">("multiplayer-btn");
const packetReplayerBtn = getElem<"button">("packet-replayer-btn");

const openDiscordBtn = getElem<"button">("open-discord-btn");
const quitClientBtn = getElem<"button">("quit-client-btn");

const skinSelector = getElem("skin-selector");
const actionBar = getElem("action-bar");

export const packetReplayerOptionsPage = getElem("packet-replayer-options-page");

function updateSkinColorPicker() {
    skinSelector.innerHTML = "";

    for (let i = 0; i < RenderingConfig.skinColors.length; i++) {
        const buttonItem = document.createElement("div");
        buttonItem.classList.add("skin-item");
        if (i == Loader.skinColor) buttonItem.classList.add("active");
        buttonItem.style.backgroundColor = RenderingConfig.skinColors[i];

        buttonItem.onclick = () => {
            localStorage.setItem("moo_skin", i.toString());
            Loader.skinColor = i;
            updateSkinColorPicker();
        };

        skinSelector.appendChild(buttonItem);
    }
}

const clearAllLogsBtn = getElem<"button">("clear-all-logs-btn");
const openLogsFolderBtn = getElem<"button">("open-logs-folder-btn");
const packetReplayerFileBtn = getElem<"button">("packet-replayer-file-btn");
const packetReplayerFileInput = getElem<"input">("packet-replayer-file-input");
const packetReplayerCancelBtn = getElem<"button">("packet-replayer-cancel-btn");
const recentMultiplayerBtn = getElem<"button">("recent-multiplayer-btn");
const largestRecentMultiplayerBtn = getElem<"button">("largest-recent-multiplayer-btn");

function hookMainMenuBtns() {
    singleplayerBtn.onclick = () => {
        loadingCirclePage.style.display = "flex";
        Client.connect();
    };

    multiplayerBtn.onclick = () => {
        ServerBrowser.start();
    };

    if (typeof localStorage.getItem("falcon-recent-server") !== "string") {
        recentMultiplayerBtn.style.display = "none";
        largestRecentMultiplayerBtn.style.display = "none";
    }

    largestRecentMultiplayerBtn.onclick = async () => {
        const serverKey = localStorage.getItem("falcon-recent-server")!;
        const [_, region] = serverKey.split(":");
        loadingCirclePage.style.display = "flex";

        const mostActiveServer = await ServerBrowser.getHighest(region);
        if (mostActiveServer) {
            ServerBrowser.selectedOption = mostActiveServer;
            Client.connect(mostActiveServer.key, region, mostActiveServer.name);
        } else {
            loadingCirclePage.style.display = "none";
            largestRecentMultiplayerBtn.style.display = "none";
        }
    };

    recentMultiplayerBtn.onclick = async () => {
        const serverKey = localStorage.getItem("falcon-recent-server")!;
        loadingCirclePage.style.display = "flex";

        if (await ServerBrowser.doesExist(serverKey)) {
            const [key, region, name] = serverKey.split(":");
            Client.connect(key, region, name);
        } else {
            loadingCirclePage.style.display = "none";
            recentMultiplayerBtn.style.display = "none";
        }
    };

    packetReplayerBtn.onclick = () => {
        packetReplayerOptionsPage.style.display = "flex";
        mainMenu.style.display = "none";
    };

    packetReplayerCancelBtn.onclick = () => {
        packetReplayerOptionsPage.style.display = "none";
        mainMenu.style.display = "flex";
    };

    openDiscordBtn.onclick = () => {
        window.open("https://discord.gg/4KUJm7jNys", "_blank");
    };

    packetReplayerFileBtn.onclick = () => {
        packetReplayerFileInput.click();
    };

    packetReplayerFileInput.onchange = () => {
        loadingCirclePage.style.display = "flex";
        const files: FileList | null = packetReplayerFileInput.files;

        if (!files || files.length !== 1) {
            loadingCirclePage.style.display = "none";
            return;
        }

        const file: File = files[0];
        const fileReader = new FileReader();

        fileReader.onload = () => {
            const result = fileReader.result;

            if (result instanceof ArrayBuffer) {
                PacketReplayer.start(result);
                loadingCirclePage.style.display = "none";
            }
        };

        fileReader.readAsArrayBuffer(file);
    };

    openLogsFolderBtn.onclick = () => {
        loadingCirclePage.style.display = "flex";
    };

    clearAllLogsBtn.onclick = () => {
        loadingCirclePage.style.display = "flex";
    };

    quitClientBtn.onclick = () => { };
}

function importTemporaryObjects() {
    const tmpObjects = AllTemporaryObjects[Math.floor(AllTemporaryObjects.length * Math.random())];

    CameraManager.camX = tmpObjects.player.x;
    CameraManager.camY = tmpObjects.player.y;

    for (let i = 0; i < tmpObjects.objects.length; i++) {
        const obj = tmpObjects.objects[i];
        ObjectManager.add(i, obj.x, obj.y, obj.dir, obj.scale, obj.type ?? -1000, obj.id, true, 6967);
    }
}

export default class Loader {
    private static toolSprites: Record<string, HTMLImageElement> = {};
    static skinColor = 0;

    private static prepareUI() {
        actionBar.innerHTML = "";

        for (let i = 0; i < items.weapons.length + items.list.length; i++) {
            const actionBarItem = document.createElement("div");
            actionBarItem.id = `action-bar-item-${i}`;
            actionBarItem.classList.add("action-bar-item");
            actionBarItem.style.display = "none";

            actionBar.appendChild(actionBarItem);
        }

        for (let i = 0; i < items.weapons.length + items.list.length; i++) {
            const tmp = items.weapons[i] || items.list[i - items.weapons.length];

            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = 66;

            const tmpContext = tmpCanvas.getContext("2d")!;
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));

            tmpContext.imageSmoothingEnabled = false;

            const actionElem = getElem<"div">(`action-bar-item-${i}`);
            actionElem.style.position = "relative";

            if (items.weapons[i]) {
                tmpContext.rotate((Math.PI / 4) + Math.PI);

                const tmpSprite = new Image();
                tmpSprite.crossOrigin = "anonymous";
                this.toolSprites[tmp.src] = tmpSprite;

                tmpSprite.onload = () => {
                    tmpSprite.isLoaded = true;

                    const tmpPad = 1 / (tmpSprite.height / tmpSprite.width);
                    const tmpMlt = (tmp.iPad || 1);

                    tmpContext.drawImage(
                        tmpSprite,
                        -(tmpCanvas.width * tmpMlt * RenderingConfig.iconPad * tmpPad) / 2,
                        -(tmpCanvas.height * tmpMlt * RenderingConfig.iconPad) / 2,
                        tmpCanvas.width * tmpMlt * tmpPad * RenderingConfig.iconPad,
                        tmpCanvas.height * tmpMlt * RenderingConfig.iconPad
                    );

                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);

                    actionElem.style.backgroundImage = `url('${tmpCanvas.toDataURL()}')`;
                };

                tmpSprite.src = `../../img/weapons/${tmp.src}.png`;
            } else {
                const tmpSprite = SpriteCache.getItemSprite(items.list[i - items.weapons.length], true);
                const tmpScale = Math.min(tmpCanvas.width - RenderingConfig.iconPadding, tmpSprite.width);

                tmpContext.globalAlpha = 1;
                tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);

                tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                tmpContext.globalCompositeOperation = "source-atop";
                tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);

                actionElem.style.backgroundImage = `url('${tmpCanvas.toDataURL()}')`;
            }
        }

        for (let i = 19; i <= 38; i++) {
            const itemCounts = document.createElement("div");
            itemCounts.id = `item-count-${i}`;
            itemCounts.classList.add("item-count");
            itemCounts.style.position = "absolute";
            itemCounts.innerText = "0";

            getElem(`action-bar-item-${i}`).appendChild(itemCounts);
        }
    }

    static async main() {
        importTemporaryObjects();
        this.prepareUI();

        Menu.init();
        RendererSystem.init();
        DisclaimerDisplay.show();

        Hook();

        const moo_skin = localStorage.getItem("moo_skin");
        if (typeof moo_skin === "string" && !isNaN(parseInt(moo_skin))) {
            this.skinColor = parseInt(moo_skin);
        }

        updateSkinColorPicker();
        hookMainMenuBtns();
    }
}