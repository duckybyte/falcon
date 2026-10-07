import items from "@constants/items";
import Client from "@core/Client";
import Menu from "@menu/Menu";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";

const upgradeHolder = getElem<"div">("upgrade-holder");
const upgradeCounter = getElem<"div">("upgrade-counter");
const tmpUpgradeList: number[] = [];

export default function updateUpgrades(points: number, age: number) {
    Client.player.upgradePoints = points;
    Client.player.upgrAge = age;
    if (age === 2) Client.upgradesObtained.clear();

    if (points > 0) {
        const tmpList = tmpUpgradeList;
        tmpUpgradeList.length = 0;
        upgradeHolder.innerHTML = "";

        for (let i = 0; i < items.weapons.length; i++) {
            const wpn = items.weapons[i];
            const isWithinAge = wpn.pre === undefined || Client.player.weapons.indexOf(wpn.pre) >= 0;

            if (wpn.age === age && (Client.socket.isPrivateServer || isWithinAge)) {
                const elem = document.createElement("div");
                elem.id = `upgrade-item-${i}`;
                elem.className = "action-bar-item";

                elem.style.backgroundImage = getElem<"div">(`action-bar-item-${i}`).style.backgroundImage;
                upgradeHolder.appendChild(elem);
                tmpList.push(i);
            }
        }

        for (let i = 0; i < items.list.length; i++) {
            const item = items.list[i];

            if (item.age == age) {
                const tmpId = i + items.weapons.length;
                const elem = document.createElement("div");
                elem.id = `upgrade-item-${tmpId}`;
                elem.className = "action-bar-item";

                elem.style.backgroundImage = getElem<"div">(`action-bar-item-${tmpId}`).style.backgroundImage;
                upgradeHolder.appendChild(elem);
                tmpList.push(tmpId);
            }
        }

        if (Menu.getValue("autoUpgrade")) {
            if (tmpList.length === 1) {
                Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, tmpList[0]);
                return;
            } else {
                const _7thSlot = parseInt(Menu.getValue("7thSlot"));

                for (const id of tmpList) {
                    if ([17, 31, 23, _7thSlot].includes(id)) {
                        Client.socket.sendMsg(PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE, id);
                        return;
                    }
                }
            }
        }

        for (let i = 0; i < tmpList.length; i++) {
            const tmpId = tmpList[i];
            const elem = getElem(`upgrade-item-${tmpId}`);

            elem.onclick = () => {
                Client.socket.sendMsg(
                    PacketMap.CLIENT_TO_SERVER.SEND_UPGRADE,
                    tmpId
                );
            };
        }

        if (tmpList.length) {
            upgradeHolder.style.display = "flex";
            upgradeCounter.style.display = "block";
            upgradeCounter.innerHTML = `SELECT ITEMS (${Math.min(9, points)})`;
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
        }
    } else {
        upgradeHolder.style.display = "none";
        upgradeCounter.style.display = "none";
    }
}