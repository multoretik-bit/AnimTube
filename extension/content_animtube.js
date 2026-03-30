// AnimTube Studio Bridge v11.75 | Relays Studio Commands to Extension Background
console.log("🛰️ AnimTube Bridge v11.75 Ready");

// 1. Studio -> Background (Relay Commands)
window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "ANIMTUBE_CMD") {
        chrome.runtime.sendMessage({
            type: "TO_GEMINI",
            action: event.data.action,
            prompt: event.data.prompt || "",
            base64: event.data.base64 || ""
        });
    }
});

// 2. Background -> Studio (Image Arrival & Status)
chrome.runtime.onMessage.addListener((msg) => {
    window.postMessage(msg, "*");
});
