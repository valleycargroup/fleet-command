import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../lib/auth';
import { uploadBufferToStorage, deleteFromStorage, generateStorageKey } from '../lib/storage';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_FILE_TYPES = ['application/pdf', ...ALLOWED_IMAGE_TYPES];

function folderFromQuery(req: Request): 'images' | 'files' {
  return req.query.folder === 'files' ? 'files' : 'images';
}

// POST /api/uploads — single file
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const folder = folderFromQuery(req);
    const allowed = folder === 'files' ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `File type not allowed: ${req.file.mimetype}` });
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = generateStorageKey(folder, ext);
    const result = await uploadBufferToStorage({ key, body: req.file.buffer, contentType: req.file.mimetype });
    res.json({ ok: true, data: { key: result.key, url: result.url, size: req.file.size, mimetype: req.file.mimetype } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/uploads/many — up to 10 files
router.post('/many', requireAuth, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files provided' });
    const folder = folderFromQuery(req);
    const allowed = folder === 'files' ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;
    const results = await Promise.all(
      files.map(async (f) => {
        if (!allowed.includes(f.mimetype)) throw new Error(`File type not allowed: ${f.mimetype}`);
        const ext = path.extname(f.originalname).toLowerCase();
        const key = generateStorageKey(folder, ext);
        const result = await uploadBufferToStorage({ key, body: f.buffer, contentType: f.mimetype });
        return { key: result.key, url: result.url, size: f.size, mimetype: f.mimetype };
      })
    );
    res.json({ ok: true, data: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/uploads/:key — delete by key (e.g. images/uuid.jpg)
router.delete('/:folder/:filename', requireAuth, async (req: Request, res: Response) => {
  try {
    const key = `${req.params.folder}/${req.params.filename}`;
    await deleteFromStorage(key);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
