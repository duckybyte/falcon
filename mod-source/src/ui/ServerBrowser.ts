import Client from "@core/Client";
import { mainMenu } from "@ui/Loader";
import getElem from "@utils/dom/getElem";

export const serverBrowserPage = getElem<"div">("server-browser-page");
const connectToServerBtn = getElem<"button">("connection-server-btn");
const refreshServersBtn = getElem<"button">("refresh-server-browser-btn");
const serverBrowser = getElem<"div">("server-browser");
const serverBrowserLoadingText = getElem<"div">("server-browser-loading-text");
const cancelServerBrowser = getElem<"button">("cancel-server-browser-btn");

interface MooMooPublicServer {
    key: string;
    name: string;
    playerCapacity: 40;
    playerCount: number;
    regionName: string;
    auth: boolean;
    region: "eu" | "sea" | "na";
    version: string;
}

const regionDescriptions = {
    eu: ["frank", "skibidi", "most active server somehow"],
    na: ["we eat shit", "miami tryhards", "wtf", "A server located in usa miami florida, home to the world's most zero-latency humans alive."],
    sea: ["no one plays here"]
};

export default class ServerBrowser {
    private static async getData() {
        const res = await fetch("https://api-sandbox2.moomoo.io/servers?v=1.28");
        if (!res.ok) return [];

        const data = await res.json();
        return data as MooMooPublicServer[];
    }

    static selectedOption: MooMooPublicServer | undefined;
    static selectionIndex = -1;

    private static appendOption(serverData: MooMooPublicServer, index: number) {
        const button = document.createElement("button");
        button.id = `server-option-button-${index}`;
        button.classList.add("server-browser-option");

        const icon = document.createElement("div");
        icon.innerHTML = `<i class="material-symbols-outlined" style="color: var(--generic-white); font-size: 64px;">globe</i>`;

        const labelHolder = document.createElement("div");
        labelHolder.classList.add("server-browser-option-label-holder");

        const regionName = document.createElement("div");
        regionName.style = `color: var(--generic-white); font-size: 19px;`;
        regionName.innerText = `${serverData.regionName} ${serverData.name}`;

        const regionDescription = document.createElement("div");
        const descriptions = regionDescriptions[serverData.region];
        regionDescription.style = `text-align: left; max-width: 500px; color: var(--generic-white-2); font-size: 12px;`;
        regionDescription.innerText = descriptions[Math.floor(descriptions.length * Math.random())];

        const playerCountLabel = document.createElement("div");
        playerCountLabel.classList.add("server-browser-option-player-count");
        playerCountLabel.innerHTML = `<span>${serverData.playerCount}</span>/40`;

        labelHolder.append(regionName, regionDescription);
        button.append(icon, labelHolder, playerCountLabel);

        button.onclick = () => {
            if (this.selectionIndex >= 0 && this.selectionIndex === index) {
                this.selectionIndex = index;
                this.selectedOption = serverData;
                connectToServerBtn.click();
                return;
            }

            if (this.selectionIndex >= 0) {
                getElem(`server-option-button-${this.selectionIndex}`).classList.remove("active");
            }

            this.selectionIndex = index;
            this.selectedOption = serverData;
            connectToServerBtn.classList.remove("disabled");
            getElem(`server-option-button-${index}`).classList.add("active");
        };

        serverBrowser.appendChild(button);
    }

    private static async render() {
        this.selectionIndex = -1;
        this.selectedOption = undefined;
        connectToServerBtn.classList.add("disabled");

        serverBrowserLoadingText.style.display = "flex";
        for (let i = 1; i < serverBrowser.children.length; i++) {
            serverBrowser.children[i].remove();
            i--;
        }

        const data = await this.getData();
        data.sort((a, b) => b.playerCount - a.playerCount);

        for (let i = 0; i < data.length; i++) {
            this.appendOption(data[i], i);
        }

        serverBrowserLoadingText.style.display = "none";
        refreshServersBtn.classList.remove("disabled");
    }

    static async getHighest(region: string) {
        const data = await this.getData();
        const filtered = data.filter(e => e.region === region);
        return filtered.sort((a, b) => b.playerCount - a.playerCount)[0];
    }

    static async doesExist(serverKey: string) {
        const [key, region] = serverKey.split(":");
        const data = await this.getData();
        return data.some(e => e.key === key && e.region === region);
    }

    static async start() {
        mainMenu.style.display = "none";
        serverBrowserPage.style.display = "flex";

        this.render();

        connectToServerBtn.onclick = () => {
            Client.connect();
        };

        refreshServersBtn.onclick = () => {
            refreshServersBtn.classList.add("disabled");
            this.render();
        };

        cancelServerBrowser.onclick = () => {
            this.selectedOption = undefined;
            this.selectionIndex = -1;

            mainMenu.style.display = "flex";
            serverBrowserPage.style.display = "none";
        };
    }
}