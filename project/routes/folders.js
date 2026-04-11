const express = require('express');
const auth = require('../middleware/auth');
const {
	mapFolder,
	createFolder,
	listFolderContents,
	deleteFolderTree,
} = require('../services/metadataService');
const { removeFileFromDisk } = require('../services/fileHandler');
const { subtractUsage } = require('../services/quotaManager');

const router = express.Router();

router.use(auth);

router.post('/', async (req, res) => {
	const { name, parentId } = req.body;

	if (!name || !name.trim()) {
		return res.status(400).json({ success: false, error: 'Folder name is required' });
	}

    try {
        const folder = await createFolder(req.user.id, name.trim(), parentId || null);
		return res.json({
			success: true,
			data: mapFolder(folder),
		});
    } catch (error) {
		return res.status(500).json({ success: false, error: 'Failed to create folder' });
    }
});

router.get('/:folderId', async (req, res) => {
    try {
		const { folderId } = req.params;
		const data = await listFolderContents(req.user.id, folderId);

		return res.json({
			success: true,
			data,
		});
    } catch (error) {
		return res.status(500).json({ success: false, error: 'Failed to fetch folders and files' });
    }
});

router.delete('/:folderId', async (req, res) => {
	try {
		const { folderId } = req.params;

		if (folderId === 'root') {
			return res.status(400).json({ success: false, error: 'Cannot delete root folder' });
		}

		const deletion = await deleteFolderTree(req.user.id, folderId);
		if (!deletion) {
			return res.status(404).json({ success: false, error: 'Folder not found' });
		}

		for (const filePath of deletion.deletedFilePaths) {
			await removeFileFromDisk(filePath);
		}

		await subtractUsage(req.user.id, deletion.deletedBytes);

		return res.json({
			success: true,
			data: {
				message: 'Folder deleted',
				deletedFolders: deletion.deletedFoldersCount,
				deletedFiles: deletion.deletedFilesCount,
			},
		});
	} catch (error) {
		return res.status(500).json({ success: false, error: 'Failed to delete folder' });
	}
});

module.exports = router;
