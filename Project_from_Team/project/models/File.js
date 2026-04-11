const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName:   { type: String, required: true },
  mimeType:     { type: String, required: true },
  size:         { type: Number, required: true },
  path:         { type: String, required: true },
  owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  shareToken:   { type: String, default: null },
  createdAt:    { type: Date, default: Date.now },
});

module.exports = mongoose.model('File', fileSchema);