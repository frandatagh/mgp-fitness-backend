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
    fileSize: 10 * 1024 * 1024,
  },
});

async function createImageVariants(buffer) {
  const original = await sharp(buffer)
    .rotate()
    .png()
    .toBuffer();

  const grayscale = await sharp(buffer)
    .rotate()
    .resize({
      width: 2400,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

  const highContrast = await sharp(buffer)
    .rotate()
    .resize({
      width: 2600,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .linear(1.35, -20)
    .sharpen()
    .png()
    .toBuffer();

  const threshold = await sharp(buffer)
    .rotate()
    .resize({
      width: 2600,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .threshold(165)
    .sharpen()
    .png()
    .toBuffer();

  return [
    { name: 'original', buffer: original },
    { name: 'grayscale', buffer: grayscale },
    { name: 'highContrast', buffer: highContrast },
    { name: 'threshold', buffer: threshold },
  ];
}

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function scoreOcrText(text) {
  const lower = text.toLowerCase();

  const exerciseWords = [
    'press',
    'banca',
    'inclinado',
    'aperturas',
    'jalón',
    'jalon',
    'remo',
    'sentadilla',
    'prensa',
    'curl',
    'bíceps',
    'biceps',
    'tríceps',
    'triceps',
    'abdominales',
    'series',
    'reps',
    'peso',
  ];

  const wordScore = exerciseWords.reduce((total, word) => {
    return total + (lower.includes(word) ? 5 : 0);
  }, 0);

  const numberScore = (text.match(/\b\d{1,3}\b/g) || []).length;

  const kgScore = (lower.match(/\bkg\b/g) || []).length * 3;

  const lengthScore = Math.min(text.length / 80, 20);

  return wordScore + numberScore + kgScore + lengthScore;
}

async function runOcrVariant(variant) {
  const result = await recognize(variant.buffer, 'spa+eng', {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        console.log(
          `OCR ${variant.name}: ${Math.round((message.progress || 0) * 100)}%`
        );
      }
    },
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
  });

  const rawText = cleanOcrText(result?.data?.text ?? '');

  return {
    name: variant.name,
    rawText,
    score: scoreOcrText(rawText),
  };
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

    const variants = await createImageVariants(req.file.buffer);

    const results = [];

    for (const variant of variants) {
      console.log(`\nProcesando variante OCR: ${variant.name}`);
      const result = await runOcrVariant(variant);

      console.log(`Resultado variante ${variant.name}: score ${result.score}`);
      console.log(result.rawText);

      results.push(result);
    }

    const bestResult = results.sort((a, b) => b.score - a.score)[0];

    console.log('\n================ OCR MEJOR RESULTADO ================');
    console.log('Variante:', bestResult.name);
    console.log('Score:', bestResult.score);
    console.log(bestResult.rawText);
    console.log('================ FIN OCR MEJOR RESULTADO ================\n');

    return res.json({
      rawText: bestResult.rawText,
      debug: {
        variant: bestResult.name,
        score: bestResult.score,
      },
    });
  } catch (error) {
    console.error('Error procesando OCR:', error);
    next(error);
  }
});

export default router;