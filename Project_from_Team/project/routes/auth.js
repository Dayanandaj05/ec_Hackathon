const express = require('express');
const User = require('../models/User');

const router = express.Router();

// POST /api/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        res.json({ success: true, data: { userId: user._id, username: user.username } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// POST /api/logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Logout failed' });
        }
        res.json({ success: true, data: { message: 'Logged out' } });
    });
});

module.exports = router;
