// OFFSCREEN CLIPBOARD v11.86 | Tank-Proof Mode (Hybrid)
// Combines modern Clipboard API with robust execCommand fallbacks for maximum MV3 compatibility.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;

    // Process asynchronously but without blocking the main event loop
    handleMessage(message).then(res => {
        if (res) console.log(`🤖 Offscreen: Task '${message.type}' finished with status: ${res.success}`);
    }).catch(err => {
        console.error(`❌ Offscreen: Fatal error in '${message.type}':`, err);
    });

    return true; // Keep port open
});

async function handleMessage(message) {
    // 0. Focus offscreen "window" (hidden but satisfying security checks)
    window.focus();

    if (message.type === 'write-text-to-clipboard') {
        return await writeTextTankProof(message.data);
    } else if (message.type === 'write-image-to-clipboard') {
        return await writeImageTankProof(message.data);
    }
}

/**
 * Text Strategy: Hybrid execCommand + Clipboard API
 */
async function writeTextTankProof(text) {
    try {
        if (!text) throw new Error("Empty text");

        // 1. Try modern API first
        try {
            await navigator.clipboard.writeText(text);
            console.log("✅ Text written via Modern API");
            return { success: true };
        } catch (e) {
            console.warn("⚠️ Modern API failed for text, falling back to execCommand...");
        }

        // 2. Fallback: execCommand (Works even when document is not "focused")
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (ok) {
            console.log("✅ Text written via Fallback Method (execCommand)");
            return { success: true };
        } else {
            throw new Error("execCommand failed");
        }

    } catch (err) {
        console.error("❌ All Text Clipboard methods failed:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Image Strategy: Multi-Try PNG Injection
 */
async function writeImageTankProof(base64, retries = 3) {
    try {
        if (!base64) throw new Error("No base64 provided");

        console.log("📝 Preparing multimodal asset (Base64 -> PNG)...");
        const response = await fetch(base64);
        const rawBlob = await response.blob();
        
        // Ensure we have a valid image blob
        if (!rawBlob.type.startsWith('image/')) throw new Error(`Invalid blob type: ${rawBlob.type}`);

        const img = await createImageBitmap(rawBlob);
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const pngBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject("Canvas toBlob null"), 'image/png');
        });

        // Loop for retries (sometimes system clipboard is locked)
        for (let i = 0; i < retries; i++) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ [pngBlob.type]: pngBlob })
                ]);
                console.log(`✅ Image written to System Clipboard (Try #${i+1})`);
                return { success: true };
            } catch (e) {
                console.warn(`⚠️ Image Write Try #${i+1} failed:`, e.name, e.message);
                if (i < retries - 1) await new Promise(r => setTimeout(r, 400)); // Wait before retry
                else throw e;
            }
        }

    } catch (err) {
        console.error("❌ Image Processing/Write failed:", err);
        return { success: false, error: err.message };
    }
}
