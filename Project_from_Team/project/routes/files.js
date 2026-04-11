

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File.js');

const router = express.Router();

// Configure Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const filename = crypto.randomUUID() + '-' + file.originalname;
        cb(null, filename);
    }
});

const upload = multer({ storage });

// POST /api/upload
router.post(
    '/upload',
    // AUTH MIDDLEWARE GOES HERE
    // QUOTA MIDDLEWARE GOES HERE
    upload.single('file'),
    async (req, res) => {
        try {
            const { userId, folderId } = req.body;

            if (!req.file) {
                return res.json({ success: false, error: 'No file uploaded' });
            }

            if (!userId) {
                return res.json({ success: false, error: 'userId is required' });
            }

            const saved = await File.create({
                originalName: req.file.originalname,
                storedName: req.file.filename,
                mimeType: req.file.mimetype,
                size: req.file.size,
                path: path.join(__dirname, '../uploads', req.file.filename),
                owner: userId,
                folderId: folderId || null,
                shareToken: null,
            });

            return res.json({
                success: true,
                data: {
                    id: saved._id,
                    originalName: saved.originalName,
                    mimeType: saved.mimeType,
                    size: saved.size,
                    folderId: saved.folderId,
                    shareToken: null,
                    createdAt: saved.createdAt,
                },
            });
        } catch (err) {
            return res.json({ success: false, error: err.message });
        }
    }
);

// GET /api/download/:fileId
router.get('/download/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = await File.findById(fileId);

        if (!file) {
            return res.json({ success: false, error: 'File not found' });
        }

        // AUTH OWNERSHIP CHECK GOES HERE after M3 middleware is added
        return res.download(file.path, file.originalName, (err) => {
            if (err) {
                return res.json({ success: false, error: 'File could not be downloaded' });
            }
        });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

// DELETE /api/files/:fileId
router.delete('/files/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const file = await File.findById(fileId);

        if (!file) {
            return res.json({ success: false, error: 'File not found' });
        }

        // Try to delete from disk, but continue even if it fails
        try {
            fs.unlinkSync(file.path);
        } catch (diskErr) {
            // File doesn't exist on disk, but we'll delete the DB record anyway
        }

        await File.deleteOne({ _id: fileId });
        // M2 handles quota recalculation after this line

        return res.json({ success: true, data: { message: 'File deleted' } });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

// PATCH /api/files/:fileId/move
router.patch('/files/:fileId/move', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const { targetFolderId } = req.body;

        if (targetFolderId === undefined) {
            return res.json({ success: false, error: 'targetFolderId is required' });
        }

        const file = await File.findById(fileId);

        if (!file) {
            return res.json({ success: false, error: 'File not found' });
        }

        file.folderId = targetFolderId;
        const updatedFile = await file.save();
        // File stays on disk, only DB record changes

        return res.json({ success: true, data: updatedFile });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

// Error handling middleware for Multer errors
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.json({ success: false, error: err.message });
    }
    if (err) {
        return res.json({ success: false, error: err.message });
    }
    next();
});

module.exports = router;    

