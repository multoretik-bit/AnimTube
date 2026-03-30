// BACKGROUND BRIDGE v11.93 | Tab Master (Enhanced Switching)
// Orchestrates precise tab switching and system clipboard control.

let offscreenCreated = false;
let lastStudioTabId = null;

async function createOffscreen() {
    if (offscreenCreated) return;
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['CLIPBOARD'],
            justification: 'Robot needs to write images & text to System Clipboard for automation.'
        });
        offscreenCreated = true;
    } catch (e) {
        if (e.message.includes('Only one offscreen document')) {
            offscreenCreated = true;
        } else {
            console.error("❌ Offscreen creation failed:", e);
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender && sender.tab) {
        lastStudioTabId = sender.tab.id;
    }

    if (request.type === "TO_GEMINI") {
        handleBridgeAction(request);
    } else if (request.type === "FROM_GEMINI" || request.type === "ANIMTUBE_STATUS") {
        relayToStudio(request);
    }
    return true;
});

async function handleBridgeAction(cmd) {
    const tabs = await chrome.tabs.query({});
    const geminiTab = tabs.find(t => t.url && t.url.includes("gemini.google.com"));
    
    // Attempt to find Studio tab by ID memory or fallback by URL/Title
    let studioTab = null;
    if (lastStudioTabId) {
        studioTab = tabs.find(t => t.id === lastStudioTabId);
    }
    if (!studioTab) {
        studioTab = tabs.find(t => t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.title.includes("AnimTube")));
    }

    if (!geminiTab) return relayToStudio({ type: "ANIMTUBE_STATUS", text: "❌ Gemini Tab Not Found" });

    // Ensure we have the system clipboard access ready
    await createOffscreen();

    // 1. FOCUS
    if (cmd.action === "FOCUS_GEMINI") {
        await chrome.windows.update(geminiTab.windowId, { focused: true });
        await chrome.tabs.update(geminiTab.id, { active: true });
        await new Promise(r => setTimeout(r, 500));
    } else if (cmd.action === "FOCUS_STUDIO") {
        if (studioTab) {
            await chrome.windows.update(studioTab.windowId, { focused: true });
            await chrome.tabs.update(studioTab.id, { active: true });
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // 2. SYSTEM CLIPBOARD & INJECTION
    if (cmd.action === "PASTE_PROMPT") {
        chrome.runtime.sendMessage({
            type: 'write-text-to-clipboard',
            target: 'offscreen',
            data: cmd.prompt
        });

        await new Promise(r => setTimeout(r, 600));
        
        chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: (text) => {
                const ed = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
                if (ed) {
                    ed.focus(); ed.click();
                    document.execCommand('selectAll', false, null); document.execCommand('delete', false, null);
                    document.execCommand('insertHTML', false, text);
                    ['input', 'change', 'blur'].forEach(t => ed.dispatchEvent(new Event(t, { bubbles: true })));
                }
            },
            args: [cmd.prompt]
        });
    } else if (cmd.action === "PASTE_IMAGE") {
        chrome.runtime.sendMessage({ type: 'write-image-to-clipboard', target: 'offscreen', data: cmd.base64 });
        chrome.tabs.sendMessage(geminiTab.id, { type: "ANIMTUBE_CMD_PASTE", base64: cmd.base64 });
    } else if (cmd.action === "WRITE_CLIPBOARD") {
        chrome.runtime.sendMessage({ type: 'write-image-to-clipboard', target: 'offscreen', data: cmd.base64 });
    } else if (cmd.action === "SUBMIT") {
        chrome.scripting.executeScript({
            target: { tabId: geminiTab.id },
            func: () => {
                const btn = document.querySelector('button[aria-label*="Send"]') || 
                            document.querySelector('button[aria-label*="Отправить"]');
                if (btn) btn.click();
            }
        });
    }
}

function relayToStudio(msg) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            const isStudio = tab.url && (tab.url.includes("localhost") || tab.url.includes("127.0.0.1") || tab.title.includes("AnimTube"));
            if (isStudio) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
        });
    });
}
