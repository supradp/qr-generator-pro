// api/folders.js
const { getAllFolders, createFolder } = require('./_lib/store');
const { requireAuth } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method === 'GET') {
    const folders = await getAllFolders();
    return res.json(folders);
  }

  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Назва папки обов\'язкова' });
    if (name.trim().length > 60) return res.status(400).json({ error: 'Назва надто довга' });
    const folder = await createFolder({ name });
    return res.status(201).json(folder);
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
