import Menu, { IMenuItem } from "../Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";

export default function drawMenuSelect(item: IMenuItem, contentElement: HTMLElement) {
    if (!item.options) return;
    const isInDropdownContent = contentElement !== Menu.contentElement;

    const body = drawItemBody(item);
    body.style.pointerEvents = "none";

    const iconHolderElem = document.createElement("div");
    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");
        if (item.status) iconHolderElem.classList.add("activeMenuItem");

        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(${item.status ? "--theme-primary" : "--generic-white-2"})`)}
        `;

        body.appendChild(iconHolderElem);
    }

    drawItemLabel(item, body, isInDropdownContent);

    const selector = document.createElement("select");
    selector.id = JSON.stringify(item);
    selector.classList.add("menuSelector");

    for (const option of item.options) {
        const elem = document.createElement("option");
        elem.innerText = option.label;
        elem.value = option.value;
        elem.selected = String(item.status) === String(option.value);

        selector.appendChild(elem);
    }

    body.appendChild(selector);
    selector.onchange = (ev) => {
        if (ev.target === selector) {
            item.status = selector.value;
            Menu.saveSettings();
        }
    }

    contentElement.appendChild(body);
}