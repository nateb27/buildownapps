import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'puzzle.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_url TEXT,
      layer INTEGER,
      hub TEXT,
      puzzle_index INTEGER,
      raw_content TEXT NOT NULL,
      decoded_content TEXT,
      cipher_method TEXT,
      confidence REAL DEFAULT 0.0,
      status TEXT DEFAULT 'raw',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS puzzles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      hub TEXT,
      layer INTEGER,
      description TEXT,
      status TEXT DEFAULT 'unsolved',
      answer TEXT,
      answer_confidence REAL DEFAULT 0.0,
      word_length INTEGER,
      meta_position INTEGER,
      dependencies TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cipher_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_id INTEGER REFERENCES clues(id),
      puzzle_id INTEGER REFERENCES puzzles(id),
      method TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      success INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      playlist_position INTEGER,
      frame_count INTEGER,
      analysis_status TEXT DEFAULT 'pending',
      findings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      source TEXT,
      context TEXT,
      category TEXT,
      significance REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meta_clue (
      position INTEGER PRIMARY KEY,
      word TEXT,
      word_length INTEGER NOT NULL,
      source_puzzle_id INTEGER REFERENCES puzzles(id),
      confidence REAL DEFAULT 0.0
    );

    CREATE INDEX IF NOT EXISTS idx_clues_source ON clues(source);
    CREATE INDEX IF NOT EXISTS idx_clues_status ON clues(status);
    CREATE INDEX IF NOT EXISTS idx_puzzles_status ON puzzles(status);
    CREATE INDEX IF NOT EXISTS idx_puzzles_hub ON puzzles(hub);
    CREATE INDEX IF NOT EXISTS idx_keywords_word ON keywords(word);
  `);
}

export function addClue({ source, sourceUrl, layer, hub, puzzleIndex, rawContent, decodedContent, cipherMethod, confidence, notes }) {
  const stmt = getDb().prepare(`
    INSERT INTO clues (source, source_url, layer, hub, puzzle_index, raw_content, decoded_content, cipher_method, confidence, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(source, sourceUrl, layer, hub, puzzleIndex, rawContent, decodedContent, cipherMethod, confidence || 0, notes);
}

export function addPuzzle({ name, type, hub, layer, description, wordLength, metaPosition, dependencies, notes }) {
  const stmt = getDb().prepare(`
    INSERT INTO puzzles (name, type, hub, layer, description, word_length, meta_position, dependencies, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(name, type, hub, layer, description, wordLength, metaPosition, dependencies, notes);
}

export function updatePuzzleAnswer(puzzleId, answer, confidence) {
  const stmt = getDb().prepare(`
    UPDATE puzzles SET answer = ?, answer_confidence = ?, status = 'solved', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(answer, confidence, puzzleId);
}

export function addCipherAttempt({ clueId, puzzleId, method, input, output, success, notes }) {
  const stmt = getDb().prepare(`
    INSERT INTO cipher_attempts (clue_id, puzzle_id, method, input, output, success, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(clueId, puzzleId, method, input, output, success ? 1 : 0, notes);
}

export function addVideo({ title, url, playlistPosition, frameCount }) {
  const stmt = getDb().prepare(`
    INSERT OR IGNORE INTO videos (title, url, playlist_position, frame_count)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(title, url, playlistPosition, frameCount);
}

export function addKeyword({ word, source, context, category, significance }) {
  const stmt = getDb().prepare(`
    INSERT INTO keywords (word, source, context, category, significance)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(word, source, context, category, significance || 0.5);
}

export function setMetaClue(position, word, wordLength, sourcePuzzleId, confidence) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO meta_clue (position, word, word_length, source_puzzle_id, confidence)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(position, word, wordLength, sourcePuzzleId, confidence || 0);
}

export function getUnsolvedPuzzles() {
  return getDb().prepare('SELECT * FROM puzzles WHERE status != ?').all('solved');
}

export function getAllClues(status) {
  if (status) {
    return getDb().prepare('SELECT * FROM clues WHERE status = ?').all(status);
  }
  return getDb().prepare('SELECT * FROM clues ORDER BY created_at DESC').all();
}

export function getMetaClueProgress() {
  return getDb().prepare('SELECT * FROM meta_clue ORDER BY position').all();
}

export function getPuzzlesByHub(hub) {
  return getDb().prepare('SELECT * FROM puzzles WHERE hub = ?').all(hub);
}

export function searchKeywords(term) {
  return getDb().prepare('SELECT * FROM keywords WHERE word LIKE ?').all(`%${term}%`);
}

export function getStats() {
  const d = getDb();
  return {
    totalClues: d.prepare('SELECT COUNT(*) as c FROM clues').get().c,
    decodedClues: d.prepare("SELECT COUNT(*) as c FROM clues WHERE status = 'decoded'").get().c,
    totalPuzzles: d.prepare('SELECT COUNT(*) as c FROM puzzles').get().c,
    solvedPuzzles: d.prepare("SELECT COUNT(*) as c FROM puzzles WHERE status = 'solved'").get().c,
    metaWords: d.prepare('SELECT COUNT(*) as c FROM meta_clue WHERE word IS NOT NULL').get().c,
    cipherAttempts: d.prepare('SELECT COUNT(*) as c FROM cipher_attempts').get().c,
    keywords: d.prepare('SELECT COUNT(*) as c FROM keywords').get().c,
  };
}
