#!/usr/bin/env node

/**
 * MrBeast $1M Puzzle Agent — Main CLI
 *
 * An AI-powered tool for hunting, organizing, and solving the
 * MrBeast x Salesforce $1M Puzzle Hunt.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import {
  getDb, getAllClues, getUnsolvedPuzzles, getMetaClueProgress,
  getStats, addClue, searchKeywords, getPuzzlesByHub, updatePuzzleAnswer,
} from './db/database.js';
import { bruteForceAll, phoneKeypadDecode, caesarBruteForce, rot13, atbash, vigenereDecode, a1z26Decode, indexExtract, morseDecode } from './solvers/ciphers.js';
import { findAnagrams, patternMatch, crosswordSolve, findMetaCandidates, englishScore } from './solvers/wordSolver.js';
import { solveLetterSudoku } from './solvers/sudokuVariant.js';
import { getMetaState, submitMetaWord, validateMetaPhrase, analyzeKnownWords, KNOWN_DECODED } from './solvers/metaSolver.js';
import { detectNumberPatterns, detectTextPatterns, crossReference, SIGNIFICANT_NUMBERS, KEYWORD_MAP } from './analysis/patternDetector.js';
import { getAnalysisSummary, KNOWN_FINDINGS } from './analysis/frameAnalyzer.js';
import { fetchPage, scrapeAllSources, findPuzzleContent } from './scrapers/webScraper.js';
import { searchReddit, monitorSubreddits, extractCluesFromPosts } from './scrapers/socialScraper.js';
import { banner, sectionHeader, metaProgress, statsDisplay, clueDisplay, puzzleDisplay, resultTable, success, warning, error, info } from './utils/display.js';
import { seedDatabase } from './seed.js';

const program = new Command();

program
  .name('puzzle-agent')
  .description('MrBeast $1M Puzzle Hunt Agent — Hunt. Decode. Solve.')
  .version('1.0.0');

// ─── DASHBOARD ──────────────────────────────────────────────
program
  .command('dashboard')
  .alias('d')
  .description('Show the puzzle-solving dashboard')
  .action(() => {
    banner();
    const stats = getStats();
    statsDisplay(stats);
    const meta = getMetaState();
    metaProgress(meta);

    sectionHeader('KNOWN DECODED WORDS');
    for (const [word, data] of Object.entries(KNOWN_DECODED)) {
      console.log(`  ${chalk.bold.green(word)} — ${data.method} (${(data.confidence * 100).toFixed(0)}% confidence)`);
    }

    sectionHeader('SIGNIFICANT NUMBERS');
    for (const [num, data] of Object.entries(SIGNIFICANT_NUMBERS)) {
      console.log(`  ${chalk.bold(num)} — ${data.decoded}`);
    }
  });

// ─── SEED ───────────────────────────────────────────────────
program
  .command('seed')
  .description('Seed database with all known findings')
  .action(() => {
    seedDatabase();
  });

// ─── DECODE ─────────────────────────────────────────────────
program
  .command('decode <input>')
  .description('Try all cipher methods on input text')
  .option('-m, --method <method>', 'Specific cipher method')
  .option('-k, --key <key>', 'Key for keyed ciphers (Vigenere, etc.)')
  .action((input, options) => {
    banner();
    sectionHeader(`DECODING: "${input}"`);

    if (options.method) {
      let result;
      switch (options.method) {
        case 'phone': result = phoneKeypadDecode(input); break;
        case 'caesar': result = caesarBruteForce(input); break;
        case 'rot13': result = rot13(input); break;
        case 'atbash': result = atbash(input); break;
        case 'vigenere': result = vigenereDecode(input, options.key || 'BEAST'); break;
        case 'a1z26': result = a1z26Decode(input.split(',').map(Number)); break;
        case 'morse': result = morseDecode(input); break;
        default: error(`Unknown method: ${options.method}`); return;
      }
      console.log(`  Result: ${JSON.stringify(result, null, 2)}`);
    } else {
      const results = bruteForceAll(input);
      resultTable(
        ['Method', 'Result'],
        results.map(r => [r.method, r.result.slice(0, 60)])
      );
    }
  });

// ─── ANAGRAM ────────────────────────────────────────────────
program
  .command('anagram <letters>')
  .description('Find anagrams of given letters')
  .option('-l, --min-length <len>', 'Minimum word length', '3')
  .action((letters, options) => {
    banner();
    sectionHeader(`ANAGRAMS OF: "${letters}"`);
    const results = findAnagrams(letters, parseInt(options.minLength));
    if (results.length === 0) {
      warning('No anagrams found');
    } else {
      info(`Found ${results.length} anagrams (sorted by length):`);
      for (const word of results.slice(0, 50)) {
        console.log(`  ${chalk.green(word)} (${word.length} letters)`);
      }
      if (results.length > 50) {
        console.log(chalk.dim(`  ...and ${results.length - 50} more`));
      }
    }
  });

// ─── PATTERN ────────────────────────────────────────────────
program
  .command('pattern <pattern>')
  .description('Find words matching pattern (? = unknown letter)')
  .action((pattern) => {
    banner();
    sectionHeader(`WORDS MATCHING: "${pattern}"`);
    const results = crosswordSolve(pattern);
    if (results.length === 0) {
      warning('No matches found');
    } else {
      info(`Found ${results.length} matches:`);
      for (const word of results.slice(0, 30)) {
        console.log(`  ${chalk.green(word)}`);
      }
    }
  });

// ─── META ───────────────────────────────────────────────────
program
  .command('meta')
  .description('Show and manage the 9-word meta-clue')
  .option('-s, --submit <pos:word>', 'Submit a word (e.g., 4:ENDGAME)')
  .option('-v, --validate', 'Validate current phrase')
  .option('-a, --analyze', 'Analyze known words for meta fits')
  .action((options) => {
    banner();
    const state = getMetaState();
    metaProgress(state);

    if (options.submit) {
      const [pos, word] = options.submit.split(':');
      const result = submitMetaWord(parseInt(pos), word, null, 0.5);
      if (result.success) {
        success(`Submitted "${word}" at position ${pos}`);
      } else {
        error(result.error);
      }
    }

    if (options.validate) {
      const validation = validateMetaPhrase();
      sectionHeader('VALIDATION');
      console.log(`  Valid: ${validation.valid ? chalk.green('YES') : chalk.red('NO')}`);
      console.log(`  Phrase: ${validation.phrase}`);
      if (validation.englishScore !== undefined) {
        console.log(`  English score: ${(validation.englishScore * 100).toFixed(0)}%`);
      }
    }

    if (options.analyze) {
      sectionHeader('WORD-TO-POSITION ANALYSIS');
      const decoded = Object.keys(KNOWN_DECODED);
      const fits = analyzeKnownWords(decoded);
      for (const fit of fits) {
        console.log(`  ${chalk.bold(fit.word)} → position ${fit.position} (valid: ${fit.isValidWord ? chalk.green('yes') : chalk.red('no')})`);
      }
    }
  });

// ─── SCRAPE ─────────────────────────────────────────────────
program
  .command('scrape')
  .description('Scrape web sources for new clues')
  .option('-r, --reddit', 'Search Reddit')
  .option('-w, --web', 'Scrape known web sources')
  .option('-u, --url <url>', 'Scrape a specific URL')
  .action(async (options) => {
    banner();
    const spinner = ora('Scraping for clues...').start();

    try {
      if (options.reddit) {
        spinner.text = 'Searching Reddit...';
        const posts = await searchReddit();
        spinner.succeed(`Found ${posts.length} Reddit posts`);
        const clues = extractCluesFromPosts(posts);
        info(`Extracted ${clues.length} potential clues`);
        for (const clue of clues.slice(0, 10)) {
          console.log(`  ${chalk.dim(clue.source)}: ${chalk.yellow(clue.extracted)}`);
        }
      }

      if (options.web) {
        spinner.text = 'Scraping known sources...';
        const results = await scrapeAllSources();
        spinner.succeed(`Scraped ${results.length} sources`);
        for (const result of results) {
          if (result.error) {
            warning(`${result.name}: ${result.error}`);
          } else {
            const findings = findPuzzleContent(result);
            info(`${result.name}: ${findings.length} findings`);
          }
        }
      }

      if (options.url) {
        spinner.text = `Fetching ${options.url}...`;
        const page = await fetchPage(options.url);
        spinner.succeed('Page fetched');
        if (page.error) {
          error(page.error);
        } else {
          const findings = findPuzzleContent(page);
          sectionHeader('FINDINGS');
          info(`Title: ${page.title}`);
          info(`Links: ${page.links?.length || 0}`);
          info(`Images: ${page.images?.length || 0}`);
          info(`Hidden elements: ${page.hiddenElements?.length || 0}`);
          info(`Puzzle-relevant findings: ${findings.length}`);
          for (const f of findings.slice(0, 20)) {
            console.log(`  [${f.type}] ${JSON.stringify(f.content || f.matches || f.value).slice(0, 100)}`);
          }
        }
      }

      if (!options.reddit && !options.web && !options.url) {
        spinner.info('Specify --reddit, --web, or --url <url>');
      }
    } catch (err) {
      spinner.fail(err.message);
    }
  });

// ─── NUMBERS ────────────────────────────────────────────────
program
  .command('numbers <nums...>')
  .description('Analyze number sequences for patterns')
  .action((nums) => {
    banner();
    const numbers = nums.map(Number);
    sectionHeader(`ANALYZING: ${numbers.join(', ')}`);
    const patterns = detectNumberPatterns(numbers);
    if (patterns.length === 0) {
      warning('No patterns detected');
    } else {
      for (const p of patterns) {
        console.log(`  ${chalk.bold(p.type)}: ${JSON.stringify(p).slice(0, 100)}`);
      }
    }
  });

// ─── CLUES ──────────────────────────────────────────────────
program
  .command('clues')
  .description('List all collected clues')
  .option('-s, --status <status>', 'Filter by status (raw, decoded, verified)')
  .action((options) => {
    banner();
    sectionHeader('COLLECTED CLUES');
    const clues = getAllClues(options.status);
    if (clues.length === 0) {
      warning('No clues found. Run `puzzle-agent seed` first.');
    } else {
      for (const clue of clues) {
        clueDisplay(clue);
        console.log();
      }
    }
  });

// ─── PUZZLES ────────────────────────────────────────────────
program
  .command('puzzles')
  .description('List all tracked puzzles')
  .option('-h, --hub <hub>', 'Filter by hub')
  .option('-u, --unsolved', 'Show only unsolved')
  .action((options) => {
    banner();
    sectionHeader('TRACKED PUZZLES');
    let puzzles;
    if (options.hub) {
      puzzles = getPuzzlesByHub(options.hub);
    } else if (options.unsolved) {
      puzzles = getUnsolvedPuzzles();
    } else {
      puzzles = getDb().prepare('SELECT * FROM puzzles ORDER BY layer, hub, meta_position').all();
    }
    if (puzzles.length === 0) {
      warning('No puzzles found. Run `puzzle-agent seed` first.');
    } else {
      for (const puzzle of puzzles) {
        puzzleDisplay(puzzle);
        console.log();
      }
    }
  });

// ─── KEYWORDS ───────────────────────────────────────────────
program
  .command('keywords [search]')
  .description('Search or list keywords')
  .action((search) => {
    banner();
    sectionHeader('KEYWORDS');
    if (search) {
      const results = searchKeywords(search);
      for (const k of results) {
        console.log(`  ${chalk.bold(k.word)} [${k.category}] — significance: ${k.significance}`);
      }
    } else {
      sectionHeader('ALL KNOWN KEYWORDS');
      for (const [word, data] of Object.entries(KEYWORD_MAP)) {
        console.log(`  ${chalk.bold(word)} [${data.category}] — significance: ${data.significance}`);
      }
    }
  });

// ─── VIDEO ANALYSIS ─────────────────────────────────────────
program
  .command('videos')
  .description('Show video analysis summary')
  .action(() => {
    banner();
    const summary = getAnalysisSummary();

    sectionHeader('VIDEO ANALYSIS');
    info(`Completion: ${summary.meta.completionRate} (${summary.meta.totalFramesAnalyzed}/${summary.meta.totalFrames} frames)`);
    console.log();

    for (const video of summary.videos) {
      const statusColor = video.status === 'analyzed' ? chalk.green :
                          video.status === 'partial' ? chalk.yellow : chalk.dim;
      console.log(`  ${chalk.bold(`[${video.position}]`)} ${video.title} — ${statusColor(video.status)} ${video.frameCount ? `(${video.frameCount} frames)` : ''}`);
    }

    console.log();
    sectionHeader('KEY FINDINGS');
    for (const [source, data] of Object.entries(summary.findings)) {
      console.log(`  ${chalk.bold(source)} [${data.status}]`);
      for (const finding of data.findings) {
        console.log(`    ${chalk.dim('•')} ${finding}`);
      }
      console.log();
    }
  });

// ─── INTERACTIVE MODE ───────────────────────────────────────
program
  .command('interactive')
  .alias('i')
  .description('Interactive puzzle-solving session')
  .action(async () => {
    banner();
    info('Interactive puzzle-solving mode. Type "quit" to exit.\n');

    while (true) {
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View Dashboard', value: 'dashboard' },
          { name: 'Decode a clue', value: 'decode' },
          { name: 'Find anagrams', value: 'anagram' },
          { name: 'Pattern match (crossword)', value: 'pattern' },
          { name: 'Check meta-clue progress', value: 'meta' },
          { name: 'Submit meta word', value: 'submit-meta' },
          { name: 'Analyze numbers', value: 'numbers' },
          { name: 'View clues', value: 'clues' },
          { name: 'View puzzles', value: 'puzzles' },
          { name: 'Scrape Reddit', value: 'scrape-reddit' },
          { name: 'Video analysis summary', value: 'videos' },
          new inquirer.Separator(),
          { name: 'Quit', value: 'quit' },
        ],
      }]);

      if (action === 'quit') break;

      switch (action) {
        case 'dashboard': {
          const stats = getStats();
          statsDisplay(stats);
          const meta = getMetaState();
          metaProgress(meta);
          break;
        }
        case 'decode': {
          const { input } = await inquirer.prompt([{ type: 'input', name: 'input', message: 'Enter text/code to decode:' }]);
          const results = bruteForceAll(input);
          resultTable(['Method', 'Result'], results.map(r => [r.method, r.result.slice(0, 60)]));
          break;
        }
        case 'anagram': {
          const { letters } = await inquirer.prompt([{ type: 'input', name: 'letters', message: 'Enter letters:' }]);
          const results = findAnagrams(letters);
          for (const w of results.slice(0, 20)) console.log(`  ${chalk.green(w)}`);
          break;
        }
        case 'pattern': {
          const { pat } = await inquirer.prompt([{ type: 'input', name: 'pat', message: 'Enter pattern (? for unknown):' }]);
          const results = crosswordSolve(pat);
          for (const w of results.slice(0, 20)) console.log(`  ${chalk.green(w)}`);
          break;
        }
        case 'meta': {
          metaProgress(getMetaState());
          break;
        }
        case 'submit-meta': {
          const { pos } = await inquirer.prompt([{ type: 'number', name: 'pos', message: 'Position (1-9):' }]);
          const { word } = await inquirer.prompt([{ type: 'input', name: 'word', message: 'Word:' }]);
          const { conf } = await inquirer.prompt([{ type: 'number', name: 'conf', message: 'Confidence (0-1):', default: 0.5 }]);
          const result = submitMetaWord(pos, word, null, conf);
          result.success ? success(`Submitted "${word}"`) : error(result.error);
          break;
        }
        case 'numbers': {
          const { nums } = await inquirer.prompt([{ type: 'input', name: 'nums', message: 'Enter numbers (comma separated):' }]);
          const numbers = nums.split(',').map(n => parseInt(n.trim()));
          const patterns = detectNumberPatterns(numbers);
          for (const p of patterns) console.log(`  ${chalk.bold(p.type)}: ${JSON.stringify(p).slice(0, 100)}`);
          break;
        }
        case 'clues': {
          const clues = getAllClues();
          for (const c of clues.slice(0, 15)) { clueDisplay(c); console.log(); }
          break;
        }
        case 'puzzles': {
          const puzzles = getDb().prepare('SELECT * FROM puzzles ORDER BY layer, hub').all();
          for (const p of puzzles) { puzzleDisplay(p); console.log(); }
          break;
        }
        case 'scrape-reddit': {
          const spinner = ora('Searching Reddit...').start();
          try {
            const posts = await searchReddit();
            spinner.succeed(`Found ${posts.length} posts`);
            const clues = extractCluesFromPosts(posts);
            info(`Extracted ${clues.length} clues`);
            for (const c of clues.slice(0, 5)) console.log(`  ${chalk.yellow(c.extracted)}`);
          } catch (err) { spinner.fail(err.message); }
          break;
        }
        case 'videos': {
          const summary = getAnalysisSummary();
          info(`Completion: ${summary.meta.completionRate}`);
          for (const [src, data] of Object.entries(summary.findings)) {
            console.log(`\n  ${chalk.bold(src)}`);
            for (const f of data.findings) console.log(`    • ${f}`);
          }
          break;
        }
      }
      console.log();
    }
  });

// ─── ADD CLUE ───────────────────────────────────────────────
program
  .command('add-clue')
  .description('Manually add a new clue')
  .requiredOption('-s, --source <source>', 'Source of the clue')
  .requiredOption('-c, --content <content>', 'Raw clue content')
  .option('-d, --decoded <decoded>', 'Decoded content')
  .option('-m, --method <method>', 'Cipher method used')
  .option('--confidence <n>', 'Confidence 0-1', '0.5')
  .option('-n, --notes <notes>', 'Additional notes')
  .action((options) => {
    addClue({
      source: options.source,
      rawContent: options.content,
      decodedContent: options.decoded,
      cipherMethod: options.method,
      confidence: parseFloat(options.confidence),
      notes: options.notes,
    });
    success('Clue added!');
  });

// Parse and run
program.parse();

// If no command given, show dashboard
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
