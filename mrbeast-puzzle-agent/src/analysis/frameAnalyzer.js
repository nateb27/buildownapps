/**
 * Video frame analysis module.
 * Processes video frames to find hidden clues, text, codes, and patterns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, '..', '..', 'data', 'frames');

/**
 * Known video playlist for the puzzle (9 MrBeast videos with pinned puzzle comments)
 */
export const PUZZLE_VIDEOS = [
  { position: 1, title: 'Video 1', frameCount: 769, status: 'analyzed' },
  { position: 2, title: 'Video 2', frameCount: 1441, status: 'analyzed' },
  { position: 3, title: 'Video 3 (Red Herring)', frameCount: 1234, status: 'analyzed' },
  { position: 4, title: 'Super Bowl Ad', frameCount: 3476, status: 'partial' },
  { position: 5, title: 'Video 5', frameCount: null, status: 'pending' },
  { position: 6, title: 'Video 6', frameCount: null, status: 'pending' },
  { position: 7, title: 'Video 7', frameCount: null, status: 'pending' },
  { position: 8, title: 'Video 8', frameCount: null, status: 'pending' },
  { position: 9, title: 'Video 9', frameCount: null, status: 'pending' },
];

/**
 * Known frame findings from community analysis
 */
export const KNOWN_FINDINGS = {
  video1: {
    frames: 769,
    status: 'complete',
    findings: [
      'Contains street scene clues',
      'Multiple cipher inputs found',
    ]
  },
  video2: {
    frames: 1441,
    status: 'complete',
    findings: [
      'Number 27 appears prominently in title',
      'License plate patterns detected',
      'Logo features detected',
    ]
  },
  video3: {
    frames: 1234,
    status: 'complete',
    findings: [
      'CONFIRMED RED HERRING',
      'Extended acrostic reads: "this means nothing I just wanted to waste your time lol"',
      'Troll message from puzzle designers',
    ]
  },
  superBowlAd: {
    frames: 3476,
    status: 'partial (36%)',
    findings: [
      'Barclay Hotel visible: 103 W 4th St, Los Angeles, CA 90013',
      'The Row DTLA: 777 S Alameda St (triple-7s)',
      'Barcode on armored tank with parking violation',
      'Teller has dates circled in red on desk calendars',
      'QR code decodes to: https://sforce.co/4bAAGMH?r=qr',
      'Street scene elements are cipher inputs for bank puzzles',
      'Bank scenes require street-scene answers as inputs',
      'Vault door shows 4-8-15-16-23-42 (Lost numbers, sum=108)',
    ]
  }
};

/**
 * Analyze a single frame image for puzzle clues
 * (Requires sharp for image processing)
 */
export async function analyzeFrame(framePath) {
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(framePath);
    const metadata = await image.metadata();

    // Basic analysis
    const stats = await image.stats();
    const analysis = {
      path: framePath,
      dimensions: { width: metadata.width, height: metadata.height },
      format: metadata.format,
      channels: metadata.channels,
      dominantColors: stats.channels.map(c => ({
        mean: Math.round(c.mean),
        min: c.min,
        max: c.max,
      })),
    };

    // Check for text-like regions (high contrast areas)
    const grayscale = await image.grayscale().raw().toBuffer();
    analysis.highContrastRegions = findHighContrastRegions(grayscale, metadata.width, metadata.height);

    // Check for QR code-like patterns
    analysis.hasQRPattern = detectQRPattern(grayscale, metadata.width, metadata.height);

    return analysis;
  } catch (error) {
    return { path: framePath, error: error.message };
  }
}

function findHighContrastRegions(buffer, width, height) {
  const regions = [];
  const blockSize = 32;

  for (let y = 0; y < height - blockSize; y += blockSize) {
    for (let x = 0; x < width - blockSize; x += blockSize) {
      let min = 255, max = 0;
      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const val = buffer[(y + by) * width + (x + bx)];
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
      if (max - min > 200) {
        regions.push({ x, y, contrast: max - min });
      }
    }
  }

  return regions.slice(0, 20);
}

function detectQRPattern(buffer, width, height) {
  // Simplified QR detection: look for finder patterns (dark-light-dark-light-dark in 1:1:3:1:1 ratio)
  const scanLines = [
    Math.floor(height * 0.1),
    Math.floor(height * 0.5),
    Math.floor(height * 0.9),
  ];

  for (const y of scanLines) {
    let runs = [];
    let currentVal = buffer[y * width] > 128 ? 1 : 0;
    let runLength = 1;

    for (let x = 1; x < width; x++) {
      const val = buffer[y * width + x] > 128 ? 1 : 0;
      if (val === currentVal) {
        runLength++;
      } else {
        runs.push({ val: currentVal, len: runLength });
        currentVal = val;
        runLength = 1;
      }
    }

    // Check for 1:1:3:1:1 pattern
    for (let i = 0; i < runs.length - 4; i++) {
      if (runs[i].val === 0) {
        const r = runs.slice(i, i + 5).map(r => r.len);
        const unit = r[0];
        if (unit > 3 &&
            Math.abs(r[1] - unit) < unit * 0.5 &&
            Math.abs(r[2] - unit * 3) < unit * 1.5 &&
            Math.abs(r[3] - unit) < unit * 0.5 &&
            Math.abs(r[4] - unit) < unit * 0.5) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Extract frames from a video file using ffmpeg
 */
export async function extractFrames(videoPath, outputDir, fps = 1) {
  const { execSync } = await import('child_process');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  try {
    execSync(`ffmpeg -i "${videoPath}" -vf "fps=${fps}" "${outputDir}/frame_%05d.png" -y`, {
      stdio: 'pipe',
      timeout: 300000,
    });
    const frames = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
    return frames.map(f => path.join(outputDir, f));
  } catch (error) {
    throw new Error(`Frame extraction failed: ${error.message}`);
  }
}

/**
 * Get analysis summary of all known video findings
 */
export function getAnalysisSummary() {
  return {
    videos: PUZZLE_VIDEOS,
    findings: KNOWN_FINDINGS,
    meta: {
      totalFramesAnalyzed: 769 + 1441 + 1234 + 1239,
      totalFrames: 769 + 1441 + 1234 + 3476,
      completionRate: ((769 + 1441 + 1234 + 1239) / (769 + 1441 + 1234 + 3476) * 100).toFixed(1) + '%',
    }
  };
}
