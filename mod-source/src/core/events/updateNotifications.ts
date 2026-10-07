import Client from "@core/Client";
import { AllianceNotifi } from "@mod-types/index";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";

const notificationDisplay = getElem<"div">("notification-display");

function sendRequestResponse(tmp: AllianceNotifi, accepted: boolean) {
    Client.socket.sendMsg(
        PacketMap.CLIENT_TO_SERVER.JOIN_REQUEST,
        tmp.sid,
        accepted
    );

    Client.allianceNotifications.splice(0, 1);
    updateNotifications();
}

export default function updateNotifications() {
    if (Client.allianceNotifications[0]) {
        const tmp = Client.allianceNotifications[0] || { name: "asd" };

        notificationDisplay.innerHTML = "";
        notificationDisplay.style.display = "flex";

        const notificationText = document.createElement("div");
        notificationText.className = "notification-text";
        notificationText.innerText = `${tmp.name} {${tmp.sid}}`;
        notificationDisplay.appendChild(notificationText);

        const notifButton_a = document.createElement("div");
        notifButton_a.className = "notif-button";
        notifButton_a.innerHTML = `<i class="material-icons" style="font-size: 28px; color: #cc5151;">&#xE14C;</i>`;
        notifButton_a.onclick = () => sendRequestResponse(tmp, false);
        notificationDisplay.appendChild(notifButton_a);

        const notifButton_b = document.createElement("div");
        notifButton_b.className = "notif-button";
        notifButton_b.innerHTML = `<i class="material-icons" style="font-size: 28px; color: #8ecc51;">&#xE876;</i>`;
        notifButton_b.onclick = () => sendRequestResponse(tmp, true);
        notificationDisplay.appendChild(notifButton_b);
    } else {
        notificationDisplay.style.display = "none";
    }
}