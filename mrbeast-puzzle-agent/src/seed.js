/**
 * Seeds the database with all known clues, puzzles, and findings
 * gathered from community research.
 */

import {
  getDb, addClue, addPuzzle, addKeyword, setMetaClue, addVideo, addCipherAttempt
} from './db/database.js';

export function seedDatabase() {
  const db = getDb();

  console.log('Seeding database with known findings...');

  // --- META CLUE WORD LENGTHS ---
  const metaLengths = [5, 9, 5, 7, 8, 4, 9, 6, 5];
  metaLengths.forEach((len, i) => {
    setMetaClue(i + 1, null, len, null, 0);
  });

  // --- HIGH-CONFIDENCE DECODED WORDS ---
  // ENDGAME -> position 4 (7 letters)
  setMetaClue(4, 'ENDGAME', 7, null, 0.9);
  // HIDE -> position 6 (4 letters)
  setMetaClue(6, 'HIDE', 4, null, 0.7);

  // --- PUZZLES ---
  const puzzles = [
    // Layer 3: Reddit Variety Puzzles
    { name: 'Variety Puzzle 1', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 1', wordLength: 5, metaPosition: 1 },
    { name: 'Variety Puzzle 2', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 2', wordLength: 9, metaPosition: 2 },
    { name: 'Variety Puzzle 3', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 3. WARNING: Video 3 confirmed red herring troll acrostic.', wordLength: 5, metaPosition: 3 },
    { name: 'Variety Puzzle 4', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 4', wordLength: 7, metaPosition: 4 },
    { name: 'Variety Puzzle 5', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 5', wordLength: 8, metaPosition: 5 },
    { name: 'Variety Puzzle 6', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 6', wordLength: 4, metaPosition: 6 },
    { name: 'Variety Puzzle 7', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 7', wordLength: 9, metaPosition: 7 },
    { name: 'Variety Puzzle 8', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 8', wordLength: 6, metaPosition: 8 },
    { name: 'Variety Puzzle 9', type: 'variety', hub: 'reddit-playlist', layer: 3, description: 'From MrBeast video playlist position 9', wordLength: 5, metaPosition: 9 },

    // Layer 1: Super Bowl Ad - Street Scene
    { name: 'Street Scene Ciphers', type: 'cipher-collection', hub: 'super-bowl-ad', layer: 1, description: 'Street scene elements are cipher inputs. Look in all directions.', wordLength: null, metaPosition: null },
    { name: 'Barcode Puzzle', type: 'barcode', hub: 'super-bowl-ad', layer: 1, description: 'Barcode on armored tank with parking violation', wordLength: null, metaPosition: null },
    { name: 'Calendar Dates Puzzle', type: 'date-cipher', hub: 'super-bowl-ad', layer: 1, description: 'Teller has dates circled in red on desk calendars', wordLength: null, metaPosition: null },
    { name: 'QR Code Puzzle', type: 'qr', hub: 'super-bowl-ad', layer: 1, description: 'QR code from shipping containers in Nevada desert -> https://sforce.co/4bAAGMH?r=qr', wordLength: null, metaPosition: null },

    // Layer 2: Bank Scenes
    { name: 'Bank Interior Puzzles', type: 'multi-puzzle', hub: 'super-bowl-ad', layer: 2, description: 'Bank puzzles require street-scene answers as inputs', wordLength: null, metaPosition: null },
    { name: 'Vault Door Puzzle', type: 'code', hub: 'super-bowl-ad', layer: 2, description: 'Vault door shows 4-8-15-16-23-42 (Lost numbers, sum=108)', wordLength: null, metaPosition: null },

    // Crossword (Stage 2 gateway)
    { name: 'MrBeast Crossword', type: 'crossword', hub: 'crossword', layer: 0, description: 'Gift to Jimmy. 51st clue. Key to Stage 2. Clues fill in as progress is made.', wordLength: null, metaPosition: null },

    // LIFECHANGE Sudoku
    { name: 'LIFECHANGE Sudoku', type: 'sudoku-variant', hub: 'reddit-playlist', layer: 3, description: 'Sudoku using letters L,I,F,E,C,H,A,N,G instead of 1-9', wordLength: null, metaPosition: null },
  ];

  for (const p of puzzles) {
    addPuzzle(p);
  }

  // --- CLUES ---
  const clues = [
    { source: 'super-bowl-ad', layer: 1, rawContent: '3634826', decodedContent: 'ENDGAME (phone keypad T9)', cipherMethod: 'phone-keypad', confidence: 0.9, notes: 'Main code displayed prominently' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'Room layout 8,I,D,5=E', decodedContent: 'HIDE', cipherMethod: 'position-based', confidence: 0.8, notes: 'Room layout with position-based decode' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'Reaction counts 15,20,22', decodedContent: 'TOW', cipherMethod: 'index-into-text', confidence: 0.7, notes: 'Index into message text' },
    { source: 'super-bowl-ad', layer: 2, rawContent: 'Vault door: 4-8-15-16-23-42', decodedContent: 'Lost TV show numbers, sum=108', cipherMethod: 'reference', confidence: 0.95, notes: 'Direct Lost reference, sum is 108' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'T7 street marking', decodedContent: 'Y (7th letter of BARCLAY)', cipherMethod: 'letter-index', confidence: 0.7, notes: 'T=index into word, 7=position' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'Barclay Hotel: 103 W 4th St, Los Angeles, CA 90013', decodedContent: null, cipherMethod: null, confidence: 0.5, notes: 'Real location visible in 20+ frames' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'The Row DTLA: 777 S Alameda St', decodedContent: 'Triple-7s address', cipherMethod: null, confidence: 0.5, notes: '777 pattern significant?' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'Nevada desert QR code', decodedContent: 'https://sforce.co/4bAAGMH?r=qr', cipherMethod: 'qr-code', confidence: 0.95, notes: 'Built from shipping containers' },
    { source: 'super-bowl-ad', layer: 1, rawContent: 'GPS coordinate: 36.34826°N', decodedContent: 'Nevada desert location from number 3634826', cipherMethod: 'gps', confidence: 0.6, notes: 'Dual meaning of main code as GPS coord' },
    { source: 'video-3', layer: 3, rawContent: 'Extended acrostic message', decodedContent: 'this means nothing I just wanted to waste your time lol', cipherMethod: 'acrostic', confidence: 1.0, notes: 'CONFIRMED RED HERRING / TROLL' },
    { source: 'official-hint-1', layer: 0, rawContent: 'Some of these puzzles use codes you can find online', decodedContent: null, cipherMethod: null, confidence: 1.0, notes: 'Official hint from puzzle designers' },
    { source: 'official-hint-1', layer: 0, rawContent: 'Almost everything Jimmy passes by is a clue', decodedContent: null, cipherMethod: null, confidence: 1.0, notes: 'Official hint' },
    { source: 'official-hint-1', layer: 0, rawContent: 'You need specific content from the Super Bowl ad to solve anything in the bank', decodedContent: null, cipherMethod: null, confidence: 1.0, notes: 'Layer dependency: street -> bank' },
    { source: 'official-hint-1', layer: 0, rawContent: 'Each puzzle ends in a word, 9 words form a clue in order: 5,9,5,7,8,4,9,6,5', decodedContent: null, cipherMethod: null, confidence: 1.0, notes: 'Meta-clue structure' },
    { source: 'community', layer: 0, rawContent: '#secret-clue channel reference', decodedContent: null, cipherMethod: null, confidence: 0.5, notes: 'Found in video frames' },
    { source: 'community', layer: 0, rawContent: '@the1Mil Slack handle', decodedContent: null, cipherMethod: null, confidence: 0.5, notes: 'Possibly relevant Slack contact' },
    { source: 'community', layer: 0, rawContent: 'Talk Like A Pirate Day = Sept 19', decodedContent: '9/19 or 919?', cipherMethod: null, confidence: 0.4, notes: 'Date reference found in frames' },
  ];

  for (const c of clues) {
    addClue({
      source: c.source,
      sourceUrl: null,
      layer: c.layer,
      hub: null,
      puzzleIndex: null,
      rawContent: c.rawContent,
      decodedContent: c.decodedContent,
      cipherMethod: c.cipherMethod,
      confidence: c.confidence,
      notes: c.notes,
    });
  }

  // --- KEYWORDS ---
  const keywords = [
    { word: 'ISLAND', source: 'video-analysis', category: 'location', significance: 0.7 },
    { word: 'MALCOLM', source: 'video-analysis', category: 'person', significance: 0.5 },
    { word: 'INCREDIBLE', source: 'video-analysis', category: 'adjective', significance: 0.5 },
    { word: 'CANARY', source: 'video-analysis', category: 'animal/code', significance: 0.6 },
    { word: 'BIG GAME', source: 'video-analysis', category: 'event', significance: 0.6 },
    { word: 'RED HERRING', source: 'video-3', category: 'warning', significance: 0.9 },
    { word: 'PLAY', source: 'video-analysis', category: 'action', significance: 0.6 },
    { word: 'CLAY', source: 'video-analysis', category: 'material/name', significance: 0.5 },
    { word: 'MAYBELLE', source: 'video-analysis', category: 'name', significance: 0.5 },
    { word: 'OVERTIME', source: 'video-analysis', category: 'time', significance: 0.5 },
    { word: 'ENDGAME', source: 'phone-keypad-decode', category: 'decoded', significance: 0.9 },
    { word: 'HIDE', source: 'position-decode', category: 'decoded', significance: 0.8 },
    { word: 'BARCLAY', source: 'location', category: 'location', significance: 0.7 },
    { word: 'BEAST6000', source: 'video-analysis', category: 'code', significance: 0.6 },
    { word: 'LIFECHANGE', source: 'sudoku-puzzle', category: 'puzzle-set', significance: 0.8 },
    { word: 'TOW', source: 'index-decode', category: 'decoded', significance: 0.7 },
  ];

  for (const k of keywords) {
    addKeyword(k);
  }

  // --- VIDEOS ---
  const videos = [
    { title: 'Puzzle Playlist Video 1', url: 'https://youtube.com/playlist-video-1', playlistPosition: 1, frameCount: 769 },
    { title: 'Puzzle Playlist Video 2', url: 'https://youtube.com/playlist-video-2', playlistPosition: 2, frameCount: 1441 },
    { title: 'Puzzle Playlist Video 3 (Red Herring)', url: 'https://youtube.com/playlist-video-3', playlistPosition: 3, frameCount: 1234 },
    { title: 'Super Bowl Ad', url: 'https://youtube.com/superbowl-ad', playlistPosition: 4, frameCount: 3476 },
  ];

  for (const v of videos) {
    addVideo(v);
  }

  // --- CIPHER ATTEMPTS ---
  const attempts = [
    { clueId: 1, puzzleId: null, method: 'phone-keypad', input: '3634826', output: 'ENDGAME', success: true, notes: 'T9 decode of main number' },
    { clueId: 1, puzzleId: null, method: 'gps-coordinate', input: '3634826', output: '36.34826°N (Nevada desert)', success: true, notes: 'Dual meaning as GPS latitude' },
    { clueId: 2, puzzleId: null, method: 'position-based', input: 'Room layout 8,I,D,5', output: 'HIDE', success: true, notes: '8=H, I, D, 5=E' },
    { clueId: 3, puzzleId: null, method: 'index-into-text', input: '15,20,22', output: 'TOW', success: true, notes: 'Indexed into message text' },
    { clueId: 5, puzzleId: null, method: 'letter-index', input: 'T7 + BARCLAY', output: 'Y', success: true, notes: '7th letter of BARCLAY' },
  ];

  for (const a of attempts) {
    addCipherAttempt(a);
  }

  console.log('Database seeded successfully!');
  console.log(`  Puzzles: ${puzzles.length}`);
  console.log(`  Clues: ${clues.length}`);
  console.log(`  Keywords: ${keywords.length}`);
  console.log(`  Videos: ${videos.length}`);
  console.log(`  Cipher attempts: ${attempts.length}`);
}
