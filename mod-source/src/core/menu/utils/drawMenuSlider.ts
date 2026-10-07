import Menu, { IMenuItem } from "../Menu";
import drawItemBody from "./drawItemBody";
import drawItemLabel from "./drawItemLabel";

export default function drawMenuSlider(item: IMenuItem, contentElement: HTMLElement) {
    const body = drawItemBody(item);
    body.style.pointerEvents = "none";

    const iconHolderElem = document.createElement("div");

    if (item.icon) {
        iconHolderElem.classList.add("menuItemIconHolder");
        iconHolderElem.innerHTML = `
            ${item.icon.replace(/REPLACE_WITH_COLOR/g, `var(--generic-white-2)`)}
        `;

        body.appendChild(iconHolderElem);
    }

    drawItemLabel(item, body, contentElement !== Menu.contentElement);

    const slider = document.createElement("input");
    slider.classList.add("menuSlider");
    slider.id = JSON.stringify(item);
    slider.type = "range";

    if (typeof item.min === "number") slider.min = String(item.min);
    if (typeof item.step === "number") slider.step = String(item.step);
    if (typeof item.max === "number") slider.max = String(item.max);

    slider.value = item.status;
    body.appendChild(slider);

    const sliderDisplay = document.createElement("div");
    sliderDisplay.style = "color: var(--theme-primary); font-size: 16px; width: 50px; margin-left: 10px; text-align: right;";
    body.appendChild(sliderDisplay);

    sliderDisplay.innerText = item.status || "0";

    slider.addEventListener("input", () => {
        item.status = slider.value;
        sliderDisplay.innerText = item.status;
        Menu.saveSettings();
    });

    contentElement.appendChild(body);
}