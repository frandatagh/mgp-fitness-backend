import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';

import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(verifyToken);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

let isProcessingOcr = false;

const PADDLE_OCR_URL =
  process.env.PADDLE_OCR_URL || 'http://localhost:8001/ocr/routine';

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

router.post('/routine-image', upload.single('image'), async (req, res, next) => {
  if (isProcessingOcr) {
    return res.status(429).json({
      message:
        'Ya hay un escaneo en proceso. Esperá unos segundos e intentá de nuevo.',
    });
  }

  try {
    isProcessingOcr = true;

    if (!req.file) {
      return res.status(400).json({
        message: 'No se recibió ninguna imagen.',
      });
    }

    console.log('Imagen recibida para OCR Paddle:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.user?.id,
    });

    const formData = new FormData();

    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'routine-image.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    const paddleResponse = await axios.post(PADDLE_OCR_URL, formData, {
      headers: formData.getHeaders(),
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const rawText = cleanOcrText(paddleResponse.data?.text || '');

    console.log('\n================ OCR PADDLE TEXTO COMPLETO ================');
    console.log(rawText);
    console.log('================ FIN OCR PADDLE TEXTO COMPLETO ================\n');

    return res.json({
      rawText,
      source: 'paddleocr',
      debug: {
        lineCount: paddleResponse.data?.lineCount ?? null,
        serviceUrl: PADDLE_OCR_URL,
      },
    });
  } catch (error) {
    console.error('Error usando PaddleOCR:', {
      message: error.message,
      response: error.response?.data,
    });

    next(error);
  } finally {
    isProcessingOcr = false;
  }
});

export default router;