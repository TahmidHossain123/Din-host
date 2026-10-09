const statusBox = document.getElementById('statusBox');

function showStatus(text, isError = false) {
  statusBox.textContent = text;
  statusBox.className = 'status-box ' + (isError ? 'err' : 'ok');
}

const regForm = document.getElementById('registerForm');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showStatus('Processing registration...');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      window.location.href = '/dashboard.html';
    } catch (err) {
      showStatus(err.message, true);
    }
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showStatus('Authenticating...');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      window.location.href = '/dashboard.html';
    } catch (err) {
      showStatus(err.message, true);
    }
  });
}
