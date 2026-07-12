import express from 'express';
import multer from 'multer';
import tesseract from 'tesseract.js';
import { verifyToken } from '../middlewares/auth.js';

const { recognize } = tesseract;

const router = express.Router();

router.use(verifyToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB
  },
});

router.post('/routine-image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'No se recibió ninguna imagen.',
      });
    }

    console.log('OCR recibido:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.user?.id,
    });

    const result = await recognize(req.file.buffer, 'spa+eng', {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          console.log(
            `OCR progreso: ${Math.round((message.progress || 0) * 100)}%`
          );
        }
      },
    });

    const rawText = result?.data?.text?.trim() ?? '';

    return res.json({
      rawText,
    });
  } catch (error) {
    console.error('Error procesando OCR:', error);
    next(error);
  }
});

export default router;