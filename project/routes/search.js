const express = require('express');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: { files: [] } });
        const files = await File.find({
            owner: req.user.id,
            originalName: { $regex: q, $options: 'i' }
        });
        res.json({
            success: true,
            data: {
                files: files.map(f => ({
                    id: f._id,
                    originalName: f.originalName,
                    mimeType: f.mimeType,
                    size: f.size,
                    folderId: f.folderId,
                    shareToken: f.shareToken,
                    createdAt: f.createdAt
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
