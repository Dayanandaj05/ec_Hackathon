const express = require('express');
const auth = require('../middleware/auth');
const { searchFiles } = require('../services/metadataService');

const router = express.Router();

router.get('/search', auth, async (req, res) => {
	try {
		const q = (req.query.q || '').trim();
		const userId = req.session?.userId || req.user?.id || req.query.userId;

		if (!userId) {
			return res.status(400).json({ success: false, error: 'userId is required' });
		}

		if (!q) {
			return res.json({ success: true, data: { files: [] } });
		}

		const result = await searchFiles(userId, q);

		return res.json({ success: true, data: { files: result } });
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message });
	}
});

module.exports = router;
