const statusBox = document.getElementById('statusBox');

function showStatus(msg, isError = false) {
  statusBox.textContent = msg;
  statusBox.className = 'status-box ' + (isError ? 'err' : 'ok');
}

async function initAdmin() {
  try {
    const authRes = await fetch('/api/auth/me');
    if (!authRes.ok) return (window.location.href = '/login.html');
    const authData = await authRes.json();
    if (!authData.user.is_admin) {
      alert('Access Denied: Admin role required.');
      return (window.location.href = '/dashboard.html');
    }

    loadStats();
    loadAdminSites();
    loadAdminUsers();
  } catch (e) {
    window.location.href = '/login.html';
  }
}

async function loadStats() {
  const res = await fetch('/api/admin/stats');
  if (res.ok) {
    const data = await res.json();
    document.getElementById('statUsers').textContent = data.totalUsers;
    document.getElementById('statSites').textContent = data.totalSites;
  }
}

async function loadAdminSites() {
  const list = document.getElementById('adminSitesList');
  const res = await fetch('/api/admin/sites');
  const data = await res.json();
  list.innerHTML = '';
  if (!data.sites || !data.sites.length) {
    list.innerHTML = '<p style="color:var(--text-muted)">No sites found.</p>';
    return;
  }
  data.sites.forEach(s => {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div><strong>${s.subdomain}</strong> (${s.title})</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Owner: ${s.owner_email}</div>
      <div><a href="/sites/${s.subdomain}/" target="_blank" style="color:var(--accent);">View Site</a></div>
      <div><button class="btn-danger" onclick="deleteSiteAdmin(${s.id})">Purge Site</button></div>
    `;
    list.appendChild(item);
  });
}

async function loadAdminUsers() {
  const list = document.getElementById('adminUsersList');
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  list.innerHTML = '';
  data.users.forEach(u => {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div><strong>${u.email}</strong> ${u.is_admin ? '<span class="badge">ADMIN</span>' : ''}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);">Joined: ${u.created_at}</div>
      ${!u.is_admin ? `<div><button class="btn-danger" onclick="deleteUserAdmin(${u.id})">Delete User Account</button></div>` : ''}
    `;
    list.appendChild(item);
  });
}

async function deleteSiteAdmin(id) {
  if (!confirm('Force purge site from storage?')) return;
  const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showStatus('Site purged');
    loadStats();
    loadAdminSites();
  }
}

async function deleteUserAdmin(id) {
  if (!confirm('Purge user and all their deployed sites?')) return;
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showStatus('User purged');
    loadStats();
    loadAdminSites();
    loadAdminUsers();
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

initAdmin();
