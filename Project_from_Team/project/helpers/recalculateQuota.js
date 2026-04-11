const File = require('../models/File');
const User = require('../models/User');
const mongoose = require('mongoose');

async function recalculateQuota(userId) {
  const result = await File.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: '$size' }
      }
    }
  ]);

  const totalUsed = result.length > 0 ? result[0].totalSize : 0;

  await User.findByIdAndUpdate(userId, { quotaUsed: totalUsed });

  return totalUsed;
}

module.exports = recalculateQuota;