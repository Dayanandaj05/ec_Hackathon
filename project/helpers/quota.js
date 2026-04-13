const User = require('../models/User');
const File = require('../models/File');

async function recalculateQuota(userId) {
  const files = await File.find({ owner: userId });
  const totalUsed = files.reduce((sum, f) => sum + f.size, 0);
  await User.findByIdAndUpdate(userId, { quotaUsed: totalUsed });
  return totalUsed;
}

module.exports = recalculateQuota;
