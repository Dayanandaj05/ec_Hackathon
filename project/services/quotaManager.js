const User = require('../models/User');

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_USER_QUOTA = 500 * 1024 * 1024;

async function getUserById(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

function ensureFileWithinLimit(fileSize) {
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File exceeds 50 MB limit.');
  }
}

async function ensureUserHasQuota(userId, incomingSize) {
  const user = await getUserById(userId);
  const effectiveLimit = Math.min(user.quotaLimit || MAX_USER_QUOTA, MAX_USER_QUOTA);

  if (user.quotaUsed + incomingSize > effectiveLimit) {
    throw new Error(`Quota exceeded. Used: ${user.quotaUsed} bytes of ${effectiveLimit} bytes.`);
  }

  return {
    used: user.quotaUsed,
    limit: effectiveLimit,
  };
}

async function addUsage(userId, size) {
  return User.findByIdAndUpdate(userId, {
    $inc: { quotaUsed: size },
    $set: { quotaLimit: MAX_USER_QUOTA },
  });
}

async function subtractUsage(userId, size) {
  if (!size) {
    return null;
  }

  const user = await getUserById(userId);
  const safeDecrement = Math.min(size, Math.max(0, user.quotaUsed));

  return User.findByIdAndUpdate(userId, {
    $inc: { quotaUsed: -safeDecrement },
    $set: { quotaLimit: MAX_USER_QUOTA },
  });
}

async function getQuota(userId) {
  const user = await getUserById(userId);
  const used = Math.max(0, user.quotaUsed || 0);
  const limit = Math.min(user.quotaLimit || MAX_USER_QUOTA, MAX_USER_QUOTA);
  return { used, limit };
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_USER_QUOTA,
  ensureFileWithinLimit,
  ensureUserHasQuota,
  addUsage,
  subtractUsage,
  getQuota,
};
