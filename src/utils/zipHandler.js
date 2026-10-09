const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const config = require('../config');

function inspectAndExtractZip(buffer, targetDir) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    throw new Error('Corrupt or invalid ZIP archive file.');
  }

  const zipEntries = zip.getEntries();
  if (zipEntries.length === 0) {
    throw new Error('ZIP archive is empty.');
  }

  if (zipEntries.length > config.MAX_FILE_COUNT) {
    throw new Error(`Archive exceeds maximum limit of ${config.MAX_FILE_COUNT} files.`);
  }

  let totalDecompressedBytes = 0;
  let hasIndexHtml = false;

  // Validation pass: Verify path safety, size ceilings, and file types
  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    totalDecompressedBytes += entry.header.size;
    if (totalDecompressedBytes > config.MAX_UNCOMPRESSED_SIZE_BYTES) {
      throw new Error(`Decompressed size exceeds ${config.MAX_UNCOMPRESSED_SIZE_BYTES / (1024 * 1024)}MB safety threshold.`);
    }

    const normalizedPath = path.normalize(entry.entryName);
    // Path traversal mitigation
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath) || normalizedPath.includes('..\\')) {
      throw new Error('Security violation: ZIP contains illegal traversal paths.');
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!config.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`Prohibited file type detected: "${entry.name}". Server-side scripts and binaries are forbidden.`);
    }

    if (entry.name.toLowerCase() === 'index.html') {
      hasIndexHtml = true;
    }
  }

  if (!hasIndexHtml) {
    throw new Error('Missing "index.html" in root of ZIP. A root index.html is required for static websites.');
  }

  // Deletion of pre-existing build if present
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // Safe extraction pass
  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    const safeDestPath = path.resolve(targetDir, entry.entryName);
    if (!safeDestPath.startsWith(path.resolve(targetDir) + path.sep)) {
      throw new Error('Attempted path escape during write operation.');
    }

    const destinationFolder = path.dirname(safeDestPath);
    if (!fs.existsSync(destinationFolder)) {
      fs.mkdirSync(destinationFolder, { recursive: true });
    }

    fs.writeFileSync(safeDestPath, entry.getData());
  }

  return true;
}

module.exports = {
  inspectAndExtractZip
};
