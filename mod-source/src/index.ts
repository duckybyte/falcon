import Loader from "./ui/Loader";

declare global {
    interface Window {
        initFalconClient: () => void;
    }
}

window.initFalconClient = () => Loader.main(); // Glorious index.ts file