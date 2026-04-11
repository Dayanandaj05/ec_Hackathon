const crypto = require('crypto');
const File = require('../models/File');
const User = require('../models/User');

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

async function createShareLink(ownerId, fileId) {
  const token = generateToken();

  const file = await File.findOneAndUpdate(
    { _id: fileId, owner: ownerId },
    { shareToken: token },
    { returnDocument: 'after' }
  );

  if (!file) {
    return null;
  }

  return {
    token,
    shareUrl: `/share/${token}`,
  };
}

async function getSharedFile(token) {
  return File.findOne({ shareToken: token });
}

async function getSharedFileMetadata(token) {
  const file = await getSharedFile(token);
  if (!file) {
    return null;
  }

  const owner = await User.findById(file.owner).select('username');

  return {
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    owner: owner?.username || 'Unknown',
    createdAt: file.createdAt,
    downloadUrl: `/api/share/${token}/download`,
  };
}

module.exports = {
  createShareLink,
  getSharedFile,
  getSharedFileMetadata,
};
