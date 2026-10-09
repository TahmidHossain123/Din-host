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

    data.sites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'site-item';

      const fallbackUrl = `${window.location.origin}/sites/${site.subdomain}/`;
      const logoHtml = site.logo_url
        ? `<img src="${site.logo_url}" alt="Logo" style="height:38px; width:38px; object-fit:contain; border-radius:6px; background:#0b1120; border:1px solid rgba(255,255,255,0.1); padding:2px;">`
        : `<div style="height:38px; width:38px; background:#1e293b; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">🌐</div>`;

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoHtml}
            <div>
              <strong style="font-size:1.1rem; color:#fff;">${site.title}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">/${site.subdomain}</div>
            </div>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(site.updated_at).toLocaleDateString()}</span>
        </div>

        <div class="site-links" style="margin: 0.6rem 0; display:flex; align-items:center; justify-content:space-between; background:rgba(0,0,0,0.3); padding:0.6rem 0.8rem; border-radius:8px; gap:8px;">
          <a href="${fallbackUrl}" target="_blank" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">${fallbackUrl}</a>
          <button class="btn-copy" onclick="copySiteUrl('${fallbackUrl}', this)" style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; padding:0.3rem 0.6rem; border-radius:6px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:0.2s;">📋 Copy</button>
        </div>

        <div style="display:flex; gap:0.6rem; margin-top:0.3rem;">
          <button class="btn-primary" style="padding:0.4rem 0.8rem; font-size:0.85rem;" onclick="openEditModal(${site.id}, '${encodeURIComponent(site.title)}', '${encodeURIComponent(site.logo_url || '')}')">✏️ Edit</button>
          <button class="btn-danger" onclick="deleteSite(${site.id})">🗑️ Delete</button>
        </div>
      `;
      siteList.appendChild(item);
    });
  } catch (err) {
    showStatus('Error fetching sites: ' + err.message, true);
  }
}

// Function to copy site URL to clipboard
window.copySiteUrl = (url, btnElement) => {
  navigator.clipboard.writeText(url).then(() => {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '✓ Copied!';
    btnElement.style.background = 'rgba(16, 185, 129, 0.2)';
    btnElement.style.borderColor = '#10b981';
    btnElement.style.color = '#10b981';

    setTimeout(() => {
      btnElement.innerHTML = originalText;
      btnElement.style.background = 'rgba(56,189,248,0.15)';
      btnElement.style.borderColor = 'rgba(56,189,248,0.3)';
      btnElement.style.color = '#38bdf8';
    }, 2000);
  }).catch(err => {
    alert('Failed to copy: ' + err);
  });
};

// Function to trigger edit modal
window.openEditModal = (id, encTitle, encLogo) => {
  document.getElementById('editSiteId').value = id;
  document.getElementById('editTitle').value = decodeURIComponent(encTitle);
  document.getElementById('editLogoUrl').value = decodeURIComponent(encLogo);
  document.getElementById('editHtmlFile').value = '';
  document.getElementById('editModal').style.display = 'flex';
};

async function deleteSite(id) {
  if (!confirm('Are you sure you want to delete this website?')) return;
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
