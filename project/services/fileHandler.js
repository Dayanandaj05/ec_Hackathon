const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { MAX_FILE_SIZE } = require('./quotaManager');

const uploadDirectory = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}-${file.originalname}`);
  },
});

const uploadSingleFile = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

function buildStoredPath(storedName) {
  return path.join(uploadDirectory, storedName);
}

async function removeFileFromDisk(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

function sendDownload(res, file) {
  return res.download(file.path, file.originalName);
}

module.exports = {
  uploadSingleFile,
  buildStoredPath,
  removeFileFromDisk,
  sendDownload,
};
