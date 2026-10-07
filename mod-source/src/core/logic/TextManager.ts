
export class Text {
    life: number = TextManager.LIFE;
    alpha: number = 1;

    private scale: number;
    private originalScale: number = TextManager.SIZE;
    maxScale: number;

    private color: string;

    constructor(
        public x: number,
        public y: number,
        public text: string | number,
        type: number,
        public id: number
    ) {
        if (typeof text === "string") {
            this.color = "#ffffff";
        } else {
            if (type === -1) {
                this.color = "#ee5551";
            } else {
                this.color = text >= 0 ? "#ffffff" : "#8ecc51";
            }
        }

        this.scale = this.originalScale;
        this.maxScale = this.originalScale * 1.25;
    }

    render(mainContext: CanvasRenderingContext2D) {
        mainContext.font = `${this.scale}px Hammersmith One`;
        mainContext.fillStyle = this.color;
        mainContext.lineJoin = "round";
        mainContext.textAlign = "center";

        mainContext.fillText(typeof this.text === "string" ? this.text : Math.abs(this.text) + "", 0, 0);
    }

    update(delta: number) {
        this.life -= delta;

        if (typeof this.text === "string") {
            this.scale = 30;
            return;
        }

        this.y -= delta * TextManager.TEXT_SPEED;

        if (this.scale < this.maxScale) {
            this.scale += delta * TextManager.UPSCALE_SPEED;

            if (this.scale >= this.maxScale) {
                this.maxScale = this.originalScale;
            }
        } else {
            this.scale -= delta * TextManager.UPSCALE_SPEED;

            if (this.scale <= this.maxScale) {
                this.scale = this.maxScale;
            }
        }

        if (this.life <= 375) {
            this.alpha -= delta / 375;
            this.alpha = Math.max(0, Math.min(1, this.alpha));
        }
    }
}

export default class TextManager {
    static UPSCALE_SPEED = .07;
    static TEXT_SPEED = .13;
    static LIFE = 1250;
    static SIZE = 50;

    static texts: Map<number, Text> = new Map();

    static add(x: number, y: number, text: number | string, type: number) {
        const id = Math.floor(Math.random() * 99999);
        this.texts.set(id, new Text(x, y, text, type, id));
    }
}