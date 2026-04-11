const express = require('express');
const router = express.Router();
const File = require('../models/File');
const mongoose = require('mongoose');

// GET /api/search?q=&userId=
router.get('/', async (req, res) => {
  try {
    const { q, userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const files = await File.find({
      owner: mongoose.Types.ObjectId(userId),
      originalName: { $regex: q || '', $options: 'i' }
    });

    const data = files.map(f => ({
      id: f._id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      folderId: f.folderId,
      shareToken: f.shareToken,
      createdAt: f.createdAt
    }));

    return res.json({ success: true, data: { files: data } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;