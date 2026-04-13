
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const User = require('./models/User');

require('dotenv').config();

const app = express();
const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'hackathon-secret',
    resave: false,
    saveUninitialized: false,
}));

app.get('/share/:token', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'share.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const fileRoutes = require('./routes/files');
const foldersRoutes = require('./routes/folders');
const shareRoutes = require('./routes/share');
const quotaRoutes = require('./routes/quota');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const dbUser = await User.findOne({ username, password });
        if (!dbUser) {
            return res.json({ success: false, error: 'Invalid credentials' });
        }

        req.session.userId = dbUser._id;
        return res.json({
            success: true,
            data: {
                userId: dbUser._id,
                username: dbUser.username,
                role: dbUser.role,
            },
        });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, data: { message: 'Logged out' } });
    });
});

app.use('/api', require('./routes/files'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api', require('./routes/share'));
app.use('/api', require('./routes/quota'));
app.use('/api', require('./routes/search'));
app.use('/api/admin', adminRoutes);

mongoose.connect(MONGO_URI)
.then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});