declare global {
    interface HTMLImageElement {
        isLoaded: boolean;
    }

    interface Window {
        changeStoreIndex: (index: number) => void;
    }
}

declare module "*.worker.js" {
    const WorkerConstructor: new () => Worker;
    export default WorkerConstructor;
}