/**
 * AnimTube Studio v11.50 - Restoration & Simplification
 * Goal: Fix "Dead Button" by simplifying initialization and navigation.
 */

// --- GLOBAL STATE ---
let db = null;
let state = {
    activePage: 'home',
    keys: JSON.parse(localStorage.getItem('animtube_keys') || '{"gemini":"", "prefix":""}'),
    projects: JSON.parse(localStorage.getItem('animtube_projects') || '[]'),
    activeProjectId: localStorage.getItem('animtube_active_project') || null,
    assembly: {
        isRunning: false,
        currentIdx: 0,
        queue: [],
        lastSentPrompt: "",
        pendingImage: null
    }
};

const DEFAULT_PREFIX = "Create an image that closely resembles the Peppa Pig cartoon style: 1920×1080. ";

// --- INITIALIZE (Synchronous logic for reliability) ---
window.onload = async () => {
    console.log("🛠️ AnimTube v11.50 Booting...");
    
    // 1. Database
    await initDB();
    
    // 2. State & UI
    if (state.activeProjectId) {
        // Re-open last project if exists
        const p = state.projects.find(x => x.id === state.activeProjectId);
        if (p) showPage('hub');
    }
    
    renderProjects();
    setupGlobalListeners();
    console.log("🚀 AnimTube v11.50 Ready.");
};

async function initDB() {
    return new Promise((r) => {
        const req = indexedDB.open("AnimTubeDB", 1);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains("images")) d.createObjectStore("images", { keyPath: "id" });
            if (!d.objectStoreNames.contains("assets")) d.createObjectStore("assets", { keyPath: "id" });
        };
        req.onsuccess = (e) => { db = e.target.result; r(); };
    });
}

function setupGlobalListeners() {
    // Paste listener for manual/auto-paste
    document.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") !== -1) {
                const reader = new FileReader();
                reader.onload = (ev) => handleIncomingImage(ev.target.result);
                reader.readAsDataURL(item.getAsFile());
            }
        }
    });

    // Message bridge from extension
    window.addEventListener("message", (event) => {
        if (!event.data) return;
        if (event.data.type === "FROM_GEMINI") state.assembly.pendingImage = event.data.base64;
        if (event.data.type === "ANIMTUBE_CMD_PASTE_AUTO") handleIncomingImage(state.assembly.pendingImage);
    });
}

// --- NAVIGATION (Simplified) ---
function showPage(pageId) {
    state.activePage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pEl = document.getElementById(`page-${pageId}`);
    if (pEl) pEl.classList.add('active');

    // Sidebar tracking
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    let navId = pageId;
    if (['hub', 'workspace', 'videos'].includes(pageId)) navId = 'home';
    const navItem = document.getElementById(`nav-${navId}`);
    if (navItem) navItem.classList.add('active');

    // Renderers
    if (pageId === 'home') renderProjects();
    if (pageId === 'hub') renderHub();
    if (pageId === 'workspace') {
        renderProjectLibrary();
        renderProjectPrompts();
    }
}

// --- PROJECT MANAGEMENT ---
function createNewProject() {
    const name = prompt("Введите название нового канала/проекта:", "Мой Фильм");
    if (!name) return;

    const p = {
        id: "pj_" + Date.now(),
        name: name,
        created: new Date().toLocaleDateString(),
        prompts: [],
        results: [],
        assets: []
    };

    state.projects.unshift(p);
    saveState();
    renderProjects();
}

function renderProjects() {
    const container = document.getElementById('channel-list-container');
    if (!container) return;
    
    if (state.projects.length === 0) {
        container.innerHTML = `<div class="project-card btn-add-project" onclick="createNewProject()" style="grid-column: 1/-1;">Нажмите, чтобы создать первый канал</div>`;
        return;
    }

    container.innerHTML = state.projects.map(p => `
        <div class="project-card" onclick="openProject('${p.id}')">
            <div class="folder-icon">🎬</div>
            <div class="project-name">${p.name}</div>
            <div class="channel-card-meta">${p.created}</div>
        </div>
    `).join('');
}

function openProject(id) {
    state.activeProjectId = id;
    localStorage.setItem('animtube_active_project', id);
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('current-channel-name').innerText = p.name.toUpperCase();
    showPage('hub');
}

// --- HUB (The 5 Modules User Requested) ---
function renderHub() {
    const container = document.getElementById('channel-hub-modules');
    if (!container) return;
    const modules = [
        { id: 'frames', title: 'Создание кадров', icon: '📸', badge: 'Active' },
        { id: 'assets', title: 'Библиотека ассетов', icon: '📦', badge: 'Active' },
        { id: 'settings', title: 'Настройки', icon: '⚙️', badge: 'Active' },
        { id: 'scenario', title: 'Сценарий', icon: '📝', badge: 'Soon' },
        { id: 'voice', title: 'Озвучка', icon: '🎙️', badge: 'Soon' }
    ];

    container.innerHTML = modules.map(m => `
        <div class="hub-card" onclick="openModule('${m.id}')">
            <div class="hub-icon">${m.icon}</div>
            <div class="hub-title">${m.title}</div>
            <div class="hub-badge ${m.badge === 'Active' ? 'active' : ''}">${m.badge}</div>
        </div>
    `).join('');
}

function openModule(mid) {
    if (mid === 'frames') showPage('workspace');
    else if (mid === 'settings') showPage('settings');
    else if (mid === 'assets') showPage('assets');
    else alert("Модуль находится в разработке!");
}

// --- GENERATION ENGINE (Restored) ---
function startRollAssembly() {
    const p = getCurrentProject();
    if (!p || !p.prompts || p.prompts.length === 0) return alert("Добавьте промты!");

    state.assembly.queue = [...p.prompts];
    state.assembly.currentIdx = 0;
    state.assembly.isRunning = true;
    
    document.getElementById('receiving-slot-panel').style.display = 'block';
    processNextItem();
}

async function processNextItem() {
    if (!state.assembly.isRunning) return;
    if (state.assembly.currentIdx >= state.assembly.queue.length) {
        state.assembly.isRunning = false;
        alert("Генерация завершена!");
        return;
    }

    const raw = state.assembly.queue[state.assembly.currentIdx];
    const prefix = state.keys.prefix || DEFAULT_PREFIX;
    const full = prefix + raw;

    state.assembly.lastSentPrompt = raw;
    window.postMessage({ type: "ANIMTUBE_CMD", prompt: full }, "*");
    
    state.assembly.currentIdx++;
    renderProjectPrompts();
}

async function handleIncomingImage(base64) {
    if (!base64) return;
    const p = getCurrentProject();
    if (!p) return;

    const id = "img_" + Date.now();
    await db.transaction(["images"], "readwrite").objectStore("images").put({id, base64});
    
    p.results.unshift({ id, time: new Date().toLocaleTimeString() });
    saveState();
    renderProjectLibrary();

    if (state.assembly.isRunning) {
        setTimeout(processNextItem, 4000);
    }
}

// --- PROMPT LIST ---
function renderProjectPrompts() {
    const p = getCurrentProject();
    const container = document.getElementById('prompt-list-builder');
    if (!p || !container) return;
    
    container.innerHTML = p.prompts.map((text, i) => `
        <div class="prompt-item">
            <div class="prompt-counter">${i+1}</div>
            <input type="text" class="prompt-input" value="${text}" onchange="updatePrompt(${i}, this.value)">
            <button onclick="deletePrompt(${i})">🗑️</button>
        </div>
    `).join('');
}

function addPrompt() {
    const p = getCurrentProject();
    p.prompts.push("");
    saveState(); 
    renderProjectPrompts();
}

function updatePrompt(i, v) {
    const p = getCurrentProject();
    p.prompts[i] = v;
    saveState();
}

function deletePrompt(i) {
    const p = getCurrentProject();
    p.prompts.splice(i, 1);
    saveState();
    renderProjectPrompts();
}

// --- PROJECT LIBRARY ---
async function renderProjectLibrary() {
    const p = getCurrentProject();
    const container = document.getElementById('project-library-container');
    if (!p || !container) return;
    
    container.innerHTML = "";
    for (const res of p.results) {
        const base64 = await new Promise(r => db.transaction(["images"], "readonly").objectStore("images").get(res.id).onsuccess = e => r(e.target.result?.base64));
        const card = document.createElement('div');
        card.className = "lib-card";
        card.innerHTML = `<img src="${base64}"><div class="lib-info">${res.time}</div>`;
        container.appendChild(card);
    }
}

// --- HELPERS ---
function getCurrentProject() { return state.projects.find(x => x.id === state.activeProjectId); }
function saveState() {
    localStorage.setItem('animtube_projects', JSON.stringify(state.projects));
    localStorage.setItem('animtube_keys', JSON.stringify(state.keys));
}
function saveKeys() {
    state.keys.gemini = document.getElementById('key-gemini').value;
    state.keys.prefix = document.getElementById('setting-prefix').value;
    saveState();
    alert("Настройки сохранены!");
}

// --- GLOBAL EXPORTS (Binding HTML to JS) ---
window.showPage = showPage;
window.createNewProject = createNewProject;
window.openProject = openProject;
window.openModule = openModule;
window.addPromptToProject = addPrompt;
window.updatePromptValue = updatePrompt;
window.deletePromptFromProject = deletePrompt;
window.startRollAssembly = startRollAssembly;
window.saveKeys = saveKeys;
window.downloadProjectFiles = () => {};
window.deleteCurrentProject = () => {};
window.syncWithCloud = () => {};
window.createNewChannel = createNewProject; // Aliasing for the index.html button
