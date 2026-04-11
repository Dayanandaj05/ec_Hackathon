// ── CONFIG ──────────────────────────────────────────────────────────────────
const MOCK_MODE = false;
const BASE = (window.location && window.location.origin && window.location.origin.startsWith('http'))
  ? window.location.origin
  : 'http://localhost:3000';

// ── STATE ────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentFolderId = 'root';
let breadcrumbStack = [{ id: 'root', name: 'My Drive' }];
let allFolders = [];
let currentFiles = [];
let moveTargetFileId = null;
let searchDebounceTimer = null;
let isSearchMode = false;

// ── MOCK DATA ─────────────────────────────────────────────────────────────────
const MOCK_USER = { userId: 'user1', username: 'alice' };
const MOCK_QUOTA = { used: 20971520, limit: 52428800 };
const MOCK_FILES = [
  { id: 'f1', originalName: 'photo.jpg', mimeType: 'image/jpeg', size: 204800, folderId: null, shareToken: null, createdAt: '2025-01-01' },
  { id: 'f2', originalName: 'notes.txt', mimeType: 'text/plain', size: 1024, folderId: null, shareToken: null, createdAt: '2025-01-02' }
];
const MOCK_FOLDERS = [{ id: 'folder1', name: 'Documents', parentId: null }];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const bytesToMB = b => (b / 1048576).toFixed(1);

function apiFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: 'include' });
}

function fileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.startsWith('text/')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📄';
  return '📄';
}

function showToast(text, progress = 0) {
  $('upload-toast').classList.remove('hidden');
  $('upload-toast-text').textContent = text;
  $('toast-progress-bar').style.width = progress + '%';
}

function hideToast() {
  setTimeout(() => $('upload-toast').classList.add('hidden'), 800);
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  const errEl = $('login-error');
  errEl.classList.add('hidden');

  if (MOCK_MODE) {
    currentUser = MOCK_USER;
    onLoginSuccess();
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Login failed');
    currentUser = json.data;
    onLoginSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

function onLoginSuccess() {
  $('login-screen').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('user-display-name').textContent = currentUser.username;
  $('user-avatar').textContent = currentUser.username[0].toUpperCase();
  loadFolder('root');
  loadQuota();
  loadSidebarFolders();
}

async function logout() {
  if (!MOCK_MODE) {
    await apiFetch(`${BASE}/api/logout`, { method: 'POST' }).catch(() => {});
  }
  currentUser = null;
  currentFolderId = 'root';
  breadcrumbStack = [{ id: 'root', name: 'My Drive' }];
  $('app').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
  $('login-username').value = '';
  $('login-password').value = '';
}

// ── QUOTA ─────────────────────────────────────────────────────────────────────
async function loadQuota() {
  let quota;
  if (MOCK_MODE) {
    quota = MOCK_QUOTA;
  } else {
    try {
      const res = await apiFetch(`${BASE}/api/quota?userId=${currentUser.userId}`);
      const json = await res.json();
      if (!json.success) return;
      quota = json.data;
    } catch { return; }
  }
  const pct = Math.min((quota.used / quota.limit) * 100, 100);
  const fill = $('quota-bar-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('danger', pct > 80);
  $('quota-text').textContent = `${bytesToMB(quota.used)} MB of ${bytesToMB(quota.limit)} MB used`;
}

// ── FOLDER NAVIGATION ─────────────────────────────────────────────────────────
async function loadFolder(folderId) {
  isSearchMode = false;
  $('search-mode-badge').classList.add('hidden');
  currentFolderId = folderId;

  let folders, files;

  if (MOCK_MODE) {
    folders = MOCK_FOLDERS.filter(f => (folderId === 'root' ? f.parentId === null : f.parentId === folderId));
    files = MOCK_FILES.filter(f => (folderId === 'root' ? f.folderId === null : f.folderId === folderId));
  } else {
    try {
      const res = await apiFetch(`${BASE}/api/folders/${folderId}`);
      const json = await res.json();
      if (!json.success) return;
      folders = json.data.folders;
      files = json.data.files;
    } catch { return; }
  }

  allFolders = folders;
  currentFiles = files;
  renderGrid(folders, files);
  renderBreadcrumb();
}

function navigateToRoot() {
  breadcrumbStack = [{ id: 'root', name: 'My Drive' }];
  loadFolder('root');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  $('nav-my-drive').classList.add('active');
}

function navigateToFolder(folder) {
  if (!breadcrumbStack.find(b => b.id === folder.id)) {
    breadcrumbStack.push({ id: folder.id, name: folder.name });
  }
  loadFolder(folder.id);
}

function navigateToCrumb(index) {
  breadcrumbStack = breadcrumbStack.slice(0, index + 1);
  loadFolder(breadcrumbStack[index].id);
}

function renderBreadcrumb() {
  const bc = $('breadcrumb');
  bc.innerHTML = '';
  breadcrumbStack.forEach((crumb, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
      bc.appendChild(sep);
    }
    const el = document.createElement('span');
    el.className = 'crumb' + (i === breadcrumbStack.length - 1 ? ' active' : '');
    el.textContent = crumb.name;
    if (i < breadcrumbStack.length - 1) el.onclick = () => navigateToCrumb(i);
    bc.appendChild(el);
  });
}

async function loadSidebarFolders() {
  let folders;
  if (MOCK_MODE) {
    folders = MOCK_FOLDERS;
  } else {
    try {
      const res = await apiFetch(`${BASE}/api/folders/root`);
      const json = await res.json();
      if (!json.success) return;
      folders = json.data.folders;
    } catch { return; }
  }
  const ul = $('sidebar-folder-list');
  ul.innerHTML = folders.map(f => `
    <li onclick="navigateToFolder({id:'${f.id}',name:'${f.name}'})">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="currentColor"/></svg>
      ${f.name}
    </li>`).join('');
}

// ── RENDER GRID ───────────────────────────────────────────────────────────────
function renderGrid(folders, files) {
  const grid = $('file-grid');
  grid.innerHTML = '';

  if (!folders.length && !files.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" width="64" height="64"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      <p>This folder is empty</p>
    </div>`;
    return;
  }

  if (folders.length) {
    const label = document.createElement('div');
    label.className = 'grid-section-label';
    label.textContent = 'Folders';
    grid.appendChild(label);
    folders.forEach(f => grid.appendChild(makeFolderCard(f)));
  }

  if (files.length) {
    const label = document.createElement('div');
    label.className = 'grid-section-label';
    label.textContent = 'Files';
    grid.appendChild(label);
    files.forEach(f => grid.appendChild(makeFileCard(f)));
  }
}

function makeFolderCard(folder) {
  const card = document.createElement('div');
  card.className = 'card folder-card';
  card.innerHTML = `
    <div class="card-thumb">
      <span class="file-icon">📁</span>
    </div>
    <div class="card-info">
      <div class="card-name" title="${folder.name}">${folder.name}</div>
      <div class="card-meta">Folder</div>
    </div>
    <div class="card-actions">
      <button class="card-btn" title="Open" onclick="navigateToFolder({id:'${folder.id}',name:'${folder.name}'})">📂 Open</button>
      <button class="card-btn danger" title="Delete" onclick="deleteFolder('${folder.id}',event)">🗑 Delete</button>
    </div>`;
  card.addEventListener('click', () => navigateToFolder(folder));
  return card;
}

function makeFileCard(file) {
  const card = document.createElement('div');
  card.className = 'card';
  const isImage = file.mimeType && file.mimeType.startsWith('image/');
  const thumb = isImage
    ? `<img src="${BASE}/api/download/${file.id}" alt="${file.originalName}" loading="lazy" />`
    : `<span class="file-icon">${fileIcon(file.mimeType)}</span>`;

  card.innerHTML = `
    <div class="card-thumb">${thumb}</div>
    <div class="card-info">
      <div class="card-name" title="${file.originalName}">${file.originalName}</div>
      <div class="card-meta">${bytesToMB(file.size)} MB</div>
    </div>
    <div class="card-actions">
      <button class="card-btn" title="Download" onclick="downloadFile('${file.id}',event)">⬇ DL</button>
      <button class="card-btn" title="Preview" onclick="openPreviewAction('${file.id}',event)">👁 Preview</button>
      <button class="card-btn" title="Share" onclick="shareFile('${file.id}',event)">🔗</button>
      <button class="card-btn" title="Move" onclick="openMoveModal('${file.id}',event)">📂</button>
      <button class="card-btn danger" title="Delete" onclick="deleteFile('${file.id}',event)">🗑</button>
    </div>`;
  card.addEventListener('click', () => downloadFile(file.id));
  return card;
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────
async function handleUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  for (const file of files) await uploadFile(file);
  event.target.value = '';
}

async function uploadFile(file) {
  showToast(`Uploading ${file.name}…`, 30);

  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 600));
    MOCK_FILES.push({
      id: 'f' + Date.now(), originalName: file.name,
      mimeType: file.type, size: file.size,
      folderId: currentFolderId === 'root' ? null : currentFolderId,
      shareToken: null, createdAt: new Date().toISOString().split('T')[0]
    });
    showToast(`Uploaded ${file.name}`, 100);
    hideToast();
    loadFolder(currentFolderId);
    return;
  }

  const fd = new FormData();
  fd.append('file', file);
  fd.append('userId', currentUser.userId);
  if (currentFolderId !== 'root') fd.append('folderId', currentFolderId);

  try {
    showToast(`Uploading ${file.name}…`, 60);
    const res = await apiFetch(`${BASE}/api/upload`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Upload failed');
    showToast(`Uploaded ${file.name}`, 100);
    hideToast();
    loadFolder(currentFolderId);
    loadQuota();
  } catch (err) {
    showToast(`Error: ${err.message}`, 0);
    setTimeout(() => $('upload-toast').classList.add('hidden'), 3000);
  }
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────────
const mainEl = $('main');
mainEl.addEventListener('dragover', e => { e.preventDefault(); $('drop-overlay').classList.remove('hidden'); $('drop-overlay').classList.add('active'); });
mainEl.addEventListener('dragleave', e => { if (!mainEl.contains(e.relatedTarget)) { $('drop-overlay').classList.add('hidden'); $('drop-overlay').classList.remove('active'); } });
mainEl.addEventListener('drop', e => {
  e.preventDefault();
  $('drop-overlay').classList.add('hidden');
  $('drop-overlay').classList.remove('active');
  const files = Array.from(e.dataTransfer.files);
  files.forEach(uploadFile);
});

// ── CREATE FOLDER ─────────────────────────────────────────────────────────────
async function createFolder() {
  const name = prompt('Folder name:');
  if (!name || !name.trim()) return;

  if (MOCK_MODE) {
    MOCK_FOLDERS.push({ id: 'folder' + Date.now(), name: name.trim(), parentId: currentFolderId === 'root' ? null : currentFolderId });
    loadFolder(currentFolderId);
    loadSidebarFolders();
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parentId: currentFolderId === 'root' ? null : currentFolderId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    loadFolder(currentFolderId);
    loadSidebarFolders();
  } catch (err) { alert('Error: ' + err.message); }
}

// ── DOWNLOAD ──────────────────────────────────────────────────────────────────
function downloadFile(fileId, e) {
  if (e) e.stopPropagation();
  window.open(`${BASE}/api/download/${fileId}`, '_blank');
}

// ── DELETE ────────────────────────────────────────────────────────────────────
async function deleteFile(fileId, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this file?')) return;

  if (MOCK_MODE) {
    const idx = MOCK_FILES.findIndex(f => f.id === fileId);
    if (idx !== -1) MOCK_FILES.splice(idx, 1);
    loadFolder(currentFolderId);
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/files/${fileId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    closeModalDirect();
    loadFolder(currentFolderId);
    loadQuota();
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteFolder(folderId, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this folder and all nested files/folders?')) return;

  if (MOCK_MODE) {
    alert('Mock mode does not support folder deletion tree.');
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/folders/${folderId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Folder delete failed');
    await loadFolder(currentFolderId);
    await loadSidebarFolders();
    await loadQuota();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ── SHARE ─────────────────────────────────────────────────────────────────────
async function shareFile(fileId, e) {
  if (e) e.stopPropagation();

  if (MOCK_MODE) {
    $('share-url-input').value = `http://localhost:3000/share/mock-token-${fileId}`;
    $('copy-confirm').classList.add('hidden');
    $('share-modal').classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/files/${fileId}/share`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    $('share-url-input').value = BASE + json.data.shareUrl;
    $('copy-confirm').classList.add('hidden');
    $('share-modal').classList.remove('hidden');
  } catch (err) { alert('Error: ' + err.message); }
}

function copyShareUrl() {
  const input = $('share-url-input');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    $('copy-confirm').classList.remove('hidden');
    setTimeout(() => $('copy-confirm').classList.add('hidden'), 2000);
  });
}

function closeShareModal(e) { if (e.target === $('share-modal')) closeShareModalDirect(); }
function closeShareModalDirect() { $('share-modal').classList.add('hidden'); }

// ── MOVE ──────────────────────────────────────────────────────────────────────
async function openMoveModal(fileId, e) {
  if (e) e.stopPropagation();
  moveTargetFileId = fileId;

  let folders;
  if (MOCK_MODE) {
    folders = MOCK_FOLDERS;
  } else {
    try {
      const res = await apiFetch(`${BASE}/api/folders/root`);
      const json = await res.json();
      if (!json.success) return;
      folders = json.data.folders;
    } catch { return; }
  }

  const sel = $('move-folder-select');
  sel.innerHTML = `<option value="root">My Drive (root)</option>` +
    folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  $('move-modal').classList.remove('hidden');
}

async function confirmMove() {
  const targetFolderId = $('move-folder-select').value;

  if (MOCK_MODE) {
    const file = MOCK_FILES.find(f => f.id === moveTargetFileId);
    if (file) file.folderId = targetFolderId === 'root' ? null : targetFolderId;
    closeMoveModalDirect();
    loadFolder(currentFolderId);
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/files/${moveTargetFileId}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolderId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    closeMoveModalDirect();
    loadFolder(currentFolderId);
  } catch (err) { alert('Error: ' + err.message); }
}

function closeMoveModal(e) { if (e.target === $('move-modal')) closeMoveModalDirect(); }
function closeMoveModalDirect() { $('move-modal').classList.add('hidden'); moveTargetFileId = null; }

// ── SEARCH ────────────────────────────────────────────────────────────────────
$('search-input').addEventListener('input', e => {
  clearTimeout(searchDebounceTimer);
  const q = e.target.value.trim();
  $('search-clear').classList.toggle('hidden', !q);
  if (!q) { clearSearch(); return; }
  searchDebounceTimer = setTimeout(() => runSearch(q), 300);
});

async function runSearch(q) {
  isSearchMode = true;
  $('search-mode-badge').classList.remove('hidden');

  if (MOCK_MODE) {
    const results = MOCK_FILES.filter(f => f.originalName.toLowerCase().includes(q.toLowerCase()));
    currentFiles = results;
    renderGrid([], results);
    return;
  }

  try {
    const res = await apiFetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&userId=${currentUser.userId}`);
    const json = await res.json();
    if (!json.success) return;
    currentFiles = json.data.files;
    renderGrid([], json.data.files);
  } catch { }
}

function clearSearch() {
  $('search-input').value = '';
  $('search-clear').classList.add('hidden');
  isSearchMode = false;
  $('search-mode-badge').classList.add('hidden');
  loadFolder(currentFolderId);
}

// ── PREVIEW MODAL ─────────────────────────────────────────────────────────────
function openPreview(file) {
  $('modal-title').textContent = file.originalName;
  const body = $('modal-body');
  body.innerHTML = '';

  if (file.mimeType && file.mimeType.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = `${BASE}/api/download/${file.id}`;
    img.alt = file.originalName;
    body.appendChild(img);
  } else if (file.mimeType && file.mimeType.startsWith('text/')) {
    const pre = document.createElement('pre');
    pre.textContent = 'Loading…';
    body.appendChild(pre);
    if (!MOCK_MODE) {
      apiFetch(`${BASE}/api/download/${file.id}`)
        .then(r => r.text())
        .then(t => { pre.textContent = t; })
        .catch(() => { pre.textContent = 'Could not load preview.'; });
    } else {
      pre.textContent = '(Mock) Text file content preview.';
    }
  } else {
    body.innerHTML = `<div class="preview-icon"><span>${fileIcon(file.mimeType)}</span><p>No preview available</p></div>`;
  }

  $('modal-download-btn').onclick = () => downloadFile(file.id);
  $('modal-share-btn').onclick = () => shareFile(file.id);
  $('modal-delete-btn').onclick = () => deleteFile(file.id);
  $('modal-overlay').classList.remove('hidden');
}

function closeModal(e) { if (e.target === $('modal-overlay')) closeModalDirect(); }
function closeModalDirect() { $('modal-overlay').classList.add('hidden'); }

function openPreviewAction(fileId, e) {
  if (e) e.stopPropagation();

  const file = currentFiles.find((f) => String(f.id) === String(fileId));
  if (!file) return;
  openPreview(file);
}