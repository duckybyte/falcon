import getElem from "@utils/dom/getElem";

const disclaimerHolder = getElem("disclaimer-holder");
const disclaimerBtn = getElem("disclaimer-btn");

export default class DisclaimerDisplay {
    static async check() {
        return localStorage.getItem("falcon-is-first-join") === "ok3";
    }

    static async show() {
        const result = await this.check();
        if (result) return;

        disclaimerHolder.style.display = "flex";

        disclaimerBtn.onclick = () => {
            localStorage.setItem("falcon-is-first-join", "ok3");
            disclaimerHolder.style.display = "none";
        };
    }
}