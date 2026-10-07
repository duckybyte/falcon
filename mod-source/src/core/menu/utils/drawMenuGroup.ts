import Menu, { IMenuItem } from "../Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";

export default function drawMenuGroup(item: IMenuItem, contentElement: HTMLElement) {
    if (!item.settings) return;

    const body = drawItemBody(item);
    body.classList.add("menuGroup");

    const iconHolderElem = document.createElement("div");
    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");

        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(--generic-white-2)`)}
        `;

        body.appendChild(iconHolderElem);
    }

    drawItemLabel(item, body);

    const settingButton = document.createElement("div");
    settingButton.classList.add("menuItemSettings");
    settingButton.style.pointerEvents = "none";
    settingButton.innerHTML = `
    <span class="material-icons" style="color: var(--generic-white-2); font-size: 16px;">
        open_in_new
    </span>
    `;
    body.appendChild(settingButton);

    body.onclick = () => {
        Menu.renderItems(item.settings!);

        Menu.currentItem = item.settings![0];

        Menu.backwardStack.push(item);
        Menu.forwardStack.clear();
        Menu.updateUtilsBar(item.label);
    };

    contentElement.appendChild(body);
}