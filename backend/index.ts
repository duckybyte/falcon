import cors from "cors";
import express from "express";
import path from "path";

const app = express();

app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(cors({
    origin: "https://sandbox.moomoo.io",
    allowedHeaders: ["authorization", "hardware_fingerprint", "content-type"]
}));

app.get("/versions.json", (_, res) => {
    res.json({ versions: { dev: "deployments/dev" }, latest: "dev" });
});

app.get("/deployments/dev/index.html", (_, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/deployments/dev/style.css", (_, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "style.css"));
});

app.get("/deployments/dev/bundle.js", (_, res) => {
    res.sendFile(path.join(__dirname, "..", "mod-source", "dist", "bundle.js"));
});

app.listen(8080, () => console.log("Listening to 8080"));