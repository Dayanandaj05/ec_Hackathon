const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        req.user = {
            id: user._id,
            username: user.username,
            quotaUsed: user.quotaUsed,
            quotaLimit: user.quotaLimit
        };

        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
};

module.exports = authMiddleware;
