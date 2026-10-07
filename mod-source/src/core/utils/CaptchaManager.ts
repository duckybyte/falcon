import Client from "@core/Client";
import Socket, { MixKeyFunc } from "@core/socket/Socket";
import SocketListener from "@core/socket/SocketListener";
import getElem from "@utils/dom/getElem";

declare const turnstile: Turnstile.Turnstile;

interface ServerJoinRequest {
    ticket: string;
    did: string;
    name: string;
}

export interface MooMooProtocol {
    BUILD_ID: string;
    BUILD_SALT: number;
    mixKey: MixKeyFunc;
}

export default class CaptchaManager {
    private static widgetId: string | null | undefined = null;

    static async renderChallenge(wsAddress: string) {
        if (typeof turnstile === "undefined") return;

        const captchaToken = wsAddress.includes("localhost") ? "lol" : await (new Promise<string | undefined>((res) => {
            this.widgetId = turnstile.render(getElem("turnstile-holder"), {
                sitekey: "0x4AAAAAAAMYHI96GFiJzMmp",
                theme: "light",
                "error-callback": (err) => res(undefined),
                callback: (e) => res(e)
            });
        }));

        if (typeof captchaToken !== "string") {
            alert("Error occured with cloudflare turnstile. Please reload the page.");
            return;
        }

        if (typeof this.widgetId === "string") {
            turnstile.remove(this.widgetId);
            this.widgetId = null;
        }

        const res = await fetch("https://api-sandbox2.moomoo.io/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                captcha: captchaToken,
                did: localStorage.getItem("moo_did") ?? undefined,
                host: wsAddress
            }),
            signal: AbortSignal.timeout(8e3)
        });

        const data = (await res.json()) as ServerJoinRequest;
        const ticketToken = `tk:${data.ticket}`;
        localStorage.setItem("moo_did", data.did);

        let fullWsAddress = "";
        if (wsAddress.includes("localhost")) fullWsAddress += "ws://";
        else fullWsAddress += "wss://";

        // vvv very very OP coding:
        const buildFile = (window as any).oldHTML.match(/"imports"\s*:\s*\{\s*"moomoo-protocol"\s*:\s*"([^"]+)"/g)[0].split("\":\"")[1].slice(1, -1);
        const moduleUrl = `https://sandbox.moomoo.io/${buildFile}`;
        const moomooProtocol = (await import(moduleUrl)) as MooMooProtocol;

        fullWsAddress += `${wsAddress}/?token=${encodeURIComponent(ticketToken)}&b=${moomooProtocol.BUILD_ID}`;
        Client.socket = new Socket(fullWsAddress, moomooProtocol);
        SocketListener.hookEvents(Client.socket);
    }

    static reset() {
        if (!this.widgetId) return;

        turnstile.reset(this.widgetId);
        this.widgetId = null;
    }
}
