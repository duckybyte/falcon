import * as esbuild from "esbuild";
import cssModulesPlugin from "esbuild-plugin-inline-css";
import inlineWorkerPlugin from "esbuild-plugin-inline-worker";

async function run() {
    const ctx = await esbuild.context({
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

    ctx.watch();
    console.log("Watching source files and bundling code...");
}

run();