const statusBox = document.getElementById('statusBox');
const userBadge = document.getElementById('userBadge');
const adminLink = document.getElementById('adminLink');
const deployForm = document.getElementById('deployForm');
const siteList = document.getElementById('siteList');
const uploadBtn = document.getElementById('uploadBtn');

function showStatus(msg, isError = false) {
  statusBox.textContent = msg;
  statusBox.className = 'status-box ' + (isError ? 'err' : 'ok');
}

async function verifyAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    const data = await res.json();
    userBadge.textContent = data.user.email;
    if (data.user.is_admin) {
      adminLink.style.display = 'inline';
    }
    loadSites();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

async function loadSites() {
  try {
    const res = await fetch('/api/sites');
    const data = await res.json();
    siteList.innerHTML = '';

    if (!data.sites || data.sites.length === 0) {
      siteList.innerHTML = '<p style="color:var(--text-muted);">No websites deployed yet.</p>';
      return;
    }

    const currentHost = window.location.hostname;
    const isRenderDefault = currentHost.includes('render.com');

    data.sites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'site-item';

      // Fallback path URL works guaranteed
      const fallbackUrl = `${window.location.origin}/sites/${site.subdomain}/`;
      // Host subdomain URL depends on external DNS configuration
      const directUrl = `${window.location.protocol}//${site.subdomain}.${currentHost}/`;

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${site.title}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">Updated: ${new Date(site.updated_at).toLocaleDateString()}</span>
        </div>
        <div class="site-links">
          <div><label>Immediate Access Path:</label><br><a href="${fallbackUrl}" target="_blank">${fallbackUrl}</a></div>
          ${!isRenderDefault ? `<div><label>Subdomain (Requires Wildcard DNS):</label><br><a href="${directUrl}" target="_blank">${directUrl}</a></div>` : ''}
        </div>
        <div style="margin-top:0.5rem;">
          <button class="btn-danger" onclick="deleteSite(${site.id})">Delete Site</button>
        </div>
      `;
      siteList.appendChild(item);
    });
  } catch (err) {
    showStatus('Error fetching sites: ' + err.message, true);
  }
}

deployForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  uploadBtn.disabled = true;
  showStatus('Validating and extracting package...');

  const formData = new FormData();
  formData.append('subdomain', document.getElementById('subdomain').value);
  formData.append('title', document.getElementById('title').value);
  formData.append('bundle', document.getElementById('bundle').files[0]);

  try {
    const res = await fetch('/api/sites/deploy', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Deployment failed');
    showStatus(result.message, false);
    deployForm.reset();
    loadSites();
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    uploadBtn.disabled = false;
  }
});

async function deleteSite(id) {
  if (!confirm('Permanently delete this website?')) return;
  try {
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Delete failed');
    showStatus(result.message, false);
    loadSites();
  } catch (err) {
    showStatus(err.message, true);
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

verifyAuth();
