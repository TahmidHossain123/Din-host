const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { authenticateToken, sanitizeSubdomain } = require('../utils/security');
const { inspectAndExtractZip } = require('../utils/zipHandler');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_BYTES }
});

const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'mail', 'ftp', 'sites', 'health', 'dinhost'];

// List current user sites
router.get('/', authenticateToken, (req, res) => {
  db.all('SELECT * FROM sites WHERE user_id = ? ORDER BY id DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Could not fetch websites.' });
    res.json({ sites: rows });
  });
});

// Deploy or Update static site
router.post('/deploy', authenticateToken, upload.single('bundle'), (req, res) => {
  const subdomain = sanitizeSubdomain(req.body.subdomain);
  const title = (req.body.title || subdomain).trim();

  if (!subdomain || subdomain.length < 3) {
    return res.status(400).json({ error: 'Subdomain must be at least 3 alphanumeric characters.' });
  }

  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return res.status(400).json({ error: `The name "${subdomain}" is reserved by the system.` });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Please supply a .ZIP file bundle containing an index.html file.' });
  }

  // Check ownership
  db.get('SELECT * FROM sites WHERE subdomain = ?', [subdomain], (err, existing) => {
    if (err) return res.status(500).json({ error: 'Database check failed.' });
    if (existing && existing.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Subdomain is already claimed by another user.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, subdomain);

    try {
      inspectAndExtractZip(req.file.buffer, siteDestination);
    } catch (unzipErr) {
      return res.status(400).json({ error: unzipErr.message });
    }

    if (existing) {
      db.run(
        'UPDATE sites SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, existing.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: 'Failed to record site update.' });
          res.json({ success: true, message: `Website "${subdomain}" successfully updated.` });
        }
      );
    } else {
      db.run(
        'INSERT INTO sites (user_id, subdomain, title) VALUES (?, ?, ?)',
        [req.user.id, subdomain, title],
        (insertErr) => {
          if (insertErr) return res.status(500).json({ error: 'Failed to record new site.' });
          res.json({ success: true, message: `Website "${subdomain}" successfully deployed.` });
        }
      );
    }
  });
});

// Delete a site
router.delete('/:id', authenticateToken, (req, res) => {
  const siteId = req.params.id;

  db.get('SELECT * FROM sites WHERE id = ?', [siteId], (err, site) => {
    if (err || !site) return res.status(404).json({ error: 'Website record not found.' });

    if (site.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'You lack permission to delete this site.' });
    }

    const siteDestination = path.join(config.STORAGE_DIR, site.subdomain);
    if (fs.existsSync(siteDestination)) {
      try {
        fs.rmSync(siteDestination, { recursive: true, force: true });
      } catch (e) {
        // Log & proceed
      }
    }

    db.run('DELETE FROM sites WHERE id = ?', [siteId], (delErr) => {
      if (delErr) return res.status(500).json({ error: 'Database deletion failure.' });
      res.json({ success: true, message: 'Website and stored files deleted.' });
    });
  });
});

module.exports = router;
