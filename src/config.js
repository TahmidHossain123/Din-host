const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'temporary-dev-secret-change-in-production',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@dinhost.th.hn').toLowerCase(),
  BASE_DOMAIN: (process.env.BASE_DOMAIN || 'dinhost.th.hn').toLowerCase(),
  
  // Storage paths on Render local filesystem
  STORAGE_DIR: path.join(__dirname, '..', 'data', 'sites'),
  DB_DIR: path.join(__dirname, '..', 'data'),
  
  // Security limits for uploads
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB maximum ZIP upload
  MAX_UNCOMPRESSED_SIZE_BYTES: 25 * 1024 * 1024, // 25MB decompressed ceiling
  MAX_FILE_COUNT: 100, // Maximum individual files allowed per upload
  
  ALLOWED_EXTENSIONS: [
    '.html', '.htm', '.css', '.js', '.json', '.xml', '.txt',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.otf', '.map', '.webmanifest'
  ]
};
