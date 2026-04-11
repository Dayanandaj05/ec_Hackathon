const User = require('../models/User');

async function checkQuota(req, res, next) {
  try {
    const userId = req.session?.userId || (req.body && req.body.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const incomingSize = parseInt(req.headers['content-length']) || 0;

    if (user.quotaUsed + incomingSize > user.quotaLimit) {
      return res.status(413).json({
        success: false,
        error: `Quota exceeded. Used: ${user.quotaUsed} bytes of ${user.quotaLimit} bytes.`
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = checkQuota;