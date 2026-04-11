const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/quota?userId=
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        used: user.quotaUsed,
        limit: user.quotaLimit
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;