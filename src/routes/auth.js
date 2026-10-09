const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { authenticateToken } = require('../utils/security');

// Register Endpoint
router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and a password of at least 6 characters are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const isAdmin = normalizedEmail === config.ADMIN_EMAIL ? 1 : 0;
  const hashedPassword = bcrypt.hashSync(password, 10);

  const query = `INSERT INTO users (email, password, is_admin) VALUES (?, ?, ?)`;
  db.run(query, [normalizedEmail, hashedPassword, isAdmin], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      return res.status(500).json({ error: 'Database error registering account.' });
    }

    const token = jwt.sign(
      { id: this.lastID, email: normalizedEmail, is_admin: isAdmin },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Registration complete.', isAdmin: !!isAdmin });
  });
});

// Login Endpoint
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  db.get(`SELECT * FROM users WHERE email = ?`, [normalizedEmail], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Dynamic escalation check: if admin email set in environment matches user
    const shouldBeAdmin = user.email === config.ADMIN_EMAIL ? 1 : user.is_admin;
    if (shouldBeAdmin !== user.is_admin) {
      db.run('UPDATE users SET is_admin = ? WHERE id = ?', [shouldBeAdmin, user.id]);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: shouldBeAdmin },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Logged in.', isAdmin: !!shouldBeAdmin });
  });
});

// Session Validation Endpoint
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Logout Endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
