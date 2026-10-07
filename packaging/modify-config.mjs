import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dirPath = path.join(__dirname, "..", "mod-source", "src", "utils", "utils", "config", "scriptConfiguration.json");
const configurations = JSON.parse(fs.readFileSync(dirPath, "utf8"));
configurations.IS_DEVELOPMENT_MODE = false;

fs.writeFileSync(dirPath, JSON.stringify(configurations, null, 4));