const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireAdmin } = require('../utils/security');

// Overview platform metrics
router.get('/stats', requireAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as userCount FROM users', (err, u) => {
    db.get('SELECT COUNT(*) as siteCount FROM sites', (err2, s) => {
      res.json({
        totalUsers: u ? u.userCount : 0,
        totalSites: s ? s.siteCount : 0,
        storagePath: config.STORAGE_DIR
      });
    });
  });
});

// Enumerate all users
router.get('/users', requireAdmin, (req, res) => {
  db.all('SELECT id, email, is_admin, created_at FROM users ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error fetching users.' });
    res.json({ users: rows });
  });
});

// Enumerate all sites
router.get('/sites', requireAdmin, (req, res) => {
  const query = `
    SELECT sites.*, users.email as owner_email 
    FROM sites 
    JOIN users ON sites.user_id = users.id 
    ORDER BY sites.id DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error fetching sites.' });
    res.json({ sites: rows });
  });
});

// Purge any user (Admin override)
router.delete('/users/:id', requireAdmin, (req, res) => {
  const targetId = req.params.id;
  if (parseInt(targetId, 10) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own administrator account.' });
  }

  // Delete sites from disk first
  db.all('SELECT subdomain FROM sites WHERE user_id = ?', [targetId], (err, rows) => {
    if (!err && rows) {
      rows.forEach(site => {
        const p = path.join(config.STORAGE_DIR, site.subdomain);
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
      });
    }

    db.run('DELETE FROM users WHERE id = ?', [targetId], (delErr) => {
      if (delErr) return res.status(500).json({ error: 'Failed to delete user.' });
      res.json({ success: true, message: 'User and all associated sites purged.' });
    });
  });
});

module.exports = router;
