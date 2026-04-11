// Express server for file storage hackathon
// Port: 3000
// Middleware: cors, express.json, express.urlencoded
// Routes: /api mounted from routes/files.js
// MongoDB: connect via mongoose to mongodb://localhost:27017/filestorage
// Multer: configured in routes/files.js, not here

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// Middleware
// Required for M4 frontend on different port
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// SESSION SETUP GOES HERE when M3 provides it

// Routes
const fileRoutes = require('./routes/files');
app.use('/api', fileRoutes);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/filestorage', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
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