const File = require('../models/File');
const Folder = require('../models/Folder');

function mapFile(file) {
  return {
    id: file._id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    folderId: file.folderId,
    shareToken: file.shareToken,
    createdAt: file.createdAt,
  };
}

function mapFolder(folder) {
  return {
    id: folder._id,
    name: folder.name,
    parentId: folder.parentId,
  };
}

async function createFileRecord(payload) {
  return File.create(payload);
}

async function getOwnedFile(ownerId, fileId) {
  return File.findOne({ _id: fileId, owner: ownerId });
}

async function deleteOwnedFile(ownerId, fileId) {
  const file = await File.findOne({ _id: fileId, owner: ownerId });
  if (!file) {
    return null;
  }

  await File.deleteOne({ _id: fileId });
  return file;
}

async function moveOwnedFile(ownerId, fileId, targetFolderId) {
  const file = await File.findOne({ _id: fileId, owner: ownerId });
  if (!file) {
    return null;
  }

  file.folderId = targetFolderId;
  const updated = await file.save();
  return updated;
}

async function createFolder(ownerId, name, parentId) {
  return Folder.create({
    name,
    owner: ownerId,
    parentId: parentId || null,
  });
}

async function listFolderContents(ownerId, folderId) {
  const queryParentId = folderId === 'root' ? null : folderId;

  const folders = await Folder.find({ parentId: queryParentId, owner: ownerId }).sort({ name: 1 });
  const files = await File.find({ folderId: queryParentId, owner: ownerId }).sort({ createdAt: -1 });

  return {
    folders: folders.map(mapFolder),
    files: files.map(mapFile),
  };
}

async function getDescendantFolderIds(ownerId, rootFolderId) {
  const collected = [rootFolderId];
  const queue = [rootFolderId];

  while (queue.length) {
    const current = queue.shift();
    const children = await Folder.find({ owner: ownerId, parentId: current }).select('_id');

    for (const child of children) {
      const id = String(child._id);
      collected.push(id);
      queue.push(id);
    }
  }

  return collected;
}

async function deleteFolderTree(ownerId, folderId) {
  const rootFolder = await Folder.findOne({ _id: folderId, owner: ownerId });
  if (!rootFolder) {
    return null;
  }

  const folderIds = await getDescendantFolderIds(ownerId, String(rootFolder._id));
  const files = await File.find({ owner: ownerId, folderId: { $in: folderIds } });

  const totalBytes = files.reduce((acc, file) => acc + (file.size || 0), 0);

  await File.deleteMany({ owner: ownerId, folderId: { $in: folderIds } });
  await Folder.deleteMany({ owner: ownerId, _id: { $in: folderIds } });

  return {
    deletedFoldersCount: folderIds.length,
    deletedFilesCount: files.length,
    deletedBytes: totalBytes,
    deletedFilePaths: files.map((file) => file.path),
  };
}

async function searchFiles(ownerId, q) {
  if (!q || !q.trim()) {
    return [];
  }

  const files = await File.find({
    owner: ownerId,
    originalName: { $regex: q.trim(), $options: 'i' },
  }).sort({ createdAt: -1 });

  return files.map(mapFile);
}

module.exports = {
  mapFile,
  mapFolder,
  createFileRecord,
  getOwnedFile,
  deleteOwnedFile,
  moveOwnedFile,
  createFolder,
  listFolderContents,
  deleteFolderTree,
  searchFiles,
};
