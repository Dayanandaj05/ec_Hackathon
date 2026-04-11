const {
  MAX_FILE_SIZE,
  ensureUserHasQuota,
} = require('../services/quotaManager');

async function checkQuota(req, res, next) {
  try {
    const userId = req.session?.userId || req.user?.id || (req.body && req.body.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const incomingSize = parseInt(req.headers['content-length'], 10) || 0;

    if (incomingSize > MAX_FILE_SIZE) {
      return res.status(413).json({
        success: false,
        error: 'File exceeds 50 MB limit.'
      });
    }

    await ensureUserHasQuota(userId, incomingSize);

    next();
  } catch (err) {
    const status = err.message === 'User not found'
      ? 404
      : err.message.includes('Quota exceeded') || err.message.includes('File exceeds')
        ? 413
        : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

module.exports = checkQuota;