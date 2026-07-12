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
  'kg',
];

async function getImageMetadata(buffer) {
  return sharp(buffer).rotate().metadata();
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

async function preprocessImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: 2200,
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .linear(1.35, -20)
    .sharpen()
    .png()
    .toBuffer();
}

async function createImageVariants(buffer) {
  const metadata = await getImageMetadata(buffer);

  const fullImage = await preprocessImage(buffer);

  const cropBoxes = [
    {
      name: 'table_full',
      left: 0.07,
      top: 0.22,
      width: 0.86,
      height: 0.58,
    },
    {
      name: 'table_top',
      left: 0.07,
      top: 0.22,
      width: 0.86,
      height: 0.26,
    },
    {
      name: 'table_middle',
      left: 0.07,
      top: 0.38,
      width: 0.86,
      height: 0.26,
    },
    {
      name: 'table_bottom',
      left: 0.07,
      top: 0.54,
      width: 0.86,
      height: 0.26,
    },
  ];

  const variants = [
    {
      name: 'full_highContrast',
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

  const wordScore = exerciseWords.reduce((total, word) => {
    return total + (lower.includes(word) ? 7 : 0);
  }, 0);

  const numberScore = (text.match(/\b\d{1,3}\b/g) || []).length * 1.5;
  const kgScore = (lower.match(/\bkg\b/g) || []).length * 5;
  const rowScore = (text.match(/\b\d{1,2}\s*[\.\)]/g) || []).length * 4;
  const lengthScore = Math.min(text.length / 70, 25);

  return wordScore + numberScore + kgScore + rowScore + lengthScore;
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
    tessedit_pageseg_mode: variant.psm || '6',
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

function combineUsefulOcrTexts(results) {
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const selectedResults = sorted.slice(0, 3);

  const lines = [];

  for (const result of selectedResults) {
    const resultLines = result.rawText
      .split(/\n/)
      .map((line) => cleanOcrText(line))
      .filter(Boolean);

    for (const line of resultLines) {
      lines.push(line);
    }
  }

  const seen = new Set();

  const uniqueLines = lines.filter((line) => {
    const key = normalizeLineForDedup(line);

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  return uniqueLines.join('\n');
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

    console.log(`OCR variantes a procesar: ${variants.length}`);

    const results = [];

    for (const variant of variants) {
      console.log(`\nProcesando variante OCR: ${variant.name}`);

      const result = await runOcrVariant(variant);

      console.log(`Resultado variante ${variant.name}: score ${result.score}`);
      console.log(result.rawText);

      results.push(result);
    }

    const bestResult = [...results].sort((a, b) => b.score - a.score)[0];
    const combinedText = combineUsefulOcrTexts(results);

    console.log('\n================ OCR MEJOR RESULTADO ================');
    console.log('Variante:', bestResult.name);
    console.log('Score:', bestResult.score);
    console.log(bestResult.rawText);
    console.log('================ FIN OCR MEJOR RESULTADO ================\n');

    console.log('\n================ OCR TEXTO COMBINADO ================');
    console.log(combinedText);
    console.log('================ FIN OCR TEXTO COMBINADO ================\n');

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
  }
});

export default router;