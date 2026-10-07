import { IMenuItem } from "../Menu";

export default function drawItemLabel(item: IMenuItem, body: HTMLDivElement, isInDropdownContent: boolean = false) {
    const labelHolder = document.createElement("div");
    labelHolder.style.marginLeft = item.icon ? "7px" : "";
    labelHolder.style.width = "100%";

    const name = document.createElement("div");
    name.classList.add("menuItemLabel");
    labelHolder.appendChild(name);
    name.innerHTML = item.label;

    if (item.description) {
        if (isInDropdownContent) {
            const infoWrapper = document.createElement("div");
            infoWrapper.classList.add("menuItemInfoWrapper");

            const infoIcon = document.createElement("span");
            infoIcon.classList.add("menuItemInfoIcon");
            infoIcon.innerHTML = "&#9432;";

            infoIcon.onmouseover = () => {
                tooltipBox.style.display = "block";
            };

            infoIcon.onmouseout = () => {
                tooltipBox.style.display = "none";
            };

            const tooltipBox = document.createElement("div");
            tooltipBox.classList.add("menuItemTooltip");
            tooltipBox.innerHTML = item.description;

            infoWrapper.appendChild(infoIcon);
            infoWrapper.appendChild(tooltipBox);
            name.appendChild(infoWrapper);
        } else {
            const description = document.createElement("div");
            description.classList.add("menuItemDescription");
            description.innerHTML = item.description;
            labelHolder.appendChild(description);
        }
    }

    body.appendChild(labelHolder);
}