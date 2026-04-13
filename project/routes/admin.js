const express = require('express');
const User = require('../models/User');
const File = require('../models/File');
const Folder = require('../models/Folder');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const { removeFileFromDisk } = require('../services/fileHandler');
const recalculateQuota = require('../helpers/quota');
const { getSystemConfig } = require('../services/quotaManager');
const SystemConfig = require('../models/SystemConfig');

const router = express.Router();

router.use(auth);
router.use(adminOnly);

router.get('/me', async (req, res) => {
  return res.json({
    success: true,
    data: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
    },
  });
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ username: 1 });
    return res.json({ success: true, data: { users } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/users/:userId/quota', async (req, res) => {
  try {
    const { userId } = req.params;
    const quotaLimit = Number(req.body?.quotaLimit);

    if (!Number.isFinite(quotaLimit) || quotaLimit <= 0) {
      return res.status(400).json({ success: false, error: 'quotaLimit must be a positive number' });
    }

    const systemConfig = await getSystemConfig();
    if (quotaLimit > systemConfig.maxUserQuota) {
      return res.status(400).json({
        success: false,
        error: `quotaLimit cannot exceed system max user quota (${systemConfig.maxUserQuota} bytes)`,
      });
    }

    const user = await User.findByIdAndUpdate(userId, { $set: { quotaLimit } }, { new: true });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          quotaUsed: user.quotaUsed,
          quotaLimit: user.quotaLimit,
          role: user.role,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, role, quotaLimit } = req.body || {};
    const systemConfig = await getSystemConfig();

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Username already exists' });
    }

    const user = await User.create({
      username,
      password,
      role: role === 'admin' ? 'admin' : 'user',
      quotaLimit: Number.isFinite(Number(quotaLimit))
        ? Math.min(Number(quotaLimit), systemConfig.maxUserQuota)
        : systemConfig.maxUserQuota,
      quotaUsed: 0,
    });

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          quotaUsed: user.quotaUsed,
          quotaLimit: user.quotaLimit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ success: false, error: 'Admin cannot delete own account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const files = await File.find({ owner: userId });
    for (const file of files) {
      await removeFileFromDisk(file.path);
    }

    await File.deleteMany({ owner: userId });
    await Folder.deleteMany({ owner: userId });
    await User.deleteOne({ _id: userId });

    return res.json({ success: true, data: { message: 'User and related data deleted' } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/files', async (req, res) => {
  try {
    const files = await File.find({}).populate('owner', 'username role').sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        files: files.map((file) => ({
          id: file._id,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          folderId: file.folderId,
          shareToken: file.shareToken,
          createdAt: file.createdAt,
          owner: file.owner
            ? {
                id: file.owner._id,
                username: file.owner.username,
                role: file.owner.role,
              }
            : null,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    await File.deleteOne({ _id: fileId });
    await removeFileFromDisk(file.path);
    await recalculateQuota(file.owner);

    return res.json({ success: true, data: { message: 'File deleted by admin' } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [userCount, fileCount, folderCount, fileSizes] = await Promise.all([
      User.countDocuments(),
      File.countDocuments(),
      Folder.countDocuments(),
      File.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]),
    ]);

    return res.json({
      success: true,
      data: {
        users: userCount,
        files: fileCount,
        folders: folderCount,
        totalStorageUsed: fileSizes[0]?.total || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const systemConfig = await getSystemConfig();
    return res.json({ success: true, data: systemConfig });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const totalStorageLimit = Number(req.body?.totalStorageLimit);
    const maxUserQuota = Number(req.body?.maxUserQuota);

    if (!Number.isFinite(totalStorageLimit) || totalStorageLimit <= 0) {
      return res.status(400).json({ success: false, error: 'totalStorageLimit must be a positive number' });
    }

    if (!Number.isFinite(maxUserQuota) || maxUserQuota <= 0) {
      return res.status(400).json({ success: false, error: 'maxUserQuota must be a positive number' });
    }

    if (maxUserQuota > totalStorageLimit) {
      return res.status(400).json({ success: false, error: 'maxUserQuota cannot exceed totalStorageLimit' });
    }

    const usageAgg = await User.aggregate([{ $group: { _id: null, total: { $sum: '$quotaUsed' } } }]);
    const totalUsed = usageAgg[0]?.total || 0;
    if (totalStorageLimit < totalUsed) {
      return res.status(400).json({
        success: false,
        error: `totalStorageLimit cannot be lower than currently used storage (${totalUsed} bytes)`,
      });
    }

    let config;
    try {
      config = await SystemConfig.findOneAndUpdate(
        { key: 'global' },
        {
          $set: {
            totalStorageLimit,
            maxUserQuota,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      if (e && e.code === 11000) {
        config = await SystemConfig.findOneAndUpdate(
          { key: 'global' },
          {
            $set: {
              totalStorageLimit,
              maxUserQuota,
              updatedAt: new Date(),
            },
          },
          { new: true }
        );
      } else {
        throw e;
      }
    }

    await User.updateMany(
      { quotaLimit: { $gt: maxUserQuota } },
      { $set: { quotaLimit: maxUserQuota } }
    );

    return res.json({
      success: true,
      data: {
        totalStorageLimit: config.totalStorageLimit,
        maxUserQuota: config.maxUserQuota,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const [storageByUser, filesByMime, uploadsByDay, systemConfig, usageAgg] = await Promise.all([
      User.find({}, { username: 1, quotaUsed: 1, quotaLimit: 1 }).sort({ quotaUsed: -1 }),
      File.aggregate([
        {
          $project: {
            category: {
              $cond: [
                { $or: [{ $eq: ['$mimeType', null] }, { $eq: ['$mimeType', ''] }] },
                'unknown',
                { $arrayElemAt: [{ $split: ['$mimeType', '/'] }, 0] },
              ],
            },
            size: '$size',
          },
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            bytes: { $sum: '$size' },
          },
        },
        { $sort: { bytes: -1 } },
      ]),
      File.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            files: { $sum: 1 },
            bytes: { $sum: '$size' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      getSystemConfig(),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$quotaUsed' } } }]),
    ]);

    const totalUsed = usageAgg[0]?.total || 0;
    return res.json({
      success: true,
      data: {
        systemUsage: {
          used: totalUsed,
          limit: systemConfig.totalStorageLimit,
          percentage: systemConfig.totalStorageLimit ? (totalUsed / systemConfig.totalStorageLimit) * 100 : 0,
        },
        storageByUser: storageByUser.map((u) => ({
          id: u._id,
          username: u.username,
          used: u.quotaUsed || 0,
          limit: u.quotaLimit || systemConfig.maxUserQuota,
        })),
        filesByMime: filesByMime.map((item) => ({
          type: item._id,
          count: item.count,
          bytes: item.bytes,
        })),
        uploadsByDay,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
