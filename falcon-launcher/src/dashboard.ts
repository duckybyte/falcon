(function () {
    const saveConfigBtn = document.getElementById("save-config-btn") as HTMLButtonElement;
    const versionSelector = document.getElementById("version-selector") as HTMLSelectElement;
    const accessTokenInput = document.getElementById("access-token-input") as HTMLInputElement;

    const hostURL = "http://localhost:8080";

    let cachedSettings = "";
    const settings: SettingsSchema = {
        accessToken: "",
        versionSelection: "latest"
    };

    interface SettingsSchema {
        accessToken?: string;
        versionSelection?: string;
    }

    saveConfigBtn.onclick = async (ev) => {
        if (!ev.isTrusted) return;

        const { versionSelection, accessToken } = settings;
        await chrome.storage.local.set({ versionSelection, accessToken });
        cachedSettings = JSON.stringify(settings);
        saveConfigBtn.blur();
    };

    accessTokenInput.oninput = (ev) => {
        if (!ev.isTrusted) return;
        settings.accessToken = accessTokenInput.value;
    };

    versionSelector.oninput = (ev) => {
        if (!ev.isTrusted) return;
        settings.versionSelection = versionSelector.value;
    };

    interface ScriptVersions {
        latest: string;
        versions: Record<string, string>;
    }

    async function updateVersions() {
        try {
            const res = await fetch(`${hostURL}/versions.json`);
            const data = (await res.json()) as ScriptVersions;

            versionSelector.innerHTML = "";

            for (const key in data.versions) {
                const val = data.versions[key];

                versionSelector.innerHTML = `
                <option value=${data.versions[key]} ${val === settings.versionSelection ? "selected" : ""}>
                    ${key}
                </option>
            `+ versionSelector.innerHTML;
            }

            versionSelector.innerHTML = `<option value="latest" ${settings.versionSelection === "latest" ? "selected" : ""}>Latest Version</option>` + versionSelector.innerHTML;
        } catch (e) { }
    }

    chrome.storage.local.get(["accessToken", "versionSelection"], (result: SettingsSchema) => {
        const accessToken = result.accessToken ?? "";
        const versionSelection = result.versionSelection ?? "latest";

        accessTokenInput.value = accessToken;

        settings.accessToken = accessToken;
        settings.versionSelection = versionSelection;

        if (versionSelection !== "latest") {
            versionSelector.innerHTML = `<option>Loading...</option>`;
        }

        cachedSettings = JSON.stringify(settings);
        chrome.storage.local.set({ accessToken, versionSelection });
        updateVersions();
    });

    function updateSaveBtn() {
        if (JSON.stringify(settings) === cachedSettings) {
            saveConfigBtn.classList.add("disabled");
        } else {
            saveConfigBtn.classList.remove("disabled");
        }

        window.requestAnimationFrame(updateSaveBtn);
    }

    document.addEventListener("DOMContentLoaded", () => {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get("error");

        if (error) {
            alert(error);
        }
    });

    window.requestAnimationFrame(updateSaveBtn);
})();