/**
 * Sudoku variant solver — supports letter-based sudoku
 * (e.g., using letters in "LIFECHANGE" instead of numbers 1-9)
 */

/**
 * Solve a letter-based sudoku puzzle
 * @param {string[][]} grid - 9x9 grid with letters or empty strings
 * @param {string} letterSet - The set of letters to use (e.g., "LIFECHANG")
 * Note: LIFECHANGE has 10 letters but E repeats, so unique = L,I,F,E,C,H,A,N,G = 9
 */
export function solveLetterSudoku(grid, letterSet) {
  const uniqueLetters = [...new Set(letterSet.toUpperCase().split(''))];
  if (uniqueLetters.length !== 9) {
    throw new Error(`Need exactly 9 unique letters, got ${uniqueLetters.length}: ${uniqueLetters.join('')}`);
  }

  // Map letters to digits 1-9
  const letterToDigit = {};
  const digitToLetter = {};
  uniqueLetters.forEach((letter, i) => {
    letterToDigit[letter] = i + 1;
    digitToLetter[i + 1] = letter;
  });

  // Convert grid to numeric
  const numGrid = grid.map(row =>
    row.map(cell => {
      if (!cell || cell === '' || cell === '.') return 0;
      return letterToDigit[cell.toUpperCase()] || 0;
    })
  );

  // Solve using backtracking
  if (solveSudoku(numGrid)) {
    // Convert back to letters
    return numGrid.map(row => row.map(n => digitToLetter[n] || '?'));
  }
  return null;
}

function solveSudoku(grid) {
  const empty = findEmpty(grid);
  if (!empty) return true; // Solved

  const [row, col] = empty;
  for (let num = 1; num <= 9; num++) {
    if (isValid(grid, row, col, num)) {
      grid[row][col] = num;
      if (solveSudoku(grid)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

function findEmpty(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function isValid(grid, row, col, num) {
  // Check row
  if (grid[row].includes(num)) return false;

  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

/**
 * Extract hidden message from a solved sudoku grid
 * Common extraction methods in puzzle hunts
 */
export function extractFromSudoku(solvedGrid, method, params) {
  switch (method) {
    case 'diagonal':
      return solvedGrid.map((row, i) => row[i]).join('');
    case 'anti-diagonal':
      return solvedGrid.map((row, i) => row[8 - i]).join('');
    case 'row':
      return solvedGrid[params.row].join('');
    case 'column':
      return solvedGrid.map(row => row[params.col]).join('');
    case 'positions':
      return params.positions.map(([r, c]) => solvedGrid[r][c]).join('');
    case 'highlighted':
      // Extract letters from highlighted/shaded cells
      return params.cells.map(([r, c]) => solvedGrid[r][c]).join('');
    default:
      return '';
  }
}
