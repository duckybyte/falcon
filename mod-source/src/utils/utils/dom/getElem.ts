export default function getElem<K extends keyof HTMLElementTagNameMap>(id: string): HTMLElementTagNameMap[K] {
    const elem = document.getElementById(id);

    if (!elem) throw new Error(`'${id}' cannot be found in the context of the DOM.`);

    return elem as HTMLElementTagNameMap[K];
}