const express = require('express');
const auth = require('../middleware/auth');
const { sendDownload } = require('../services/fileHandler');
const {
    createShareLink,
    getSharedFile,
    getSharedFileMetadata,
} = require('../services/shareService');

const router = express.Router();

// POST /api/files/:fileId/share — protected
router.post('/files/:fileId/share', auth, async (req, res) => {
    const { fileId } = req.params;
    try {
        const link = await createShareLink(req.user.id, fileId);
        if (!link) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
        return res.json({ success: true, data: { shareUrl: link.shareUrl } });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to generate share link' });
    }
});

// GET /api/share/:token — public metadata for share page
router.get('/share/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const metadata = await getSharedFileMetadata(token);
        if (!metadata) {
            return res.status(404).json({ success: false, error: 'Invalid or expired link' });
        }
        return res.json({ success: true, data: metadata });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to load shared file' });
    }
});

// GET /api/share/:token/download — public download endpoint
router.get('/share/:token/download', async (req, res) => {
    const { token } = req.params;
    try {
        const file = await getSharedFile(token);
        if (!file) {
            return res.status(404).json({ success: false, error: 'Invalid or expired link' });
        }

        return sendDownload(res, file);
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to download file' });
    }
});

module.exports = router;
