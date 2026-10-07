import Client from "@core/Client";
import getElem from "@utils/dom/getElem";
import kFormat from "@utils/math/kFormat";

const foodDisplay = getElem("food-display");
const scoreDisplay = getElem("score-display");
const woodDisplay = getElem("wood-display");
const stoneDisplay = getElem("stone-display");
const killDisplay = getElem("kill-display");

export default function updatePlayerValue() {
    const player = Client.player;
    if (!player) return;

    foodDisplay.innerText = kFormat(player.food);
    woodDisplay.innerText = kFormat(player.wood);
    stoneDisplay.innerText = kFormat(player.stone);
    scoreDisplay.innerText = kFormat(player.points);
    killDisplay.innerText = kFormat(player.kills);
}