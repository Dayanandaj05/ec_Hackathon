const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const File = require('../models/File');

const router = express.Router();

// POST /api/files/:fileId/share — protected
router.post('/files/:fileId/share', auth, async (req, res) => {
    const { fileId } = req.params;
    try {
        const token = crypto.randomBytes(16).toString('hex');
        const file = await File.findByIdAndUpdate(fileId, { shareToken: token }, { new: true });
        if (!file) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        res.json({ success: true, data: { shareUrl: '/api/share/' + token } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate share link' });
    }
});

// GET /api/share/:token — public, no auth
router.get('/share/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const file = await File.findOne({ shareToken: token });
        if (!file) {
            return res.status(404).json({ success: false, error: 'Invalid or expired link' });
        }
        res.download(file.path, file.originalName);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to download file' });
    }
});

module.exports = router;
