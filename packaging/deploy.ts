import axios from "axios";
import { config } from "dotenv";
import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import versionsJSON from "../versions.json";

config({ quiet: true });

const github_url = process.env.github_repo_url;

async function getFileSha(token: string, url: string) {
    let sha = undefined;

    try {
        const existing = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        sha = existing.data.sha;
    } catch { }

    return sha;
}

async function deleteOnGithub(updateMessage: string, releaseName: string, fileName: string) {
    const url = `${github_url}/contents/src/versions/falcon/deployments/${releaseName}/${fileName}`;
    const token = process.env.github_token!;
    const sha = await getFileSha(token, url);

    if (typeof sha === "undefined")
        return false;

    await axios.delete(
        url,
        {
            headers: {
                Authorization: `Bearer ${token}`
            },
            data: {
                message: updateMessage,
                sha,
                branch: "main"
            }
        }
    );

    return true;
}

async function uploadToGithub(updateMessage: string, releaseName: string, path: string) {
    const url = `${github_url}/contents/src/versions/falcon/deployments/${releaseName}`;

    const token = process.env.github_token!;
    const sha = await getFileSha(token, url);

    const buffer = fs.readFileSync(path);
    const encoded = buffer.toString("base64");

    await axios.put(
        url,
        {
            message: updateMessage,
            content: encoded,
            sha,
            branch: "main"
        },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return true;
}

type DeploymentArgumentsType = "patch" | "minor" | "major" | "current";

async function main() {
    const args = process.argv;
    if (args.length !== 3) {
        throw new Error("Deployment build requires only 3 arguments.");
    }

    const type = args[2] as DeploymentArgumentsType;
    const currentVersionFull = versionsJSON.latest;

    const currentVersion = currentVersionFull.slice(1);
    let [major, minor, patch] = currentVersion.split(".").map(e => parseInt(e));

    if (type === "major") {
        major++;
        minor = 0;
        patch = 0;
    } else if (type === "minor") {
        minor++;
        patch = 0;
    } else if (type === "patch") {
        delete (versionsJSON.versions as Record<string, any>)[currentVersionFull];
        patch++;
    } else if (type !== "current") {
        throw new Error("Deployment build command only valid inputs are 'minor', 'major', 'patch', and 'current'.");
    }

    const newVersionFull = `v${major}.${minor}.${patch}`;
    const newVersion = newVersionFull.slice(1);
    const versionsPath = path.join(__dirname, "..", "versions.json");
    const clientDir = path.join(__dirname, "..", "deployment");

    versionsJSON.latest = newVersionFull;
    (versionsJSON.versions as Record<string, any>)[newVersionFull] = `deployments/v${newVersion}`;

    let htmlContent = (await readFile(path.join(clientDir, "index.html"), { encoding: "utf-8" }));
    htmlContent = htmlContent.replace(/VDev/, `V${newVersion}`);
    await writeFile(path.join(clientDir, "index.html"), htmlContent);

    let scriptContent = (await readFile(path.join(clientDir, "bundle.js"), { encoding: "utf-8" }));
    scriptContent = scriptContent.replace(/vDev/g, newVersionFull);
    await writeFile(path.join(clientDir, "bundle.js"), scriptContent);

    const stringJSON = JSON.stringify(versionsJSON, null, 4);

    try {
        const commitMsg = `${type === "patch" ? "fix" : "feat"}: release ${newVersionFull}`;

        if (type === "patch") {
            await deleteOnGithub(`delete: release v${currentVersion}`, currentVersionFull, "index.html");
            await deleteOnGithub(`delete: release v${currentVersion}`, currentVersionFull, "style.css");
            await deleteOnGithub(`delete: release v${currentVersion}`, currentVersionFull, "bundle.js");
        }

        await uploadToGithub(commitMsg, `v${newVersion}/bundle.js`, path.join(__dirname, "..", "deployment", "bundle.js"));
        await uploadToGithub(commitMsg, `v${newVersion}/index.html`, path.join(__dirname, "..", "deployment", "index.html"));
        await uploadToGithub(commitMsg, `v${newVersion}/style.css`, path.join(__dirname, "..", "deployment", "style.css"));

        await fs.promises.writeFile(versionsPath, stringJSON);
        await uploadToGithub("chore: update versions.json", `versions.json`, path.join(__dirname, "..", "versions.json"));

        console.log("Uploaded files to GitHub");
    } catch (e) {
        console.log(e);
    }
}

main();