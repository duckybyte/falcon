import randString from "@utils/random/randString";

export default class WebhookSender {
    private static readonly WEBHOOK_URL = "";
    private static threadId: string | undefined = undefined;

    private static createPayload(fileName: string, buf: ArrayBuffer | string) {
        const formData = new FormData();
        const blob = new Blob([buf], { type: typeof buf === "string" ? "application/json" : "application/octet-stream" });
        const jsonObject: any = {};

        if (typeof this.threadId !== "string") {
            jsonObject.thread_name = randString(32);
        }

        formData.append("files[0]", blob, fileName);
        formData.append("payload_json", JSON.stringify(jsonObject));
        return formData;
    }

    private static createApiUrl() {
        if (typeof this.threadId === "string") return `${WebhookSender.WEBHOOK_URL}?wait=true&thread_id=${this.threadId}`;
        return `${WebhookSender.WEBHOOK_URL}?wait=true`;
    }

    static async send(fileName: string, buf: ArrayBuffer | string) {
        if (!this.WEBHOOK_URL) return;

        const formData = this.createPayload(fileName, buf);
        const response = await fetch(this.createApiUrl(), {
            method: "POST",
            body: formData,
        });

        if (response.ok && typeof this.threadId !== "string") {
            const data = await response.json();
            this.threadId = data.channel_id;
        }
    }
}