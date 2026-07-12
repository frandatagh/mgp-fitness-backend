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
    fileSize: 8 * 1024 * 1024,
  },
});

let isProcessingOcr = false;

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[|¦]/g, '|')
    .trim();
}

async function preprocessImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 1800,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .linear(1.25, -15)
    .sharpen()
    .png()
    .toBuffer();
}

function safeExtractBox(metadata, box) {
  const imageWidth = metadata.width || 1;
  const imageHeight = metadata.height || 1;

  const left = Math.max(0, Math.floor(imageWidth * box.left));
  const top = Math.max(0, Math.floor(imageHeight * box.top));

  const width = Math.min(
    imageWidth - left,
    Math.floor(imageWidth * box.width)
  );

  const height = Math.min(
    imageHeight - top,
    Math.floor(imageHeight * box.height)
  );

  return {
    left,
    top,
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

async function createFastVariants(buffer) {
  const metadata = await sharp(buffer).rotate().metadata();

  const fullImage = await preprocessImage(buffer);

  const tableFullBox = safeExtractBox(metadata, {
    left: 0.06,
    top: 0.22,
    width: 0.88,
    height: 0.58,
  });

  const tableMiddleBox = safeExtractBox(metadata, {
    left: 0.06,
    top: 0.34,
    width: 0.88,
    height: 0.42,
  });

  const tableFullCrop = await sharp(buffer)
    .rotate()
    .extract(tableFullBox)
    .png()
    .toBuffer();

  const tableMiddleCrop = await sharp(buffer)
    .rotate()
    .extract(tableMiddleBox)
    .png()
    .toBuffer();

  return [
    {
      name: 'full_fast',
      buffer: fullImage,
      psm: '6',
    },
  ];

  for (const box of cropBoxes) {
    const extractBox = safeExtractBox(metadata, box);

    const cropBuffer = await sharp(buffer)
      .rotate()
      .extract(extractBox)
      .png()
      .toBuffer();

    variants.push({
      name: `${box.name}_highContrast`,
      buffer: await preprocessImage(cropBuffer),
      psm: '6',
    });
  }

  return variants;
}

function cleanOcrText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[|¦]/g, '|')
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
    'kg',
  ];

  const wordScore = exerciseWords.reduce((total, word) => {
    return total + (lower.includes(word) ? 8 : 0);
  }, 0);

  const numberScore = (text.match(/\b\d{1,3}\b/g) || []).length * 1.5;
  const kgScore = (lower.match(/\bkg\b/g) || []).length * 5;
  const rowScore = (text.match(/\b\d{1,2}\s*[\.\)]/g) || []).length * 5;

  return wordScore + numberScore + kgScore + rowScore;
}

async function runOcrVariant(variant) {
  console.log(`Procesando OCR: ${variant.name}`);

  const result = await recognize(variant.buffer, 'spa+eng', {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        const progress = Math.round((message.progress || 0) * 100);

        if (progress === 0 || progress === 50 || progress === 100) {
          console.log(`OCR ${variant.name}: ${progress}%`);
        }
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

function normalizeLineForDedup(line) {
  return line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function combineTexts(results) {
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const lines = [];

  for (const result of sorted) {
    const resultLines = result.rawText
      .split(/\n/)
      .map((line) => cleanOcrText(line))
      .filter(Boolean);

    lines.push(...resultLines);
  }

  const seen = new Set();

  return lines
    .filter((line) => {
      const key = normalizeLineForDedup(line);

      if (!key) return false;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .join('\n');
}

router.post('/routine-image', upload.single('image'), async (req, res, next) => {
  if (isProcessingOcr) {
    return res.status(429).json({
      message: 'Ya hay un escaneo en proceso. Esperá unos segundos e intentá de nuevo.',
    });
  }

  try {
    isProcessingOcr = true;

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

    const variants = await createFastVariants(req.file.buffer);

    console.log(`OCR variantes a procesar: ${variants.length}`);

    const results = [];

    for (const variant of variants) {
      const result = await runOcrVariant(variant);

      console.log(`Resultado ${result.name}: score ${result.score}`);
      console.log(result.rawText);

      results.push(result);
    }

    const bestResult = [...results].sort((a, b) => b.score - a.score)[0];
    const combinedText = combineTexts(results);

    console.log('\n================ OCR TEXTO FINAL ================');
    console.log(combinedText || bestResult.rawText);
    console.log('================ FIN OCR TEXTO FINAL ================\n');

    return res.json({
      rawText: combinedText || bestResult.rawText,
      debug: {
        bestVariant: bestResult.name,
        bestScore: bestResult.score,
        variantsCount: results.length,
      },
    });
  } catch (error) {
    console.error('Error procesando OCR:', error);
    next(error);
  } finally {
    isProcessingOcr = false;
  }
});

export default router;