import Client from "@core/Client";
import updateClanMenu, { allianceHolder } from "@core/events/updateClanMenu";
import TextManager from "@core/logic/TextManager";
import AttackManager from "@core/mod/combat/core/AttackManager";
import CombatController from "@core/mod/combat/core/CombatController";
import PacketReplayer from "@core/PacketReplayer";
import Menu from "@menu/Menu";
import AutoGrinder from "@placing/modules/AutoGrinder";
import AutoMiller from "@placing/modules/AutoMiller";
import SpriteCache from "@rendering/core/SpriteCache";
import WindowResizer from "@rendering/core/WindowResizer";
import RenderingConfig from "@rendering/RenderingConfig";
import PacketMap from "@root/utils/socket/PacketMap";
import Loader, { loadingCirclePage } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

const moveKeys: Record<number, [number, number]> = {
    87: [0, -1],
    38: [0, -1],
    83: [0, 1],
    40: [0, 1],
    65: [-1, 0],
    37: [-1, 0],
    68: [1, 0],
    39: [1, 0]
};

function getMoveDir(): number | null {
    let dx = 0;
    let dy = 0;

    for (const key in moveKeys) {
        const keyNum = Number(key);

        if (Input.keys[keyNum]) {
            const buf = moveKeys[keyNum];
            const mx = buf[0], my = buf[1];

            dx += mx;
            dy += my;
        }
    }

    return (dx === 0 && dy === 0) ? null : parseFloat(Math.atan2(dy, dx).toFixed(2));
}

const gameCanvas = getElem<"canvas">("game-canvas");
export const chatInput = getElem<"input">("chat-input");

export class Input {
    static keys: Record<string | number, boolean> = {};

    private static mouseX: number = 0;
    private static mouseY: number = 0;

    static init() {
        gameCanvas.addEventListener("mousemove", (event) => {
            Input.mouseX = event.clientX;
            Input.mouseY = event.clientY;
        });
    }

    static getAttackDir() {
        const mouseDir = Math.atan2(this.mouseY - (window.innerHeight / 2), this.mouseX - (window.innerWidth / 2));
        return mouseDir;
    }
}

Input.init();

function sendMoveDir() {
    const moveDir = getMoveDir();
    Client.lastMoveDir = moveDir;
}

document.addEventListener("contextmenu", (event) => event.preventDefault());

function resetMovementDir() {
    Input.keys = {};
    Client.lastMoveDir = null;
}

function toggleChat() {
    if (chatInput.style.display === "block") {
        chatInput.style.display = "none";

        if (Client.socket && Client.player) Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.SEND_CHAT,
            chatInput.value.slice(0, 30)
        );
    } else {
        chatInput.style.display = "block";
        chatInput.focus();
        chatInput.value = "";
    }
}

gameCanvas.addEventListener("mouseup", (event) => {
    if (event.button === 0) {
        CombatController.tankSpam = !CombatController.tankSpam;
    }
});

gameCanvas.addEventListener("mousedown", (event) => {
    inWindow = true;
});

gameCanvas.addEventListener("wheel", (event) => {
    if (!Client.player) return;
    const delta = event.deltaY || event.deltaX;

    if (delta > 0) {
        RenderingConfig.maxScreenWidth *= 0.95;
        RenderingConfig.maxScreenHeight *= 0.95;
    } else {
        RenderingConfig.maxScreenWidth /= 0.95;
        RenderingConfig.maxScreenHeight /= 0.95;
    }

    WindowResizer.resize();
});

export function resetScreenSize() {
    RenderingConfig.maxScreenWidth = RenderingConfig.baseScreenWidth;
    RenderingConfig.maxScreenHeight = RenderingConfig.baseScreenHeight;
    WindowResizer.resize();
}

let inWindow = false;

export function isOnWindow() {
    return inWindow;
}

window.onblur = () => {
    inWindow = false;
    Input.keys = {};
};

window.onfocus = () => {
    inWindow = true;
};

function isKeyboardActive() {
    return chatInput.style.display !== "block" && allianceHolder.style.display !== "flex" && document.activeElement?.tagName !== "INPUT" && !document.activeElement?.classList.contains("menuConfigUIInput");
}

const pauseIcon = getElem("paused-icon");

document.addEventListener("keydown", (event) => {
    inWindow = true;
    if (!Client.player) return;

    if (event.code === "Enter") {
        toggleChat();
    } else if (isKeyboardActive()) {
        Input.keys[event.code] = true;
        Input.keys[event.keyCode] = true;
        Input.keys[event.key] = true;

        if (moveKeys[event.keyCode]) {
            sendMoveDir();
        } else {
            if (event.code === "KeyR") {
                AttackManager.autoInstaToggle = !AttackManager.autoInstaToggle;
            } else if (event.code === "Equal") {
                resetScreenSize();
            } else if (event.code === "KeyE") {
                Client.socket.sendMsg(
                    PacketMap.CLIENT_TO_SERVER.AUTO_GATHER,
                    1
                );
            } else if (event.shiftKey && event.code === "KeyZ") {
                SpriteCache.reset();
                SpriteCache.renderIcons();
            } else if (event.code === "KeyT" && Menu.getValue("dynamicOneTick")) {
                AttackManager.oneTicker.tapMode = !AttackManager.oneTicker.tapMode;
                TextManager.add(
                    Client.player.render_position.x,
                    Client.player.render_position.y,
                    AttackManager.oneTicker.tapMode ? "Active" : "Passive",
                    0
                );
            } else if (event.code === "KeyZ") {
                AutoMiller.data.status = !AutoMiller.data.status;
            } else if (/Digit[0-9]/.test(event.code)) {
                const player = Client.player;
                const id = parseInt(event.code.split("Digit")[1]) - 1;

                if (typeof player.weapons[id] === "number") {
                    Client.weaponIndex = AutoGrinder.weaponIndex = player.weapons[id];
                    Client.socket.sendMsg(
                        PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD,
                        player.weapons[id],
                        true
                    );
                } else if (typeof player.items[id - player.weapons.length] === "number") {
                    Client.socket.sendMsg(
                        PacketMap.CLIENT_TO_SERVER.SELECT_TO_BUILD,
                        player.items[id - player.weapons.length],
                        false
                    );
                }
            } else if (event.code === "Space") {
                PacketReplayer.isPaused = !PacketReplayer.isPaused;

                const pauseMaterialIcon = pauseIcon.querySelector(".material-symbols-outlined");
                if (pauseMaterialIcon)
                    pauseMaterialIcon.innerHTML = PacketReplayer.isPaused ? "play_arrow" : "pause";
            }
        }
    }
});

document.addEventListener("keyup", (event) => {
    Input.keys[event.code] = false;
    Input.keys[event.keyCode] = false;
    Input.keys[event.key] = false;

    if (moveKeys[event.keyCode]) {
        sendMoveDir();
    }
});

export const nameInput = getElem<"input">("username-input");
export const enterGameBtn = getElem<"button">("enter-game-btn");
const allianceBtn = getElem<"button">("alliance-btn");

export default function Hook() {
    nameInput.value = localStorage.getItem("moo_name") ?? "";

    enterGameBtn.onclick = () => {
        localStorage.setItem("moo_name", nameInput.value);

        Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.JOIN_GAME,
            {
                name: nameInput.value || "unknown",
                moofoll: "1",
                skin: Loader.skinColor
            }
        );

        loadingCirclePage.style.display = "flex";
    };

    allianceBtn.onclick = () => {
        if (allianceHolder.style.display === "none")
            allianceHolder.style.display = "flex";
        else allianceHolder.style.display = "none";

        resetMovementDir();
        updateClanMenu();
    };
}