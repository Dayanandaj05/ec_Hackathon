const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId:  { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Folder', folderSchema);