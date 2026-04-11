const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
	name: { type: String, required: true },
	owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
	parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
});

module.exports = mongoose.model('Folder', folderSchema);
