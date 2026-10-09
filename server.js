const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const authRoutes = require('./src/routes/auth');
const siteRoutes = require('./src/routes/sites');
const adminRoutes = require('./src/routes/admin');

const app = express();

// Ensure local directories exist on cold boot
if (!fs.existsSync(config.STORAGE_DIR)) {
  fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Subdomain Host Router Middleware
app.use((req, res, next) => {
  const host = (req.hostname || req.headers.host || '').split(':')[0].toLowerCase();

  // Check if incoming request matches a user subdomain: e.g. site1.dinhost.th.hn
  if (host !== config.BASE_DOMAIN && host.endsWith('.' + config.BASE_DOMAIN)) {
    const subdomain = host.slice(0, -(config.BASE_DOMAIN.length + 1));
    const siteDir = path.join(config.STORAGE_DIR, subdomain);

    if (fs.existsSync(siteDir)) {
      return express.static(siteDir, {
        extensions: ['html', 'htm'],
        index: 'index.html'
      })(req, res, next);
    } else {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Site Not Found - DIN Host</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;">
          <h2>404 - Site Not Deployed</h2>
          <p>The site <strong>${subdomain}.${config.BASE_DOMAIN}</strong> does not exist on this server.</p>
          <p><em>Notice: Render free instances wipe storage on restart. If this is unexpected, redeploy the site bundle.</em></p>
        </body></html>
      `);
    }
  }
  next();
});

// Platform Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    service: 'DIN Host Engine'
  });
});

// Universal Fallback Route for Websites: /sites/:subdomain/*
app.use('/sites/:subdomain', (req, res, next) => {
  const subdomain = req.params.subdomain.toLowerCase();
  const siteDir = path.join(config.STORAGE_DIR, subdomain);

  if (!fs.existsSync(siteDir)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>404 - DIN Host</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;">
        <h2>Website Not Found</h2>
        <p>Target site <code>${subdomain}</code> is not present or was cleared on instance sleep.</p>
        <a href="/">Return to DIN Host</a>
      </body></html>
    `);
  }

  // Strip prefix and serve static files directly from user folder
  express.static(siteDir, {
    extensions: ['html', 'htm'],
    index: 'index.html'
  })(req, res, next);
});

// Core Platform API Mounts
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/admin', adminRoutes);

// Dashboard Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File size exceeds maximum upload limit of 10MB.' });
  }
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(config.PORT, () => {
  console.log(`DIN Host online on port ${config.PORT}`);
  console.log(`Base domain set to: ${config.BASE_DOMAIN}`);
});
