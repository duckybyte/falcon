import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function copyFrontendFiles() {
    const clientDir = path.join(__dirname, "..", "deployment");
    await fs.mkdir(clientDir, { recursive: true });

    await fs.copyFile(path.join(__dirname, "..", "public", "index.html"), path.join(clientDir, "index.html"));
    await fs.copyFile(path.join(__dirname, "..", "public", "style.css"), path.join(clientDir, "style.css"));
}

async function build() {
    const deploymentDir = path.join(__dirname, "..", "deployment");
    await fs.mkdir(deploymentDir, { recursive: true });

    await copyFrontendFiles();
    await fs.copyFile(path.join(__dirname, "..", "mod-source", "dist", "bundle.js"), path.join(deploymentDir, "bundle.js"));

    console.log("Build complete (bundles + assets copied)");
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});