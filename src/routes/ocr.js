import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import tesseract from 'tesseract.js';
import { verifyToken } from '../middlewares/auth.js';

const { recognize } = tesseract;

const router = express.Router();

router.use(verifyToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

async function prepareImageForOcr(buffer) {
  /**
   * Preprocesamiento para mejorar OCR:
   * - rota según metadatos EXIF
   * - agranda la imagen
   * - escala de grises
   * - mejora contraste
   * - enfoca texto
   */
  return sharp(buffer)
    .rotate()
    .resize({
      width: 1800,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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

    const processedImageBuffer = await prepareImageForOcr(req.file.buffer);

    const result = await recognize(processedImageBuffer, 'spa+eng', {
      logger: (message) => {
        if (message.status === 'recognizing text') {
          console.log(
            `OCR progreso: ${Math.round((message.progress || 0) * 100)}%`
          );
        }
      },
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });

    const rawText = cleanOcrText(result?.data?.text ?? '');

    console.log('\n================ OCR BACKEND TEXTO ================');
    console.log(rawText);
    console.log('================ FIN OCR BACKEND TEXTO ================\n');

    return res.json({
      rawText,
    });
  } catch (error) {
    console.error('Error procesando OCR:', error);
    next(error);
  }
});

export default router;