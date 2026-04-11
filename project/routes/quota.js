const express = require('express');
const auth = require('../middleware/auth');
const { getQuota } = require('../services/quotaManager');

const router = express.Router();

router.get('/quota', auth, async (req, res) => {
	try {
		const userId = req.session?.userId || req.user?.id || req.query.userId;

		if (!userId) {
			return res.status(400).json({ success: false, error: 'userId is required' });
		}

		const quota = await getQuota(userId);

		return res.json({
			success: true,
			data: quota,
		});
	} catch (err) {
		const status = err.message === 'User not found' ? 404 : 500;
		return res.status(status).json({ success: false, error: err.message });
	}
});

module.exports = router;
