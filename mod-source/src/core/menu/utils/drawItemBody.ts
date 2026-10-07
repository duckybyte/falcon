import { IMenuItem } from "../Menu";

export default function drawItemBody(item?: IMenuItem): HTMLDivElement {
    const body = document.createElement("div");
    body.classList.add("menuItem");
    return body;
}