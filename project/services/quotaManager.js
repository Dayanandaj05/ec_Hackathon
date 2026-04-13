const User = require('../models/User');
const SystemConfig = require('../models/SystemConfig');

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_USER_QUOTA = 500 * 1024 * 1024;
const DEFAULT_TOTAL_STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

async function getSystemConfig() {
  let config;
  try {
    config = await SystemConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $setOnInsert: {
          key: 'global',
          totalStorageLimit: DEFAULT_TOTAL_STORAGE_LIMIT,
          maxUserQuota: MAX_USER_QUOTA,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err && err.code === 11000) {
      config = await SystemConfig.findOne({ key: 'global' });
    } else {
      throw err;
    }
  }

  return {
    totalStorageLimit: Math.max(1, config.totalStorageLimit || DEFAULT_TOTAL_STORAGE_LIMIT),
    maxUserQuota: Math.max(1, config.maxUserQuota || MAX_USER_QUOTA),
  };
}

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
  const systemConfig = await getSystemConfig();
  const effectiveLimit = Math.min(
    user.quotaLimit || systemConfig.maxUserQuota,
    systemConfig.maxUserQuota
  );

  if (user.quotaUsed + incomingSize > effectiveLimit) {
    throw new Error(`Quota exceeded. Used: ${user.quotaUsed} bytes of ${effectiveLimit} bytes.`);
  }

  const usageAgg = await User.aggregate([{ $group: { _id: null, total: { $sum: '$quotaUsed' } } }]);
  const totalUsed = usageAgg[0]?.total || 0;
  if (totalUsed + incomingSize > systemConfig.totalStorageLimit) {
    throw new Error('System storage limit exceeded. Contact admin.');
  }

  return {
    used: user.quotaUsed,
    limit: effectiveLimit,
  };
}

async function addUsage(userId, size) {
  return User.findByIdAndUpdate(userId, {
    $inc: { quotaUsed: size },
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
  });
}

async function getQuota(userId) {
  const user = await getUserById(userId);
  const systemConfig = await getSystemConfig();
  const used = Math.max(0, user.quotaUsed || 0);
  const limit = Math.min(user.quotaLimit || systemConfig.maxUserQuota, systemConfig.maxUserQuota);
  return { used, limit };
}

module.exports = {
  MAX_FILE_SIZE,
  MAX_USER_QUOTA,
  DEFAULT_TOTAL_STORAGE_LIMIT,
  getSystemConfig,
  ensureFileWithinLimit,
  ensureUserHasQuota,
  addUsage,
  subtractUsage,
  getQuota,
};
