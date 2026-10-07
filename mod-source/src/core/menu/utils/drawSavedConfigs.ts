import Menu, { menuContent } from "../Menu";
import drawItemBody from "./drawItemBody";

const ICON = `
<svg viewBox="0 0 360 360" width="37" height="37">
    <path fill="REPLACE_WITH_COLOR" d="M0 0C1.3 0 2.6 0 4 0 4.6 0 5.3 0 6 0 8.1 0 10.1 0 12.2 0 14.1 0 14.1 0 16.1 0 17.9 0 17.9 0 19.7 0 24.7.8 27.6 2.6 30.6 6.6 31.2 7.4 31.7 8.2 32.3 9 37.6 16.2 43.3 22.9 52.4 24.5 64 26 75.8 25.2 87.4 24.7 93.2 24.4 98.9 24.3 104.7 24.1 109.2 24 113.6 23.9 118.1 23.7 118.9 23.6 119.7 23.6 120.6 23.6 122.1 23.5 123.6 23.5 125.1 23.4 130.2 23.2 133.8 23.9 138.1 26.5 142.1 31.7 142.6 37.2 142.6 43.5 142.6 44.8 142.6 44.8 142.6 46.1 142.6 48.9 142.6 51.8 142.6 54.6 142.6 56.5 142.6 58.5 142.6 60.5 142.6 64.6 142.6 68.7 142.5 72.8 142.5 78.1 142.5 83.4 142.5 88.6 142.5 92.7 142.5 96.8 142.5 100.8 142.5 102.8 142.5 104.7 142.5 106.7 142.5 109.4 142.5 112.1 142.5 114.8 142.5 116 142.5 116 142.5 117.2 142.4 122.1 141.7 125.3 139.1 129.5 134.4 134 130.9 134.7 124.5 134.7 123.4 134.7 122.3 134.7 121.1 134.7 119.3 134.7 119.3 134.7 117.4 134.7 115.5 134.7 115.5 134.7 113.5 134.7 109.9 134.7 106.4 134.7 102.8 134.7 100.6 134.7 98.4 134.7 96.2 134.7 89.2 134.8 82.2 134.8 75.3 134.8 67.3 134.8 59.3 134.8 51.2 134.8 45 134.8 38.8 134.9 32.6 134.9 28.9 134.9 25.2 134.9 21.5 134.9 17.4 134.9 13.2 134.9 9.1 134.9 7.3 134.9 7.3 134.9 5.4 134.9-2.2 134.9-6.9 134.1-13.3 130-15.9 126-15.6 121.9-15.7 117.2-15.7 116.2-15.7 115.1-15.8 114.1-15.8 110.9-15.9 107.7-15.9 104.5-16 103.1-16 103.1-16 101.7-16.1 95.1-16.1 88.5-16.1 81.9-16.1 80.9-16.1 79.9-16.1 78.9-16.2 73.6-16.2 68.3-16.2 63-16.2 57.5-16.2 52.1-16.2 46.6-16.3 42.4-16.3 38.1-16.3 33.9-16.3 31.9-16.3 29.9-16.3 27.9-16.3 25.1-16.3 22.3-16.3 19.5-16.3 18.7-16.3 17.8-16.3 17-16.3 12.1-15.6 8.8-12.9 4.5-8.6.9-5.6 0 0 0Z" transform="translate(116.9375,112.46875)"/>
</svg>
`;

export default async function drawSavedConfigs() {
    const savedConfigs = localStorage.getItem("falcon-configs") ? JSON.parse(localStorage.getItem("falcon-configs")!) : {};

    for (const key in savedConfigs) {
        if (!savedConfigs[key]) continue;

        const body = drawItemBody();
        body.classList.add("menuConfigToggle");

        const iconHolderElem = document.createElement("div");
        iconHolderElem.classList.add("menuItemIconHolder");
        iconHolderElem.innerHTML = `
            ${ICON.replace(/REPLACE_WITH_COLOR/g, `var(--generic-white-2)`)}
        `;

        body.appendChild(iconHolderElem);

        const labelHolder = document.createElement("div");
        const name = document.createElement("div");
        name.style.marginLeft = "7px";
        name.classList.add("menuItemLabel");
        labelHolder.appendChild(name);
        name.innerHTML = `Load '${key}' Config`;

        body.appendChild(labelHolder);

        const deleteButton = document.createElement("div");
        deleteButton.classList.add("menuItemSettings");
        deleteButton.innerHTML = `
        <span class="material-icons" style="color: var(--generic-white-2); font-size: 16px;">
            delete
        </span>
        `;
        body.appendChild(deleteButton);

        deleteButton.onclick = async () => {
            savedConfigs[key] = undefined;
            localStorage.setItem("falcon-configs", JSON.stringify(savedConfigs));
            Menu.renderItems(menuContent.configs);
        };

        const settingButton = document.createElement("div");
        settingButton.classList.add("menuItemSettings");
        settingButton.style.pointerEvents = "none";
        settingButton.style.marginLeft = "12px";
        settingButton.innerHTML = `
        <span class="material-icons" style="color: var(--generic-white-2); font-size: 16px;">
            open_in_new
        </span>
        `;
        body.appendChild(settingButton);

        body.onclick = () => {
            Menu.loadSettings(savedConfigs[key]);
        };

        Menu.contentElement.appendChild(body);
    }
}