import Client from "@core/Client";
import PacketMap from "@root/utils/socket/PacketMap";
import getElem from "@utils/dom/getElem";

export const allianceMenu = getElem<"div">("alliance-menu");
export const allianceHolder = getElem<"div">("alliance-holder");
const allianceActionHolder = getElem<"div">("alliance-action-holder");

function kickFromClan(sid: number) {
    Client.socket.sendMsg(
        PacketMap.CLIENT_TO_SERVER.KICK_FROM_CLAN,
        sid
    );
}

export default function updateClanMenu() {
    const player = Client.player;
    if (!player) return;

    allianceMenu.innerHTML = "";

    if (Client.player.team) {
        for (let i = 0; i < Client.alliancePlayers.length; i += 2) {
            const allianceItem = document.createElement("div");
            allianceItem.className = "alliance-item";
            allianceItem.style = `color: ${Client.alliancePlayers[i] == Client.mySID ? "#fff" : "rgba(255,255,255,0.6)"};`;
            allianceItem.innerText = `${Client.alliancePlayers[i + 1]}`;
            allianceMenu.appendChild(allianceItem);

            if (Client.player.isOwner && Client.alliancePlayers[i] != Client.mySID) {
                const joinAlBtn = document.createElement("div");
                joinAlBtn.className = "join-alliance-btn";
                joinAlBtn.innerText = "Kick";
                joinAlBtn.onclick = () => kickFromClan(Client.alliancePlayers[i] as number);
                allianceItem.appendChild(joinAlBtn);
            }
        }
    } else {
        if (Client.alliances.length) {
            for (const team of Client.alliances) {
                const allianceItem = document.createElement("div");
                allianceItem.className = "alliance-item";
                allianceItem.style = `color: ${team.sid == Client.player.team ? "#fff" : "rgba(255,255,255,0.6)"};`;
                allianceItem.innerText = `${team.sid}`;
                allianceMenu.appendChild(allianceItem);

                const joinAlBtn = document.createElement("div");
                joinAlBtn.className = "join-alliance-btn";
                joinAlBtn.innerText = "Join";
                joinAlBtn.onclick = () => Client.socket.sendMsg(
                    PacketMap.CLIENT_TO_SERVER.JOIN_CLAN,
                    team.sid
                );
                allianceItem.appendChild(joinAlBtn);
            }
        } else {
            const allianceItem = document.createElement("div");
            allianceItem.className = "no-alliances-yet";
            allianceItem.innerText = "No Tribes Yet";
            allianceMenu.appendChild(allianceItem);
        }
    }

    allianceActionHolder.innerHTML = "";

    if (player.team) {
        const allianceActionBtn = document.createElement("div");
        allianceActionBtn.classList.add("alliance-leave-action-btn");
        allianceActionBtn.innerText = Client.player.isOwner ? "Delete Tribe" : "Leave Tribe";
        allianceActionBtn.onclick = () => Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.LEAVE_CLAN
        );
        allianceActionHolder.append(allianceActionBtn);
    } else {
        const allianceInput = document.createElement("input");
        allianceInput.id = "alliance-input";
        allianceInput.maxLength = 7;
        allianceInput.placeholder = "unique name";
        allianceInput.type = "text";
        allianceActionHolder.appendChild(allianceInput);

        const allianceButtonM = document.createElement("div");
        allianceButtonM.className = "alliance-btn-confirm";
        allianceButtonM.innerText = "Create";
        allianceButtonM.onclick = () => Client.socket.sendMsg(
            PacketMap.CLIENT_TO_SERVER.CREATE_CLAN,
            allianceInput.value.slice(0, 7)
        );
        allianceActionHolder.appendChild(allianceButtonM);
    }
}
