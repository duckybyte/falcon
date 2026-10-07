import Menu, { IMenuItem } from "../Menu";
import drawItemBody from "./drawItemBody";

export default function drawMenuParagraph(item: IMenuItem) {
    const body = drawItemBody(item);
    body.style.pointerEvents = "none";
    body.style.color = "var(--generic-white)";
    body.style.fontSize = "13px";
    body.innerHTML = item.description || "";
    Menu.contentElement.appendChild(body);
}