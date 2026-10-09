const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { authenticateToken, sanitizeSubdomain } = require('../utils/security');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      return cb(new Error('Only single HTML files (.html, .htm) are permitted.'));
    }
    cb(null, true);
  }
});

const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'mail', 'ftp', 'sites', 'health', 'dinhost'];

// Helper to inject Brand Header Bar (YouTube/Firebase Style Logo + Name) into index.html
function injectBrandHeader(buffer, title, logoUrl) {
  let content = buffer.toString('utf8');
  
  if (logoUrl && logoUrl.trim().startsWith('http')) {
    const headerHtml = `
  <!-- DIN Host Brand Bar (YouTube/Firebase style) -->
  <div id="din-brand-header" style="
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    background: rgba(15, 23, 42, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  ">
    <img src="${logoUrl.trim()}" alt="Logo" style="
      height: 38px;
      width: auto;
      max-width: 140px;
      object-fit: contain;
      border-radius: 6px;
    ">
    <span style="
      color: #ffffff;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.3px;
    ">${title}</span>
  </div>
  <!-- End DIN Host Brand Bar -->
`;

    // Inject immediately after <body> or <BODY>
    if (content.includes('<body')) {
      content = content.replace(/(<body[^>]*>)/i, `$1\n${headerHtml}`);
    } else {
      content = headerHtml + content;
    }
  }

  return Buffer.from(content, 'utf8');
}

// Get user sites
router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM sites WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database fetch error.' });
    res.json({ sites: rows });
  });
});

// Deploy New Website
router.post('/deploy', authenticateToken, upload.single('htmlFile'), (req, res) => {
  const subdomain = sanitizeSubdomain(req.body.subdomain);
  const title = (req.body.title || subdomain).trim();
  const logoUrl = (req.body.logo_url || '').trim();

  if (!subdomain || subdomain.length < 3) {
    return res.status(400).json({ error: 'Subdomain must be at least 3 letters/numbers.' });
  }

  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return res.status(400).json({ error: `The name "${subdomain}" is reserved.` });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please choose an HTML (.html) file.' });
  }

  db.get('SELECT * FROM sites WHERE subdomain = ?', [subdomain], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Database check failed.' });
    if (existing) {
      return res.status(400).json({ error: 'Subdomain already taken. Choose another one.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, subdomain);

    try {
      if (!fs.existsSync(siteDestination)) {
        fs.mkdirSync(siteDestination, { recursive: true });
      }
      
      const finalBuffer = injectBrandHeader(req.file.buffer, title, logoUrl);
      fs.writeFileSync(path.join(siteDestination, 'index.html'), finalBuffer);
      fs.writeFileSync(path.join(siteDestination, 'raw.html'), req.file.buffer);
    } catch (saveErr) {
      return res.status(500).json({ error: 'Failed to write website files.' });
    }

    db.run(
      'INSERT INTO sites (user_id, subdomain, title, logo_url) VALUES (?, ?, ?, ?)',
      [req.user.id, subdomain, title, logoUrl],
      (iErr) => {
        if (iErr) return res.status(500).json({ error: 'Failed to save site data.' });
        res.json({ success: true, message: `Website "${subdomain}" published successfully!` });
      }
    );
  });
});

// Edit / Update Website (Change Name, Logo, or HTML file)
router.post('/update/:id', authenticateToken, upload.single('htmlFile'), (req, res) => {
  const siteId = req.params.id;
  const title = (req.body.title || '').trim();
  const logoUrl = (req.body.logo_url || '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Website title cannot be empty.' });
  }

  db.get('SELECT * FROM sites WHERE id = ?', [siteId], (err, site) => {
    if (err || !site) return res.status(404).json({ error: 'Website not found.' });

    if (site.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, site.subdomain);
    const rawPath = path.join(siteDestination, 'raw.html');
    const indexPath = path.join(siteDestination, 'index.html');

    try {
      if (!fs.existsSync(siteDestination)) {
        fs.mkdirSync(siteDestination, { recursive: true });
      }

      let baseBuffer;
      if (req.file) {
        baseBuffer = req.file.buffer;
        fs.writeFileSync(rawPath, req.file.buffer);
      } else if (fs.existsSync(rawPath)) {
        baseBuffer = fs.readFileSync(rawPath);
      } else if (fs.existsSync(indexPath)) {
        baseBuffer = fs.readFileSync(indexPath);
      } else {
        baseBuffer = Buffer.from('<h1>Hello World</h1>');
      }

      const updatedBuffer = injectBrandHeader(baseBuffer, title, logoUrl);
      fs.writeFileSync(indexPath, updatedBuffer);
    } catch (writeErr) {
      return res.status(500).json({ error: 'Could not write updated HTML file.' });
    }

    db.run(
      'UPDATE sites SET title = ?, logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, logoUrl, siteId],
      (uErr) => {
        if (uErr) return res.status(500).json({ error: 'Failed to update website info.' });
        res.json({ success: true, message: 'Website updated successfully!' });
      }
    );
  });
});

// Delete Website
router.delete('/:id', authenticateToken, (req, res) => {
  const siteId = req.params.id;

  db.get('SELECT * FROM sites WHERE id = ?', [siteId], (err, site) => {
    if (err || !site) return res.status(404).json({ error: 'Site not found.' });

    if (site.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, site.subdomain);
    if (fs.existsSync(siteDestination)) {
      try {
        fs.rmSync(siteDestination, { recursive: true, force: true });
      } catch (e) {}
    }

    db.run('DELETE FROM sites WHERE id = ?', [siteId], (delErr) => {
      if (delErr) return res.status(500).json({ error: 'Database removal failure.' });
      res.json({ success: true, message: 'Website deleted permanently.' });
    });
  });
});

module.exports = router;
