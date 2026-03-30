/**
 * AnimTube Studio v1.2 - PREMIUM RESTORED (ПОЛНЫЙ ДИЗАЙН)
 * Feature: High-Fidelity v6.0 UI, Hub Modules, Robotic Bridge, Assets.
 */

// --- GLOBAL STATE ---
window.db = null;
let supabaseClient = null; 
let currentUser = null;

let state = {
    activePage: localStorage.getItem('animtube_active_page') || 'home',
    keys: { prefix: localStorage.getItem('animtube_prefix') || "", supabase_url: "https://qyumcgwotdzalbsfdumh.supabase.co", supabase_key: "sb_publishable_rMHUQggerdk7ixtXGSCvgA_0_SGQA8e" },
    projects: JSON.parse(localStorage.getItem('animtube_projects')) || [],
    activeProjectId: localStorage.getItem('animtube_active_project') || null,
    activeVideoId: localStorage.getItem('animtube_active_video') || null,
    assembly: { isRunning: false, currentIdx: 0, queue: [] }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- 1. INITIALIZATION ---
window.onload = async () => {
    console.log("🛠️ Starting AnimTube v1.2 PREMIUM Engine...");
    await initDB();
    if (window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(state.keys.supabase_url, state.keys.supabase_key);
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (session && session.user) { 
                    currentUser = session.user; 
                    handleAuthSuccess(); 
                } else { 
                    currentUser = null; 
                    showAuthModal(true); 
                }
            });
        } catch (e) { showAuthModal(true); }
    } else { showAuthModal(true); }
    
    // UI Init
    renderProjects();
    renderBrandConfig();
    showPage(state.activePage);
    setupGlobalListeners();
};

function handleAuthSuccess() {
    showAuthModal(false);
    syncWithCloud();
}

async function initDB() {
    return new Promise((r) => {
        const req = indexedDB.open("AnimTubeDB", 2);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
            if (!d.objectStoreNames.contains("assets")) d.createObjectStore("assets", { keyPath: "id" });
        };
        req.onsuccess = (e) => { window.db = e.target.result; r(); };
        req.onerror = () => r();
    });
}

// --- 2. CORE SYNC & SAVE ---
const saveState = () => {
    localStorage.setItem('animtube_projects', JSON.stringify(state.projects));
    const p = state.projects.find(x => x.id === state.activeProjectId);
    if (p && currentUser) pushToCloud('projects', p);
};

async function pushToCloud(table, data) { 
    if (!supabaseClient || !currentUser) return; 
    try { await supabaseClient.from(table).upsert({ ...data, user_id: currentUser.id }); } catch(e){} 
}

async function syncWithCloud() { 
    if (!supabaseClient || !currentUser) return; 
    try { 
        const { data } = await supabaseClient.from('projects').select('*').eq('user_id', currentUser.id); 
        if (data && data.length > 0) { 
            state.projects = data; 
            if (state.activePage === 'home') renderProjects();
            if (state.activePage === 'hub') renderHub();
            if (state.activePage === 'video-list') renderVideoList();
        } 
    } catch(e){} 
}

// --- 3. HUB MODULES ---
function renderHub() {
    const p = state.projects.find(x => x.id === state.activeProjectId);
    const container = document.getElementById('channel-hub-modules');
    if (!p || !container) return;
    
    document.getElementById('hub-project-name').innerText = p.name;
    const modules = [
        { id: 'scen', t: 'Scenario', i: '📝', d: 'Project Plotting Module', active: false },
        { id: 'prom', t: 'Prompt splitting', i: '✂️', d: 'Text to Prompts Module', active: false },
        { id: 'frames', t: 'Frames Generator', i: '📸', d: 'Gemini Bridge v1.2', active: true },
        { id: 'voice', t: 'Voice Over', i: '🎙️', d: 'AI Dubbing Module', active: false },
        { id: 'anim', t: 'Animation', i: '🎞️', d: 'Final Render Module', active: false }
    ];

    container.innerHTML = modules.map(m => `
        <div class="hub-card ${m.active ? '' : 'disabled'}" style="${m.active ? '' : 'opacity:0.4; cursor:not-allowed;'}" onclick="window.openModule('${m.id}', ${m.active})">
            <div class="hub-icon">${m.i}</div>
            <div class="hub-title">${m.t}</div>
            <div class="hub-desc">${m.d}</div>
            <div class="hub-badge ${m.active ? 'active' : ''}">${m.active ? 'READY' : 'SOON'}</div>
        </div>
    `).join('');
}

window.openModule = (mid, isActive) => {
    if (!isActive) return;
    if (mid === 'frames') {
        showPage('video-list');
        renderVideoList();
    }
};

// --- 4. PROJECT & VIDEO MGMT ---
window.createNewProject = () => {
    const name = prompt("Channel Name:");
    if (!name) return;
    const p = {
        id: "pj_" + Date.now(),
        name,
        user_id: currentUser ? currentUser.id : null,
        created: new Date().toLocaleDateString(),
        videos: []
    };
    state.projects.unshift(p);
    saveState();
    renderProjects();
};

window.openProject = (id) => {
    state.activeProjectId = id;
    localStorage.setItem('animtube_active_project', id);
    showPage('hub');
};

window.renderProjects = () => {
    const container = document.getElementById('channel-list-container');
    if (!container) return;
    
    const projectHtml = state.projects.map(p => `
        <div class="hub-card" onclick="window.openProject('${p.id}')">
            <div class="hub-icon">📺</div>
            <div class="hub-title">${p.name}</div>
            <div class="hub-desc">Last active: ${p.created}</div>
            <div class="hub-badge active">PROJECT</div>
        </div>
    `).join('');

    container.innerHTML = projectHtml + `
        <div class="hub-card" onclick="window.createNewProject()" id="btn-new-project" style="border: 2px dashed var(--border-glass); background: transparent;">
            <div class="hub-icon">➕</div>
            <div class="hub-title">New Channel</div>
            <div class="hub-desc">Create a new production environment</div>
        </div>
    `;
};

window.renderVideoList = () => {
    const p = state.projects.find(x => x.id === state.activeProjectId);
    const container = document.getElementById('video-list-container');
    if (!p || !container) return;
    
    container.innerHTML = p.videos.map(v => `
        <div class="lib-card" onclick="window.openVideo('${v.id}')">
            <div class="lib-img" style="display:flex; align-items:center; justify-content:center; font-size:48px; background:var(--bg-glass);">🎞️</div>
            <div class="lib-info">
                <div style="font-weight:700; margin-bottom:4px;">${v.name}</div>
                <div class="lib-prompt">${v.prompts.length} Frames inside</div>
                <button class="lib-del-btn" onclick="event.stopPropagation(); window.deleteVideo('${v.id}')">🗑️</button>
            </div>
        </div>
    `).join('') + `
        <div class="lib-card" onclick="window.createNewVideo()" style="border:2px dashed var(--border-glass); opacity:0.6; align-items:center; justify-content:center; display:flex; flex-direction:column; gap:10px; height:220px;">
            <div style="font-size:32px;">➕</div>
            <div style="font-weight:700; font-size:14px;">New Series</div>
        </div>
    `;
};

window.createNewVideo = () => {
    const p = state.projects.find(x => x.id === state.activeProjectId);
    if (!p) return;
    const name = prompt("Series Name:");
    if (!name) return;
    p.videos.push({ id: "vid_" + Date.now(), name, prompts: [], results: [], assets: [] });
    saveState();
    renderVideoList();
};

window.openVideo = (id) => {
    state.activeVideoId = id;
    localStorage.setItem('animtube_active_video', id);
    showPage('workspace');
};

// --- 5. ROBOTIC BRIDGE v1.2 ---
const getActiveVideo = () => {
    const p = state.projects.find(x => x.id === state.activeProjectId);
    return p ? p.videos.find(v => v.id === state.activeVideoId) : null;
};

window.startRollAssembly = async () => {
    const v = getActiveVideo();
    if (!v || !v.prompts || v.prompts.length === 0) return alert("❌ No Prompts!");
    state.assembly.queue = [...v.prompts];
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    document.getElementById('receiving-slot-panel').style.display = 'block';
    
    const btn = document.getElementById('btn-start-assembly');
    btn.innerText = "🛑 STOP ASSEMBLY";
    btn.classList.add('btn-danger');
    btn.onclick = () => location.reload();
    
    processNextItem();
};

async function processNextItem() {
    if (!state.assembly.isRunning) return;
    const v = getActiveVideo();
    if (state.assembly.currentIdx >= state.assembly.queue.length) {
        state.assembly.isRunning = false; updateDebug("🎉 Finished! All frames processed."); return;
    }

    const rawPrompt = state.assembly.queue[state.assembly.currentIdx];
    const fullPrompt = (state.keys.prefix || "") + " " + rawPrompt;

    updateDebug(`🛠️ [${state.assembly.currentIdx + 1}] Handshake started...`);
    window.postMessage({ type: "ANIMTUBE_CMD", action: "FOCUS_GEMINI" }, "*");
    await sleep(2000); 
    window.postMessage({ type: "ANIMTUBE_CMD", action: "PASTE_PROMPT", prompt: fullPrompt }, "*");
    await sleep(2000); 

    updateDebug("🔄 Returning for Assets...");
    window.postMessage({ type: "ANIMTUBE_CMD", action: "FOCUS_STUDIO" }, "*");
    await sleep(2000); 

    const allAssets = await new Promise(r => window.db.transaction(["assets"],"readonly").objectStore("assets").getAll().onsuccess = e => r(e.target.result));
    const matched = allAssets.filter(a => isAssetMatch(fullPrompt, a.name));
    
    if (matched.length > 0) {
        for (const asset of matched) {
            updateDebug(`✅ Matched: ${asset.name}`);
            const libCard = document.querySelector(`.lib-card[data-asset-id="${asset.id}"]`);
            if (libCard) {
                libCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                libCard.classList.add('asset-matched');
                await sleep(2000);
                const b64 = await getAssetBase64(asset.id);
                window.postMessage({ type: "ANIMTUBE_CMD", action: "PASTE_IMAGE", base64: b64 }, "*");
                libCard.classList.remove('asset-matched');
            }
            await sleep(2000);
            window.postMessage({ type: "ANIMTUBE_CMD", action: "FOCUS_GEMINI" }, "*");
            await sleep(2000);
            const b64 = await getAssetBase64(asset.id);
            window.postMessage({ type: "ANIMTUBE_CMD", action: "PASTE_IMAGE", base64: b64 }, "*");
            await sleep(2000); 
        }
    }

    updateDebug("🚀 Submitting to Gemini...");
    window.postMessage({ type: "ANIMTUBE_CMD", action: "SUBMIT" }, "*");
    await sleep(2000); 
    state.assembly.currentIdx++;
    renderProjectPrompts();
    processNextItem();
}

// --- 6. RENDERERS & HELPERS (v6.0 Compatible) ---
function showPage(pid) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(`page-${pid}`);
    if (target) target.classList.add('active');
    const nav = document.getElementById(`nav-${pid === 'hub' ? 'home' : (pid === 'settings' ? 'settings' : (pid === 'video-list' ? 'hub' : (pid === 'workspace' ? 'hub' : pid)) )}`);
    if (nav) nav.classList.add('active');
    
    state.activePage = pid;
    localStorage.setItem('animtube_active_page', pid);
    if (pid === 'hub') renderHub();
    if (pid === 'home') renderProjects();
    if (pid === 'video-list') renderVideoList();
    if (pid === 'workspace') { renderProjectPrompts(); renderProjectAssets(); }
}

function renderProjectPrompts() { 
    const v = getActiveVideo(); 
    const container = document.getElementById('prompt-list-builder'); 
    if (!v || !container) return; 
    
    container.innerHTML = (v.prompts || []).map((text, i) => `
        <div class="prompt-item ${state.assembly.isRunning && state.assembly.currentIdx === i ? 'active pulse-border' : ''}">
            <div class="prompt-counter">${i+1}</div>
            <input type="text" class="prompt-input" value="${text}" placeholder="Enter scene description..." onchange="window.updatePromptValue(${i}, this.value)">
            <div class="prompt-actions">
                <button class="prompt-btn-del" onclick="window.deletePromptFromVideo(${i})">🗑️</button>
            </div>
        </div>
    `).join('');
    
    if (v.prompts.length === 0) container.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.3; font-size:14px;">No frames added. Click "Add New Frame" to start.</div>';
}

function renderProjectAssets() { 
    const container = document.getElementById('project-assets-selection'); 
    if (!container || !window.db) return; 
    window.db.transaction(["assets"],"readonly").objectStore("assets").getAll().onsuccess = (e) => {
        const assets = e.target.result;
        container.innerHTML = assets.map(a => `<div class="lib-card" data-asset-id="${a.id}" style="height:auto;"><img src="${a.base64}" class="lib-img"><div style="font-size:9px; padding:5px; text-align:center; overflow:hidden;">${a.name}</div></div>`).join('');
    };
}

window.renderBrandConfig = () => {
    const pInput = document.getElementById('setting-prefix'); 
    if (pInput) pInput.value = state.keys.prefix || ""; 
};

window.saveKeys = () => {
    state.keys.prefix = document.getElementById('setting-prefix').value;
    localStorage.setItem('animtube_prefix', state.keys.prefix);
    alert("🚀 Settings saved! Prefix will be used in next generation.");
};

// Global Handlers
window.showPage = showPage;
window.handleLogout = async () => { await supabaseClient.auth.signOut(); localStorage.clear(); location.reload(); };
window.handleLogin = async () => { const e = document.getElementById('auth-email').value, p = document.getElementById('auth-password').value; const { error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p }); if (error) alert(error.message); };
window.addPromptToVideo = () => { const vObj = getActiveVideo(); if (vObj) { vObj.prompts.push(""); saveState(); renderProjectPrompts(); } };
window.updatePromptValue = (i, v) => { const vObj = getActiveVideo(); if (vObj) { vObj.prompts[i] = v; saveState(); } };
window.deletePromptFromVideo = (i) => { const vObj = getActiveVideo(); if (vObj) { vObj.prompts.splice(i,1); saveState(); renderProjectPrompts(); } };
window.deleteVideo = (id) => { const p = state.projects.find(x => x.id === state.activeProjectId); if (p) { p.videos = p.videos.filter(v => v.id !== id); saveState(); renderVideoList(); } };

// Asset Logic
window.triggerGlobalAssetUpload = () => document.getElementById('global-asset-file').click();
window.handlePreviewGlobalAsset = (input) => {
    if (input.files && input.files[0]) {
        const r = new FileReader(); r.onload = (e) => { 
            const img = document.getElementById('temp-asset-preview'); img.src = e.target.result;
            document.getElementById('asset-upload-preview').style.display = 'block';
            document.getElementById('btn-final-save-asset').style.display = 'block';
        }; r.readAsDataURL(input.files[0]);
    }
};
window.saveGlobalAsset = () => {
    const name = document.getElementById('global-asset-name').value;
    const b64 = document.getElementById('temp-asset-preview').src;
    if (!name || !b64) return alert("❌ Name/Image missing!");
    const asset = { id: "ast_" + Date.now(), name, base64: b64 };
    window.db.transaction(["assets"], "readwrite").objectStore("assets").add(asset).onsuccess = () => {
        renderBrandConfig(); renderProjectAssets();
        document.getElementById('asset-upload-preview').style.display = 'none';
        document.getElementById('btn-final-save-asset').style.display = 'none';
        if (currentUser) pushToCloud('assets', asset);
    };
};

// Helpers
function showAuthModal(show) { document.getElementById('auth-modal').style.display=show?'flex':'none'; document.getElementById('sidebar-nav').style.display=show?'none':'flex'; document.querySelectorAll('main').forEach(m => m.style.display=show?'none':'block'); }
function setupGlobalListeners() { window.addEventListener("message", (event) => { if (event.data && event.data.type === "FROM_GEMINI") console.log("Received data from extension."); }); }
function updateDebug(msg) { const el = document.getElementById('robodebug'); if (el) el.innerText = "> " + msg; }
function isAssetMatch(p, a) { return p.toLowerCase().includes(a.toLowerCase().substring(0, 4)); }
async function getAssetBase64(id) { const res = await new Promise(r => window.db.transaction(["assets"],"readonly").objectStore("assets").get(id).onsuccess = e => r(e.target.result)); return res ? res.base64 : null; }
