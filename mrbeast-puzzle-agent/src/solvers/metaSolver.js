/**
 * Meta-puzzle solver: combines individual puzzle answers into the 9-word clue.
 * The 9-word meta-clue "defines the nature of the search."
 * Word lengths: 5, 9, 5, 7, 8, 4, 9, 6, 5
 */

import { getDb, getMetaClueProgress, setMetaClue } from '../db/database.js';
import { isWord, patternMatch, englishScore } from './wordSolver.js';

export const META_WORD_LENGTHS = [5, 9, 5, 7, 8, 4, 9, 6, 5];

/**
 * Get current meta-clue state
 */
export function getMetaState() {
  const progress = getMetaClueProgress();
  const state = META_WORD_LENGTHS.map((len, i) => {
    const entry = progress.find(p => p.position === i + 1);
    return {
      position: i + 1,
      requiredLength: len,
      word: entry?.word || null,
      confidence: entry?.confidence || 0,
      pattern: entry?.word || '_'.repeat(len),
    };
  });

  const known = state.filter(s => s.word).map(s => s.word);
  const total = state.length;
  const solved = known.length;

  return {
    words: state,
    phrase: state.map(s => s.pattern).join(' '),
    progress: `${solved}/${total}`,
    percentComplete: ((solved / total) * 100).toFixed(0) + '%',
  };
}

/**
 * Submit a candidate word for a meta position
 */
export function submitMetaWord(position, word, sourcePuzzleId, confidence) {
  if (position < 1 || position > 9) {
    return { success: false, error: 'Position must be 1-9' };
  }
  const expectedLen = META_WORD_LENGTHS[position - 1];
  if (word.length !== expectedLen) {
    return {
      success: false,
      error: `Word at position ${position} must be ${expectedLen} letters, got ${word.length}`,
    };
  }

  setMetaClue(position, word.toUpperCase(), expectedLen, sourcePuzzleId, confidence);
  return { success: true, position, word: word.toUpperCase() };
}

/**
 * Validate the complete meta-clue phrase
 */
export function validateMetaPhrase() {
  const state = getMetaState();
  const allFilled = state.words.every(w => w.word !== null);
  if (!allFilled) {
    return {
      valid: false,
      error: `Only ${state.progress} words found`,
      phrase: state.phrase,
    };
  }

  const phrase = state.words.map(w => w.word.toLowerCase()).join(' ');
  const score = englishScore(phrase);
  const allWords = state.words.every(w => isWord(w.word));

  return {
    valid: score > 0.6,
    phrase,
    englishScore: score,
    allDictionaryWords: allWords,
    confidence: state.words.reduce((sum, w) => sum + w.confidence, 0) / 9,
  };
}

/**
 * Generate candidate phrases by trying combinations of possible words
 */
export function generateCandidates(knownWords) {
  // knownWords: { [position]: string[] } - possible words for each position
  const state = getMetaState();
  const candidates = [];

  // For positions where we have candidates, score them
  for (const [pos, words] of Object.entries(knownWords)) {
    const position = parseInt(pos);
    const expectedLen = META_WORD_LENGTHS[position - 1];
    const validWords = words.filter(w => w.length === expectedLen && isWord(w));
    candidates.push({
      position,
      validCandidates: validWords.slice(0, 20),
      totalCandidates: validWords.length,
    });
  }

  return candidates;
}

/**
 * Analyze known decoded words to see if any fit meta positions
 */
export function analyzeKnownWords(decodedWords) {
  const fits = [];

  for (const word of decodedWords) {
    for (let i = 0; i < META_WORD_LENGTHS.length; i++) {
      if (word.length === META_WORD_LENGTHS[i]) {
        fits.push({
          word: word.toUpperCase(),
          position: i + 1,
          isValidWord: isWord(word),
        });
      }
    }
  }

  return fits;
}

/**
 * Known high-confidence decoded words from the community
 */
export const KNOWN_DECODED = {
  ENDGAME: { method: 'Phone keypad (3634826)', confidence: 0.9, length: 7, possiblePositions: [4] },
  HIDE: { method: 'Position-based room layout', confidence: 0.8, length: 4, possiblePositions: [6] },
  ISLAND: { method: 'Video analysis', confidence: 0.6, length: 6, possiblePositions: [8] },
  PLAY: { method: 'Hidden keyword', confidence: 0.5, length: 4, possiblePositions: [6] },
};
