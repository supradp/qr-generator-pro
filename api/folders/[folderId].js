// api/folders/[folderId].js
const { deleteFolder, getAllFolders } = require('../_lib/store');
const { requireAuth } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { folderId } = req.query;

  if (req.method === 'DELETE') {
    const folders = await getAllFolders();
    if (!folders.some(f => f.id === folderId)) return res.status(404).json({ error: 'Not found' });
    await deleteFolder(folderId);
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
