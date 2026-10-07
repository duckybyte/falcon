import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

export default defineConfig({
    plugins: [
        crx({
            manifest
        }),
    ],
    server: {
        port: 5173,
        strictPort: true,
        cors: {
            origin: /chrome-extension:\/\//,
        },
        hmr: {
            port: 5173,
        },
    },
    build: {
        rollupOptions: {
            input: {
                dashboard: resolve(__dirname, "index.html")
            }
        }
    },
    legacy: {
        skipWebSocketTokenCheck: true,
    },
})