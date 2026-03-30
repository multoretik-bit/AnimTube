// ROBOTIC GEMINI BRIDGE v11.88 | Fast Mode
// Simulates human-like paste and submission but at high speed.

const cursor = document.createElement('div');
cursor.id = 'gemini-robot-cursor';
cursor.style.cssText = `
    position: fixed; pointer-events: none; z-index: 999999;
    width: 24px; height: 24px; border-radius: 50%;
    background: radial-gradient(circle, rgba(230, 0, 255, 0.8) 0%, rgba(230, 0, 255, 0) 70%);
    border: 2px solid rgba(255,255,255,0.5);
    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
    display: none;
`;
document.body.appendChild(cursor);

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "ANIMTUBE_CMD_PASTE") {
        simulateRoboticPaste(msg.base64);
    }
});

async function simulateRoboticPaste(base64) {
    const editor = document.querySelector('div[contenteditable="true"]') || document.querySelector('.ql-editor');
    if (!editor) return;

    // 1. Move Cursor to Editor (Fast)
    const rect = editor.getBoundingClientRect();
    cursor.style.display = 'block';
    cursor.style.left = `${rect.left + 20}px`;
    cursor.style.top = `${rect.top + 20}px`;

    // 2. FOCUS & CLICK
    editor.focus();
    editor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    editor.click();

    // 3. INSTANT PASTE (No waiting)
    try {
        const response = await fetch(base64);
        const blob = await response.blob();
        const file = new File([blob], "asset.png", { type: "image/png" });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dataTransfer
        });
        
        editor.dispatchEvent(pasteEvent);
        console.log("✅ Silent Multimodal Injection Successful");
        
        // Visual indicator
        cursor.style.transform = 'scale(1.5)';
        setTimeout(() => {
            cursor.style.transform = 'scale(1)';
            cursor.style.display = 'none';
        }, 500);

    } catch (e) {
        console.error("❌ Silent Paste Failed:", e);
    }
}
