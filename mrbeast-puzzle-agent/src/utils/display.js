/**
 * Display utilities for the CLI interface.
 */

import chalk from 'chalk';

export function banner() {
  console.log(chalk.bold.yellow(`
 ╔══════════════════════════════════════════════════════╗
 ║   MrBeast $1M Puzzle Agent                          ║
 ║   Powered by AI • Hunt. Decode. Solve.              ║
 ╚══════════════════════════════════════════════════════╝
  `));
}

export function sectionHeader(title) {
  console.log('\n' + chalk.bold.cyan(`━━━ ${title} ━━━`));
}

export function metaProgress(metaState) {
  sectionHeader('META-CLUE PROGRESS');
  console.log(chalk.dim(`  Progress: ${metaState.progress} (${metaState.percentComplete})`));
  console.log();

  for (const word of metaState.words) {
    const pos = chalk.dim(`[${word.position}]`);
    const len = chalk.dim(`(${word.requiredLength} letters)`);
    if (word.word) {
      const conf = word.confidence >= 0.8 ? chalk.green : word.confidence >= 0.5 ? chalk.yellow : chalk.red;
      console.log(`  ${pos} ${chalk.bold.green(word.word)} ${len} ${conf(`${(word.confidence * 100).toFixed(0)}%`)}`);
    } else {
      console.log(`  ${pos} ${chalk.dim(word.pattern)} ${len}`);
    }
  }

  console.log();
  console.log(chalk.bold(`  Phrase: `) + metaState.phrase);
}

export function statsDisplay(stats) {
  sectionHeader('DATABASE STATS');
  const entries = [
    ['Clues collected', stats.totalClues],
    ['Clues decoded', stats.decodedClues],
    ['Puzzles tracked', stats.totalPuzzles],
    ['Puzzles solved', stats.solvedPuzzles],
    ['Meta words found', stats.metaWords],
    ['Cipher attempts', stats.cipherAttempts],
    ['Keywords indexed', stats.keywords],
  ];

  for (const [label, value] of entries) {
    const color = value > 0 ? chalk.green : chalk.dim;
    console.log(`  ${chalk.dim(label + ':')} ${color(value)}`);
  }
}

export function clueDisplay(clue) {
  const status = clue.status === 'decoded' ? chalk.green('DECODED') :
                 clue.status === 'raw' ? chalk.yellow('RAW') :
                 chalk.dim(clue.status);
  console.log(`  ${chalk.dim(`#${clue.id}`)} [${status}] ${chalk.bold(clue.raw_content?.slice(0, 80))}`);
  if (clue.decoded_content) {
    console.log(`    ${chalk.green('→')} ${clue.decoded_content}`);
  }
  if (clue.cipher_method) {
    console.log(`    ${chalk.dim('Method:')} ${clue.cipher_method}`);
  }
  console.log(`    ${chalk.dim('Source:')} ${clue.source}`);
}

export function puzzleDisplay(puzzle) {
  const status = puzzle.status === 'solved' ? chalk.green('SOLVED') :
                 puzzle.status === 'in-progress' ? chalk.yellow('IN PROGRESS') :
                 chalk.red('UNSOLVED');
  console.log(`  ${chalk.dim(`#${puzzle.id}`)} [${status}] ${chalk.bold(puzzle.name)}`);
  if (puzzle.type) console.log(`    ${chalk.dim('Type:')} ${puzzle.type}`);
  if (puzzle.hub) console.log(`    ${chalk.dim('Hub:')} ${puzzle.hub}`);
  if (puzzle.answer) console.log(`    ${chalk.green('Answer:')} ${puzzle.answer} (${(puzzle.answer_confidence * 100).toFixed(0)}%)`);
  if (puzzle.description) console.log(`    ${chalk.dim(puzzle.description.slice(0, 100))}`);
}

export function resultTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxData = Math.max(...rows.map(r => String(r[i] || '').length));
    return Math.max(h.length, maxData) + 2;
  });

  // Header
  console.log(chalk.bold(headers.map((h, i) => h.padEnd(colWidths[i])).join('')));
  console.log(chalk.dim('─'.repeat(colWidths.reduce((a, b) => a + b, 0))));

  // Rows
  for (const row of rows) {
    console.log(row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join(''));
  }
}

export function success(msg) { console.log(chalk.green(`  ✓ ${msg}`)); }
export function warning(msg) { console.log(chalk.yellow(`  ⚠ ${msg}`)); }
export function error(msg) { console.log(chalk.red(`  ✗ ${msg}`)); }
export function info(msg) { console.log(chalk.blue(`  ℹ ${msg}`)); }
