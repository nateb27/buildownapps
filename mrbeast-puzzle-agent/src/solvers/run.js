#!/usr/bin/env node

/**
 * Solver runner: attempt to decode all raw clues and solve puzzles.
 */

import chalk from 'chalk';
import ora from 'ora';
import { getDb, getAllClues, getUnsolvedPuzzles, addCipherAttempt } from '../db/database.js';
import { bruteForceAll } from './ciphers.js';
import { isWord, englishScore } from './wordSolver.js';
import { getMetaState, analyzeKnownWords, KNOWN_DECODED, META_WORD_LENGTHS } from './metaSolver.js';
import { banner, sectionHeader, info, success, warning, resultTable } from '../utils/display.js';

function run() {
  banner();
  sectionHeader('SOLVER RUN');

  // 1. Try to decode all raw clues
  const rawClues = getAllClues('raw');
  info(`Processing ${rawClues.length} raw clues...`);

  let decoded = 0;
  for (const clue of rawClues) {
    const results = bruteForceAll(clue.raw_content);
    const promising = results.filter(r => {
      const text = r.result;
      // Check if result looks like English
      if (text.length < 3) return false;
      if (isWord(text)) return true;
      if (englishScore(text) > 0.5) return true;
      return false;
    });

    for (const p of promising) {
      addCipherAttempt({
        clueId: clue.id,
        puzzleId: null,
        method: p.method,
        input: clue.raw_content,
        output: p.result,
        success: true,
        notes: 'Auto-decoded by solver run',
      });

      // Update clue status
      getDb().prepare(`
        UPDATE clues SET status = 'decoded', decoded_content = ?, cipher_method = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'raw'
      `).run(p.result, p.method, clue.id);

      decoded++;
    }
  }

  success(`Decoded ${decoded} clues from ${rawClues.length} raw inputs`);

  // 2. Check all decoded words against meta positions
  sectionHeader('META-CLUE ANALYSIS');
  const allDecoded = getDb().prepare("SELECT DISTINCT decoded_content FROM clues WHERE decoded_content IS NOT NULL").all();
  const words = allDecoded.map(c => c.decoded_content).filter(Boolean);

  info(`Checking ${words.length} decoded words against meta positions...`);

  for (const word of words) {
    for (let i = 0; i < META_WORD_LENGTHS.length; i++) {
      if (word.length === META_WORD_LENGTHS[i] && isWord(word)) {
        console.log(`  ${chalk.green(word)} fits position ${i + 1} (${META_WORD_LENGTHS[i]} letters)`);
      }
    }
  }

  // 3. Show current meta state
  const meta = getMetaState();
  console.log(`\n  Current phrase: ${chalk.bold(meta.phrase)}`);
  console.log(`  Progress: ${meta.progress}`);

  // 4. Show unsolved puzzles
  sectionHeader('UNSOLVED PUZZLES');
  const unsolved = getUnsolvedPuzzles();
  info(`${unsolved.length} puzzles still unsolved`);
  for (const p of unsolved.slice(0, 10)) {
    console.log(`  ${chalk.dim(`#${p.id}`)} ${chalk.bold(p.name)} [${p.type || 'unknown'}]`);
  }

  success('Solver run complete!');
}

run();
