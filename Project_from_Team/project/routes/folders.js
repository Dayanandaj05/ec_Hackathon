const express = require('express');
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const File = require('../models/File');

const router = express.Router();

router.use(auth);

router.post('/', async (req, res) => {
    const { name, parentId } = req.body;
    try {
        const folder = await Folder.create({
            name,
            owner: req.user.id,
            parentId: parentId || null
        });
        res.json({
            success: true,
            data: {
                id: folder._id,
                name: folder.name,
                parentId: folder.parentId
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create folder' });
    }
});

router.get('/:folderId', async (req, res) => {
    const { folderId } = req.params;
    let queryParentId;
    if (folderId === 'root') {
        queryParentId = null;
    } else {
        queryParentId = folderId;
    }
    try {
        const folders = await Folder.find({ parentId: queryParentId, owner: req.user.id });
        const files = await File.find({ folderId: queryParentId, owner: req.user.id });
        const folderData = folders.map(f => ({
            id: f._id,
            name: f.name,
            parentId: f.parentId
        }));
        const fileData = files.map(f => ({
            id: f._id,
            originalName: f.originalName,
            mimeType: f.mimeType,
            size: f.size,
            folderId: f.folderId,
            shareToken: f.shareToken,
            createdAt: f.createdAt
        }));
        res.json({
            success: true,
            data: {
                folders: folderData,
                files: fileData
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch folders and files' });
    }
});

module.exports = router;
