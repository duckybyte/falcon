const observer = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "SCRIPT" && (node.src || node.textContent.toLowerCase().includes("frvr"))) {
                window.loadedScript = true;
                node.parentNode.removeChild(node);
            }
        });
    }
});

observer.observe(document, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
});