const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { authenticateToken, sanitizeSubdomain } = require('../utils/security');

// Multer memory storage configured for single HTML files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      return cb(new Error('Only HTML files (.html, .htm) are allowed.'));
    }
    cb(null, true);
  }
});

const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'mail', 'ftp', 'sites', 'health', 'dinhost'];

// List user sites
router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM sites WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Could not fetch websites.' });
    res.json({ sites: rows });
  });
});

// Deploy or Update single HTML site
router.post('/deploy', authenticateToken, upload.single('htmlFile'), (req, res) => {
  const subdomain = sanitizeSubdomain(req.body.subdomain);
  const title = (req.body.title || subdomain).trim();

  if (!subdomain || subdomain.length < 3) {
    return res.status(400).json({ error: 'Subdomain must be at least 3 alphanumeric characters.' });
  }

  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return res.status(400).json({ error: `The name "${subdomain}" is reserved.` });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please choose an HTML (.html) file to upload.' });
  }

  // Basic HTML validation
  const fileContent = req.file.buffer.toString('utf8', 0, 500).toLowerCase();
  if (!fileContent.includes('<html') && !fileContent.includes('<!doctype') && !fileContent.includes('<body') && !fileContent.includes('<div') && !fileContent.includes('<h')) {
    return res.status(400).json({ error: 'The uploaded file does not appear to be a valid HTML document.' });
  }

  db.get('SELECT * FROM sites WHERE subdomain = ?', [subdomain], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (existing && existing.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'This subdomain is already taken by another user.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, subdomain);

    try {
      if (!fs.existsSync(siteDestination)) {
        fs.mkdirSync(siteDestination, { recursive: true });
      }
      // Save uploaded file strictly as index.html
      fs.writeFileSync(path.join(siteDestination, 'index.html'), req.file.buffer);
    } catch (saveErr) {
      return res.status(500).json({ error: 'Failed to write HTML file to disk.' });
    }

    if (existing) {
      db.run(
        'UPDATE sites SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, existing.id],
        (uErr) => {
          if (uErr) return res.status(500).json({ error: 'Failed to update site record.' });
          res.json({ success: true, message: `Website "${subdomain}" updated successfully.` });
        }
      );
    } else {
      db.run(
        'INSERT INTO sites (user_id, subdomain, title) VALUES (?, ?, ?)',
        [req.user.id, subdomain, title],
        (iErr) => {
          if (iErr) return res.status(500).json({ error: 'Failed to create site record.' });
          res.json({ success: true, message: `Website "${subdomain}" published successfully.` });
        }
      );
    }
  });
});

// Delete a site
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
      if (delErr) return res.status(500).json({ error: 'Failed to remove site from database.' });
      res.json({ success: true, message: 'Website removed.' });
    });
  });
});

module.exports = router;
