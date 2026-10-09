const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      res.clearCookie('auth_token');
      return res.status(403).json({ error: 'Session expired or invalid.' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Administrator clearance required.' });
    }
    next();
  });
}

function sanitizeSubdomain(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

module.exports = {
  authenticateToken,
  requireAdmin,
  sanitizeSubdomain
};
