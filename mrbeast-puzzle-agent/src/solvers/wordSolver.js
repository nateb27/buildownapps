/**
 * Word-level puzzle solvers: anagrams, pattern matching, crossword helpers.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Common English words dictionary (loaded lazily)
let DICTIONARY = null;

function loadDictionary() {
  if (DICTIONARY) return DICTIONARY;
  // Try system dictionary first, fall back to a bundled one
  const paths = [
    '/usr/share/dict/words',
    '/usr/share/dict/american-english',
    path.join(__dirname, '..', '..', 'data', 'words.txt')
  ];
  for (const p of paths) {
    try {
      const words = fs.readFileSync(p, 'utf8').split('\n').filter(w => w.length > 0);
      DICTIONARY = new Set(words.map(w => w.toLowerCase().trim()));
      return DICTIONARY;
    } catch { /* try next */ }
  }
  console.warn('No dictionary found. Word validation will be limited.');
  DICTIONARY = new Set();
  return DICTIONARY;
}

/**
 * Check if a word is in the dictionary
 */
export function isWord(word) {
  return loadDictionary().has(word.toLowerCase());
}

/**
 * Find all anagrams of the given letters
 */
export function findAnagrams(letters, minLength = 3) {
  const dict = loadDictionary();
  const sorted = letters.toLowerCase().split('').sort().join('');
  const results = [];

  for (const word of dict) {
    if (word.length < minLength || word.length > letters.length) continue;
    const wordSorted = word.split('').sort().join('');
    if (isSubMultiset(wordSorted, sorted)) {
      results.push(word);
    }
  }

  return results.sort((a, b) => b.length - a.length);
}

function isSubMultiset(sub, sup) {
  let i = 0, j = 0;
  while (i < sub.length && j < sup.length) {
    if (sub[i] === sup[j]) { i++; j++; }
    else if (sub[i] > sup[j]) { j++; }
    else return false;
  }
  return i === sub.length;
}

/**
 * Find words matching a pattern (? for unknown letters)
 * E.g., "E?DG?ME" -> "ENDGAME"
 */
export function patternMatch(pattern, wordList) {
  const dict = wordList || loadDictionary();
  const regex = new RegExp('^' + pattern.toLowerCase().replace(/\?/g, '[a-z]') + '$');
  const results = [];
  for (const word of dict) {
    if (regex.test(word)) results.push(word);
  }
  return results;
}

/**
 * Find words of a specific length
 */
export function wordsOfLength(length) {
  const dict = loadDictionary();
  return [...dict].filter(w => w.length === length);
}

/**
 * Find words containing specific letters at specific positions
 * positions: { 0: 'e', 3: 'g' } means letter 'e' at position 0, 'g' at position 3
 */
export function findWordsWithConstraints(length, positions) {
  const dict = loadDictionary();
  return [...dict].filter(word => {
    if (word.length !== length) return false;
    for (const [pos, letter] of Object.entries(positions)) {
      if (word[parseInt(pos)] !== letter.toLowerCase()) return false;
    }
    return true;
  });
}

/**
 * Crossword clue solver: find words fitting length and known letters
 */
export function crosswordSolve(pattern) {
  // Pattern like "E_D_A_E" where _ is unknown
  return patternMatch(pattern.replace(/_/g, '?'));
}

/**
 * Find words that could be part of the 9-word meta clue
 * Word lengths: 5, 9, 5, 7, 8, 4, 9, 6, 5
 */
export function findMetaCandidates(position) {
  const META_LENGTHS = [5, 9, 5, 7, 8, 4, 9, 6, 5];
  if (position < 0 || position > 8) return [];
  return wordsOfLength(META_LENGTHS[position]);
}

/**
 * Score how likely a string is to be meaningful English
 */
export function englishScore(text) {
  const words = text.toLowerCase().split(/\s+/);
  const dict = loadDictionary();
  let matchCount = 0;
  for (const word of words) {
    if (dict.has(word)) matchCount++;
  }
  return words.length > 0 ? matchCount / words.length : 0;
}

/**
 * Generate common puzzle-related word transformations
 */
export function wordTransformations(word) {
  const w = word.toUpperCase();
  return {
    original: w,
    reversed: w.split('').reverse().join(''),
    firstLetters: w[0],
    lastLetters: w[w.length - 1],
    length: w.length,
    letterValues: w.split('').map(c => c.charCodeAt(0) - 64),
    letterSum: w.split('').reduce((sum, c) => sum + (c.charCodeAt(0) - 64), 0),
    isAnagram: (other) => {
      return w.split('').sort().join('') === other.toUpperCase().split('').sort().join('');
    }
  };
}
