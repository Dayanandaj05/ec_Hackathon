// Express server for file storage hackathon
// Port: 3000
// Middleware: cors, express.json, express.urlencoded
// Routes: /api mounted from routes/files.js
// MongoDB: connect via mongoose to mongodb://localhost:27017/filestorage
// Multer: configured in routes/files.js, not here

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const User = require('./models/User');

require('dotenv').config();

const app = express();
const PORT = 3000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
// Required for M4 frontend on different port
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'hackathon-secret',
    resave: false,
    saveUninitialized: false,
}));

// Routes
const fileRoutes = require('./routes/files');
const foldersRoutes = require('./routes/folders');
const shareRoutes = require('./routes/share');

const users = [
    { username: 'alice', password: 'pass1' },
    { username: 'bob', password: 'pass2' },
];

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find((u) => u.username === username && u.password === password);

        if (!user) {
            return res.json({ success: false, error: 'Invalid credentials' });
        }

        const dbUser = await User.findOne({ username: user.username });
        if (!dbUser) {
            return res.json({ success: false, error: 'Invalid credentials' });
        }

        req.session.userId = dbUser._id;
        return res.json({
            success: true,
            data: {
                userId: dbUser._id,
                username: dbUser.username,
            },
        });
    } catch (err) {
        return res.json({ success: false, error: err.message });
    }
});

app.use('/api', fileRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api', shareRoutes);

// Connect to MongoDB
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