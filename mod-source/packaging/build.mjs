import * as esbuild from "esbuild";
import cssModulesPlugin from "esbuild-plugin-inline-css";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";

async function run() {
    await esbuild.build({
        entryPoints: ["src/index.ts"],
        bundle: true,
        minify: true,
        minifySyntax: true,
        platform: "browser",
        plugins: [cssModulesPlugin(), inlineWorkerPlugin({
            format: "iife"
        })],
        outfile: "dist/bundle.js",
    });

    console.log("Built source files and bundled code.");
}

run();