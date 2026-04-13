
const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const {
    uploadSingleFile,
    buildStoredPath,
    removeFileFromDisk,
    sendDownload,
} = require('../services/fileHandler');
const {
    mapFile,
    createFileRecord,
    hasDuplicateFileName,
    getOwnedFile,
    deleteOwnedFile,
    moveOwnedFile,
} = require('../services/metadataService');
const {
    ensureFileWithinLimit,
    ensureUserHasQuota,
    addUsage,
    subtractUsage,
} = require('../services/quotaManager');
const User = require('../models/User');
const recalculateQuota = require('../helpers/quota');

const router = express.Router();
router.use(authMiddleware);

router.post(
    '/upload',
    uploadSingleFile,
    async (req, res) => {
        try {
            const body = req.body || {};
            const userId = body.userId || req.session?.userId || req.user?.id;
            const folderId = body.folderId || null;

            if (!req.file) {
                return res.json({ success: false, error: 'No file uploaded' });
            }

            if (!userId) {
                return res.json({ success: false, error: 'userId is required' });
            }

            ensureFileWithinLimit(req.file.size);
            await ensureUserHasQuota(userId, req.file.size);

            const duplicateExists = await hasDuplicateFileName(
                userId,
                folderId || null,
                req.file.originalname
            );

            if (duplicateExists) {
                throw new Error('A file with the same name already exists in this folder.');
            }

            const saved = await createFileRecord({
                originalName: req.file.originalname,
                storedName: req.file.filename,
                mimeType: req.file.mimetype,
                size: req.file.size,
                path: buildStoredPath(req.file.filename),
                owner: userId,
                folderId: folderId || null,
                shareToken: null,
            });

            await addUsage(userId, req.file.size);
            await User.findByIdAndUpdate(userId, { $inc: { quotaUsed: req.file.size } });

            return res.json({
                success: true,
                data: mapFile(saved),
            });
        } catch (err) {
            if (req.file?.path) {
                await removeFileFromDisk(req.file.path);
            }
            return res.json({ success: false, error: err.message });
        }
    }
);

router.get('/download/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const ownerId = req.session?.userId || req.user?.id;
        const file = await getOwnedFile(ownerId, fileId);

        if (!file) {
            return res.json({ success: false, error: 'File not found' });
        }

        return sendDownload(res, file);
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

router.delete('/files/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const ownerId = req.session?.userId || req.user?.id;
        const file = await getOwnedFile(ownerId, fileId);

        if (!file) {
            return res.json({ success: false, error: 'File not found' });
        }

        await deleteOwnedFile(ownerId, fileId);
        await recalculateQuota(file.owner);
        await removeFileFromDisk(file.path);
        await subtractUsage(ownerId, file.size);

        return res.json({ success: true, data: { message: 'File deleted' } });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

router.patch('/files/:fileId/move', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const { targetFolderId } = req.body;

        if (targetFolderId === undefined) {
            return res.json({ success: false, error: 'targetFolderId is required' });
        }

        const ownerId = req.session?.userId || req.user?.id;
        const normalizedFolderId = targetFolderId === 'root' ? null : targetFolderId;
        const updatedFile = await moveOwnedFile(ownerId, fileId, normalizedFolderId);

        if (!updatedFile) {
            return res.json({ success: false, error: 'File not found' });
        }

        return res.json({ success: true, data: mapFile(updatedFile) });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, error: 'File exceeds 50 MB limit.' });
        }
        return res.json({ success: false, error: err.message });
    }
    if (err) {
        return res.json({ success: false, error: err.message });
    }
    next();
});

module.exports = router;

