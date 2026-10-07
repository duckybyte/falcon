(function () {
    const baseURL = "http://localhost:8080";

    async function registerCspBypassRule() {
        const RULE_ID = 9999;

        const rule: chrome.declarativeNetRequest.Rule = {
            id: RULE_ID,
            priority: 1,
            action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                responseHeaders: [
                    {
                        header: "content-security-policy",
                        operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
                    }
                ]
            },
            condition: {
                urlFilter: "sandbox.moomoo.io",
                resourceTypes: [
                    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                    chrome.declarativeNetRequest.ResourceType.SUB_FRAME
                ]
            }
        };

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RULE_ID],
            addRules: [rule]
        });
    }

    chrome.runtime.onStartup.addListener(() => {
        registerCspBypassRule().catch(console.error);
    });

    interface SettingsSchema {
        accessToken?: string;
        versionSelection?: string;
    }

    async function getLatestVersion() {
        const response = await fetch(`${baseURL}/versions.json`);
        const data = await response.json();
        return data.versions[data.latest];
    }

    async function fetchAsset(path: string, key: string) {
        const response = await fetch(`${baseURL}/${path}`, {
            headers: {
                authorization: `Bearer ${key}`
            }
        });

        if (!response.ok)
            throw new Error(`server fetch failed`);

        const isTextAsset = path.endsWith(".html") || path.endsWith(".css") || path.endsWith(".js");
        return isTextAsset ? response.text() : await response.json();
    }

    chrome.runtime.onInstalled.addListener((details) => {
        registerCspBypassRule().catch(console.error);

        if (details.reason === "install") {
            chrome.tabs.create({
                url: chrome.runtime.getURL("index.html")
            });
        }
    });

    chrome.action.onClicked.addListener(() => {
        chrome.tabs.create({
            url: chrome.runtime.getURL("index.html")
        });
    });

    chrome.webNavigation.onCommitted.addListener((details) => {
        if (!details.url.includes("sandbox.moomoo.io")) return;
        if (details.frameId !== 0) return;

        chrome.storage.local.get(["accessToken", "versionSelection"], async (items: SettingsSchema) => {
            if (!items.accessToken) {
                chrome.tabs.remove(details.tabId);
                return chrome.tabs.create({
                    url: chrome.runtime.getURL(`index.html`)
                });
            }

            const token = items.accessToken;
            let version = "latest";

            if (items.versionSelection) {
                version = items.versionSelection;
            }

            if (version === "latest") {
                try {
                    version = await getLatestVersion();
                } catch (e) { }
            }

            try {
                const htmlContent = await fetchAsset(`${version}/index.html`, token);
                const cssContent = await fetchAsset(`${version}/style.css`, token);
                const jsContent = await fetchAsset(`${version}/bundle.js`, token);

                chrome.scripting.executeScript({
                    target: { tabId: details.tabId, frameIds: [details.frameId] },
                    injectImmediately: true,
                    world: "MAIN",
                    func: injectDynamicLoader,
                    args: [htmlContent, cssContent, jsContent]
                });
            } catch (e) {
                chrome.tabs.remove(details.tabId);
                chrome.tabs.create({
                    url: chrome.runtime.getURL(`index.html?error=${encodeURIComponent("invalid_access_token")}`)
                });
            }
        });
    });

    function injectDynamicLoader(htmlContent: string, cssContent: string, jsContent: string) {
        (window as any).oldHTML = document.documentElement.innerHTML;
        document.documentElement.innerHTML = htmlContent;

        const styleElement = document.createElement("style");
        styleElement.innerHTML = cssContent;
        document.head.appendChild(styleElement);

        const turnstile = document.createElement("script");
        turnstile.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        document.head.appendChild(turnstile);

        turnstile.onload = async () => {
            const runtimeScript = document.createElement("script");
            runtimeScript.innerText = jsContent;
            document.head.appendChild(runtimeScript);

            if (typeof (window as any).initFalconClient === "function") {
                (window as any).initFalconClient();
                delete (window as any).initFalconClient;
                runtimeScript.remove();
                return;
            }

            let interval = setInterval(() => {
                if (typeof (window as any).initFalconClient === "function") {
                    clearInterval(interval);
                    (window as any).initFalconClient();
                    delete (window as any).initFalconClient;
                    runtimeScript.remove();
                }
            }, 500);
        };
    }
})();