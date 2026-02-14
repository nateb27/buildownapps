/**
 * Pattern detection engine: finds recurring numbers, words, and structures
 * across all collected data.
 */

/**
 * Known significant numbers in the puzzle
 */
export const SIGNIFICANT_NUMBERS = {
  3634826: { decoded: 'ENDGAME (phone keypad)', confidence: 0.9 },
  108: { decoded: 'Sum of Lost numbers (4+8+15+16+23+42)', confidence: 0.95 },
  27: { decoded: 'Recurring — MrBeast age? Video 2 title?', confidence: 0.7 },
  7: { decoded: 'Recurring — 777 address, position 7', confidence: 0.6 },
  14: { decoded: 'Recurring — double 7?', confidence: 0.5 },
  41: { decoded: 'Recurring', confidence: 0.4 },
  42: { decoded: 'Lost number, answer to everything', confidence: 0.8 },
  '4-8-15-16-23-42': { decoded: 'Lost TV numbers on vault door', confidence: 0.95 },
};

/**
 * Known keywords and their significance
 */
export const KEYWORD_MAP = {
  ISLAND: { category: 'location', significance: 0.7 },
  MALCOLM: { category: 'person', significance: 0.5 },
  INCREDIBLE: { category: 'adjective', significance: 0.5 },
  CANARY: { category: 'animal/code', significance: 0.6 },
  'BIG GAME': { category: 'event', significance: 0.6 },
  'RED HERRING': { category: 'warning', significance: 0.9 },
  PLAY: { category: 'action', significance: 0.6 },
  CLAY: { category: 'material/name', significance: 0.5 },
  MAYBELLE: { category: 'name', significance: 0.5 },
  OVERTIME: { category: 'time', significance: 0.5 },
  ENDGAME: { category: 'action/phase', significance: 0.9 },
  HIDE: { category: 'action', significance: 0.8 },
  BARCLAY: { category: 'location', significance: 0.7 },
  BEAST6000: { category: 'code', significance: 0.6 },
};

/**
 * Detect number patterns in a data stream
 */
export function detectNumberPatterns(numbers) {
  const patterns = [];

  // Check for arithmetic sequences
  if (numbers.length >= 3) {
    const diffs = numbers.slice(1).map((n, i) => n - numbers[i]);
    const isArithmetic = diffs.every(d => d === diffs[0]);
    if (isArithmetic) {
      patterns.push({ type: 'arithmetic', difference: diffs[0], sequence: numbers });
    }
  }

  // Check for geometric sequences
  if (numbers.length >= 3 && numbers.every(n => n > 0)) {
    const ratios = numbers.slice(1).map((n, i) => n / numbers[i]);
    const isGeometric = ratios.every(r => Math.abs(r - ratios[0]) < 0.001);
    if (isGeometric) {
      patterns.push({ type: 'geometric', ratio: ratios[0], sequence: numbers });
    }
  }

  // Check for Fibonacci-like
  if (numbers.length >= 3) {
    let isFib = true;
    for (let i = 2; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i-1] + numbers[i-2]) { isFib = false; break; }
    }
    if (isFib) patterns.push({ type: 'fibonacci-like', sequence: numbers });
  }

  // Check against known significant numbers
  for (const num of numbers) {
    const key = String(num);
    if (SIGNIFICANT_NUMBERS[key]) {
      patterns.push({ type: 'known-significant', number: num, ...SIGNIFICANT_NUMBERS[key] });
    }
  }

  // Check digit sums
  for (const num of numbers) {
    const digitSum = String(num).split('').reduce((s, d) => s + parseInt(d), 0);
    if (SIGNIFICANT_NUMBERS[String(digitSum)]) {
      patterns.push({ type: 'digit-sum-match', number: num, digitSum, significance: SIGNIFICANT_NUMBERS[String(digitSum)] });
    }
  }

  return patterns;
}

/**
 * Detect text patterns across multiple strings
 */
export function detectTextPatterns(texts) {
  const patterns = [];

  // Acrostic (first letters)
  const firstLetters = texts.map(t => t.trim()[0]).filter(Boolean).join('');
  if (firstLetters.length >= 3) {
    patterns.push({ type: 'acrostic', result: firstLetters });
  }

  // Last letters
  const lastLetters = texts.map(t => {
    const trimmed = t.trim();
    return trimmed[trimmed.length - 1];
  }).filter(Boolean).join('');
  if (lastLetters.length >= 3) {
    patterns.push({ type: 'telestich', result: lastLetters });
  }

  // Word lengths
  const wordLengths = texts.map(t => t.trim().length);
  patterns.push({ type: 'length-sequence', lengths: wordLengths });

  // Check if lengths match meta pattern
  const META_LENGTHS = [5, 9, 5, 7, 8, 4, 9, 6, 5];
  if (wordLengths.length === META_LENGTHS.length &&
      wordLengths.every((l, i) => l === META_LENGTHS[i])) {
    patterns.push({ type: 'META MATCH!', lengths: wordLengths, confidence: 1.0 });
  }

  return patterns;
}

/**
 * Cross-reference findings across different sources
 */
export function crossReference(clues) {
  const wordFrequency = {};
  const numberFrequency = {};

  for (const clue of clues) {
    const text = String(clue.raw_content || clue.rawContent || '');

    // Count word frequencies
    const words = text.toUpperCase().match(/[A-Z]{3,}/g) || [];
    for (const word of words) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }

    // Count number frequencies
    const nums = text.match(/\d+/g) || [];
    for (const num of nums) {
      numberFrequency[num] = (numberFrequency[num] || 0) + 1;
    }
  }

  // Sort by frequency
  const topWords = Object.entries(wordFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 30);
  const topNumbers = Object.entries(numberFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20);

  return { topWords, topNumbers };
}
