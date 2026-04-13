const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  totalStorageLimit: { type: Number, required: true, default: 10 * 1024 * 1024 * 1024 },
  maxUserQuota: { type: Number, required: true, default: 500 * 1024 * 1024 },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
