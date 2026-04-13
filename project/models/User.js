const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: { type: String, enum: ['user', 'admin'], default: 'user' },
	quotaUsed: { type: Number, default: 0 },
	quotaLimit: { type: Number, default: 524288000 },
});

module.exports = mongoose.model('User', userSchema);
