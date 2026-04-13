const API = '';
let currentUser = null;
let currentFolderId = null;
let breadcrumbStack = [{ id: null, name: 'My Drive' }];
let searchTimeout = null;
let isAdminView = false;
let selectedSizeUnit = localStorage.getItem('sizeUnit') || 'auto';

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.success) { err.textContent = data.error; return; }
    currentUser = data.data;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    const roleLabel = currentUser.role ? ` (${currentUser.role})` : '';
    document.getElementById('user-info').textContent = `Signed in as ${currentUser.username}${roleLabel}`;
    document.getElementById('admin-nav').classList.toggle('hidden', currentUser.role !== 'admin');
    loadFolder(null);
    loadQuota();
    loadSidebarFolders();
  } catch (e) { err.textContent = 'Connection error'; }
}

async function logout() {
  await fetch(`${API}/api/logout`, { method: 'POST', credentials: 'include' });
  location.reload();
}

async function loadQuota() {
  try {
    const res = await fetch(`${API}/api/quota`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    const { used, limit } = data.data;
    const pct = Math.min((used / limit) * 100, 100).toFixed(1);
    document.getElementById('quota-label').textContent = `${formatSize(used)} used of ${formatSize(limit)}`;
    const fill = document.getElementById('quota-fill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('danger', pct > 80);
  } catch (e) {}
}

async function loadFolder(folderId) {
  currentFolderId = folderId;
  const param = folderId || 'root';
  try {
    const res = await fetch(`${API}/api/folders/${param}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    renderGrid(data.data.folders, data.data.files);
    updateBreadcrumb();
  } catch (e) {}
}

function navigateTo(folderId, name) {
  showDriveView();
  const existing = breadcrumbStack.findIndex(b => b.id === folderId);
  if (existing >= 0) breadcrumbStack = breadcrumbStack.slice(0, existing + 1);
  else breadcrumbStack.push({ id: folderId, name });
  loadFolder(folderId);
  loadSidebarFolders();
}

function updateBreadcrumb() {
  document.getElementById('breadcrumb').innerHTML = breadcrumbStack.map((b, i) => {
    if (i === breadcrumbStack.length - 1) return `<span>${b.name}</span>`;
    return `<span style="cursor:pointer;color:#1e3a5f;text-decoration:underline" onclick="navigateTo('${b.id}','${b.name}')">${b.name}</span> / `;
  }).join('');
}

async function loadSidebarFolders() {
  try {
    const res = await fetch(`${API}/api/folders/root`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    document.getElementById('sidebar-folders').innerHTML = data.data.folders.map(f =>
      `<div class="sidebar-folder" onclick="navigateTo('${f.id}','${f.name}')">📁 ${f.name}</div>`
    ).join('');
  } catch (e) {}
}

async function createFolder() {
  const name = prompt('Folder name:');
  if (!name) return;
  try {
    const res = await fetch(`${API}/api/folders`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: currentFolderId })
    });
    const data = await res.json();
    if (!data.success) { alert(data.error); return; }
    loadFolder(currentFolderId);
    loadSidebarFolders();
  } catch (e) {}
}

function triggerUpload() { document.getElementById('file-input').click(); }

async function uploadFile(file) {
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  if (currentFolderId) form.append('folderId', currentFolderId);
  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', credentials: 'include', body: form });
    const data = await res.json();
    if (!data.success) { alert('Upload failed: ' + data.error); return; }
    loadFolder(currentFolderId);
    loadQuota();
  } catch (e) { alert('Upload error'); }
  document.getElementById('file-input').value = '';
}

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📕';
  if (mime.startsWith('text/')) return '📝';
  return '📄';
}

function formatSize(bytes) {
  const safe = Number.isFinite(Number(bytes)) ? Number(bytes) : 0;
  const abs = Math.abs(safe);
  const unit = selectedSizeUnit;

  if (unit === 'bytes') return `${safe} B`;
  if (unit === 'kb') return `${(safe / 1024).toFixed(2)} KB`;
  if (unit === 'mb') return `${(safe / 1048576).toFixed(2)} MB`;
  if (unit === 'gb') return `${(safe / 1073741824).toFixed(2)} GB`;
  if (unit === 'tb') return `${(safe / 1099511627776).toFixed(2)} TB`;

  if (abs < 1024) return `${safe} B`;
  if (abs < 1048576) return `${(safe / 1024).toFixed(1)} KB`;
  if (abs < 1073741824) return `${(safe / 1048576).toFixed(2)} MB`;
  if (abs < 1099511627776) return `${(safe / 1073741824).toFixed(2)} GB`;
  return `${(safe / 1099511627776).toFixed(2)} TB`;
}

function formatSizeMB(bytes) {
  const safe = Number.isFinite(Number(bytes)) ? Number(bytes) : 0;
  return `${(safe / 1048576).toFixed(2)} MB`;
}

function refreshCurrentView() {
  if (!currentUser) return;
  if (isAdminView) {
    loadAdminDashboard();
  } else {
    loadFolder(currentFolderId);
    loadQuota();
  }
}

function setupSizeUnitSelector() {
  const select = document.getElementById('size-unit-select');
  if (!select) return;

  const allowed = ['auto', 'bytes', 'kb', 'mb', 'gb', 'tb'];
  if (!allowed.includes(selectedSizeUnit)) {
    selectedSizeUnit = 'auto';
  }

  select.value = selectedSizeUnit;
  select.addEventListener('change', () => {
    selectedSizeUnit = select.value;
    localStorage.setItem('sizeUnit', selectedSizeUnit);
    refreshCurrentView();
  });
}

function renderGrid(folders, files) {
  const grid = document.getElementById('file-grid');
  if (!folders.length && !files.length) {
    grid.innerHTML = '<div class="empty-state">📭 This folder is empty</div>'; return;
  }
  grid.innerHTML = [
    ...folders.map(f => `
      <div class="card" ondblclick="navigateTo('${f.id}','${f.name}')">
        <div class="card-icon">📁</div>
        <div class="card-name">${f.name}</div>
        <div class="card-actions">
          <button class="btn-delete" onclick="event.stopPropagation();alert('Delete files inside first')">🗑</button>
        </div>
      </div>`),
    ...files.map(f => `
      <div class="card" ondblclick="previewFile('${f.id}','${f.mimeType}','${f.originalName}')">
        <div class="card-icon">${fileIcon(f.mimeType)}</div>
        <div class="card-name">${f.originalName}</div>
        <div class="card-size">${formatSize(f.size)}</div>
        <div class="card-actions">
          <button class="btn-download" onclick="event.stopPropagation();downloadFile('${f.id}')">⬇</button>
          <button class="btn-share" onclick="event.stopPropagation();shareFile('${f.id}')">🔗</button>
          <button class="btn-move" onclick="event.stopPropagation();moveFile('${f.id}')">↪</button>
          <button class="btn-delete" onclick="event.stopPropagation();deleteFile('${f.id}')">🗑</button>
        </div>
        <div id="share-${f.id}" class="share-url hidden"></div>
      </div>`)
  ].join('');
}

function downloadFile(id) { window.open(`${API}/api/download/${id}`, '_blank'); }

async function deleteFile(id) {
  if (!confirm('Delete this file?')) return;
  const res = await fetch(`${API}/api/files/${id}`, { method: 'DELETE', credentials: 'include' });
  const data = await res.json();
  if (!data.success) { alert(data.error); return; }
  loadFolder(currentFolderId);
  loadQuota();
}

async function shareFile(id) {
  const res = await fetch(`${API}/api/files/${id}/share`, { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!data.success) { alert(data.error); return; }
  const fullUrl = `${window.location.origin}${data.data.shareUrl}`;
  const el = document.getElementById(`share-${id}`);
  el.textContent = `📋 ${fullUrl} — click to copy`;
  el.classList.remove('hidden');
  el.onclick = () => { navigator.clipboard.writeText(fullUrl); el.textContent = '✅ Copied!'; };
}

async function moveFile(id) {
  const targetId = prompt('Paste target folder ID (blank = move to root):');
  if (targetId === null) return;
  const res = await fetch(`${API}/api/files/${id}/move`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetFolderId: targetId || null })
  });
  const data = await res.json();
  if (!data.success) { alert(data.error); return; }
  loadFolder(currentFolderId);
}

async function previewFile(id, mime, name) {
  const modal = document.getElementById('preview-modal');
  const content = document.getElementById('preview-content');
  modal.classList.remove('hidden');
  if (mime && mime.startsWith('image/')) {
    content.innerHTML = `<h3 style="margin-bottom:12px">${name}</h3><img src="${API}/api/download/${id}" />`;
  } else if (mime && mime.startsWith('text/')) {
    const res = await fetch(`${API}/api/download/${id}`, { credentials: 'include' });
    const text = await res.text();
    content.innerHTML = `<h3 style="margin-bottom:12px">${name}</h3><pre>${text}</pre>`;
  } else {
    content.innerHTML = `<div style="text-align:center;padding:40px">
      <div style="font-size:64px">${fileIcon(mime)}</div>
      <h3 style="margin:16px 0 8px">${name}</h3>
      <button class="btn-primary" onclick="window.open('${API}/api/download/${id}','_blank')">⬇ Download</button>
    </div>`;
  }
}

function closePreview(e) {
  if (!e || e.target === document.getElementById('preview-modal') || !e.target) {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('preview-content').innerHTML = '';
  }
}

function handleSearch(q) {
  if (isAdminView) return;
  clearTimeout(searchTimeout);
  if (!q.trim()) { loadFolder(currentFolderId); return; }
  searchTimeout = setTimeout(async () => {
    const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) return;
    document.getElementById('breadcrumb').textContent = `Search: "${q}"`;
    renderGrid([], data.data.files);
  }, 300);
}

function showDriveView() {
  if (!isAdminView) return;
  isAdminView = false;
  document.getElementById('quota-section').classList.remove('hidden');
  document.getElementById('toolbar').classList.remove('hidden');
  document.getElementById('file-grid').classList.remove('hidden');
  document.getElementById('admin-panel').classList.add('hidden');
  const searchInput = document.getElementById('search-input');
  searchInput.disabled = false;
  searchInput.placeholder = '🔍 Search files...';
}

async function openAdminPanel() {
  if (!currentUser || currentUser.role !== 'admin') {
    alert('Admin access required');
    return;
  }

  isAdminView = true;
  document.getElementById('quota-section').classList.add('hidden');
  document.getElementById('toolbar').classList.add('hidden');
  document.getElementById('file-grid').classList.add('hidden');
  const panel = document.getElementById('admin-panel');
  panel.classList.remove('hidden');
  document.getElementById('breadcrumb').textContent = 'Admin Panel';
  const searchInput = document.getElementById('search-input');
  searchInput.value = '';
  searchInput.disabled = true;
  searchInput.placeholder = 'Admin view active';

  await loadAdminDashboard();
}

async function loadAdminDashboard() {
  const panel = document.getElementById('admin-panel');
  panel.innerHTML = '<div class="admin-loading">Loading admin data...</div>';

  try {
    const [statsRes, usersRes, filesRes, analyticsRes, settingsRes] = await Promise.all([
      fetch(`${API}/api/admin/stats`, { credentials: 'include' }),
      fetch(`${API}/api/admin/users`, { credentials: 'include' }),
      fetch(`${API}/api/admin/files`, { credentials: 'include' }),
      fetch(`${API}/api/admin/analytics`, { credentials: 'include' }),
      fetch(`${API}/api/admin/settings`, { credentials: 'include' }),
    ]);

    const stats = await statsRes.json();
    const users = await usersRes.json();
    const files = await filesRes.json();
    const analytics = await analyticsRes.json();
    const settings = await settingsRes.json();

    if (!stats.success || !users.success || !files.success || !analytics.success || !settings.success) {
      panel.innerHTML = `<div class="admin-error">${stats.error || users.error || files.error || analytics.error || settings.error || 'Failed to load admin data'}</div>`;
      return;
    }

    renderAdminPanel(stats.data, users.data.users, files.data.files, analytics.data, settings.data);
  } catch (e) {
    panel.innerHTML = '<div class="admin-error">Unable to load admin dashboard</div>';
  }
}

function renderAdminPanel(stats, users, files, analytics, settings) {
  const panel = document.getElementById('admin-panel');
  const systemUsed = analytics?.systemUsage?.used || 0;
  const systemLimit = analytics?.systemUsage?.limit || 1;
  const systemPct = Math.min(100, ((systemUsed / systemLimit) * 100) || 0).toFixed(1);

  const maxMimeBytes = Math.max(1, ...(analytics?.filesByMime || []).map((m) => m.bytes || 0));
  const maxUserBytes = Math.max(1, ...(analytics?.storageByUser || []).map((u) => u.used || 0));
  const maxDailyBytes = Math.max(1, ...(analytics?.uploadsByDay || []).map((d) => d.bytes || 0));

  panel.innerHTML = `
    <div class="admin-stats">
      <div class="admin-stat-card"><div class="admin-stat-label">Users</div><div class="admin-stat-value">${stats.users}</div></div>
      <div class="admin-stat-card"><div class="admin-stat-label">Files</div><div class="admin-stat-value">${stats.files}</div></div>
      <div class="admin-stat-card"><div class="admin-stat-label">Folders</div><div class="admin-stat-value">${stats.folders}</div></div>
      <div class="admin-stat-card"><div class="admin-stat-label">Storage</div><div class="admin-stat-value">${formatSizeMB(stats.totalStorageUsed || 0)}</div></div>
    </div>

    <div class="admin-section">
      <h3>System Quota Settings</h3>
      <div class="admin-form-row">
        <input id="system-total-limit" type="number" min="1" step="1" value="${(settings.totalStorageLimit || 0) / 1048576}" placeholder="Total system limit (MB)" />
        <input id="system-max-user-quota" type="number" min="1" step="1" value="${(settings.maxUserQuota || 0) / 1048576}" placeholder="Max per-user quota (MB)" />
        <button class="btn-primary" onclick="updateSystemSettings()">Save Settings</button>
      </div>
      <div class="admin-helper-text">Current usage: ${formatSizeMB(systemUsed)} / ${formatSizeMB(systemLimit)} (${systemPct}%)</div>
    </div>

    <div class="admin-charts-grid">
      <div class="admin-section">
        <h3>System Usage</h3>
        <div class="usage-ring" style="--usage:${systemPct}%">
          <div class="usage-ring-inner">${systemPct}%</div>
        </div>
      </div>

      <div class="admin-section">
        <h3>Storage by File Type</h3>
        <div class="bar-chart-list">
          ${(analytics?.filesByMime || []).slice(0, 8).map((item) => `
            <div class="bar-row">
              <span>${item.type}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${((item.bytes / maxMimeBytes) * 100).toFixed(1)}%"></div></div>
              <span>${formatSizeMB(item.bytes)}</span>
            </div>
          `).join('') || '<div class="admin-helper-text">No file type data available</div>'}
        </div>
      </div>

      <div class="admin-section">
        <h3>Top User Storage Usage</h3>
        <div class="bar-chart-list">
          ${(analytics?.storageByUser || []).slice(0, 8).map((user) => `
            <div class="bar-row">
              <span>${user.username}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${((user.used / maxUserBytes) * 100).toFixed(1)}%"></div></div>
              <span>${formatSizeMB(user.used)}</span>
            </div>
          `).join('') || '<div class="admin-helper-text">No user usage data available</div>'}
        </div>
      </div>

      <div class="admin-section">
        <h3>Uploads (Last 14 Days)</h3>
        <div class="bar-chart-list">
          ${(analytics?.uploadsByDay || []).map((day) => `
            <div class="bar-row">
              <span>${day._id}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${((day.bytes / maxDailyBytes) * 100).toFixed(1)}%"></div></div>
              <span>${formatSizeMB(day.bytes)}</span>
            </div>
          `).join('') || '<div class="admin-helper-text">No recent uploads</div>'}
        </div>
      </div>
    </div>

    <div class="admin-section">
      <h3>Create User</h3>
      <div class="admin-form-row">
        <input id="admin-new-username" type="text" placeholder="Username" />
        <input id="admin-new-password" type="password" placeholder="Password" />
        <select id="admin-new-role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <input id="admin-new-quota" type="number" min="1" step="1" placeholder="Quota MB (optional)" />
        <button class="btn-primary" onclick="createAdminUser()">Create</button>
      </div>
    </div>

    <div class="admin-section">
      <h3>Users</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Username</th><th>Role</th><th>Quota Used (MB)</th><th>Quota Limit (MB)</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>${u.username}</td>
                <td>${u.role || 'user'}</td>
                <td>${formatSizeMB(u.quotaUsed || 0)}</td>
                <td>
                  <div class="quota-editor">
                    <input id="quota-user-${u._id}" type="number" min="1" step="1" value="${((u.quotaLimit || 0) / 1048576).toFixed(2)}" />
                    <button class="btn-secondary admin-btn-small" onclick="updateUserQuota('${u._id}')">Save</button>
                  </div>
                </td>
                <td><button class="btn-danger admin-btn-small" onclick="deleteAdminUser('${u._id}', '${u.username}')">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="admin-section">
      <h3>All Files</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Owner</th><th>Type</th><th>Size (MB)</th><th>Actions</th></tr></thead>
          <tbody>
            ${files.map((f) => `
              <tr>
                <td>${f.originalName}</td>
                <td>${f.owner?.username || 'Unknown'}</td>
                <td>${f.mimeType || '-'}</td>
                <td>${formatSizeMB(f.size || 0)}</td>
                <td>
                  <button class="btn-secondary admin-btn-small" onclick="window.open('${API}/api/download/${f.id}', '_blank')">Download</button>
                  <button class="btn-danger admin-btn-small" onclick="deleteAdminFile('${f.id}', '${f.originalName.replace(/'/g, "\\'")}')">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function createAdminUser() {
  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value.trim();
  const role = document.getElementById('admin-new-role').value;
  const quotaRaw = document.getElementById('admin-new-quota').value.trim();
  const quotaLimit = quotaRaw ? Number(quotaRaw) * 1048576 : undefined;

  if (!username || !password) {
    alert('Username and password are required');
    return;
  }

  const res = await fetch(`${API}/api/admin/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role, quotaLimit }),
  });

  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to create user');
    return;
  }

  document.getElementById('admin-new-username').value = '';
  document.getElementById('admin-new-password').value = '';
  document.getElementById('admin-new-quota').value = '';
  await loadAdminDashboard();
}

async function updateUserQuota(userId) {
  const input = document.getElementById(`quota-user-${userId}`);
  const quotaLimit = Number(input?.value) * 1048576;

  if (!Number.isFinite(quotaLimit) || quotaLimit <= 0) {
    alert('Quota must be a positive number');
    return;
  }

  const res = await fetch(`${API}/api/admin/users/${userId}/quota`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotaLimit }),
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to update quota');
    return;
  }

  await loadAdminDashboard();
}

async function updateSystemSettings() {
  const totalStorageLimit = Number(document.getElementById('system-total-limit').value) * 1048576;
  const maxUserQuota = Number(document.getElementById('system-max-user-quota').value) * 1048576;

  if (!Number.isFinite(totalStorageLimit) || totalStorageLimit <= 0) {
    alert('Total storage limit must be a positive number');
    return;
  }

  if (!Number.isFinite(maxUserQuota) || maxUserQuota <= 0) {
    alert('Max user quota must be a positive number');
    return;
  }

  const res = await fetch(`${API}/api/admin/settings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalStorageLimit, maxUserQuota }),
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to update settings');
    return;
  }

  await loadAdminDashboard();
}

async function deleteAdminUser(userId, username) {
  if (!confirm(`Delete user "${username}" and all their data?`)) return;

  const res = await fetch(`${API}/api/admin/users/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to delete user');
    return;
  }

  await loadAdminDashboard();
}

async function deleteAdminFile(fileId, fileName) {
  if (!confirm(`Delete file "${fileName}"?`)) return;

  const res = await fetch(`${API}/api/admin/files/${fileId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to delete file');
    return;
  }

  await loadAdminDashboard();
}

function setupDragAndDropUpload() {
  const dropArea = document.querySelector('.main');
  const grid = document.getElementById('file-grid');
  if (!dropArea || !grid) return;

  const setDragActive = (isActive) => {
    grid.classList.toggle('drag-active', isActive);
  };

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    });
  });

  ['dragleave', 'dragend'].forEach((eventName) => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropArea.contains(e.relatedTarget)) {
        setDragActive(false);
      }
    });
  });

  dropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      await uploadFile(file);
    }
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePreview();
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) login();
});

setupDragAndDropUpload();
setupSizeUnitSelector();
